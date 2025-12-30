package com.futebadosparcas.data.model

import com.google.firebase.firestore.PropertyName

/**
 * Representa as configuracoes dinamicas de XP do aplicativo.
 * Armazenado em app_settings/gamification
 */
data class GamificationSettings(
    @get:PropertyName("xp_presence") @set:PropertyName("xp_presence") var xpPresence: Int = 10,
    @get:PropertyName("xp_per_goal") @set:PropertyName("xp_per_goal") var xpPerGoal: Int = 10,
    @get:PropertyName("xp_per_assist") @set:PropertyName("xp_per_assist") var xpPerAssist: Int = 7,
    @get:PropertyName("xp_per_save") @set:PropertyName("xp_per_save") var xpPerSave: Int = 5,
    @get:PropertyName("xp_win") @set:PropertyName("xp_win") var xpWin: Int = 20,
    @get:PropertyName("xp_draw") @set:PropertyName("xp_draw") var xpDraw: Int = 10,
    @get:PropertyName("xp_mvp") @set:PropertyName("xp_mvp") var xpMvp: Int = 30,
    @get:PropertyName("xp_streak_3") @set:PropertyName("xp_streak_3") var xpStreak3: Int = 20,
    @get:PropertyName("xp_streak_7") @set:PropertyName("xp_streak_7") var xpStreak7: Int = 50,
    @get:PropertyName("xp_streak_10") @set:PropertyName("xp_streak_10") var xpStreak10: Int = 100,
    @get:PropertyName("updated_at") @set:PropertyName("updated_at") var updatedAt: Long = System.currentTimeMillis(),
    @get:PropertyName("updated_by") @set:PropertyName("updated_by") var updatedBy: String = ""
)
