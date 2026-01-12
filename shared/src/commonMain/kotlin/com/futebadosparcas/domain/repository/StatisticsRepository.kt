package com.futebadosparcas.domain.repository

import com.futebadosparcas.domain.model.Statistics
import com.futebadosparcas.domain.model.XpLog
import kotlinx.coroutines.flow.Flow

/**
 * Interface de repositorio de estatisticas.
 * Implementacoes especificas de plataforma em androidMain/iosMain.
 */
interface StatisticsRepository {

    /**
     * Busca estatisticas do usuario atual.
     */
    suspend fun getMyStatistics(): Result<Statistics>

    /**
     * Busca estatisticas de um usuario.
     */
    suspend fun getUserStatistics(userId: String): Result<Statistics>

    /**
     * Observa estatisticas em tempo real.
     */
    fun observeStatistics(userId: String): Flow<Statistics?>

    /**
     * Atualiza estatisticas apos um jogo.
     */
    suspend fun updateStatistics(
        userId: String,
        goals: Int = 0,
        assists: Int = 0,
        saves: Int = 0,
        yellowCards: Int = 0,
        redCards: Int = 0,
        isBestPlayer: Boolean = false,
        isWorstPlayer: Boolean = false,
        hasBestGoal: Boolean = false,
        gameResult: GameResult = GameResult.DRAW
    ): Result<Statistics>

    /**
     * Busca artilheiros (ranking de gols).
     */
    suspend fun getTopScorers(limit: Int = 10): Result<List<Statistics>>

    /**
     * Busca melhores goleiros (ranking de defesas).
     */
    suspend fun getTopGoalkeepers(limit: Int = 10): Result<List<Statistics>>

    /**
     * Busca melhores jogadores (ranking de MVP).
     */
    suspend fun getBestPlayers(limit: Int = 10): Result<List<Statistics>>

    /**
     * Busca historico de gols por mes (ultimos 6 meses).
     */
    suspend fun getGoalsHistory(userId: String): Result<Map<String, Int>>

    /**
     * Busca historico de XP.
     */
    suspend fun getXpHistory(userId: String, limit: Int = 20): Result<List<XpLog>>

    /**
     * Salva log de XP.
     */
    suspend fun saveXpLog(xpLog: XpLog): Result<Unit>

    /**
     * Busca ranking geral de jogadores.
     */
    suspend fun getGlobalRanking(
        orderBy: RankingOrderBy = RankingOrderBy.GOALS,
        limit: Int = 50
    ): Result<List<Statistics>>
}

/**
 * Resultado de um jogo para atualizacao de estatisticas.
 */
enum class GameResult {
    WIN,
    LOSS,
    DRAW
}

/**
 * Criterio de ordenacao do ranking.
 */
enum class RankingOrderBy {
    GOALS,
    ASSISTS,
    GAMES,
    WINS,
    MVP_COUNT,
    WIN_RATE
}
