package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Temporada da liga.
 */
@Serializable
data class Season(
    val id: String = "",
    val name: String = "",
    val description: String = "",
    @SerialName("start_date") val startDate: Long = 0,
    @SerialName("end_date") val endDate: Long = 0,
    @SerialName("is_active") val isActive: Boolean = false,
    @SerialName("created_at") val createdAt: Long? = null,
    @SerialName("closed_at") val closedAt: Long? = null,
    @SerialName("total_participants") val totalParticipants: Int = 0,
    @SerialName("total_games") val totalGames: Int = 0
)

/**
 * Participacao de um usuario em uma temporada.
 */
@Serializable
data class SeasonParticipation(
    val id: String = "",
    @SerialName("season_id") val seasonId: String = "",
    @SerialName("user_id") val userId: String = "",
    val division: String = LeagueDivision.BRONZE.name,
    @SerialName("league_rating") val leagueRating: Int = 1000,
    val points: Int = 0,
    @SerialName("games_played") val gamesPlayed: Int = 0,
    val wins: Int = 0,
    val draws: Int = 0,
    val losses: Int = 0,
    val goals: Int = 0,
    val assists: Int = 0,
    val saves: Int = 0,
    @SerialName("mvp_count") val mvpCount: Int = 0,
    @SerialName("best_gk_count") val bestGkCount: Int = 0,
    @SerialName("worst_player_count") val worstPlayerCount: Int = 0,
    @SerialName("current_streak") val currentStreak: Int = 0,
    @SerialName("best_streak") val bestStreak: Int = 0,
    @SerialName("xp_earned") val xpEarned: Long = 0,
    @SerialName("created_at") val createdAt: Long? = null,
    @SerialName("updated_at") val updatedAt: Long? = null
) {
    fun getDivisionEnum(): LeagueDivision = LeagueDivision.fromString(division)

    /**
     * Calcula a taxa de vitoria.
     */
    fun getWinRate(): Float {
        if (gamesPlayed == 0) return 0f
        return wins.toFloat() / gamesPlayed.toFloat()
    }

    /**
     * Calcula media de gols por jogo.
     */
    fun getGoalsPerGame(): Float {
        if (gamesPlayed == 0) return 0f
        return goals.toFloat() / gamesPlayed.toFloat()
    }

    /**
     * Calcula media de assistencias por jogo.
     */
    fun getAssistsPerGame(): Float {
        if (gamesPlayed == 0) return 0f
        return assists.toFloat() / gamesPlayed.toFloat()
    }
}
