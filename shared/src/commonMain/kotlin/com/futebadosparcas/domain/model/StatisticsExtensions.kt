package com.futebadosparcas.domain.model

/**
 * Interface para objetos que possuem estatisticas de jogos com contadores
 * de partidas, gols, assistencias, vitorias, etc.
 *
 * Elimina duplicacao de calculos de taxa (win rate, goals per game, etc.)
 * que estavam repetidos em Statistics e SeasonParticipation.
 */
interface HasGameStats {
    val statGamesPlayed: Int
    val statGoals: Int
    val statAssists: Int
    val statWins: Int
}

/**
 * Calcula a taxa de vitoria (0.0 a 1.0).
 * Retorna 0f se nenhum jogo foi disputado.
 */
fun HasGameStats.winRate(): Float {
    if (statGamesPlayed == 0) return 0f
    return statWins.toFloat() / statGamesPlayed.toFloat()
}

/**
 * Calcula media de gols por jogo.
 * Retorna 0f se nenhum jogo foi disputado.
 */
fun HasGameStats.goalsPerGame(): Float {
    if (statGamesPlayed == 0) return 0f
    return statGoals.toFloat() / statGamesPlayed.toFloat()
}

/**
 * Calcula media de assistencias por jogo.
 * Retorna 0f se nenhum jogo foi disputado.
 */
fun HasGameStats.assistsPerGame(): Float {
    if (statGamesPlayed == 0) return 0f
    return statAssists.toFloat() / statGamesPlayed.toFloat()
}

/**
 * Calcula participacao total em gols (gols + assistencias).
 */
fun HasGameStats.goalParticipation(): Int = statGoals + statAssists

/**
 * Calcula media de participacao em gols por jogo.
 * Retorna 0f se nenhum jogo foi disputado.
 */
fun HasGameStats.goalParticipationPerGame(): Float {
    if (statGamesPlayed == 0) return 0f
    return goalParticipation().toFloat() / statGamesPlayed.toFloat()
}

/**
 * Calcula a taxa de aproveitamento formatada como porcentagem (0 a 100).
 */
fun HasGameStats.winRatePercentage(): Int {
    return (winRate() * 100).toInt()
}

/**
 * Calcula taxa segura: divisao protegida contra divisao por zero.
 * Util para calculos genericos de media.
 */
fun safeRate(numerator: Int, denominator: Int): Float {
    if (denominator == 0) return 0f
    return numerator.toFloat() / denominator.toFloat()
}
