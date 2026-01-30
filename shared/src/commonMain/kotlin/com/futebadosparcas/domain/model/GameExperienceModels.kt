package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Categorias de votacao para jogo.
 */
@Serializable
enum class VoteCategory {
    @SerialName("MVP")
    MVP,        // Craque da Partida

    @SerialName("WORST")
    WORST,      // Bola Murcha

    @SerialName("BEST_GOALKEEPER")
    BEST_GOALKEEPER,  // Melhor Goleiro

    @SerialName("CUSTOM")
    CUSTOM  // Categoria personalizada
}

/**
 * Voto de um jogador para outro em uma categoria (MVP, Melhor Goleiro, Bola Murcha).
 * Colecao: mvp_votes
 * ID do documento: {gameId}_{voterId}_{category}
 */
@Serializable
data class MVPVote(
    val id: String = "",
    @SerialName("game_id") val gameId: String = "",
    @SerialName("voter_id") val voterId: String = "",
    @SerialName("voted_player_id") val votedPlayerId: String = "",
    val category: VoteCategory = VoteCategory.MVP,
    @SerialName("voted_at") val votedAt: Long? = null
)

/**
 * Resultado da votacao para exibicao.
 */
@Serializable
data class MVPVoteResult(
    val playerId: String = "",
    val playerName: String = "",
    val playerPhoto: String? = null,
    val voteCount: Int = 0,
    val percentage: Double = 0.0
)

/**
 * Placar ao vivo de um jogo (legado - ver LiveScore em LiveGame.kt para a versao KMP).
 * Mantido para compatibilidade com codigo Android existente.
 */
@Serializable
data class LiveGameScore(
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
 * Evento de jogo para compatibilidade com Android.
 * Ver GameEvent em LiveGame.kt para a versao KMP completa.
 */
@Serializable
data class GameEventData(
    val id: String = "",
    @SerialName("game_id") val gameId: String = "",
    @SerialName("event_type") val eventType: String = GameEventType.GOAL.name,
    @SerialName("player_id") val playerId: String = "",
    @SerialName("player_name") val playerName: String = "",
    @SerialName("team_id") val teamId: String = "",
    @SerialName("assisted_by_id") val assistedById: String? = null,
    @SerialName("assisted_by_name") val assistedByName: String? = null,
    val minute: Int = 0,
    @SerialName("created_at") val createdAt: Long? = null
)
