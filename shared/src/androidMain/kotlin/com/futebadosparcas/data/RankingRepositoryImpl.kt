package com.futebadosparcas.data

import com.futebadosparcas.domain.model.PlayerRankingItem
import com.futebadosparcas.domain.model.RankingCategory
import com.futebadosparcas.domain.model.RankingPeriod
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.model.XpEvolution
import com.futebadosparcas.domain.model.XpLog
import com.futebadosparcas.domain.repository.RankingRepository
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import java.text.SimpleDateFormat
import java.util.*
import kotlinx.datetime.Clock

// Removido import desnecessário - coroutineScope ainda é usado no fetchUserDataParallel

/**
 * Implementação Android do RankingRepository.
 *
 * Utiliza cache LRU para otimizar queries de usuários e evitar problemas N+1.
 * Cache com TTL de 5 minutos e limite máximo de 200 entradas.
 *
 * Performance:
 * - Cache hit: 0 queries ao Firestore
 * - Cache miss: Batch paralelo de queries em chunks de 10
 */
class RankingRepositoryImpl(
    private val firebaseDataSource: FirebaseDataSource
) : RankingRepository {

    companion object {
        private const val USER_CACHE_MAX_SIZE = 200
        private const val USER_CACHE_TTL_MS = 5 * 60 * 1000L // 5 minutos
        private const val TAG = "RankingRepositoryImpl"
    }

    /**
     * Cache LRU de usuários com TTL.
     */
    private data class CachedUser(
        val user: User,
        val cachedAt: Long = Clock.System.now().toEpochMilliseconds()
    ) {
        fun isExpired(): Boolean = Clock.System.now().toEpochMilliseconds() - cachedAt > USER_CACHE_TTL_MS
    }

    // Cache LRU manual - compatível com KMP
    private val userCache = mutableMapOf<String, CachedUser>()

    private fun putInCache(userId: String, user: User) {
        userCache[userId] = CachedUser(user)
        // LRU manual: remover entrada mais antiga se exceder limite
        if (userCache.size > USER_CACHE_MAX_SIZE) {
            val oldestKey = userCache.entries.minByOrNull { it.value.cachedAt }?.key
            if (oldestKey != null) {
                userCache.remove(oldestKey)
            }
        }
    }

    override suspend fun getRanking(
        category: RankingCategory,
        limit: Int
    ): Result<List<PlayerRankingItem>> {
        return try {
            val results = firebaseDataSource.getRankingByCategory(
                category = category.name,
                field = category.field,
                limit = limit
            )

            if (results.isFailure) {
                return Result.failure(results.exceptionOrNull() ?: Exception("Erro ao buscar ranking"))
            }

            val rankingData = results.getOrNull() ?: emptyList()
            val userIds = rankingData.map { it.first }

            // Buscar dados dos usuários em paralelo
            val usersMap = fetchUserDataParallel(userIds)

            val entries = rankingData.mapIndexed { index, (userId, value, games) ->
                val user = usersMap[userId]
                PlayerRankingItem(
                    rank = index + 1,
                    userId = userId,
                    playerName = user?.name ?: "Jogador",
                    value = value,
                    photoUrl = user?.photoUrl,
                    gamesPlayed = games,
                    average = if (games > 0) value.toDouble() / games else 0.0,
                    nickname = user?.nickname,
                    level = user?.level ?: 0
                )
            }

            Result.success(entries)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getRankingByPeriod(
        category: RankingCategory,
        period: RankingPeriod,
        limit: Int
    ): Result<List<PlayerRankingItem>> {
        return try {
            // ALL_TIME usa o método normal
            if (period == RankingPeriod.ALL_TIME) {
                return getRanking(category, limit)
            }

            val periodKey = when (period) {
                RankingPeriod.WEEK -> getCurrentWeekKey()
                RankingPeriod.MONTH -> getCurrentMonthKey()
                RankingPeriod.YEAR -> getCurrentYearKey()
                else -> return getRanking(category, limit)
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

            val results = firebaseDataSource.getRankingDeltas(
                periodName = periodName,
                periodKey = periodKey,
                deltaField = deltaField,
                minGames = period.minGames,
                limit = limit
            )

            if (results.isFailure) {
                return Result.failure(results.exceptionOrNull() ?: Exception("Erro ao buscar ranking por periodo"))
            }

            val deltas = results.getOrNull() ?: emptyList()
            val userIds = deltas.map { it.first }
            val usersMap = fetchUserDataParallel(userIds)

            val entries = deltas.mapIndexed { index, (userId, value, games) ->
                val user = usersMap[userId]
                PlayerRankingItem(
                    rank = index + 1,
                    userId = userId,
                    playerName = user?.name ?: "Jogador",
                    value = value,
                    photoUrl = user?.photoUrl,
                    gamesPlayed = games,
                    average = if (games > 0) value.toDouble() / games else 0.0,
                    nickname = user?.nickname,
                    level = user?.level ?: 0
                )
            }

            Result.success(entries)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getUserPosition(
        userId: String,
        category: RankingCategory,
        period: RankingPeriod
    ): Result<Int> {
        return try {
            val ranking = if (period == RankingPeriod.ALL_TIME) {
                getRanking(category, 1000)
            } else {
                getRankingByPeriod(category, period, 1000)
            }

            if (ranking.isFailure) {
                return Result.failure(ranking.exceptionOrNull() ?: Exception("Erro ao buscar posição no ranking"))
            }

            val position = ranking.getOrNull()?.indexOfFirst { it.userId == userId }
            Result.success(if (position != null && position >= 0) position + 1 else 0)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getUserXpHistory(
        userId: String,
        limit: Int
    ): Result<List<XpLog>> {
        return try {
            firebaseDataSource.getUserXpLogs(userId, limit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getXpEvolution(
        userId: String,
        months: Int
    ): Result<XpEvolution> {
        return try {
            // Calcular data de início usando Calendar (API 24 compatível)
            val startCalendar = Calendar.getInstance().apply {
                add(Calendar.MONTH, -months)
                set(Calendar.DAY_OF_MONTH, 1)
                set(Calendar.HOUR_OF_DAY, 0)
                set(Calendar.MINUTE, 0)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
            }
            val startTimestamp = startCalendar.timeInMillis

            // Buscar logs de XP no período
            val logsResult = firebaseDataSource.getUserXpLogs(userId, 500)
            if (logsResult.isFailure) {
                return Result.failure(logsResult.exceptionOrNull() ?: Exception("Erro ao buscar logs de XP"))
            }

            val logs = logsResult.getOrNull()
                ?.filter { it.createdAt != null && it.createdAt >= startTimestamp }
                ?: emptyList()

            // Agrupar por mês usando SimpleDateFormat (API 24 compatível)
            val formatter = SimpleDateFormat("MM/yyyy", Locale.getDefault())
            val monthlyXp = logs.groupBy { log ->
                log.createdAt?.let {
                    formatter.format(Date(it))
                } ?: "N/A"
            }.mapValues { (_, logsInMonth) ->
                logsInMonth.sumOf { it.xpEarned }
            }

            // Buscar usuário atual para XP total
            val userResult = firebaseDataSource.getUserById(userId)
            if (userResult.isFailure) {
                return Result.failure(userResult.exceptionOrNull() ?: Exception("Erro ao buscar dados do usuário"))
            }

            val user = userResult.getOrNull()

            Result.success(
                XpEvolution(
                    userId = userId,
                    monthlyXp = monthlyXp,
                    totalXp = user?.experiencePoints ?: 0L,
                    currentLevel = user?.level ?: 1,
                    lastUpdate = System.currentTimeMillis()
                )
            )
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun clearUserCache() {
        synchronized(userCache) {
            userCache.clear()
        }
    }

    override fun invalidateUserCache(userId: String) {
        synchronized(userCache) {
            userCache.remove(userId)
        }
    }

    override suspend fun getTopRankings(
        categories: List<RankingCategory>,
        limit: Int
    ): Result<Map<RankingCategory, List<PlayerRankingItem>>> {
        return try {
            val rankingResults = categories.map { category ->
                category to (getRanking(category, limit).getOrNull() ?: emptyList())
            }

            Result.success(rankingResults.toMap())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getDashboardRankings(): Result<Map<RankingCategory, List<PlayerRankingItem>>> {
        return getTopRankings(
            categories = listOf(
                RankingCategory.GOALS,
                RankingCategory.ASSISTS,
                RankingCategory.SAVES,
                RankingCategory.MVP
            ),
            limit = 3
        )
    }

    override suspend fun getUsersRankingsComparison(
        userIds: List<String>
    ): Result<Map<String, PlayerRankingItem>> {
        return try {
            if (userIds.isEmpty()) {
                return Result.success(emptyMap())
            }

            // Buscar estatísticas dos usuários
            val statsResult = firebaseDataSource.getUsersStatistics(userIds)
            if (statsResult.isFailure) {
                return Result.failure(statsResult.exceptionOrNull() ?: Exception("Erro ao buscar estatísticas"))
            }

            val statsMap = statsResult.getOrNull() ?: emptyMap()
            val usersMap = fetchUserDataParallel(userIds)

            // Criar ranking de participação (total de jogos)
            val comparison = userIds.mapNotNull { userId ->
                val stats = statsMap[userId]
                val user = usersMap[userId]
                if (stats != null && user != null) {
                    userId to PlayerRankingItem(
                        rank = 0, // Não é um ranking real
                        userId = userId,
                        playerName = user.name,
                        value = stats.totalGoals.toLong(),
                        photoUrl = user.photoUrl,
                        gamesPlayed = stats.totalGames,
                        average = stats.avgGoalsPerGame.toDouble(),
                        nickname = user.nickname,
                        level = user.level
                    )
                } else null
            }.toMap()

            Result.success(comparison)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Busca dados de usuários em paralelo com cache LRU.
     *
     * Otimização N+1: Utiliza cache para evitar queries repetidas.
     * Apenas usuários não encontrados no cache são buscados no Firestore.
     */
    private suspend fun fetchUserDataParallel(userIds: List<String>): Map<String, User> {
        if (userIds.isEmpty()) return emptyMap()

        val result = mutableMapOf<String, User>()
        val idsToFetch = mutableListOf<String>()

        // 1. Verificar cache primeiro
        for (userId in userIds) {
            val cached = userCache[userId]
            if (cached != null && !cached.isExpired()) {
                result[userId] = cached.user
            } else {
                if (cached?.isExpired() == true) {
                    userCache.remove(userId)
                }
                idsToFetch.add(userId)
            }
        }

        // 2. Se todos estavam no cache, retornar
        if (idsToFetch.isEmpty()) {
            return result
        }

        // 3. Buscar usuários faltantes em paralelo
        return try {
            coroutineScope {
                val deferredResults = idsToFetch.chunked(10).map { chunk ->
                    async {
                        try {
                            firebaseDataSource.getUsersByIds(chunk).getOrNull() ?: emptyList()
                        } catch (e: Exception) {
                            emptyList()
                        }
                    }
                }

                val fetchedUsers = deferredResults.awaitAll().flatten()

                // 4. Atualizar cache usando putInCache
                fetchedUsers.forEach { user ->
                    putInCache(user.id, user)
                }

                // 5. Combinar resultados
                result.putAll(fetchedUsers.associateBy { it.id })
                result
            }
        } catch (e: Exception) {
            // Retornar pelo menos os que estavam no cache
            result
        }
    }

    private fun getCurrentWeekKey(): String {
        val calendar = Calendar.getInstance()
        val year = calendar.get(Calendar.YEAR)
        val weekNumber = calendar.get(Calendar.WEEK_OF_YEAR)
        return "${year}-W${weekNumber.toString().padStart(2, '0')}"
    }

    private fun getCurrentMonthKey(): String {
        val calendar = Calendar.getInstance()
        val year = calendar.get(Calendar.YEAR)
        val month = calendar.get(Calendar.MONTH) + 1
        return "${year}-${month.toString().padStart(2, '0')}"
    }

    private fun getCurrentYearKey(): String {
        return Calendar.getInstance().get(Calendar.YEAR).toString()
    }
}
