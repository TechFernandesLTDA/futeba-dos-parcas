package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Acoes que concedem (ou penalizam) XP em uma partida.
 *
 * Source of truth: shared/xp-constants.json — keep in sync
 *
 * Cada acao tem um valor padrao de XP associado.
 * Esses valores podem ser sobrescritos por [GamificationSettings] do grupo.
 *
 * Regras de XP:
 * - Participacao: +10 XP por jogo (base)
 * - Gol: +25 XP cada
 * - Assistencia: +20 XP cada
 * - Defesa (goleiro): +15 XP cada
 * - Clean Sheet (goleiro): +15 XP bonus
 * - Vitoria: +30 XP
 * - Empate: +10 XP
 * - MVP: +50 XP
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
    PARTICIPATION(10, "Participação"),

    /** Gol marcado */
    @SerialName("GOAL")
    GOAL(25, "Gol"),

    /** Assistencia */
    @SerialName("ASSIST")
    ASSIST(20, "Assistência"),

    /** Defesa do goleiro */
    @SerialName("SAVE")
    SAVE(15, "Defesa"),

    /** Clean Sheet do goleiro (sem sofrer gol) */
    @SerialName("CLEAN_SHEET")
    CLEAN_SHEET(15, "Clean Sheet"),

    /** Vitoria da equipe */
    @SerialName("WIN")
    WIN(30, "Vitória"),

    /** Empate da equipe */
    @SerialName("DRAW")
    DRAW(10, "Empate"),

    /** Eleito MVP da partida */
    @SerialName("MVP")
    MVP(50, "MVP"),

    /** Sequencia de 3 jogos consecutivos */
    @SerialName("STREAK_3")
    STREAK_3(20, "Sequência 3"),

    /** Sequencia de 5 jogos consecutivos */
    @SerialName("STREAK_5")
    STREAK_5(35, "Sequência 5"),

    /** Sequencia de 7 jogos consecutivos */
    @SerialName("STREAK_7")
    STREAK_7(50, "Sequência 7"),

    /** Sequencia de 10+ jogos consecutivos */
    @SerialName("STREAK_10")
    STREAK_10(100, "Sequência 10"),

    /** Penalidade por ser eleito Bola Murcha (pior jogador) */
    @SerialName("WORST_PLAYER")
    WORST_PLAYER(-10, "Bola Murcha"),

    /** Maior goleador da partida (inclusive em empate). */
    @SerialName("TOP_SCORER")
    TOP_SCORER(15, "Artilheiro do Jogo 🎯"),

    /** Fez tres ou mais gols na mesma partida. */
    @SerialName("HAT_TRICK")
    HAT_TRICK(30, "Hat-trick ⚽⚽⚽"),

    /** Marcou o primeiro gol da partida. */
    @SerialName("FIRST_GOAL")
    FIRST_GOAL(5, "Primeiro Gol do Jogo 🥇"),

    /** Goleiro marcou um gol durante a partida. */
    @SerialName("GOALKEEPER_GOAL")
    GOALKEEPER_GOAL(20, "Gol do Goleiro 🧤"),

    /** Participou sem receber cartoes. */
    @SerialName("FAIR_PLAY")
    FAIR_PLAY(5, "Fair Play 🤝"),

    /** Retornou apos 14 dias sem jogar. */
    @SerialName("COMEBACK_14D")
    COMEBACK_14D(10, "Tá de volta! 🔙"),

    /** Retornou apos 30 dias sem jogar. */
    @SerialName("COMEBACK_30D")
    COMEBACK_30D(20, "Tá de volta! 🔙"),

    /** Primeiro jogo do mes civil. */
    @SerialName("FIRST_GAME_OF_MONTH")
    FIRST_GAME_OF_MONTH(15, "Primeira do Mês 📅"),

    /** Tres meses consecutivos com participacao. */
    @SerialName("MONTHLY_STREAK_3")
    MONTHLY_STREAK_3(50, "Sequência Mensal 🔥"),

    /** Seis meses consecutivos com participacao. */
    @SerialName("MONTHLY_STREAK_6")
    MONTHLY_STREAK_6(100, "Sequência Mensal 6 🔥"),

    /** Doze meses consecutivos com participacao. */
    @SerialName("MONTHLY_STREAK_12")
    MONTHLY_STREAK_12(250, "Sequência Mensal 12 🔥"),

    /** Registrou eventos validos no jogo. */
    @SerialName("EVENT_RECORDER")
    EVENT_RECORDER(2, "Mesa Oficial 📝"),

    /** Confirmou presenca com 48h ou mais de antecedencia. */
    @SerialName("EARLY_CONFIRMATION")
    EARLY_CONFIRMATION(5, "Confirmação Antecipada ⏰"),

    /** Fez check-in ate dez minutos apos o inicio. */
    @SerialName("ON_TIME_CHECKIN")
    ON_TIME_CHECKIN(5, "Pontualidade ⏱️"),

    /** Completou um jogo que ainda estava incompleto na ultima hora. */
    @SerialName("LAST_MINUTE_SAVER")
    LAST_MINUTE_SAVER(15, "Salvou a Pelada 🦸"),

    /** Foi promovido da waitlist e compareceu. */
    @SerialName("WAITLIST_PROMOTED")
    WAITLIST_PROMOTED(10, "Veio da Waitlist 🎟️");

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
