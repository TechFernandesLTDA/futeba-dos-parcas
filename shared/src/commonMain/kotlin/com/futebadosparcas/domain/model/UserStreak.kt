package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Streak de jogos consecutivos do usuário.
 *
 * O streak conta quantos jogos consecutivos o usuário participou.
 * Se o usuário ficar sem jogar por mais de 1 dia, o streak reseta.
 */
@Serializable
data class UserStreak(
    val id: String = "",
    @SerialName("user_id")
    val userId: String = "",
    @SerialName("schedule_id")
    val scheduleId: String? = null,
    @SerialName("current_streak")
    val currentStreak: Int = 0,
    @SerialName("longest_streak")
    val longestStreak: Int = 0,
    @SerialName("last_game_date")
    val lastGameDate: String? = null, // Formato: "yyyy-MM-dd"
    @SerialName("streak_started_at")
    val streakStartedAt: String? = null // Formato: "yyyy-MM-dd"
) {
    /**
     * Verifica se o streak está ativo (jogou nos últimos 2 dias).
     */
    fun isStreakActive(): Boolean = currentStreak > 0

    /**
     * Retorna a mensagem de conquista baseada no streak.
     */
    fun getStreakMessage(): String {
        return when {
            currentStreak >= 30 -> "Mítico! $currentStreak jogos consecutivos!"
            currentStreak >= 20 -> "Lendário! $currentStreak jogos seguidos!"
            currentStreak >= 10 -> "Incansável! $currentStreak jogos consecutivos!"
            currentStreak >= 5 -> "Em chamas! $currentStreak jogos seguidos!"
            currentStreak >= 3 -> "Em sequência! $currentStreak jogos"
            currentStreak > 0 -> "Continue assim!"
            else -> "Comece seu streak hoje!"
        }
    }
}
