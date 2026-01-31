package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Placar ao vivo de um jogo.
 */
@Serializable
data class LiveScore(
    val id: String = "",
    @SerialName("game_id") val gameId: String = "",
    @SerialName("team1_id") val team1Id: String = "",
    @SerialName("team1_score") val team1Score: Int = 0,
    @SerialName("team2_id") val team2Id: String = "",
    @SerialName("team2_score") val team2Score: Int = 0,
    @SerialName("started_at") val startedAt: Long? = null,
    @SerialName("finished_at") val finishedAt: Long? = null
)

/**
 * Evento de jogo (gol, assistencia, cartao, etc).
 */
@Serializable
data class GameEvent(
    val id: String = "",
    @SerialName("game_id") val gameId: String = "",
    @SerialName("event_type") val eventType: String = GameEventType.GOAL.name,
    @SerialName("player_id") val playerId: String = "",
    @SerialName("player_name") val playerName: String = "",
    @SerialName("team_id") val teamId: String = "",
    @SerialName("assisted_by_id") val assistedById: String? = null,
    @SerialName("assisted_by_name") val assistedByName: String? = null,
    val minute: Int = 0,
    @SerialName("created_by") val createdBy: String = "",
    @SerialName("created_at") val createdAt: Long? = null
) {
    fun getEventTypeEnum(): GameEventType = try {
        GameEventType.valueOf(eventType)
    } catch (e: Exception) {
        GameEventType.GOAL
    }
}

/**
 * Tipos de eventos em um jogo.
 */
enum class GameEventType {
    GOAL,          // Gol
    OWN_GOAL,      // Gol contra
    ASSIST,        // Assistencia
    SAVE,          // Defesa de goleiro
    YELLOW_CARD,   // Cartao amarelo
    RED_CARD,      // Cartao vermelho
    SUBSTITUTION,  // Substituicao
    PERIOD_START,  // Inicio de periodo
    PERIOD_END,    // Fim de periodo
    GAME_END       // Fim do jogo
}

/**
 * Estatisticas ao vivo do jogador no jogo.
 */
@Serializable
data class LivePlayerStats(
    val id: String = "",
    @SerialName("game_id") val gameId: String = "",
    @SerialName("player_id") val playerId: String = "",
    @SerialName("player_name") val playerName: String = "",
    @SerialName("team_id") val teamId: String = "",
    val position: String = PlayerPosition.LINE.name,
    val goals: Int = 0,
    val assists: Int = 0,
    val saves: Int = 0,
    @SerialName("yellow_cards") val yellowCards: Int = 0,
    @SerialName("red_cards") val redCards: Int = 0,
    @SerialName("is_playing") val isPlaying: Boolean = true
)
