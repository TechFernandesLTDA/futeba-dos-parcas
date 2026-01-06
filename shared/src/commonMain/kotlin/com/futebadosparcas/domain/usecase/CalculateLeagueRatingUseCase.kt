package com.futebadosparcas.domain.usecase

import com.futebadosparcas.domain.model.GameResult
import com.futebadosparcas.domain.ranking.LeagueRatingCalculator

/**
 * Use Case para calcular rating de liga (sistema Elo modificado).
 * Usa o LeagueRatingCalculator compartilhado.
 */
class CalculateLeagueRatingUseCase {

    /**
     * Calcula novo rating completo com todas as estatisticas.
     */
    fun calculateNewRating(
        currentRating: Int,
        opponentAverageRating: Int,
        gameResult: GameResult,
        gamesPlayed: Int = 0,
        wasMvp: Boolean = false,
        goals: Int = 0,
        assists: Int = 0
    ): LeagueRatingCalculator.RatingCalculationResult {
        return LeagueRatingCalculator.calculateNewRating(
            currentRating = currentRating,
            opponentAverageRating = opponentAverageRating,
            gameResult = gameResult,
            gamesPlayed = gamesPlayed,
            wasMvp = wasMvp,
            goals = goals,
            assists = assists
        )
    }

    /**
     * Estima a mudança de rating de forma simples.
     */
    fun estimateRatingChange(
        currentRating: Int,
        opponentRating: Int,
        gameResult: GameResult
    ): Int {
        return LeagueRatingCalculator.estimateRatingChange(currentRating, opponentRating, gameResult)
    }

    /**
     * Calcula rating médio de um grupo de jogadores.
     */
    fun calculateAverageRating(ratings: List<Int>): Int {
        return LeagueRatingCalculator.calculateAverageRating(ratings)
    }

    /**
     * Retorna o rating inicial para novos jogadores.
     */
    fun getInitialRating(): Int {
        return LeagueRatingCalculator.getInitialRating()
    }

    /**
     * Calcula pontos da temporada baseado em vitorias/empates/derrotas.
     */
    fun calculateSeasonPoints(wins: Int, draws: Int, losses: Int): Int {
        return LeagueRatingCalculator.calculateSeasonPoints(wins, draws, losses)
    }
}
