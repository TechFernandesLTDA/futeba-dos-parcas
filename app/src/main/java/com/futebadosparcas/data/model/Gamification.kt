package com.futebadosparcas.data.model

import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

// ========== LIGAS E TEMPORADAS ==========

enum class LeagueDivision(val displayName: String, val colorHex: String) {
    BRONZE("Bronze", "#5D4037"),
    PRATA("Prata", "#757575"),
    OURO("Ouro", "#FFD700"),
    DIAMANTE("Diamante", "#00BCD4")
}

data class Season(
    @DocumentId
    val id: String = "",
    val name: String = "",
    @get:PropertyName("start_date")
    @set:PropertyName("start_date")
    var startDate: String = "",
    @get:PropertyName("end_date")
    @set:PropertyName("end_date")
    var endDate: String = "",
    @get:PropertyName("is_active")
    @set:PropertyName("is_active")
    var isActive: Boolean = true,
    @get:PropertyName("schedule_id")
    @set:PropertyName("schedule_id")
    var scheduleId: String? = null,
    @ServerTimestamp
    @get:PropertyName("created_at")
    @set:PropertyName("created_at")
    var createdAt: Date? = null
) {
    constructor() : this(id = "")
}

data class SeasonParticipation(
    @DocumentId
    val id: String = "",
    @get:PropertyName("user_id")
    @set:PropertyName("user_id")
    var userId: String = "",
    @get:PropertyName("season_id")
    @set:PropertyName("season_id")
    var seasonId: String = "",
    val division: LeagueDivision = LeagueDivision.BRONZE,
    val points: Int = 0,
    @get:PropertyName("games_played")
    @set:PropertyName("games_played")
    var gamesPlayed: Int = 0,
    val wins: Int = 0,
    val draws: Int = 0,
    val losses: Int = 0,
    @get:PropertyName("goals_scored")
    @set:PropertyName("goals_scored")
    var goalsScored: Int = 0,
    @get:PropertyName("goals_conceded")
    @set:PropertyName("goals_conceded")
    var goalsConceded: Int = 0,
    @get:PropertyName("mvp_count")
    @set:PropertyName("mvp_count")
    var mvpCount: Int = 0
) {
    constructor() : this(id = "")
    
    val goalDifference: Int
        get() = goalsScored - goalsConceded
}

// ========== BADGES E CONQUISTAS ==========

enum class BadgeType {
    HAT_TRICK, PAREDAO, ARTILHEIRO_MES,
    FOMINHA, STREAK_7, STREAK_30,
    ORGANIZADOR_MASTER, INFLUENCER,
    LENDA, FAIXA_PRETA, MITO
}

enum class BadgeRarity {
    COMUM, RARO, EPICO, LENDARIO
}

data class Badge(
    @DocumentId
    val id: String = "",
    val type: BadgeType = BadgeType.HAT_TRICK,
    val name: String = "",
    val description: String = "",
    @get:PropertyName("icon_url")
    @set:PropertyName("icon_url")
    var iconUrl: String = "",
    @get:PropertyName("xp_reward")
    @set:PropertyName("xp_reward")
    var xpReward: Int = 0,
    val rarity: BadgeRarity = BadgeRarity.COMUM
) {
    constructor() : this(id = "")
}

data class UserBadge(
    @DocumentId
    val id: String = "",
    @get:PropertyName("user_id")
    @set:PropertyName("user_id")
    var userId: String = "",
    @get:PropertyName("badge_id")
    @set:PropertyName("badge_id")
    var badgeId: String = "",
    val count: Int = 1,
    @get:PropertyName("unlocked_at")
    @set:PropertyName("unlocked_at")
    var unlockedAt: Date? = null,
    @get:PropertyName("last_earned_at")
    @set:PropertyName("last_earned_at")
    var lastEarnedAt: Date? = null
) {
    constructor() : this(id = "")
}

// ========== STREAK ==========

data class UserStreak(
    @DocumentId
    val id: String = "",
    @get:PropertyName("user_id")
    @set:PropertyName("user_id")
    var userId: String = "",
    @get:PropertyName("schedule_id")
    @set:PropertyName("schedule_id")
    var scheduleId: String? = null,
    @get:PropertyName("current_streak")
    @set:PropertyName("current_streak")
    var currentStreak: Int = 0,
    @get:PropertyName("longest_streak")
    @set:PropertyName("longest_streak")
    var longestStreak: Int = 0,
    @get:PropertyName("last_game_date")
    @set:PropertyName("last_game_date")
    var lastGameDate: String? = null,
    @get:PropertyName("streak_started_at")
    @set:PropertyName("streak_started_at")
    var streakStartedAt: String? = null
) {
    constructor() : this(id = "")
}

// ========== DESAFIOS SEMANAIS ==========

enum class ChallengeType {
    SCORE_GOALS, WIN_GAMES, ASSISTS,
    CLEAN_SHEETS, PLAY_GAMES, INVITE_PLAYERS
}

data class WeeklyChallenge(
    @DocumentId
    val id: String = "",
    val name: String = "",
    val description: String = "",
    val type: ChallengeType = ChallengeType.SCORE_GOALS,
    @get:PropertyName("target_value")
    @set:PropertyName("target_value")
    var targetValue: Int = 0,
    @get:PropertyName("xp_reward")
    @set:PropertyName("xp_reward")
    var xpReward: Int = 100,
    @get:PropertyName("start_date")
    @set:PropertyName("start_date")
    var startDate: String = "",
    @get:PropertyName("end_date")
    @set:PropertyName("end_date")
    var endDate: String = "",
    @get:PropertyName("is_active")
    @set:PropertyName("is_active")
    var isActive: Boolean = true,
    @get:PropertyName("schedule_id")
    @set:PropertyName("schedule_id")
    var scheduleId: String? = null
) {
    constructor() : this(id = "")
}

data class UserChallengeProgress(
    @DocumentId
    val id: String = "",
    @get:PropertyName("user_id")
    @set:PropertyName("user_id")
    var userId: String = "",
    @get:PropertyName("challenge_id")
    @set:PropertyName("challenge_id")
    var challengeId: String = "",
    @get:PropertyName("current_progress")
    @set:PropertyName("current_progress")
    var currentProgress: Int = 0,
    @get:PropertyName("is_completed")
    @set:PropertyName("is_completed")
    var isCompleted: Boolean = false,
    @get:PropertyName("completed_at")
    @set:PropertyName("completed_at")
    var completedAt: Date? = null
) {
    constructor() : this(id = "")

    fun progressPercentage(challenge: WeeklyChallenge): Int {
        return if (challenge.targetValue > 0) {
            ((currentProgress.toFloat() / challenge.targetValue) * 100).toInt().coerceIn(0, 100)
        } else 0
    }
}

// ========== ÁLBUM DE FIGURINHAS (PLAYER CARDS) ==========

enum class CardRarity {
    COMUM, INCOMUM, RARO, EPICO, LENDARIO
}

data class PlayerCard(
    @DocumentId
    val id: String = "",
    @get:PropertyName("user_id")
    @set:PropertyName("user_id")
    var userId: String = "",
    val season: String = "Temporada Atual",
    @get:PropertyName("attack_rating")
    @set:PropertyName("attack_rating")
    var attackRating: Int = 50,
    @get:PropertyName("defense_rating")
    @set:PropertyName("defense_rating")
    var defenseRating: Int = 50,
    @get:PropertyName("physical_rating")
    @set:PropertyName("physical_rating")
    var physicalRating: Int = 50,
    @get:PropertyName("technique_rating")
    @set:PropertyName("technique_rating")
    var techniqueRating: Int = 50,
    @get:PropertyName("overall_rating")
    @set:PropertyName("overall_rating")
    var overallRating: Int = 50,
    val rarity: CardRarity = CardRarity.COMUM,
    val level: Int = 1,
    @get:PropertyName("total_games")
    @set:PropertyName("total_games")
    var totalGames: Int = 0,
    @get:PropertyName("special_trait")
    @set:PropertyName("special_trait")
    var specialTrait: String? = null,
    @get:PropertyName("card_image_url")
    @set:PropertyName("card_image_url")
    var cardImageUrl: String? = null
) {
    constructor() : this(id = "")

    // Cor da carta baseada na raridade
    fun getCardColor(): String {
        return when (rarity) {
            CardRarity.COMUM -> "#8E8E8E"
            CardRarity.INCOMUM -> "#4CAF50"
            CardRarity.RARO -> "#2196F3"
            CardRarity.EPICO -> "#9C27B0"
            CardRarity.LENDARIO -> "#FFD700"
        }
    }
}

// ========== CONFRONTO DIRETO (FREGUESIA) ==========

data class HeadToHead(
    @DocumentId
    val id: String = "",
    @get:PropertyName("player1_id")
    @set:PropertyName("player1_id")
    var player1Id: String = "",
    @get:PropertyName("player2_id")
    @set:PropertyName("player2_id")
    var player2Id: String = "",
    @get:PropertyName("player1_wins")
    @set:PropertyName("player1_wins")
    var player1Wins: Int = 0,
    @get:PropertyName("player2_wins")
    @set:PropertyName("player2_wins")
    var player2Wins: Int = 0,
    val draws: Int = 0,
    @get:PropertyName("total_games")
    @set:PropertyName("total_games")
    var totalGames: Int = 0,
    @get:PropertyName("player1_goals")
    @set:PropertyName("player1_goals")
    var player1Goals: Int = 0,
    @get:PropertyName("player2_goals")
    @set:PropertyName("player2_goals")
    var player2Goals: Int = 0
) {
    constructor() : this(id = "")

    fun getWinPercentage(playerId: String): Double {
        if (totalGames == 0) return 0.0
        val wins = if (playerId == player1Id) player1Wins else player2Wins
        return (wins.toDouble() / totalGames) * 100
    }
}
