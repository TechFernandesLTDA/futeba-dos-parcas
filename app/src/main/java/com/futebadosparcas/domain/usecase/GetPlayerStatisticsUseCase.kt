package com.futebadosparcas.domain.usecase

import com.futebadosparcas.data.datasource.FirebaseDataSource
import com.futebadosparcas.data.model.User
import com.futebadosparcas.data.model.UserStatistics
import com.futebadosparcas.data.model.XpLog
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine

/**
 * Use Case para buscar estatísticas de jogadores.
 *
 * Responsabilidades:
 * - Buscar estatísticas completas (User + UserStatistics)
 * - Calcular métricas derivadas (taxas, médias)
 * - Fornecer histórico de XP
 * - Comparar estatísticas entre jogadores
 */
class GetPlayerStatisticsUseCase constructor(
    private val firebaseDataSource: FirebaseDataSource,
    private val auth: FirebaseAuth
) {
    companion object {
        private const val TAG = "GetPlayerStatisticsUseCase"
    }

    /**
     * Estatísticas completas de um jogador.
     */
    data class PlayerStats(
        val user: User,
        val statistics: UserStatistics,
        val level: Int,
        val experiencePoints: Long,
        val nextLevelXp: Long,
        val currentLevelProgress: Double
    )

    /**
     * Busca estatísticas completas do jogador atual.
     *
     * @return Result com estatísticas completas
     */
    suspend fun getCurrentPlayerStats(): Result<PlayerStats> {
        val userId = auth.currentUser?.uid
            ?: return Result.failure(IllegalStateException("Usuário não autenticado"))

        return getPlayerStats(userId)
    }

    /**
     * Busca estatísticas completas de um jogador específico.
     *
     * @param userId ID do jogador
     * @return Result com estatísticas completas
     */
    suspend fun getPlayerStats(userId: String): Result<PlayerStats> {
        AppLogger.d(TAG) { "Buscando estatísticas do jogador: $userId" }

        // 1. Buscar usuário e estatísticas em paralelo
        val userResult = firebaseDataSource.getUserById(userId)
        val statsResult = firebaseDataSource.getUserStatistics(userId)

        // 2. Verificar erros
        val user = userResult.getOrElse { return Result.failure(it) }
        val statistics = statsResult.getOrElse { return Result.failure(it) }

        // 3. Calcular progresso de nível
        val nextLevelXp = calculateNextLevelXp(user.level)
        val currentLevelXp = calculateCurrentLevelXp(user.level)
        val xpInCurrentLevel = user.experiencePoints - currentLevelXp
        val xpNeededForNextLevel = nextLevelXp - currentLevelXp
        val progress = if (xpNeededForNextLevel > 0) {
            (xpInCurrentLevel.toDouble() / xpNeededForNextLevel.toDouble()).coerceIn(0.0, 1.0)
        } else {
            1.0
        }

        val playerStats = PlayerStats(
            user = user,
            statistics = statistics,
            level = user.level,
            experiencePoints = user.experiencePoints,
            nextLevelXp = nextLevelXp,
            currentLevelProgress = progress
        )

        AppLogger.d(TAG) {
            "Estatísticas carregadas: Level ${user.level}, XP ${user.experiencePoints}, " +
            "Jogos ${statistics.totalGames}, Gols ${statistics.totalGoals}"
        }

        return Result.success(playerStats)
    }

    /**
     * Busca estatísticas em tempo real (Flow).
     *
     * @param userId ID do jogador
     * @return Flow com estatísticas completas
     */
    fun getPlayerStatsFlow(userId: String): Flow<Result<PlayerStats>> {
        AppLogger.d(TAG) { "Iniciando flow de estatísticas: $userId" }

        val statsFlow = firebaseDataSource.getUserStatisticsFlow(userId)

        return statsFlow.combine(
            // Pode adicionar flow do user aqui se necessário
            statsFlow
        ) { statsResult, _ ->
            val statistics = statsResult.getOrElse { return@combine Result.failure(it) }
            val userResult = firebaseDataSource.getUserById(userId)
            val user = userResult.getOrElse { return@combine Result.failure(it) }
            val nextLevelXp = calculateNextLevelXp(user.level)
            val currentLevelXp = calculateCurrentLevelXp(user.level)
            val xpInCurrentLevel = user.experiencePoints - currentLevelXp
            val xpNeededForNextLevel = nextLevelXp - currentLevelXp
            val progress = if (xpNeededForNextLevel > 0) {
                (xpInCurrentLevel.toDouble() / xpNeededForNextLevel.toDouble()).coerceIn(0.0, 1.0)
            } else {
                1.0
            }

            Result.success(
                PlayerStats(
                    user = user,
                    statistics = statistics,
                    level = user.level,
                    experiencePoints = user.experiencePoints,
                    nextLevelXp = nextLevelXp,
                    currentLevelProgress = progress
                )
            )
        }
    }

    /**
     * Busca histórico de XP do jogador.
     *
     * @param userId ID do jogador (null = usuário atual)
     * @param limit Número máximo de logs
     * @return Result com lista de logs de XP
     */
    suspend fun getXpHistory(
        userId: String? = null,
        limit: Int = 30
    ): Result<List<XpLog>> {
        val targetUserId = userId ?: auth.currentUser?.uid
            ?: return Result.failure(IllegalStateException("Usuário não autenticado"))

        AppLogger.d(TAG) { "Buscando histórico de XP: userId=$targetUserId, limit=$limit" }

        return firebaseDataSource.getUserXpLogs(targetUserId, limit)
    }

    /**
     * Compara estatísticas entre dois jogadores.
     *
     * @param userId1 ID do primeiro jogador
     * @param userId2 ID do segundo jogador
     * @return Result com comparação de estatísticas
     */
    suspend fun compareStats(
        userId1: String,
        userId2: String
    ): Result<StatsComparison> {
        AppLogger.d(TAG) { "Comparando estatísticas: $userId1 vs $userId2" }

        val stats1Result = getPlayerStats(userId1)
        val stats2Result = getPlayerStats(userId2)

        val stats1 = stats1Result.getOrElse { return Result.failure(it) }
        val stats2 = stats2Result.getOrElse { return Result.failure(it) }

        val comparison = StatsComparison(
            player1 = stats1,
            player2 = stats2,
            levelDiff = stats1.level - stats2.level,
            xpDiff = stats1.experiencePoints - stats2.experiencePoints,
            gamesDiff = stats1.statistics.totalGames - stats2.statistics.totalGames,
            goalsDiff = stats1.statistics.totalGoals - stats2.statistics.totalGoals,
            assistsDiff = stats1.statistics.totalAssists - stats2.statistics.totalAssists,
            winRateDiff = stats1.statistics.winRate - stats2.statistics.winRate
        )

        return Result.success(comparison)
    }

    /**
     * Comparação entre estatísticas de dois jogadores.
     */
    data class StatsComparison(
        val player1: PlayerStats,
        val player2: PlayerStats,
        val levelDiff: Int,
        val xpDiff: Long,
        val gamesDiff: Int,
        val goalsDiff: Int,
        val assistsDiff: Int,
        val winRateDiff: Double
    )

    /**
     * Calcula XP necessário para o próximo nível.
     * Fórmula: 100 * level^1.5
     */
    private fun calculateNextLevelXp(currentLevel: Int): Long {
        val nextLevel = currentLevel + 1
        return (100 * Math.pow(nextLevel.toDouble(), 1.5)).toLong()
    }

    /**
     * Calcula XP acumulado até o nível atual.
     */
    private fun calculateCurrentLevelXp(level: Int): Long {
        var totalXp = 0L
        for (lvl in 1 until level) {
            totalXp += (100 * Math.pow(lvl.toDouble(), 1.5)).toLong()
        }
        return totalXp
    }
}
