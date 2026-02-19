package com.futebadosparcas.domain.usecase

import com.futebadosparcas.data.datasource.FirebaseDataSource
import com.futebadosparcas.data.model.User
import com.futebadosparcas.data.model.UserStatistics
import com.futebadosparcas.domain.model.RankingCategory
import com.futebadosparcas.domain.model.RankingPeriod
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.DocumentSnapshot
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope

/**
 * Use Case para buscar rankings da liga.
 *
 * Responsabilidades:
 * - Buscar rankings por categoria (Gols, Assistências, XP, etc)
 * - Filtrar por período (Semana, Mês, Ano, Histórico)
 * - Enriquecer dados com informações de usuário
 * - Calcular posição do jogador no ranking
 */
class GetLeagueRankingUseCase constructor(
    private val firebaseDataSource: FirebaseDataSource,
    private val auth: FirebaseAuth
) {
    companion object {
        private const val TAG = "GetLeagueRankingUseCase"
        private const val DEFAULT_LIMIT = 50
    }

    /**
     * Entrada de ranking enriquecida.
     */
    data class RankingEntry(
        val rank: Int,
        val userId: String,
        val userName: String,
        val nickname: String?,
        val photoUrl: String?,
        val value: Long,
        val gamesPlayed: Int,
        val average: Double,
        val level: Int,
        val isCurrentUser: Boolean
    )

    /**
     * Resultado de ranking com metadados.
     */
    data class RankingResult(
        val category: RankingCategory,
        val period: RankingPeriod,
        val entries: List<RankingEntry>,
        val currentUserPosition: Int?,
        val totalPlayers: Int
    )

    /**
     * Busca ranking por categoria e período (All-Time).
     *
     * @param category Categoria do ranking
     * @param limit Número máximo de entradas
     * @return Result com ranking completo
     */
    suspend fun execute(
        category: RankingCategory,
        limit: Int = DEFAULT_LIMIT
    ): Result<RankingResult> {
        AppLogger.d(TAG) { "Buscando ranking: category=$category, limit=$limit" }

        val currentUserId = auth.currentUser?.uid

        // 1. Buscar dados do ranking
        val rankingResult = firebaseDataSource.getRanking(
            category = category.name,
            orderByField = category.field,
            limit = limit
        )

        val documents = rankingResult.getOrElse { return Result.failure(it) }

        // 2. Processar documentos baseado na categoria
        val entries = if (category == RankingCategory.XP) {
            processXpRanking(documents, currentUserId)
        } else {
            processStatisticsRanking(documents, category, currentUserId)
        }

        // 3. Encontrar posição do usuário atual
        val currentUserPosition = entries.indexOfFirst { it.isCurrentUser }
            .takeIf { it >= 0 }?.let { it + 1 }

        val result = RankingResult(
            category = category,
            period = RankingPeriod.ALL_TIME,
            entries = entries,
            currentUserPosition = currentUserPosition,
            totalPlayers = documents.size
        )

        AppLogger.d(TAG) {
            "Ranking carregado: ${entries.size} entradas, posição usuário=$currentUserPosition"
        }

        return Result.success(result)
    }

    /**
     * Busca ranking por categoria e período específico.
     *
     * @param category Categoria do ranking
     * @param period Período (semana, mês, ano)
     * @param limit Número máximo de entradas
     * @return Result com ranking completo
     */
    suspend fun executeByPeriod(
        category: RankingCategory,
        period: RankingPeriod,
        limit: Int = DEFAULT_LIMIT
    ): Result<RankingResult> {
        AppLogger.d(TAG) { "Buscando ranking: category=$category, period=$period" }

        // Se for ALL_TIME, usar método padrão
        if (period == RankingPeriod.ALL_TIME) {
            return execute(category, limit)
        }

        val currentUserId = auth.currentUser?.uid
        val periodKey = getPeriodKey(period)
        val periodName = period.name.lowercase()

        // 1. Buscar deltas do período
        val deltaField = when (category) {
            RankingCategory.GOALS -> "goals_added"
            RankingCategory.ASSISTS -> "assists_added"
            RankingCategory.SAVES -> "saves_added"
            RankingCategory.XP -> "xp_added"
            RankingCategory.GAMES -> "games_added"
            RankingCategory.WINS -> "wins_added"
            RankingCategory.MVP -> "mvp_added"
        }

        val deltasResult = firebaseDataSource.getRankingDeltas(
            period = periodName,
            periodKey = periodKey,
            orderByField = deltaField,
            limit = limit
        )

        val documents = deltasResult.getOrElse { return Result.failure(it) }

        // 2. Processar deltas e enriquecer com dados de usuário
        val entries = processDeltaRanking(documents, deltaField, period.minGames, currentUserId)

        // 3. Encontrar posição do usuário atual
        val currentUserPosition = entries.indexOfFirst { it.isCurrentUser }
            .takeIf { it >= 0 }?.let { it + 1 }

        val result = RankingResult(
            category = category,
            period = period,
            entries = entries,
            currentUserPosition = currentUserPosition,
            totalPlayers = documents.size
        )

        AppLogger.d(TAG) {
            "Ranking do período carregado: ${entries.size} entradas"
        }

        return Result.success(result)
    }

    /**
     * Busca múltiplos rankings em paralelo.
     *
     * @param categories Lista de categorias
     * @param period Período
     * @param limit Limite por ranking
     * @return Result com mapa de rankings
     */
    suspend fun executeMultiple(
        categories: List<RankingCategory>,
        period: RankingPeriod = RankingPeriod.ALL_TIME,
        limit: Int = 10
    ): Result<Map<RankingCategory, RankingResult>> = coroutineScope {
        AppLogger.d(TAG) { "Buscando ${categories.size} rankings em paralelo" }

        try {
            val deferredResults = categories.map { category ->
                async {
                    val result = if (period == RankingPeriod.ALL_TIME) {
                        execute(category, limit)
                    } else {
                        executeByPeriod(category, period, limit)
                    }
                    category to result
                }
            }

            val results = deferredResults.awaitAll()

            // Verificar se algum falhou
            val failures = results.filter { it.second.isFailure }
            if (failures.isNotEmpty()) {
                val firstFailure = failures.first().second.exceptionOrNull()
                    ?: Exception("Erro desconhecido ao buscar ranking")
                return@coroutineScope Result.failure(firstFailure)
            }

            val rankingsMap = results.associate { (category, result) ->
                category to result.getOrThrow()
            }

            Result.success(rankingsMap)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar rankings em paralelo", e)
            Result.failure(e)
        }
    }

    // ========== PROCESSAMENTO ==========

    private suspend fun processXpRanking(
        documents: List<DocumentSnapshot>,
        currentUserId: String?
    ): List<RankingEntry> {
        val users = documents.mapNotNull { it.toObject(User::class.java) }

        return users.mapIndexed { index, user ->
            RankingEntry(
                rank = index + 1,
                userId = user.id,
                userName = user.name,
                nickname = user.nickname,
                photoUrl = user.photoUrl,
                value = user.experiencePoints,
                gamesPlayed = 0, // Não disponível em User
                average = 0.0,
                level = user.level,
                isCurrentUser = user.id == currentUserId
            )
        }
    }

    private suspend fun processStatisticsRanking(
        documents: List<DocumentSnapshot>,
        category: RankingCategory,
        currentUserId: String?
    ): List<RankingEntry> {
        val stats = documents.mapNotNull { it.toObject(UserStatistics::class.java) }
        val userIds = stats.map { it.id }

        // Buscar dados de usuários em batch
        val usersResult = firebaseDataSource.getUsersByIds(userIds)
        val usersMap = usersResult.getOrNull()?.associateBy { it.id } ?: emptyMap()

        return stats.mapIndexed { index, stat ->
            val user = usersMap[stat.id]
            val value = getStatValue(stat, category)

            RankingEntry(
                rank = index + 1,
                userId = stat.id,
                userName = user?.name ?: "Jogador",
                nickname = user?.nickname,
                photoUrl = user?.photoUrl,
                value = value.toLong(),
                gamesPlayed = stat.totalGames,
                average = if (stat.totalGames > 0) value.toDouble() / stat.totalGames else 0.0,
                level = user?.level ?: 0,
                isCurrentUser = stat.id == currentUserId
            )
        }
    }

    private suspend fun processDeltaRanking(
        documents: List<DocumentSnapshot>,
        deltaField: String,
        minGames: Int,
        currentUserId: String?
    ): List<RankingEntry> {
        val deltas = documents.mapNotNull { doc ->
            val userId = doc.getString("user_id") ?: return@mapNotNull null
            val value = doc.getLong(deltaField) ?: 0L
            val games = doc.getLong("games_added")?.toInt() ?: 0
            Triple(userId, value, games)
        }

        // Filtrar por mínimo de jogos
        val filteredDeltas = deltas.filter { it.third >= minGames }
        val userIds = filteredDeltas.map { it.first }

        // Buscar dados de usuários
        val usersResult = firebaseDataSource.getUsersByIds(userIds)
        val usersMap = usersResult.getOrNull()?.associateBy { it.id } ?: emptyMap()

        return filteredDeltas.mapIndexed { index, (userId, value, games) ->
            val user = usersMap[userId]

            RankingEntry(
                rank = index + 1,
                userId = userId,
                userName = user?.name ?: "Jogador",
                nickname = user?.nickname,
                photoUrl = user?.photoUrl,
                value = value,
                gamesPlayed = games,
                average = if (games > 0) value.toDouble() / games else 0.0,
                level = user?.level ?: 0,
                isCurrentUser = userId == currentUserId
            )
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
            RankingCategory.XP -> 0
        }
    }

    private fun getPeriodKey(period: RankingPeriod): String {
        val now = java.time.LocalDate.now()
        return when (period) {
            RankingPeriod.WEEK -> {
                val weekFields = java.time.temporal.WeekFields.of(java.util.Locale.getDefault())
                val weekNumber = now.get(weekFields.weekOfWeekBasedYear())
                "${now.year}-W${weekNumber.toString().padStart(2, '0')}"
            }
            RankingPeriod.MONTH -> {
                now.format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM"))
            }
            RankingPeriod.YEAR -> {
                now.year.toString()
            }
            RankingPeriod.ALL_TIME -> ""
        }
    }
}
