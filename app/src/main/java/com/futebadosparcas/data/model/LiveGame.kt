package com.futebadosparcas.data.model

import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.Exclude
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

// Modelo para o placar do jogo ao vivo
@IgnoreExtraProperties
data class LiveGameScore(
    @DocumentId
    var id: String = "",
    @get:PropertyName("game_id")
    @set:PropertyName("game_id")
    var gameId: String = "",
    @get:PropertyName("team1_id")
    @set:PropertyName("team1_id")
    var team1Id: String = "",
    @get:PropertyName("team1_score")
    @set:PropertyName("team1_score")
    var team1Score: Int = 0,
    @get:PropertyName("team2_id")
    @set:PropertyName("team2_id")
    var team2Id: String = "",
    @get:PropertyName("team2_score")
    @set:PropertyName("team2_score")
    var team2Score: Int = 0,
    @get:PropertyName("started_at")
    @set:PropertyName("started_at")
    @ServerTimestamp
    var startedAt: Date? = null,
    @get:PropertyName("finished_at")
    @set:PropertyName("finished_at")
    var finishedAt: Date? = null
) {
    constructor() : this(id = "")
}

// Eventos do jogo (gols, assistencias, cartoes)
@IgnoreExtraProperties
data class GameEvent(
    @DocumentId
    var id: String = "",
    @get:PropertyName("game_id")
    @set:PropertyName("game_id")
    var gameId: String = "",
    @get:PropertyName("event_type")
    @set:PropertyName("event_type")
    var eventType: String = GameEventType.GOAL.name,
    @get:PropertyName("player_id")
    @set:PropertyName("player_id")
    var playerId: String = "",
    @get:PropertyName("player_name")
    @set:PropertyName("player_name")
    var playerName: String = "",
    @get:PropertyName("team_id")
    @set:PropertyName("team_id")
    var teamId: String = "",
    @get:PropertyName("assisted_by_id")
    @set:PropertyName("assisted_by_id")
    var assistedById: String? = null,
    @get:PropertyName("assisted_by_name")
    @set:PropertyName("assisted_by_name")
    var assistedByName: String? = null,
    @get:PropertyName("minute")
    @set:PropertyName("minute")
    var minute: Int = 0,
    @get:PropertyName("created_by")
    @set:PropertyName("created_by")
    var createdBy: String = "",
    @ServerTimestamp
    @get:PropertyName("created_at")
    @set:PropertyName("created_at")
    var createdAt: Date? = null
) {
    constructor() : this(id = "")

    @Exclude
    fun getEventTypeEnum(): GameEventType = try {
        GameEventType.valueOf(eventType)
    } catch (e: Exception) {
        GameEventType.GOAL
    }
}

enum class GameEventType {
    GOAL,          // Gol
    ASSIST,        // Assistencia
    SAVE,          // Defesa de goleiro
    YELLOW_CARD,   // Cartao amarelo
    RED_CARD,      // Cartao vermelho
    SUBSTITUTION   // Substituicao
}

// Estatisticas ao vivo do jogador no jogo
@IgnoreExtraProperties
data class LivePlayerStats(
    @DocumentId
    var id: String = "",
    @get:PropertyName("game_id")
    @set:PropertyName("game_id")
    var gameId: String = "",
    @get:PropertyName("player_id")
    @set:PropertyName("player_id")
    var playerId: String = "",
    @get:PropertyName("player_name")
    @set:PropertyName("player_name")
    var playerName: String = "",
    @get:PropertyName("team_id")
    @set:PropertyName("team_id")
    var teamId: String = "",
    @get:PropertyName("position")
    @set:PropertyName("position")
    var position: String = PlayerPosition.FIELD.name,
    val goals: Int = 0,
    val assists: Int = 0,
    val saves: Int = 0,
    @get:PropertyName("yellow_cards")
    @set:PropertyName("yellow_cards")
    var yellowCards: Int = 0,
    @get:PropertyName("red_cards")
    @set:PropertyName("red_cards")
    var redCards: Int = 0,
    @get:PropertyName("is_playing")
    @set:PropertyName("is_playing")
    var isPlaying: Boolean = true
) {
    constructor() : this(id = "")

    @Exclude
    fun getPositionEnum(): PlayerPosition = try {
        PlayerPosition.valueOf(position)
    } catch (e: Exception) {
        PlayerPosition.FIELD
    }
}
