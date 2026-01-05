package com.futebadosparcas.domain.repository

import com.futebadosparcas.domain.model.LeagueDivision
import com.futebadosparcas.domain.model.Season
import com.futebadosparcas.domain.model.SeasonParticipation
import kotlinx.coroutines.flow.Flow

/**
 * Interface de repositorio de temporadas e liga.
 * Implementacoes especificas de plataforma em androidMain/iosMain.
 */
interface SeasonRepository {

    /**
     * Busca a temporada ativa.
     */
    suspend fun getActiveSeason(): Result<Season?>

    /**
     * Busca todas as temporadas.
     */
    suspend fun getAllSeasons(): Result<List<Season>>

    /**
     * Busca uma temporada por ID.
     */
    suspend fun getSeasonById(seasonId: String): Result<Season>

    /**
     * Busca participacao de um usuario em uma temporada.
     */
    suspend fun getParticipation(seasonId: String, userId: String): Result<SeasonParticipation?>

    /**
     * Observa ranking da temporada em tempo real.
     */
    fun observeSeasonRanking(seasonId: String, limit: Int = 100): Flow<List<SeasonParticipation>>

    /**
     * Busca ranking por divisao.
     */
    suspend fun getRankingByDivision(
        seasonId: String,
        division: LeagueDivision,
        limit: Int = 50
    ): Result<List<SeasonParticipation>>

    /**
     * Atualiza participacao apos um jogo.
     */
    suspend fun updateParticipationAfterGame(
        seasonId: String,
        userId: String,
        goals: Int,
        assists: Int,
        saves: Int,
        won: Boolean,
        drew: Boolean,
        wasMvp: Boolean,
        wasBestGk: Boolean,
        wasWorstPlayer: Boolean,
        xpEarned: Long
    ): Result<Unit>

    /**
     * Recalcula rating da liga.
     */
    suspend fun recalculateLeagueRating(
        seasonId: String,
        userId: String
    ): Result<Int>

    /**
     * Busca posicao do usuario no ranking.
     */
    suspend fun getUserPosition(seasonId: String, userId: String): Result<Int?>
}
