package com.futebadosparcas.domain.usecase

import com.futebadosparcas.domain.ranking.LeagueRatingCalculator

/**
 * Use Case para calcular rating de liga (sistema Elo modificado).
 * Usa o LeagueRatingCalculator compartilhado.
 */
class CalculateLeagueRatingUseCase {

    private val calculator = LeagueRatingCalculator()

    /**
     * Calcula a variacao de rating para dois jogadores apos uma partida.
     *
     * @param winnerRating Rating atual do vencedor
     * @param loserRating Rating atual do perdedor
     * @return Variacao de rating (pontos ganhos/perdidos)
     */
    fun calculateRatingChange(
        winnerRating: Double,
        loserRating: Double
    ): Double {
        return calculator.calculateRatingChange(winnerRating, loserRating)
    }

    /**
     * Calcula novo rating apos uma vitoria.
     *
     * @param currentRating Rating atual do jogador
     * @param opponentRating Rating do adversario
     * @return Novo rating do jogador
     */
    fun calculateNewRatingAfterWin(
        currentRating: Double,
        opponentRating: Double
    ): Double {
        val change = calculateRatingChange(currentRating, opponentRating)
        return currentRating + change
    }

    /**
     * Calcula novo rating apos uma derrota.
     *
     * @param currentRating Rating atual do jogador
     * @param opponentRating Rating do vencedor
     * @return Novo rating do jogador
     */
    fun calculateNewRatingAfterLoss(
        currentRating: Double,
        opponentRating: Double
    ): Double {
        val change = calculateRatingChange(opponentRating, currentRating)
        return currentRating - change
    }

    /**
     * Calcula novo rating apos um empate (nenhuma mudanca significativa).
     *
     * @param currentRating Rating atual do jogador
     * @return Novo rating do jogador (inalterado ou pequena mudanca)
     */
    fun calculateNewRatingAfterDraw(currentRating: Double): Double {
        // Em empates, o rating permanece o mesmo ou sofre ajuste minimo
        return currentRating
    }

    /**
     * Calcula a probabilidade de vitoria baseada nos ratings.
     *
     * @param playerRating Rating do jogador
     * @param opponentRating Rating do adversario
     * @return Probabilidade de vitoria (0.0 - 1.0)
     */
    fun calculateWinProbability(
        playerRating: Double,
        opponentRating: Double
    ): Double {
        return calculator.calculateExpectedScore(playerRating, opponentRating)
    }

    /**
     * Retorna informacoes detalhadas sobre uma partida de rating.
     *
     * @param playerRating Rating do jogador
     * @param opponentRating Rating do adversario
     * @return Informacoes da partida
     */
    fun getMatchInfo(
        playerRating: Double,
        opponentRating: Double
    ): MatchRatingInfo {
        val winProbability = calculateWinProbability(playerRating, opponentRating)
        val ratingChange = calculateRatingChange(playerRating, opponentRating)
        val newRatingIfWin = calculateNewRatingAfterWin(playerRating, opponentRating)
        val newRatingIfLose = calculateNewRatingAfterLoss(playerRating, opponentRating)

        return MatchRatingInfo(
            currentRating = playerRating,
            opponentRating = opponentRating,
            winProbability = winProbability,
            lossProbability = 1.0 - winProbability,
            potentialGain = ratingChange,
            potentialLoss = ratingChange,
            newRatingIfWin = newRatingIfWin,
            newRatingIfLose = newRatingIfLose
        )
    }
}

/**
 * Informacoes detalhadas sobre uma partida de rating.
 */
data class MatchRatingInfo(
    val currentRating: Double,
    val opponentRating: Double,
    val winProbability: Double,
    val lossProbability: Double,
    val potentialGain: Double,
    val potentialLoss: Double,
    val newRatingIfWin: Double,
    val newRatingIfLose: Double
) {
    /**
     * Retorna a probabilidade de vitoria como percentual (0-100).
     */
    fun getWinProbabilityPercent(): Int = (winProbability * 100).toInt()

    /**
     * Retorna a probabilidade de derrota como percentual (0-100).
     */
    fun getLossProbabilityPercent(): Int = (lossProbability * 100).toInt()

    /**
     * Verifica se o jogador e favorito (probabilidade > 50%).
     */
    fun isFavorite(): Boolean = winProbability > 0.5

    /**
     * Retorna a diferenca de rating.
     */
    fun getRatingDifference(): Double = currentRating - opponentRating
}
