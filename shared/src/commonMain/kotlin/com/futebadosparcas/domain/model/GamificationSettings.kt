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
    @SerialName("xp_per_save") val xpPerSave: Int = 5,
    @SerialName("xp_win") val xpWin: Int = 20,
    @SerialName("xp_draw") val xpDraw: Int = 10,
    @SerialName("xp_mvp") val xpMvp: Int = 30,
    @SerialName("xp_streak_3") val xpStreak3: Int = 20,
    @SerialName("xp_streak_7") val xpStreak7: Int = 50,
    @SerialName("xp_streak_10") val xpStreak10: Int = 100,
    @SerialName("xp_worst_player_penalty") val xpWorstPlayerPenalty: Int = -10,
    @SerialName("updated_at") val updatedAt: Long = 0L,
    @SerialName("updated_by") val updatedBy: String = ""
)
