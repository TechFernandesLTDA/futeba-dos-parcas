package com.futebadosparcas.ui.core

import com.futebadosparcas.domain.model.Statistics

/**
 * Números exibidos na tela de estatísticas do iOS, já derivados do documento `statistics/{uid}`.
 */
data class PlayerStatsSummary(
    val games: Int,
    val goals: Int,
    val assists: Int,
    val saves: Int,
    val wins: Int,
    val draws: Int,
    val losses: Int,
    val mvps: Int,
    val yellowCards: Int,
    val redCards: Int,
    /** Aproveitamento em pontos corridos (vitória 3, empate 1), de 0 a 100. */
    val winRatePercent: Int,
    val goalsPerGame: Double
) {
    /** Sem nenhum jogo registrado: a tela mostra o estado vazio em vez de zeros. */
    val isEmpty: Boolean get() = games == 0
}

fun buildPlayerStatsSummary(stats: Statistics): PlayerStatsSummary {
    val decided = stats.totalWins + stats.totalDraws + stats.totalLosses
    val winRate = if (decided == 0) 0 else
        ((stats.totalWins * 3 + stats.totalDraws) * 100) / (decided * 3)
    val goalsPerGame = if (stats.totalGames == 0) 0.0 else
        stats.totalGoals.toDouble() / stats.totalGames
    return PlayerStatsSummary(
        games = stats.totalGames,
        goals = stats.totalGoals,
        assists = stats.totalAssists,
        saves = stats.totalSaves,
        wins = stats.totalWins,
        draws = stats.totalDraws,
        losses = stats.totalLosses,
        mvps = stats.mvpCount,
        yellowCards = stats.yellowCards,
        redCards = stats.redCards,
        winRatePercent = winRate.coerceIn(0, 100),
        goalsPerGame = goalsPerGame
    )
}

/** Uma casa decimal, sem depender de `String.format` (indisponível no código comum). */
fun formatOneDecimal(value: Double): String {
    val tenths = kotlin.math.round(value * 10).toLong()
    return "${tenths / 10},${kotlin.math.abs(tenths % 10)}"
}
