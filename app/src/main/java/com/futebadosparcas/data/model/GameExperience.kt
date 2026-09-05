package com.futebadosparcas.data.model

import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.Exclude
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

// ========== VOTAÇÃO MVP ==========

/**
 * Categorias de votação para jogo.
 * Inclui categorias padrão e customizáveis.
 */
enum class VoteCategory(val displayName: String, val isDefault: Boolean = true) {
    MVP("Craque da Partida", true),
    WORST("Bola Murcha", true),
    BEST_GOALKEEPER("Melhor Goleiro", true),
    CUSTOM("Categoria Personalizada", false)
}

/**
 * Categoria customizada definida pelo grupo.
 */
@IgnoreExtraProperties
data class CustomVoteCategory(
    @DocumentId
    val id: String = "",
    val name: String = "",
    val description: String = "",
    val emoji: String = "",
    @get:PropertyName("is_active")
    @set:PropertyName("is_active")
    var isActive: Boolean = true,
    @ServerTimestamp
    @get:PropertyName("created_at")
    @set:PropertyName("created_at")
    var createdAt: Date? = null,
    @get:PropertyName("for_goalkeepers_only")
    @set:PropertyName("for_goalkeepers_only")
    var forGoalkeepersOnly: Boolean = false,
    @get:PropertyName("for_field_players_only")
    @set:PropertyName("for_field_players_only")
    var forFieldPlayersOnly: Boolean = false
) {
    constructor() : this(id = "")
}

/**
 * Configurações de votação do grupo.
 */
@IgnoreExtraProperties
data class VotingSettings(
    @get:PropertyName("is_anonymous")
    @set:PropertyName("is_anonymous")
    var isAnonymous: Boolean = false,
    @get:PropertyName("voting_timeout_hours")
    @set:PropertyName("voting_timeout_hours")
    var votingTimeoutHours: Int = 24,
    @get:PropertyName("show_top_3")
    @set:PropertyName("show_top_3")
    var showTop3: Boolean = true,
    @get:PropertyName("separate_goalkeeper_voting")
    @set:PropertyName("separate_goalkeeper_voting")
    var separateGoalkeeperVoting: Boolean = false,
    @get:PropertyName("allow_skip_vote")
    @set:PropertyName("allow_skip_vote")
    var allowSkipVote: Boolean = true,
    @get:PropertyName("custom_categories")
    @set:PropertyName("custom_categories")
    var customCategories: List<CustomVoteCategory> = emptyList(),
    @get:PropertyName("enabled_categories")
    @set:PropertyName("enabled_categories")
    var enabledCategories: List<String> = listOf(
        VoteCategory.MVP.name,
        VoteCategory.BEST_GOALKEEPER.name,
        VoteCategory.WORST.name
    )
) {
    constructor() : this(isAnonymous = false)
}

/**
 * Voto de um jogador para outro em uma categoria.
 */
@IgnoreExtraProperties
data class MVPVote(
    @DocumentId
    val id: String = "",
    @get:PropertyName("game_id")
    @set:PropertyName("game_id")
    var gameId: String = "",
    @get:PropertyName("voter_id")
    @set:PropertyName("voter_id")
    var voterId: String = "",
    @get:PropertyName("voted_player_id")
    @set:PropertyName("voted_player_id")
    var votedPlayerId: String = "",
    val category: VoteCategory = VoteCategory.MVP,
    @get:PropertyName("custom_category_id")
    @set:PropertyName("custom_category_id")
    var customCategoryId: String? = null,
    @ServerTimestamp
    @get:PropertyName("voted_at")
    @set:PropertyName("voted_at")
    var votedAt: Date? = null,
    @get:PropertyName("skipped")
    @set:PropertyName("skipped")
    var skipped: Boolean = false
) {
    constructor() : this(id = "")
}

/**
 * Avaliação de atributos de um jogador (1-5 estrelas).
 */
@IgnoreExtraProperties
data class AttributeRating(
    @DocumentId
    val id: String = "",
    @get:PropertyName("game_id")
    @set:PropertyName("game_id")
    var gameId: String = "",
    @get:PropertyName("rater_id")
    @set:PropertyName("rater_id")
    var raterId: String = "",
    @get:PropertyName("rated_player_id")
    @set:PropertyName("rated_player_id")
    var ratedPlayerId: String = "",
    @get:PropertyName("defense")
    @set:PropertyName("defense")
    var defense: Int = 0,
    @get:PropertyName("attack")
    @set:PropertyName("attack")
    var attack: Int = 0,
    @get:PropertyName("technique")
    @set:PropertyName("technique")
    var technique: Int = 0,
    @get:PropertyName("hustle")
    @set:PropertyName("hustle")
    var hustle: Int = 0, // Raça
    @get:PropertyName("fair_play")
    @set:PropertyName("fair_play")
    var fairPlay: Int = 0,
    @ServerTimestamp
    @get:PropertyName("rated_at")
    @set:PropertyName("rated_at")
    var ratedAt: Date? = null
) {
    constructor() : this(id = "")

    @Exclude
    fun calculateOverall(): Double {
        val sum = defense + attack + technique + hustle + fairPlay
        return if (sum > 0) sum / 5.0 else 0.0
    }
}

/**
 * Streak de MVP consecutivos.
 */
@IgnoreExtraProperties
data class MVPStreak(
    @DocumentId
    val id: String = "",
    @get:PropertyName("user_id")
    @set:PropertyName("user_id")
    var userId: String = "",
    @get:PropertyName("current_streak")
    @set:PropertyName("current_streak")
    var currentStreak: Int = 0,
    @get:PropertyName("max_streak")
    @set:PropertyName("max_streak")
    var maxStreak: Int = 0,
    @get:PropertyName("last_mvp_game_id")
    @set:PropertyName("last_mvp_game_id")
    var lastMvpGameId: String = "",
    @ServerTimestamp
    @get:PropertyName("updated_at")
    @set:PropertyName("updated_at")
    var updatedAt: Date? = null
) {
    constructor() : this(id = "")
}

/**
 * Resultado da votação para exibição.
 */
data class MVPVoteResult(
    val playerId: String = "",
    val playerName: String = "",
    val playerPhoto: String? = null,
    val voteCount: Int = 0,
    val percentage: Double = 0.0,
    val position: Int = 0, // 1 = Ouro, 2 = Prata, 3 = Bronze
    val category: VoteCategory = VoteCategory.MVP,
    val voters: List<String> = emptyList() // IDs dos votantes (vazio se anônimo)
)

/**
 * Resultado completo da votação com podium (top 3).
 */
data class VoteResultWithPodium(
    val category: VoteCategory,
    val customCategoryId: String? = null,
    val customCategoryName: String? = null,
    val results: List<MVPVoteResult> = emptyList(),
    val totalVotes: Int = 0,
    val skippedCount: Int = 0,
    val isAnonymous: Boolean = false
) {
    val gold: MVPVoteResult? get() = results.getOrNull(0)
    val silver: MVPVoteResult? get() = results.getOrNull(1)
    val bronze: MVPVoteResult? get() = results.getOrNull(2)
}

/**
 * Dados para card de compartilhamento do MVP.
 */
data class MVPShareCardData(
    val playerId: String = "",
    val playerName: String = "",
    val playerPhoto: String? = null,
    val gameDate: String = "",
    val gameLocation: String = "",
    val team1Score: Int = 0,
    val team2Score: Int = 0,
    val voteCount: Int = 0,
    val votePercentage: Double = 0.0,
    val mvpStreak: Int = 0,
    val category: VoteCategory = VoteCategory.MVP
)

// ========== PLACAR AO VIVO ==========

enum class ScoreEventType {
    GOAL,
    OWN_GOAL,
    ASSIST,
    SAVE,
    YELLOW_CARD,
    RED_CARD
}

data class LiveScore(
    @DocumentId
    val id: String = "",
    @get:PropertyName("game_id")
    @set:PropertyName("game_id")
    var gameId: String = "",
    @get:PropertyName("player_id")
    @set:PropertyName("player_id")
    var playerId: String = "",
    @get:PropertyName("team_id")
    @set:PropertyName("team_id")
    var teamId: String? = null,
    @get:PropertyName("event_type")
    @set:PropertyName("event_type")
    var eventType: ScoreEventType = ScoreEventType.GOAL,
    val minute: Int? = null,
    @get:PropertyName("assisted_by_id")
    @set:PropertyName("assisted_by_id")
    var assistedById: String? = null,
    @get:PropertyName("reporter_id")
    @set:PropertyName("reporter_id")
    var reporterId: String = "",
    @ServerTimestamp
    @get:PropertyName("created_at")
    @set:PropertyName("created_at")
    var createdAt: Date? = null
) {
    constructor() : this(id = "")

    fun getEventIcon(): String {
        return when (eventType) {
            ScoreEventType.GOAL -> "⚽"
            ScoreEventType.OWN_GOAL -> "🙈"
            ScoreEventType.ASSIST -> "🎯"
            ScoreEventType.SAVE -> "🧤"
            ScoreEventType.YELLOW_CARD -> "🟨"
            ScoreEventType.RED_CARD -> "🟥"
        }
    }

    fun getEventText(): String {
        return when (eventType) {
            ScoreEventType.GOAL -> "Gol"
            ScoreEventType.OWN_GOAL -> "Gol Contra"
            ScoreEventType.ASSIST -> "Assistência"
            ScoreEventType.SAVE -> "Defesa"
            ScoreEventType.YELLOW_CARD -> "Cartão Amarelo"
            ScoreEventType.RED_CARD -> "Cartão Vermelho"
        }
    }
}

// ========== PRANCHETA TÁTICA ==========

data class TacticalPlayerPosition(
    @get:PropertyName("player_id")
    @set:PropertyName("player_id")
    var playerId: String = "",
    val x: Float = 0f, // Posição X no campo (0-100)
    val y: Float = 0f, // Posição Y no campo (0-100)
    val role: String = "" // Ex: "GK", "DEF", "MID", "ATK"
) {
    constructor() : this("")
}

data class TacticalBoard(
    @DocumentId
    val id: String = "",
    @get:PropertyName("game_id")
    @set:PropertyName("game_id")
    var gameId: String = "",
    @get:PropertyName("creator_id")
    @set:PropertyName("creator_id")
    var creatorId: String = "",
    @get:PropertyName("formation_name")
    @set:PropertyName("formation_name")
    var formationName: String = "",
    @get:PropertyName("player_positions")
    @set:PropertyName("player_positions")
    var playerPositions: Map<String, TacticalPlayerPosition> = emptyMap(),
    val notes: String? = null,
    @get:PropertyName("image_url")
    @set:PropertyName("image_url")
    var imageUrl: String? = null,
    @ServerTimestamp
    @get:PropertyName("created_at")
    @set:PropertyName("created_at")
    var createdAt: Date? = null
) {
    constructor() : this(id = "")
}

// Formações predefinidas
object FormationTemplates {
    val formations = mapOf(
        "4-4-2" to "4 Defensores, 4 Meio-campistas, 2 Atacantes",
        "3-5-2" to "3 Defensores, 5 Meio-campistas, 2 Atacantes",
        "4-3-3" to "4 Defensores, 3 Meio-campistas, 3 Atacantes",
        "3-4-3" to "3 Defensores, 4 Meio-campistas, 3 Atacantes",
        "5-3-2" to "5 Defensores, 3 Meio-campistas, 2 Atacantes"
    )
}

// ========== CARD INSTAGRAMÁVEL ==========

data class SocialCard(
    @DocumentId
    val id: String = "",
    @get:PropertyName("game_id")
    @set:PropertyName("game_id")
    var gameId: String = "",
    @get:PropertyName("card_type")
    @set:PropertyName("card_type")
    var cardType: String = "game_result", // game_result, player_stats, season_ranking
    @get:PropertyName("image_url")
    @set:PropertyName("image_url")
    var imageUrl: String = "",
    val data: Map<String, Any> = emptyMap(), // Dados para gerar o card
    @ServerTimestamp
    @get:PropertyName("created_at")
    @set:PropertyName("created_at")
    var createdAt: Date? = null
) {
    constructor() : this(id = "")
}
