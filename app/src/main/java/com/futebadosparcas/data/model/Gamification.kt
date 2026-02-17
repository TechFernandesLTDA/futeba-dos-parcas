package com.futebadosparcas.data.model

import com.futebadosparcas.domain.validation.ValidationErrorCode
import com.futebadosparcas.domain.validation.ValidationHelper
import com.futebadosparcas.domain.validation.ValidationResult
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.Exclude
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import kotlinx.parcelize.Parcelize
import android.os.Parcelable
import java.util.Date

// ========== LIGAS E TEMPORADAS ==========

// Milestones are now defined in Gamification.kt

// ========== RESULTADOS FINAIS DE TEMPORADA ==========

/**
 * Registro congelado do desempenho do jogador ao fim da temporada.
 */
@IgnoreExtraProperties
data class SeasonFinalStanding(
    @DocumentId
    val id: String = "",
    @get:PropertyName("season_id")
    @set:PropertyName("season_id")
    var seasonId: String = "",
    @get:PropertyName("user_id")
    @set:PropertyName("user_id")
    var userId: String = "",
    val finalDivision: LeagueDivision = LeagueDivision.BRONZE,
    val finalRating: Double = 0.0,
    val points: Int = 0,
    val wins: Int = 0,
    val draws: Int = 0,
    val losses: Int = 0,
    @get:PropertyName("frozen_at")
    @set:PropertyName("frozen_at")
    var frozenAt: Date? = null
) {
    constructor() : this(id = "")

    @Exclude
    fun validate(): List<ValidationResult.Invalid> {
        val errors = mutableListOf<ValidationResult.Invalid>()
        val sResult = ValidationHelper.validateRequiredId(seasonId, "season_id")
        if (sResult is ValidationResult.Invalid) errors.add(sResult)
        val uResult = ValidationHelper.validateRequiredId(userId, "user_id")
        if (uResult is ValidationResult.Invalid) errors.add(uResult)
        val rResult = ValidationHelper.validateLeagueRating(finalRating, "finalRating")
        if (rResult is ValidationResult.Invalid) errors.add(rResult)
        if (wins < 0) errors.add(ValidationResult.Invalid("wins", "Vitórias não pode ser negativo", ValidationErrorCode.NEGATIVE_VALUE))
        return errors
    }
}

enum class MilestoneType(
    val displayName: String,
    val description: String,
    val xpReward: Long,
    val threshold: Int,
    val field: String // Campo em UserStatistics a verificar
) {
    // Jogos
    GAMES_10("Iniciante", "Jogue 10 partidas", 50L, 10, "totalGames"),
    GAMES_25("Frequentador", "Jogue 25 partidas", 100L, 25, "totalGames"),
    GAMES_50("Habitur", "Jogue 50 partidas", 200L, 50, "totalGames"),
    GAMES_100("Veterano", "Jogue 100 partidas", 500L, 100, "totalGames"),
    GAMES_250("Lenda Viva", "Jogue 250 partidas", 1000L, 250, "totalGames"),
    GAMES_500("Imortal", "Jogue 500 partidas", 2500L, 500, "totalGames"),

    // Gols
    GOALS_10("Primeiro Artilheiro", "Marque 10 gols", 50L, 10, "totalGoals"),
    GOALS_25("Goleador", "Marque 25 gols", 100L, 25, "totalGoals"),
    GOALS_50("Matador", "Marque 50 gols", 200L, 50, "totalGoals"),
    GOALS_100("Centena de Gols", "Marque 100 gols", 500L, 100, "totalGoals"),
    GOALS_250("Artilheiro Historico", "Marque 250 gols", 1000L, 250, "totalGoals"),

    // Assistencias
    ASSISTS_10("Garcom", "De 10 assistencias", 50L, 10, "totalAssists"),
    ASSISTS_25("Armador", "De 25 assistencias", 100L, 25, "totalAssists"),
    ASSISTS_50("Maestro", "De 50 assistencias", 200L, 50, "totalAssists"),
    ASSISTS_100("Cerebro", "De 100 assistencias", 500L, 100, "totalAssists"),

    // Defesas (goleiros)
    SAVES_25("Luvas de Ouro", "Faca 25 defesas", 50L, 25, "totalSaves"),
    SAVES_50("Paredao Iniciante", "Faca 50 defesas", 100L, 50, "totalSaves"),
    SAVES_100("Goleiro de Elite", "Faca 100 defesas", 200L, 100, "totalSaves"),
    SAVES_250("Muralha", "Faca 250 defesas", 500L, 250, "totalSaves"),

    // MVPs
    MVP_5("Destaque", "Seja MVP 5 vezes", 100L, 5, "bestPlayerCount"),
    MVP_10("Craque", "Seja MVP 10 vezes", 300L, 10, "bestPlayerCount"),
    MVP_25("Fenomeno", "Seja MVP 25 vezes", 750L, 25, "bestPlayerCount"),
    MVP_50("Lenda", "Seja MVP 50 vezes", 1500L, 50, "bestPlayerCount"),

    // Vitorias
    WINS_10("Vencedor", "Venca 10 jogos", 75L, 10, "gamesWon"),
    WINS_25("Campeao", "Venca 25 jogos", 150L, 25, "gamesWon"),
    WINS_50("Dominador", "Venca 50 jogos", 300L, 50, "gamesWon"),
    WINS_100("Invicto", "Venca 100 jogos", 750L, 100, "gamesWon")
}

enum class LeagueDivision(val displayName: String, val colorHex: String) {
    BRONZE("Bronze", "#5D4037"),
    PRATA("Prata", "#757575"),
    OURO("Ouro", "#FFD700"),
    DIAMANTE("Diamante", "#00BCD4")
}

@IgnoreExtraProperties
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
    var createdAt: Date? = null,
    @get:PropertyName("closed_at")
    @set:PropertyName("closed_at")
    var closedAt: Date? = null
) {
    constructor() : this(id = "")

    @Exclude
    fun validate(): List<ValidationResult.Invalid> {
        val errors = mutableListOf<ValidationResult.Invalid>()
        val nameResult = ValidationHelper.validateName(name, "name")
        if (nameResult is ValidationResult.Invalid) errors.add(nameResult)
        if (startDate.isBlank()) errors.add(ValidationResult.Invalid("start_date", "Data de início é obrigatória", ValidationErrorCode.REQUIRED_FIELD))
        if (endDate.isBlank()) errors.add(ValidationResult.Invalid("end_date", "Data de fim é obrigatória", ValidationErrorCode.REQUIRED_FIELD))
        if (startDate.isNotBlank() && endDate.isNotBlank() && startDate > endDate) {
            errors.add(ValidationResult.Invalid("start_date", "Data de início não pode ser posterior à data de fim", ValidationErrorCode.LOGICAL_INCONSISTENCY))
        }
        // Se inativa, deve ter closed_at
        if (!isActive && closedAt == null) {
            errors.add(ValidationResult.Invalid("closed_at", "Temporada inativa deve ter data de encerramento", ValidationErrorCode.LOGICAL_INCONSISTENCY))
        }
        return errors
    }
}

@IgnoreExtraProperties
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

    @Exclude
    fun validate(): List<ValidationResult.Invalid> {
        val errors = mutableListOf<ValidationResult.Invalid>()
        val uResult = ValidationHelper.validateRequiredId(userId, "user_id")
        if (uResult is ValidationResult.Invalid) errors.add(uResult)
        val sResult = ValidationHelper.validateRequiredId(seasonId, "season_id")
        if (sResult is ValidationResult.Invalid) errors.add(sResult)
        if (gamesPlayed < 0) errors.add(ValidationResult.Invalid("games_played", "Jogos não pode ser negativo", ValidationErrorCode.NEGATIVE_VALUE))
        if (wins < 0) errors.add(ValidationResult.Invalid("wins", "Vitórias não pode ser negativo", ValidationErrorCode.NEGATIVE_VALUE))
        if (wins + draws + losses > gamesPlayed && gamesPlayed >= 0) {
            errors.add(ValidationResult.Invalid("games_played", "Soma de resultados excede total de jogos", ValidationErrorCode.LOGICAL_INCONSISTENCY))
        }
        return errors
    }
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

@Parcelize
@IgnoreExtraProperties
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
    var xpReward: Long = 0,
    val rarity: BadgeRarity = BadgeRarity.COMUM
) : Parcelable {
    constructor() : this(id = "")

    fun validate(): List<ValidationResult.Invalid> {
        val errors = mutableListOf<ValidationResult.Invalid>()
        val nameResult = ValidationHelper.validateName(name, "name", min = 2, max = 50)
        if (nameResult is ValidationResult.Invalid) errors.add(nameResult)
        if (xpReward < 0) errors.add(ValidationResult.Invalid("xp_reward", "XP reward não pode ser negativo", ValidationErrorCode.NEGATIVE_VALUE))
        return errors
    }
}

@IgnoreExtraProperties
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

    @Exclude
    fun validate(): List<ValidationResult.Invalid> {
        val errors = mutableListOf<ValidationResult.Invalid>()
        val uResult = ValidationHelper.validateRequiredId(userId, "user_id")
        if (uResult is ValidationResult.Invalid) errors.add(uResult)
        val bResult = ValidationHelper.validateRequiredId(badgeId, "badge_id")
        if (bResult is ValidationResult.Invalid) errors.add(bResult)
        if (count < 1) errors.add(ValidationResult.Invalid("count", "Contagem deve ser pelo menos 1", ValidationErrorCode.OUT_OF_RANGE))
        return errors
    }
}

// ========== STREAK ==========

@IgnoreExtraProperties
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

    @Exclude
    fun validate(): List<ValidationResult.Invalid> {
        val errors = mutableListOf<ValidationResult.Invalid>()
        val uResult = ValidationHelper.validateRequiredId(userId, "user_id")
        if (uResult is ValidationResult.Invalid) errors.add(uResult)
        if (currentStreak < 0) errors.add(ValidationResult.Invalid("current_streak", "Streak atual não pode ser negativo", ValidationErrorCode.NEGATIVE_VALUE))
        if (longestStreak < 0) errors.add(ValidationResult.Invalid("longest_streak", "Maior streak não pode ser negativo", ValidationErrorCode.NEGATIVE_VALUE))
        if (longestStreak < currentStreak) {
            errors.add(ValidationResult.Invalid("longest_streak", "Maior streak ($longestStreak) não pode ser menor que streak atual ($currentStreak)", ValidationErrorCode.LOGICAL_INCONSISTENCY))
        }
        val streakResult = ValidationHelper.validateStreak(currentStreak, "current_streak")
        if (streakResult is ValidationResult.Invalid) errors.add(streakResult)
        return errors
    }
}

// ========== DESAFIOS SEMANAIS ==========

enum class ChallengeType {
    SCORE_GOALS, WIN_GAMES, ASSISTS,
    CLEAN_SHEETS, PLAY_GAMES, INVITE_PLAYERS
}

@IgnoreExtraProperties
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
    var xpReward: Long = 100,
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

    @Exclude
    fun validate(): List<ValidationResult.Invalid> {
        val errors = mutableListOf<ValidationResult.Invalid>()
        val nameResult = ValidationHelper.validateName(name, "name", min = 2, max = 100)
        if (nameResult is ValidationResult.Invalid) errors.add(nameResult)
        if (targetValue <= 0) errors.add(ValidationResult.Invalid("target_value", "Meta deve ser maior que zero", ValidationErrorCode.OUT_OF_RANGE))
        if (xpReward < 0) errors.add(ValidationResult.Invalid("xp_reward", "XP reward não pode ser negativo", ValidationErrorCode.NEGATIVE_VALUE))
        if (startDate.isBlank()) errors.add(ValidationResult.Invalid("start_date", "Data de início é obrigatória", ValidationErrorCode.REQUIRED_FIELD))
        if (endDate.isBlank()) errors.add(ValidationResult.Invalid("end_date", "Data de fim é obrigatória", ValidationErrorCode.REQUIRED_FIELD))
        return errors
    }
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

@IgnoreExtraProperties
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

    @Exclude
    fun validate(): List<ValidationResult.Invalid> {
        val errors = mutableListOf<ValidationResult.Invalid>()
        val uResult = ValidationHelper.validateRequiredId(userId, "user_id")
        if (uResult is ValidationResult.Invalid) errors.add(uResult)
        val min = ValidationHelper.CARD_RATING_MIN
        val max = ValidationHelper.CARD_RATING_MAX
        if (attackRating !in min..max) errors.add(ValidationResult.Invalid("attack_rating", "Ataque deve estar entre $min e $max", ValidationErrorCode.OUT_OF_RANGE))
        if (defenseRating !in min..max) errors.add(ValidationResult.Invalid("defense_rating", "Defesa deve estar entre $min e $max", ValidationErrorCode.OUT_OF_RANGE))
        if (physicalRating !in min..max) errors.add(ValidationResult.Invalid("physical_rating", "Físico deve estar entre $min e $max", ValidationErrorCode.OUT_OF_RANGE))
        if (techniqueRating !in min..max) errors.add(ValidationResult.Invalid("technique_rating", "Técnica deve estar entre $min e $max", ValidationErrorCode.OUT_OF_RANGE))
        if (overallRating !in min..max) errors.add(ValidationResult.Invalid("overall_rating", "Overall deve estar entre $min e $max", ValidationErrorCode.OUT_OF_RANGE))
        if (totalGames < 0) errors.add(ValidationResult.Invalid("total_games", "Total de jogos não pode ser negativo", ValidationErrorCode.NEGATIVE_VALUE))
        return errors
    }

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

@IgnoreExtraProperties
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

    @Exclude
    fun validate(): List<ValidationResult.Invalid> {
        val errors = mutableListOf<ValidationResult.Invalid>()
        val p1Result = ValidationHelper.validateRequiredId(player1Id, "player1_id")
        if (p1Result is ValidationResult.Invalid) errors.add(p1Result)
        val p2Result = ValidationHelper.validateRequiredId(player2Id, "player2_id")
        if (p2Result is ValidationResult.Invalid) errors.add(p2Result)
        if (player1Id.isNotBlank() && player1Id == player2Id) {
            errors.add(ValidationResult.Invalid("player2_id", "Jogador 1 e 2 não podem ser o mesmo", ValidationErrorCode.LOGICAL_INCONSISTENCY))
        }
        if (player1Wins < 0) errors.add(ValidationResult.Invalid("player1_wins", "Vitórias P1 não pode ser negativo", ValidationErrorCode.NEGATIVE_VALUE))
        if (player2Wins < 0) errors.add(ValidationResult.Invalid("player2_wins", "Vitórias P2 não pode ser negativo", ValidationErrorCode.NEGATIVE_VALUE))
        if (totalGames < 0) errors.add(ValidationResult.Invalid("total_games", "Total de jogos não pode ser negativo", ValidationErrorCode.NEGATIVE_VALUE))
        val resultsSum = player1Wins + player2Wins + draws
        if (resultsSum > totalGames && totalGames >= 0) {
            errors.add(ValidationResult.Invalid("total_games", "Soma de resultados ($resultsSum) excede total de jogos ($totalGames)", ValidationErrorCode.LOGICAL_INCONSISTENCY))
        }
        return errors
    }

    fun getWinPercentage(playerId: String): Double {
        if (totalGames == 0) return 0.0
        val wins = if (playerId == player1Id) player1Wins else player2Wins
        return (wins.toDouble() / totalGames) * 100
    }
}
