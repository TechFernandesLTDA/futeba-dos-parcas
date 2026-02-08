package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Configuracoes de XP e gamificacao.
 * Permite customizar valores de XP por acao.
 */
@Serializable
data class GamificationSettings(
    @SerialName("xp_presence") val xpPresence: Int = 10,
    @SerialName("xp_per_goal") val xpPerGoal: Int = 10,
    @SerialName("xp_per_assist") val xpPerAssist: Int = 7,
    @SerialName("xp_per_save") val xpPerSave: Int = 8,              // Aumentado de 5 para 8 (balance goleiros)
    @SerialName("xp_clean_sheet") val xpCleanSheet: Int = 15,      // NOVO: Bonus goleiro clean sheet
    @SerialName("xp_win") val xpWin: Int = 20,
    @SerialName("xp_draw") val xpDraw: Int = 10,
    @SerialName("xp_mvp") val xpMvp: Int = 30,
    @SerialName("xp_streak_3") val xpStreak3: Int = 20,
    @SerialName("xp_streak_5") val xpStreak5: Int = 35,            // NOVO: Bonus intermediário
    @SerialName("xp_streak_7") val xpStreak7: Int = 50,
    @SerialName("xp_streak_10") val xpStreak10: Int = 100,
    @SerialName("xp_worst_player_penalty") val xpWorstPlayerPenalty: Int = -10,
    @SerialName("updated_at") val updatedAt: Long = 0L,
    @SerialName("updated_by") val updatedBy: String = ""
) {
    init {
        require(xpPresence >= 0) { "xpPresence nao pode ser negativo: $xpPresence" }
        require(xpPerGoal >= 0) { "xpPerGoal nao pode ser negativo: $xpPerGoal" }
        require(xpPerAssist >= 0) { "xpPerAssist nao pode ser negativo: $xpPerAssist" }
        require(xpPerSave >= 0) { "xpPerSave nao pode ser negativo: $xpPerSave" }
        require(xpCleanSheet >= 0) { "xpCleanSheet nao pode ser negativo: $xpCleanSheet" }
        require(xpWin >= 0) { "xpWin nao pode ser negativo: $xpWin" }
        require(xpDraw >= 0) { "xpDraw nao pode ser negativo: $xpDraw" }
        require(xpMvp >= 0) { "xpMvp nao pode ser negativo: $xpMvp" }
        require(xpStreak3 >= 0) { "xpStreak3 nao pode ser negativo: $xpStreak3" }
        require(xpStreak5 >= 0) { "xpStreak5 nao pode ser negativo: $xpStreak5" }
        require(xpStreak7 >= 0) { "xpStreak7 nao pode ser negativo: $xpStreak7" }
        require(xpStreak10 >= 0) { "xpStreak10 nao pode ser negativo: $xpStreak10" }
        require(xpWorstPlayerPenalty <= 0) {
            "xpWorstPlayerPenalty deve ser <= 0 (eh uma penalidade): $xpWorstPlayerPenalty"
        }
    }
}
