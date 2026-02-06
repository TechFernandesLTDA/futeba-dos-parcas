package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Acoes que concedem (ou penalizam) XP em uma partida.
 *
 * Cada acao tem um valor padrao de XP associado.
 * Esses valores podem ser sobrescritos por [GamificationSettings] do grupo.
 *
 * Regras de XP:
 * - Participacao: +10 XP por jogo (base)
 * - Gol: +10 XP cada
 * - Assistencia: +7 XP cada
 * - Defesa (goleiro): +8 XP cada
 * - Clean Sheet (goleiro): +15 XP bonus
 * - Vitoria: +20 XP
 * - Empate: +10 XP
 * - MVP: +30 XP
 * - Streak 3: +20 XP
 * - Streak 5: +35 XP
 * - Streak 7: +50 XP
 * - Streak 10: +100 XP
 * - Bola Murcha: -10 XP (penalidade)
 *
 * @property defaultXp Valor padrao de XP para esta acao
 * @property displayName Nome de exibicao em PT-BR
 */
@Serializable
enum class XpAction(val defaultXp: Int, val displayName: String) {

    /** Presenca no jogo (base) */
    @SerialName("PARTICIPATION")
    PARTICIPATION(10, "Participacao"),

    /** Gol marcado */
    @SerialName("GOAL")
    GOAL(10, "Gol"),

    /** Assistencia */
    @SerialName("ASSIST")
    ASSIST(7, "Assistencia"),

    /** Defesa do goleiro */
    @SerialName("SAVE")
    SAVE(8, "Defesa"),

    /** Clean Sheet do goleiro (sem sofrer gol) */
    @SerialName("CLEAN_SHEET")
    CLEAN_SHEET(15, "Clean Sheet"),

    /** Vitoria da equipe */
    @SerialName("WIN")
    WIN(20, "Vitoria"),

    /** Empate da equipe */
    @SerialName("DRAW")
    DRAW(10, "Empate"),

    /** Eleito MVP da partida */
    @SerialName("MVP")
    MVP(30, "MVP"),

    /** Sequencia de 3 jogos consecutivos */
    @SerialName("STREAK_3")
    STREAK_3(20, "Sequencia 3"),

    /** Sequencia de 5 jogos consecutivos */
    @SerialName("STREAK_5")
    STREAK_5(35, "Sequencia 5"),

    /** Sequencia de 7 jogos consecutivos */
    @SerialName("STREAK_7")
    STREAK_7(50, "Sequencia 7"),

    /** Sequencia de 10+ jogos consecutivos */
    @SerialName("STREAK_10")
    STREAK_10(100, "Sequencia 10"),

    /** Penalidade por ser eleito Bola Murcha (pior jogador) */
    @SerialName("WORST_PLAYER")
    WORST_PLAYER(-10, "Bola Murcha");

    companion object {
        /**
         * Retorna a acao de streak adequada para o numero de jogos consecutivos.
         * Retorna null se nao atingiu nenhum nivel de streak.
         */
        fun streakActionFor(consecutiveGames: Int): XpAction? {
            return when {
                consecutiveGames >= 10 -> STREAK_10
                consecutiveGames >= 7 -> STREAK_7
                consecutiveGames >= 5 -> STREAK_5
                consecutiveGames >= 3 -> STREAK_3
                else -> null
            }
        }

        /**
         * Retorna o XP de streak para o numero de jogos consecutivos.
         * Retorna 0 se nao atingiu nenhum nivel.
         */
        fun streakXpFor(consecutiveGames: Int): Int {
            return streakActionFor(consecutiveGames)?.defaultXp ?: 0
        }
    }
}
