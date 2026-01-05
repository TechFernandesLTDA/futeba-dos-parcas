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
     * Busca estatisticas de um usuario.
     */
    suspend fun getStatistics(userId: String): Result<Statistics>

    /**
     * Observa estatisticas em tempo real.
     */
    fun observeStatistics(userId: String): Flow<Statistics?>

    /**
     * Atualiza estatisticas apos um jogo.
     */
    suspend fun updateStatisticsAfterGame(
        userId: String,
        goals: Int,
        assists: Int,
        saves: Int,
        won: Boolean,
        drew: Boolean,
        wasMvp: Boolean,
        wasBestGk: Boolean,
        wasWorstPlayer: Boolean
    ): Result<Unit>

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
