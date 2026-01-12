package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Tipo de desafio semanal.
 */
@Serializable
enum class ChallengeType(val displayName: String, val description: String) {
    @SerialName("score_goals")
    SCORE_GOALS("Marque Gols", "Marque uma quantidade de gols em jogos"),

    @SerialName("win_games")
    WIN_GAMES("Vença Jogos", "Vença uma quantidade de jogos"),

    @SerialName("assists")
    ASSISTS("Dê Assistências", "Dê uma quantidade de assistências"),

    @SerialName("clean_sheets")
    CLEAN_SHEETS("Jogos Sem Sofrer Gol", "Jogue jogos sem sofrer gols"),

    @SerialName("play_games")
    PLAY_GAMES("Participe de Jogos", "Participe de uma quantidade de jogos"),

    @SerialName("invite_players")
    INVITE_PLAYERS("Convide Jogadores", "Convide novos jogadores para o grupo")
}

/**
 * Desafio semanal ativo no sistema.
 */
@Serializable
data class WeeklyChallenge(
    val id: String = "",
    val name: String = "",
    val description: String = "",
    val type: ChallengeType = ChallengeType.SCORE_GOALS,
    @SerialName("target_value")
    val targetValue: Int = 0,
    @SerialName("xp_reward")
    val xpReward: Long = 100,
    @SerialName("start_date")
    val startDate: String = "", // Formato: "yyyy-MM-dd"
    @SerialName("end_date")
    val endDate: String = "", // Formato: "yyyy-MM-dd"
    @SerialName("is_active")
    val isActive: Boolean = true,
    @SerialName("schedule_id")
    val scheduleId: String? = null
)

/**
 * Progresso de um usuário em um desafio semanal.
 */
@Serializable
data class UserChallengeProgress(
    val id: String = "",
    @SerialName("user_id")
    val userId: String = "",
    @SerialName("challenge_id")
    val challengeId: String = "",
    @SerialName("current_progress")
    val currentProgress: Int = 0,
    @SerialName("is_completed")
    val isCompleted: Boolean = false,
    @SerialName("completed_at")
    val completedAt: Long? = null // Timestamp em milissegundos
) {
    /**
     * Calcula o percentual de progresso em relação ao objetivo.
     */
    fun progressPercentage(challenge: WeeklyChallenge): Int {
        return if (challenge.targetValue > 0) {
            ((currentProgress.toFloat() / challenge.targetValue) * 100).toInt().coerceIn(0, 100)
        } else 0
    }

    /**
     * Verifica se o progresso está quase completo (80%+).
     */
    fun isAlmostComplete(challenge: WeeklyChallenge): Boolean {
        return progressPercentage(challenge) >= 80
    }
}
