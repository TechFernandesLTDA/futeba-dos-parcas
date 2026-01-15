package com.futebadosparcas.domain.ranking

import com.futebadosparcas.domain.model.LeagueDivision

/**
 * Dados de um jogo recente para calculo de League Rating.
 */
data class RecentGameData(
    val gameId: String = "",
    val xpEarned: Long = 0L,
    val won: Boolean = false,
    val drew: Boolean = false,
    val goalDiff: Int = 0,
    val wasMvp: Boolean = false
)

/**
 * Calculador de rating da liga (sistema 0-100 em producao).
 *
 * SISTEMA DE RATING: Escala 0-100 (media ponderada)
 * -------------------------------------------------
 * O sistema usa uma formula ponderada baseada nos ultimos 10 jogos:
 * LR = (PPJ * 40%) + (WR * 30%) + (GD * 20%) + (MVP_Rate * 10%)
 *
 * Onde:
 * - PPJ = Pontos (XP) por Jogo (max 200 XP = 100 pontos)
 * - WR = Win Rate (100% = 100 pontos)
 * - GD = Goal Difference medio (+3 = 100, -3 = 0)
 * - MVP_Rate = Taxa de MVP (50% = 100 pontos, cap)
 *
 * DECISAO DE ARQUITETURA:
 * Este sistema 0-100 foi mantido em detrimento do sistema Elo (100-3000)
 * porque ja esta em producao e todos os thresholds estao definidos baseados nele.
 * O sistema Elo foi removido para evitar duplicidade e confusao.
 *
 * Thresholds de Divisao:
 * - Bronze: 0-29
 * - Prata: 30-49
 * - Ouro: 50-69
 * - Diamante: 70-100
 *
 * Logica pura compartilhavel entre plataformas (KMP).
 */
object LeagueRatingCalculator {

    /**
     * Calcula o League Rating baseado nos ultimos jogos.
     *
     * LR = (PPJ * 40) + (WR * 30) + (GD * 20) + (MVP_Rate * 10)
     * Normalizado para 0-100
     *
     * @param recentGames Lista de jogos recentes (max 10 recomendado)
     * @return Rating entre 0.0 e 100.0
     */
    fun calculate(recentGames: List<RecentGameData>): Double {
        if (recentGames.isEmpty()) return 0.0

        val gamesCount = recentGames.size

        // PPJ - Pontos (XP) por Jogo (max 200 = 100 pontos)
        val avgXp = recentGames.map { it.xpEarned }.average()
        val ppjScore = (avgXp / 200.0).coerceAtMost(1.0) * 100

        // WR - Win Rate (100% = 100 pontos)
        val winRate = recentGames.count { it.won }.toDouble() / gamesCount * 100

        // GD - Goal Difference medio (+3 = 100, -3 = 0)
        val avgGD = recentGames.map { it.goalDiff }.average()
        val gdScore = ((avgGD + 3) / 6.0).coerceIn(0.0, 1.0) * 100

        // MVP Rate (50% = 100 pontos, cap)
        val mvpRate = recentGames.count { it.wasMvp }.toDouble() / gamesCount
        val mvpScore = (mvpRate / 0.5).coerceAtMost(1.0) * 100

        return (ppjScore * 0.4) + (winRate * 0.3) + (gdScore * 0.2) + (mvpScore * 0.1)
    }

    /**
     * Retorna a divisao correspondente ao rating fornecido.
     *
     * @param rating Rating entre 0.0 e 100.0
     * @return Divisao correspondente
     */
    fun getDivisionForRating(rating: Double): LeagueDivision {
        return LeagueDivision.fromRating(rating)
    }

    /**
     * Retorna o threshold de rating para a proxima divisao.
     *
     * @param division Divisao atual
     * @return Rating minimo para subir de divisao
     */
    fun getNextDivisionThreshold(division: LeagueDivision): Double {
        return LeagueDivision.getNextDivisionThreshold(division)
    }

    /**
     * Retorna o threshold de rating para a divisao anterior.
     *
     * @param division Divisao atual
     * @return Rating minimo para cair de divisao
     */
    fun getPreviousDivisionThreshold(division: LeagueDivision): Double {
        return LeagueDivision.getPreviousDivisionThreshold(division)
    }

    /**
     * Calcula pontos para ranking da temporada.
     * Sistema simples: 3 pontos vitoria, 1 empate, 0 derrota.
     *
     * @param wins Numero de vitorias
     * @param draws Numero de empates
     * @param losses Numero de derrotas
     * @return Total de pontos
     */
    fun calculateSeasonPoints(
        wins: Int,
        draws: Int,
        losses: Int
    ): Int {
        return (wins * 3) + (draws * 1)
    }
}

/**
 * @deprecated Use o calculador 0-100 acima.
 * Sistema Elo (100-3000) foi descontinuado em favor do sistema 0-100 em producao.
 *
 * Mantido apenas por compatibilidade temporaria. Sera removido em versao futura.
 */
@Deprecated(
    message = "Sistema Elo foi descontinuado. Use calculate() com escala 0-100.",
    replaceWith = ReplaceWith("LeagueRatingCalculator.calculate(recentGames)")
)
object LeagueRatingCalculatorElo {
    private const val DEFAULT_RATING = 1000
    private const val MIN_RATING = 100
    private const val MAX_RATING = 3000

    /**
     * @deprecated Use o calculador 0-100 (LeagueRatingCalculator.calculate)
     */
    @Deprecated("Use o calculador 0-100")
    fun getInitialRating(): Int = DEFAULT_RATING

    /**
     * @deprecated Use o calculador 0-100 (LeagueRatingCalculator.calculate)
     */
    @Deprecated("Use o calculador 0-100")
    fun calculateAverageRating(ratings: List<Int>): Int {
        if (ratings.isEmpty()) return DEFAULT_RATING
        return ratings.average().toInt()
    }
}
