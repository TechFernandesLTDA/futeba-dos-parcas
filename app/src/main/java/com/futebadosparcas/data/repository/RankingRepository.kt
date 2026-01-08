package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.*
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.tasks.await
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.WeekFields
import java.util.*
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Tipos de categoria para ranking.
 */
enum class RankingCategory(val displayName: String, val field: String) {
    GOALS("Artilheiros", "totalGoals"),
    ASSISTS("Assistencias", "totalAssists"),
    SAVES("Defesas", "totalSaves"),
    MVP("Craques", "bestPlayerCount"),
    XP("XP", "experience_points"),
    GAMES("Participacao", "totalGames"),
    WINS("Vitorias", "gamesWon")
}

/**
 * Tipos de periodo para ranking.
 */
enum class RankingPeriod(val displayName: String, val minGames: Int) {
    WEEK("Semana", 2),
    MONTH("Mes", 4),
    YEAR("Ano", 20),
    ALL_TIME("Historico", 10)
}

/**
 * Repository para consultar rankings.
 *
 * OTIMIZACAO N+1: Este repositorio utiliza um cache em memoria (LRU) para armazenar
 * dados de usuarios (nome, foto, nivel). Isso evita multiplas queries ao Firestore
 * quando os mesmos usuarios aparecem em diferentes rankings ou em atualizacoes consecutivas.
 *
 * Alternativa futura: Desnormalizar nome/foto diretamente no documento de statistics
 * para eliminar completamente a necessidade de joins. Isso requereria Cloud Functions
 * para manter os dados sincronizados quando o usuario atualiza seu perfil.
 *
 * Performance:
 * - Antes: N queries por ranking (1 por usuario)
 * - Agora: Cache hit = 0 queries, Cache miss = requisicoes em batch paralelo
 */
@Singleton
class RankingRepository @Inject constructor(
    private val firestore: FirebaseFirestore
) {
    companion object {
        private const val TAG = "RankingRepository"
        private const val CHUNK_SIZE = 10 // Firestore whereIn limit
        private const val USER_CACHE_MAX_SIZE = 200 // Maximo de usuarios em cache
        private const val USER_CACHE_TTL_MS = 5 * 60 * 1000L // 5 minutos de TTL
    }

    private val statisticsCollection = firestore.collection("statistics")
    private val usersCollection = firestore.collection("users")
    private val rankingsCollection = firestore.collection("rankings")
    private val rankingDeltasCollection = firestore.collection("ranking_deltas")
    private val xpLogsCollection = firestore.collection("xp_logs")

    /**
     * Cache LRU de usuarios com TTL para evitar queries N+1.
     * Armazena dados basicos (nome, foto, nivel) que sao frequentemente acessados.
     */
    private data class CachedUser(
        val user: User,
        val cachedAt: Long = System.currentTimeMillis()
    ) {
        fun isExpired(): Boolean = System.currentTimeMillis() - cachedAt > USER_CACHE_TTL_MS
    }

    private val userCache = object : LinkedHashMap<String, CachedUser>(USER_CACHE_MAX_SIZE, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, CachedUser>?): Boolean {
            return size > USER_CACHE_MAX_SIZE
        }
    }

    /**
     * Busca ranking de uma categoria (all-time).
     * Usa a colecao statistics diretamente.
     */
    suspend fun getRanking(
        category: RankingCategory,
        limit: Int = 50
    ): Result<List<com.futebadosparcas.ui.statistics.PlayerRankingItem>> {
        return try {
            val snapshot = if (category == RankingCategory.XP) {
                usersCollection
                    .orderBy(category.field, Query.Direction.DESCENDING)
                    .limit(limit.toLong())
                    .get()
                    .await()
            } else {
                statisticsCollection
                    .orderBy(category.field, Query.Direction.DESCENDING)
                    .limit(limit.toLong())
                    .get()
                    .await()
            }

            // Se for XP, os resultados vem de User. Se for outros, vem de UserStatistics.
            val entries = mutableListOf<com.futebadosparcas.ui.statistics.PlayerRankingItem>()

            if (category == RankingCategory.XP) {
                val users = snapshot.documents.mapNotNull { it.toObject(User::class.java) }
                users.forEachIndexed { index, user ->
                    entries.add(
                        com.futebadosparcas.ui.statistics.PlayerRankingItem(
                            rank = index + 1,
                            userId = user.id,
                            playerName = user.name,
                            nickname = user.nickname,
                            photoUrl = user.photoUrl,
                            value = user.experiencePoints,
                            gamesPlayed = 0, // Precisariamos buscar stats se quisermos preencher aqui
                            average = 0.0,
                            level = user.level
                        )
                    )
                }
            } else {
                val stats = snapshot.documents.mapNotNull { it.toObject(UserStatistics::class.java) }
                val userIds = stats.map { it.id }
                val usersMap = fetchUserDataParallel(userIds)

                stats.forEachIndexed { index, stat ->
                    val user = usersMap[stat.id]
                    val value = getStatValue(stat, category)
                    entries.add(
                        com.futebadosparcas.ui.statistics.PlayerRankingItem(
                            rank = index + 1,
                            userId = stat.id,
                            playerName = user?.name ?: "Jogador",
                            nickname = user?.nickname,
                            photoUrl = user?.photoUrl,
                            value = value.toLong(),
                            gamesPlayed = stat.totalGames,
                            average = if (stat.totalGames > 0) value.toDouble() / stat.totalGames else 0.0,
                            level = user?.level ?: 0
                        )
                    )
                }
            }

            Result.success(entries)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar ranking $category", e)
            Result.failure(e)
        }
    }

    /**
     * Busca ranking por periodo (usando deltas).
     */
    suspend fun getRankingByPeriod(
        category: RankingCategory,
        period: RankingPeriod,
        limit: Int = 50
    ): Result<List<com.futebadosparcas.ui.statistics.PlayerRankingItem>> {
        return try {
            val periodKey = when (period) {
                RankingPeriod.WEEK -> getCurrentWeekKey()
                RankingPeriod.MONTH -> getCurrentMonthKey()
                RankingPeriod.YEAR -> getCurrentYearKey()
                RankingPeriod.ALL_TIME -> return getRanking(category, limit)
            }

            val periodName = when (period) {
                RankingPeriod.WEEK -> "week"
                RankingPeriod.MONTH -> "month"
                RankingPeriod.YEAR -> "year"
                else -> "alltime"
            }

            val deltaField = when (category) {
                RankingCategory.GOALS -> "goals_added"
                RankingCategory.ASSISTS -> "assists_added"
                RankingCategory.SAVES -> "saves_added"
                RankingCategory.XP -> "xp_added"
                RankingCategory.GAMES -> "games_added"
                RankingCategory.WINS -> "wins_added"
                RankingCategory.MVP -> "mvp_added"
            }

            val snapshot = rankingDeltasCollection
                .whereEqualTo("period", periodName)
                .whereEqualTo("period_key", periodKey)
                .orderBy(deltaField, Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val deltas = snapshot.documents.mapNotNull { doc ->
                val userId = doc.getString("user_id") ?: return@mapNotNull null
                val value = doc.getLong(deltaField) ?: 0L
                val games = doc.getLong("games_added")?.toInt() ?: 0
                Triple(userId, value, games)
            }

            // Filtrar por minimo de jogos
            val filteredDeltas = deltas.filter { it.third >= period.minGames }

            // Buscar dados dos usuarios em paralelo
            val userIds = filteredDeltas.map { it.first }
            val usersMap = fetchUserDataParallel(userIds)

            val entries = filteredDeltas.mapIndexed { index, (userId, value, games) ->
                val user = usersMap[userId]
                com.futebadosparcas.ui.statistics.PlayerRankingItem(
                    rank = index + 1,
                    userId = userId,
                    playerName = user?.name ?: "Jogador",
                    nickname = user?.nickname,
                    photoUrl = user?.photoUrl,
                    value = value,
                    gamesPlayed = games,
                    average = if (games > 0) value.toDouble() / games else 0.0,
                    level = user?.level ?: 0
                )
            }

            Result.success(entries)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar ranking $category para $period", e)
            Result.failure(e)
        }
    }

    /**
     * Busca posicao do usuario em um ranking.
     */
    suspend fun getUserPosition(
        userId: String,
        category: RankingCategory,
        period: RankingPeriod = RankingPeriod.ALL_TIME
    ): Result<Int> {
        return try {
            val ranking = if (period == RankingPeriod.ALL_TIME) {
                getRanking(category, 1000)
            } else {
                getRankingByPeriod(category, period, 1000)
            }

            if (ranking.isFailure) {
                return Result.failure(ranking.exceptionOrNull()!!)
            }

            val position = ranking.getOrNull()?.indexOfFirst { it.userId == userId }
            Result.success(if (position != null && position >= 0) position + 1 else 0)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Busca historico de XP do usuario.
     */
    suspend fun getUserXpHistory(
        userId: String,
        limit: Int = 30
    ): Result<List<XpLog>> {
        return try {
            val snapshot = xpLogsCollection
                .whereEqualTo("user_id", userId)
                .orderBy("created_at", Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val logs = snapshot.toObjects(XpLog::class.java)
            Result.success(logs)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar historico de XP", e)
            Result.failure(e)
        }
    }

    /**
     * Busca evolucao de XP por periodo (para graficos).
     */
    suspend fun getXpEvolution(
        userId: String,
        months: Int = 6
    ): Result<Map<String, Long>> {
        return try {
            val startDate = LocalDate.now().minusMonths(months.toLong())
            val startTimestamp = java.util.Date.from(startDate.atStartOfDay(java.time.ZoneId.systemDefault()).toInstant())

            val snapshot = xpLogsCollection
                .whereEqualTo("user_id", userId)
                .whereGreaterThan("created_at", startTimestamp)
                .orderBy("created_at", Query.Direction.ASCENDING)
                .get()
                .await()

            val logs = snapshot.toObjects(XpLog::class.java)

            // Agrupar por mes
            val formatter = DateTimeFormatter.ofPattern("MM/yyyy")
            val grouped = logs.groupBy { log ->
                log.createdAt?.let {
                    it.toInstant().atZone(java.time.ZoneId.systemDefault()).toLocalDate().format(formatter)
                } ?: "N/A"
            }.mapValues { (_, logsInMonth) ->
                logsInMonth.sumOf { it.xpEarned }
            }

            Result.success(grouped)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar evolucao de XP", e)
            Result.failure(e)
        }
    }

    /**
     * Busca dados complementares dos usuarios em PARALELO com CACHE.
     *
     * OTIMIZACAO N+1: Utiliza cache LRU em memoria para evitar queries repetidas.
     * Apenas usuarios nao encontrados no cache (ou com cache expirado) sao buscados.
     *
     * Performance:
     * - Cache hit total: 0 queries ao Firestore
     * - Cache miss parcial: apenas usuarios faltantes sao buscados em batch paralelo
     * - Antes: 100 usuarios = 10 chunks * ~1s cada = 10s
     * - Agora com cache: 100 usuarios (todos em cache) = 0s
     * - Agora sem cache: 100 usuarios = 10 chunks em paralelo = ~1s total
     */
    private suspend fun fetchUserDataParallel(userIds: List<String>): Map<String, User> {
        if (userIds.isEmpty()) return emptyMap()

        val result = mutableMapOf<String, User>()
        val idsToFetch = mutableListOf<String>()

        // 1. Verificar cache primeiro (cache hit)
        synchronized(userCache) {
            for (userId in userIds) {
                val cached = userCache[userId]
                if (cached != null && !cached.isExpired()) {
                    result[userId] = cached.user
                } else {
                    // Remover do cache se expirado
                    if (cached?.isExpired() == true) {
                        userCache.remove(userId)
                    }
                    idsToFetch.add(userId)
                }
            }
        }

        AppLogger.d(TAG) { "fetchUserDataParallel: ${result.size} cache hits, ${idsToFetch.size} cache misses" }

        // 2. Se todos estavam no cache, retornar direto
        if (idsToFetch.isEmpty()) {
            return result
        }

        // 3. Buscar usuarios faltantes em paralelo
        return try {
            coroutineScope {
                // Criar requisicoes paralelas para cada chunk
                val deferredResults = idsToFetch.chunked(CHUNK_SIZE).map { chunk ->
                    async {
                        try {
                            usersCollection
                                .whereIn(com.google.firebase.firestore.FieldPath.documentId(), chunk)
                                .get()
                                .await()
                                .documents
                                .mapNotNull { doc ->
                                    doc.toObject(User::class.java)?.let { user ->
                                        user.id to user
                                    }
                                }
                        } catch (e: Exception) {
                            AppLogger.e(TAG, "Erro ao buscar chunk de usuarios", e)
                            emptyList()
                        }
                    }
                }

                // Aguardar todas as requisicoes e combinar resultados
                val fetchedUsers = deferredResults.awaitAll().flatten().toMap()

                // 4. Atualizar cache com usuarios buscados
                synchronized(userCache) {
                    fetchedUsers.forEach { (userId, user) ->
                        userCache[userId] = CachedUser(user)
                    }
                }

                // 5. Combinar cache hits com usuarios buscados
                result.putAll(fetchedUsers)
                result
            }
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar dados de usuarios em paralelo", e)
            result // Retorna pelo menos os que estavam no cache
        }
    }

    /**
     * Limpa o cache de usuarios.
     * Util para forcar atualizacao apos mudancas de perfil.
     */
    fun clearUserCache() {
        synchronized(userCache) {
            userCache.clear()
        }
        AppLogger.d(TAG) { "Cache de usuarios limpo" }
    }

    /**
     * Remove um usuario especifico do cache.
     * Util quando sabemos que um usuario foi atualizado.
     */
    fun invalidateUserCache(userId: String) {
        synchronized(userCache) {
            userCache.remove(userId)
        }
    }

    private fun getStatValue(stats: UserStatistics, category: RankingCategory): Int {
        return when (category) {
            RankingCategory.GOALS -> stats.totalGoals
            RankingCategory.ASSISTS -> stats.totalAssists
            RankingCategory.SAVES -> stats.totalSaves
            RankingCategory.MVP -> stats.bestPlayerCount
            RankingCategory.GAMES -> stats.totalGames
            RankingCategory.WINS -> stats.gamesWon
            RankingCategory.XP -> 0 // XP vem do user, nao de stats
        }
    }

    private fun getCurrentWeekKey(): String {
        val now = LocalDate.now()
        val weekFields = WeekFields.of(Locale.getDefault())
        val weekNumber = now.get(weekFields.weekOfWeekBasedYear())
        return "${now.year}-W${weekNumber.toString().padStart(2, '0')}"
    }

    private fun getCurrentMonthKey(): String {
        return LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM"))
    }

    private fun getCurrentYearKey(): String {
        return LocalDate.now().year.toString()
    }
}
