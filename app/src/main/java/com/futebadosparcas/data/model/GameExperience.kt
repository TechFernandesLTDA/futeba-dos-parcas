package com.futebadosparcas.data.model

import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

// ========== VOTAÇÃO MVP ==========

enum class VoteCategory {
    MVP, // Craque da Partida
    WORST, // Bola Murcha
    BEST_GOALKEEPER, // Melhor Goleiro
    CUSTOM // Categoria personalizada
}

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
    // Sem @ServerTimestamp: `voted_at` é a hora do evento/derivacao, escrita com
    // FieldValue.serverTimestamp() no ponto de criacao; com a anotacao valendo,
    // qualquer set(modelo) posterior sobrescreveria a data (#4592).
    @get:PropertyName("voted_at")
    @set:PropertyName("voted_at")
    var votedAt: Date? = null
) {
    constructor() : this(id = "")
}

data class MVPVoteResult(
    val playerId: String = "",
    val playerName: String = "",
    val playerPhoto: String? = null,
    val voteCount: Int = 0,
    val percentage: Double = 0.0
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
    @get:ServerTimestamp
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
    @get:ServerTimestamp
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
    @get:ServerTimestamp
    @get:PropertyName("created_at")
    @set:PropertyName("created_at")
    var createdAt: Date? = null
) {
    constructor() : this(id = "")
}
