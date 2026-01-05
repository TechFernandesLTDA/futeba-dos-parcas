package com.futebadosparcas.domain.ranking

import com.futebadosparcas.domain.model.GameResult
import com.futebadosparcas.domain.model.LeagueDivision
import kotlin.math.pow
import kotlin.math.roundToInt

/**
 * Calculador de rating da liga (sistema Elo modificado).
 * Logica pura compartilhavel entre plataformas.
 */
object LeagueRatingCalculator {

    // Constantes do sistema de rating
    private const val DEFAULT_RATING = 1000
    private const val K_FACTOR_BASE = 32
    private const val K_FACTOR_NEW_PLAYER = 48  // Maior variacao para novos jogadores
    private const val MIN_RATING = 100
    private const val MAX_RATING = 3000
    private const val NEW_PLAYER_THRESHOLD = 10  // Jogos para ser considerado "novo"

    /**
     * Resultado do calculo de rating.
     */
    data class RatingCalculationResult(
        val newRating: Int,
        val ratingChange: Int,
        val newDivision: LeagueDivision,
        val divisionChanged: Boolean,
        val previousDivision: LeagueDivision
    )

    /**
     * Calcula o novo rating apos um jogo.
     *
     * @param currentRating Rating atual do jogador
     * @param opponentAverageRating Rating medio dos oponentes
     * @param gameResult Resultado do jogo (WIN, DRAW, LOSS)
     * @param gamesPlayed Numero de jogos jogados (para K-factor)
     * @param wasMvp Se foi eleito MVP (bonus)
     * @param goals Gols marcados (bonus)
     * @param assists Assistencias (bonus)
     */
    fun calculateNewRating(
        currentRating: Int,
        opponentAverageRating: Int,
        gameResult: GameResult,
        gamesPlayed: Int = 0,
        wasMvp: Boolean = false,
        goals: Int = 0,
        assists: Int = 0
    ): RatingCalculationResult {
        // K-factor ajustado para novos jogadores
        val kFactor = if (gamesPlayed < NEW_PLAYER_THRESHOLD) {
            K_FACTOR_NEW_PLAYER
        } else {
            K_FACTOR_BASE
        }

        // Expectativa de resultado (formula Elo)
        val expectedScore = calculateExpectedScore(currentRating, opponentAverageRating)

        // Score real baseado no resultado
        val actualScore = when (gameResult) {
            GameResult.WIN -> 1.0
            GameResult.DRAW -> 0.5
            GameResult.LOSS -> 0.0
        }

        // Calculo base do rating change
        var ratingChange = (kFactor * (actualScore - expectedScore)).roundToInt()

        // Bonus por performance individual
        if (wasMvp) {
            ratingChange += 5
        }
        if (goals >= 3) {
            ratingChange += 3  // Hat trick bonus
        } else if (goals >= 2) {
            ratingChange += 2
        }
        if (assists >= 2) {
            ratingChange += 2
        }

        // Aplicar limites
        val newRating = (currentRating + ratingChange).coerceIn(MIN_RATING, MAX_RATING)
        val actualChange = newRating - currentRating

        // Verificar mudanca de divisao
        val previousDivision = LeagueDivision.fromRating(currentRating)
        val newDivision = LeagueDivision.fromRating(newRating)

        return RatingCalculationResult(
            newRating = newRating,
            ratingChange = actualChange,
            newDivision = newDivision,
            divisionChanged = previousDivision != newDivision,
            previousDivision = previousDivision
        )
    }

    /**
     * Calcula a expectativa de resultado usando formula Elo.
     */
    private fun calculateExpectedScore(playerRating: Int, opponentRating: Int): Double {
        val exponent = (opponentRating - playerRating) / 400.0
        return 1.0 / (1.0 + 10.0.pow(exponent))
    }

    /**
     * Retorna o rating inicial para novos jogadores.
     */
    fun getInitialRating(): Int = DEFAULT_RATING

    /**
     * Calcula rating medio de um grupo de jogadores.
     */
    fun calculateAverageRating(ratings: List<Int>): Int {
        if (ratings.isEmpty()) return DEFAULT_RATING
        return ratings.average().roundToInt()
    }

    /**
     * Estima o impacto de uma vitoria/derrota no rating.
     */
    fun estimateRatingChange(
        currentRating: Int,
        opponentRating: Int,
        gameResult: GameResult
    ): Int {
        return calculateNewRating(
            currentRating = currentRating,
            opponentAverageRating = opponentRating,
            gameResult = gameResult
        ).ratingChange
    }

    /**
     * Calcula pontos para ranking da temporada.
     * Sistema simples: 3 pontos vitoria, 1 empate, 0 derrota.
     */
    fun calculateSeasonPoints(
        wins: Int,
        draws: Int,
        losses: Int
    ): Int {
        return (wins * 3) + (draws * 1)
    }
}
