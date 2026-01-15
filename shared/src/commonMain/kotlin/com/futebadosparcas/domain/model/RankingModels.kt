package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Categorias de ranking disponíveis.
 */
@Serializable
enum class RankingCategory(val displayName: String, val field: String) {
    @SerialName("goals")
    GOALS("Artilheiros", "totalGoals"),

    @SerialName("assists")
    ASSISTS("Assistências", "totalAssists"),

    @SerialName("saves")
    SAVES("Defesas", "totalSaves"),

    @SerialName("mvp")
    MVP("Craques", "mvpCount"),

    @SerialName("xp")
    XP("XP", "experience_points"),

    @SerialName("games")
    GAMES("Participação", "totalGames"),

    @SerialName("wins")
    WINS("Vitórias", "totalWins");

    companion object {
        fun fromString(value: String?): RankingCategory {
            return entries.find { it.name.equals(value, ignoreCase = true) } ?: GOALS
        }
    }
}

/**
 * Períodos de tempo para ranking.
 */
@Serializable
enum class RankingPeriod(val displayName: String, val minGames: Int) {
    @SerialName("week")
    WEEK("Semana", 2),

    @SerialName("month")
    MONTH("Mês", 4),

    @SerialName("year")
    YEAR("Ano", 20),

    @SerialName("all_time")
    ALL_TIME("Histórico", 10);

    companion object {
        fun fromString(value: String?): RankingPeriod {
            return entries.find { it.name.equals(value, ignoreCase = true) } ?: ALL_TIME
        }
    }
}

/**
 * Item de ranking de um jogador.
 */
@Serializable
data class PlayerRankingItem(
    val rank: Int = 0,
    @SerialName("user_id") val userId: String = "",
    @SerialName("player_name") val playerName: String = "",
    val value: Long = 0L,
    @SerialName("photo_url") val photoUrl: String? = null,
    @SerialName("games_played") val gamesPlayed: Int = 0,
    val average: Double = 0.0,
    val nickname: String? = null,
    val level: Int = 0
)

/**
 * Dados de evolução de XP de um jogador.
 */
@Serializable
data class XpEvolution(
    @SerialName("user_id") val userId: String = "",
    @SerialName("monthly_xp") val monthlyXp: Map<String, Long> = emptyMap(),
    @SerialName("total_xp") val totalXp: Long = 0L,
    @SerialName("current_level") val currentLevel: Int = 0,
    @SerialName("last_update") val lastUpdate: Long? = null
)

/**
 * Histórico de XP de um jogador para um período específico.
 */
@Serializable
data class XpHistoryEntry(
    val period: String = "",
    @SerialName("xp_earned") val xpEarned: Long = 0L,
    @SerialName("xp_before") val xpBefore: Long = 0L,
    @SerialName("xp_after") val xpAfter: Long = 0L,
    @SerialName("level_before") val levelBefore: Int = 0,
    @SerialName("level_after") val levelAfter: Int = 0,
    @SerialName("games_played") val gamesPlayed: Int = 0,
    val goals: Int = 0,
    val assists: Int = 0,
    val saves: Int = 0,
    @SerialName("mvp_count") val mvpCount: Int = 0
)
