package com.futebadosparcas.domain.usecase.stats

import com.futebadosparcas.data.model.UserStatistics
import com.futebadosparcas.data.repository.StatisticsRepository
import com.futebadosparcas.domain.usecase.SuspendUseCase
import com.futebadosparcas.util.AppLogger
import java.util.Date

/**
 * Get Player Performance Use Case
 *
 * Busca métricas de desempenho de um jogador ao longo do tempo.
 *
 * Responsabilidades:
 * - Buscar histórico de estatísticas do jogador
 * - Calcular métricas derivadas (médias, tendências)
 * - Filtrar por período de tempo (opcional)
 * - Retornar análise de desempenho formatada
 *
 * Uso:
 * ```kotlin
 * val result = getPlayerPerformanceUseCase(GetPlayerPerformanceParams(
 *     userId = "user123",
 *     startDate = Date(System.currentTimeMillis() - 30 * 24 * 60 * 60 * 1000),
 *     endDate = Date()
 * ))
 *
 * result.fold(
 *     onSuccess = { performance ->
 *         println("Desempenho: ${performance.averageGoalsPerGame} gols/jogo")
 *     },
 *     onFailure = { error ->
 *         println("Erro: ${error.message}")
 *     }
 * )
 * ```
 */
class GetPlayerPerformanceUseCase constructor(
    private val statisticsRepository: StatisticsRepository
) : SuspendUseCase<GetPlayerPerformanceParams, PlayerPerformanceMetrics>() {

    companion object {
        private const val TAG = "GetPlayerPerformanceUseCase"
    }

    override suspend fun execute(params: GetPlayerPerformanceParams): PlayerPerformanceMetrics {
        AppLogger.d(TAG) {
            "Buscando desempenho do jogador: userId=${params.userId}, " +
            "período=${params.startDate?.time} até ${params.endDate?.time}"
        }

        // Validar parâmetros
        require(params.userId.isNotBlank()) {
            "ID do jogador não pode estar vazio"
        }

        // Validar período de datas se fornecidas
        params.startDate?.let { start ->
            params.endDate?.let { end ->
                require(start.before(end)) {
                    "Data de início deve ser anterior à data de fim"
                }
            }
        }

        // Buscar estatísticas completas do jogador
        val result = statisticsRepository.getUserStatistics(params.userId)
        val statistics = result.getOrElse { exception ->
            AppLogger.e(TAG, "Erro ao buscar estatísticas", exception)
            throw exception
        }

        // Calcular métricas de desempenho
        val performance = calculatePerformanceMetrics(statistics, params)

        AppLogger.d(TAG) {
            "Desempenho calculado: ${performance.overallRating}★, " +
            "${performance.averageGoalsPerGame} gols/jogo"
        }

        return performance
    }

    /**
     * Calcula métricas de desempenho com base em estatísticas
     */
    private fun calculatePerformanceMetrics(
        statistics: UserStatistics,
        params: GetPlayerPerformanceParams
    ): PlayerPerformanceMetrics {
        // Se houver período definido, pode ser aplicado aqui quando houver histórico temporal
        // Por enquanto, usamos as estatísticas globais

        // Calcular rating geral (0 a 5 estrelas)
        val overallRating = calculateOverallRating(statistics)

        // Calcular pontuação de ofensiva (0 a 100)
        val offensiveScore = calculateOffensiveScore(statistics)

        // Calcular pontuação de defesa (0 a 100)
        val defensiveScore = calculateDefensiveScore(statistics)

        // Calcular consistência (variância em performance)
        val consistencyScore = calculateConsistencyScore(statistics)

        // Calcular impacto no time (contribuição geral)
        val teamImpactScore = calculateTeamImpactScore(statistics)

        return PlayerPerformanceMetrics(
            userId = statistics.id,
            totalGamesAnalyzed = statistics.totalGames,
            overallRating = overallRating,
            offensiveScore = offensiveScore,
            defensiveScore = defensiveScore,
            consistencyScore = consistencyScore,
            teamImpactScore = teamImpactScore,
            averageGoalsPerGame = statistics.avgGoalsPerGame,
            averageAssistsPerGame = statistics.avgAssistsPerGame,
            averageSavesPerGame = statistics.avgSavesPerGame,
            averageCardsPerGame = statistics.avgCardsPerGame,
            winRate = statistics.winRate,
            mvpRate = statistics.mvpRate,
            presenceRate = statistics.presenceRate,
            currentMvpStreak = statistics.currentMvpStreak,
            bestGameGoals = statistics.bestGoalCount,
            totalCards = statistics.totalCards
        )
    }

    /**
     * Calcula rating geral do jogador (0 a 5 estrelas)
     */
    private fun calculateOverallRating(stats: UserStatistics): Double {
        // Fórmula ponderada: 40% ofensiva, 30% defesa, 20% wins, 10% disciplina
        val offensive = (stats.avgGoalsPerGame / 1.5).coerceIn(0.0, 1.0)
        val defensive = (stats.avgSavesPerGame / 4.0).coerceIn(0.0, 1.0)
        val wins = stats.winRate
        val discipline = (1.0 - (stats.avgCardsPerGame / 2.0)).coerceIn(0.0, 1.0)

        val combined = (offensive * 0.4) + (defensive * 0.3) + (wins * 0.2) + (discipline * 0.1)
        return (combined * 5.0).coerceIn(0.0, 5.0)
    }

    /**
     * Calcula pontuação de ofensiva (0 a 100)
     */
    private fun calculateOffensiveScore(stats: UserStatistics): Int {
        val goalsScore = ((stats.avgGoalsPerGame / 1.5) * 50).toInt().coerceIn(0, 50)
        val assistsScore = ((stats.avgAssistsPerGame / 1.2) * 50).toInt().coerceIn(0, 50)
        return goalsScore + assistsScore
    }

    /**
     * Calcula pontuação de defesa (0 a 100)
     */
    private fun calculateDefensiveScore(stats: UserStatistics): Int {
        val savesScore = ((stats.avgSavesPerGame / 4.0) * 50).toInt().coerceIn(0, 50)
        val disciplineScore = ((1.0 - (stats.avgCardsPerGame / 2.0)) * 50).toInt().coerceIn(0, 50)
        return savesScore + disciplineScore
    }

    /**
     * Calcula score de consistência (0 a 100)
     * Jogadores com MVP rate mais consistente pontuam melhor
     */
    private fun calculateConsistencyScore(stats: UserStatistics): Int {
        if (stats.totalGames == 0) return 0

        // MVP rate alta = consistente em ser destaque
        val mvpConsistency = (stats.mvpRate * 100).toInt().coerceIn(0, 50)

        // Win rate alto = consistente em vencer
        val winConsistency = (stats.winRate * 100).toInt().coerceIn(0, 50)

        return mvpConsistency + winConsistency
    }

    /**
     * Calcula impacto no time (0 a 100)
     */
    private fun calculateTeamImpactScore(stats: UserStatistics): Int {
        // Combina: MVPs, contribuição em gols/assistências, taxa de vitória
        val mvpImpact = ((stats.bestPlayerCount.toDouble() / stats.totalGames) * 33).toInt()
            .coerceIn(0, 33)
        val contributionImpact = ((stats.avgGoalsPerGame + stats.avgAssistsPerGame) / 2.7 * 33)
            .toInt().coerceIn(0, 33)
        val winImpact = (stats.winRate * 34).toInt().coerceIn(0, 34)

        return mvpImpact + contributionImpact + winImpact
    }
}

/**
 * Métricas de desempenho calculadas para um jogador
 *
 * @param userId ID do jogador
 * @param totalGamesAnalyzed Total de jogos considerados na análise
 * @param overallRating Rating geral do jogador (0 a 5 estrelas)
 * @param offensiveScore Pontuação de ofensiva (0 a 100)
 * @param defensiveScore Pontuação de defesa (0 a 100)
 * @param consistencyScore Score de consistência (0 a 100)
 * @param teamImpactScore Impacto no time (0 a 100)
 * @param averageGoalsPerGame Média de gols por jogo
 * @param averageAssistsPerGame Média de assistências por jogo
 * @param averageSavesPerGame Média de defesas por jogo (para goleiros)
 * @param averageCardsPerGame Média de cartões por jogo
 * @param winRate Taxa de vitórias (0 a 1)
 * @param mvpRate Taxa de MVPs (0 a 1)
 * @param presenceRate Taxa de presença (0 a 1)
 * @param currentMvpStreak Sequência atual de MVPs consecutivos
 * @param bestGameGoals Melhor performance em gols em um jogo
 * @param totalCards Total de cartões (amarelos + vermelhos)
 */
data class PlayerPerformanceMetrics(
    val userId: String,
    val totalGamesAnalyzed: Int,
    val overallRating: Double,
    val offensiveScore: Int,
    val defensiveScore: Int,
    val consistencyScore: Int,
    val teamImpactScore: Int,
    val averageGoalsPerGame: Double,
    val averageAssistsPerGame: Double,
    val averageSavesPerGame: Double,
    val averageCardsPerGame: Double,
    val winRate: Double,
    val mvpRate: Double,
    val presenceRate: Double,
    val currentMvpStreak: Int,
    val bestGameGoals: Int,
    val totalCards: Int
)

/**
 * Parâmetros para buscar desempenho de um jogador
 *
 * @param userId ID do jogador
 * @param startDate Data de início do período de análise (opcional)
 * @param endDate Data de fim do período de análise (opcional)
 */
data class GetPlayerPerformanceParams(
    val userId: String,
    val startDate: Date? = null,
    val endDate: Date? = null
)
