package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Estatisticas gerais de um jogador.
 */
@Serializable
data class Statistics(
    val id: String = "",
    @SerialName("user_id") val userId: String = "",
    @SerialName("total_games") val totalGames: Int = 0,
    @SerialName("total_goals") val totalGoals: Int = 0,
    @SerialName("total_assists") val totalAssists: Int = 0,
    @SerialName("total_saves") val totalSaves: Int = 0,
    @SerialName("total_wins") val totalWins: Int = 0,
    @SerialName("total_draws") val totalDraws: Int = 0,
    @SerialName("total_losses") val totalLosses: Int = 0,
    @SerialName("mvp_count") val mvpCount: Int = 0,
    @SerialName("best_gk_count") val bestGkCount: Int = 0,
    @SerialName("worst_player_count") val worstPlayerCount: Int = 0,
    @SerialName("current_streak") val currentStreak: Int = 0,
    @SerialName("best_streak") val bestStreak: Int = 0,
    @SerialName("yellow_cards") val yellowCards: Int = 0,
    @SerialName("red_cards") val redCards: Int = 0,
    @SerialName("last_game_date") val lastGameDate: Long? = null,
    @SerialName("updated_at") val updatedAt: Long? = null
) {
    /**
     * Calcula a taxa de vitoria.
     */
    fun getWinRate(): Float {
        if (totalGames == 0) return 0f
        return totalWins.toFloat() / totalGames.toFloat()
    }

    /**
     * Calcula media de gols por jogo.
     */
    fun getGoalsPerGame(): Float {
        if (totalGames == 0) return 0f
        return totalGoals.toFloat() / totalGames.toFloat()
    }

    /**
     * Calcula media de assistencias por jogo.
     */
    fun getAssistsPerGame(): Float {
        if (totalGames == 0) return 0f
        return totalAssists.toFloat() / totalGames.toFloat()
    }

    /**
     * Calcula participacao em gols (gols + assistencias).
     */
    fun getGoalParticipation(): Int = totalGoals + totalAssists

    /**
     * Calcula media de participacao em gols por jogo.
     */
    fun getGoalParticipationPerGame(): Float {
        if (totalGames == 0) return 0f
        return getGoalParticipation().toFloat() / totalGames.toFloat()
    }
}

/**
 * Log de XP ganho em um jogo.
 */
@Serializable
data class XpLog(
    val id: String = "",
    @SerialName("user_id") val userId: String = "",
    @SerialName("game_id") val gameId: String = "",
    @SerialName("xp_earned") val xpEarned: Long = 0,
    @SerialName("xp_before") val xpBefore: Long = 0,
    @SerialName("xp_after") val xpAfter: Long = 0,
    @SerialName("level_before") val levelBefore: Int = 1,
    @SerialName("level_after") val levelAfter: Int = 1,

    // Breakdown do XP
    @SerialName("xp_participation") val xpParticipation: Int = 0,
    @SerialName("xp_goals") val xpGoals: Int = 0,
    @SerialName("xp_assists") val xpAssists: Int = 0,
    @SerialName("xp_saves") val xpSaves: Int = 0,
    @SerialName("xp_result") val xpResult: Int = 0,
    @SerialName("xp_mvp") val xpMvp: Int = 0,
    @SerialName("xp_milestones") val xpMilestones: Int = 0,
    @SerialName("xp_streak") val xpStreak: Int = 0,

    // Dados do jogo
    val goals: Int = 0,
    val assists: Int = 0,
    val saves: Int = 0,
    @SerialName("was_mvp") val wasMvp: Boolean = false,
    @SerialName("game_result") val gameResult: String = "",
    @SerialName("milestones_unlocked") val milestonesUnlocked: List<String> = emptyList(),
    @SerialName("created_at") val createdAt: Long? = null
) {
    fun didLevelUp(): Boolean = levelAfter > levelBefore
}
