package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Status do jogo.
 */
@Serializable
enum class GameStatus {
    @SerialName("SCHEDULED")
    SCHEDULED,      // Lista aberta para confirmacoes

    @SerialName("CONFIRMED")
    CONFIRMED,      // Lista fechada, aguardando inicio

    @SerialName("LIVE")
    LIVE,           // Bola rolando - jogo em andamento

    @SerialName("FINISHED")
    FINISHED,       // Jogo finalizado

    @SerialName("CANCELLED")
    CANCELLED       // Jogo cancelado
}

/**
 * Visibilidade do jogo.
 */
@Serializable
enum class GameVisibility(val displayName: String) {
    @SerialName("GROUP_ONLY")
    GROUP_ONLY("Apenas Grupo"),

    @SerialName("PUBLIC_CLOSED")
    PUBLIC_CLOSED("Publico (Lista Fechada)"),

    @SerialName("PUBLIC_OPEN")
    PUBLIC_OPEN("Publico (Aceita Solicitacoes)")
}

/**
 * Status de confirmacao do jogador.
 */
@Serializable
enum class ConfirmationStatus {
    @SerialName("CONFIRMED")
    CONFIRMED,

    @SerialName("CANCELLED")
    CANCELLED,

    @SerialName("PENDING")
    PENDING,

    @SerialName("WAITLIST")
    WAITLIST
}

/**
 * Status de pagamento.
 */
@Serializable
enum class PaymentStatus {
    @SerialName("PENDING")
    PENDING,

    @SerialName("PAID")
    PAID,

    @SerialName("PARTIAL")
    PARTIAL,

    @SerialName("REFUNDED")
    REFUNDED
}

/**
 * Jogo/Partida (versao compartilhada KMP).
 */
@Serializable
data class Game(
    val id: String = "",
    @SerialName("schedule_id") val scheduleId: String = "",
    val date: String = "",
    val time: String = "",
    @SerialName("end_time") val endTime: String = "",
    val status: String = GameStatus.SCHEDULED.name,
    @SerialName("max_players") val maxPlayers: Int = 14,
    @SerialName("max_goalkeepers") val maxGoalkeepers: Int = 3,
    @SerialName("players_count") val playersCount: Int = 0,
    @SerialName("goalkeepers_count") val goalkeepersCount: Int = 0,
    @SerialName("daily_price") val dailyPrice: Double = 0.0,
    @SerialName("total_cost") val totalCost: Double = 0.0,
    @SerialName("pix_key") val pixKey: String = "",
    @SerialName("number_of_teams") val numberOfTeams: Int = 2,
    @SerialName("owner_id") val ownerId: String = "",
    @SerialName("owner_name") val ownerName: String = "",

    // Local
    @SerialName("location_id") val locationId: String = "",
    @SerialName("field_id") val fieldId: String = "",
    @SerialName("location_name") val locationName: String = "",
    @SerialName("location_address") val locationAddress: String = "",
    @SerialName("location_lat") val locationLat: Double? = null,
    @SerialName("location_lng") val locationLng: Double? = null,
    @SerialName("field_name") val fieldName: String = "",

    // Configuracoes
    @SerialName("game_type") val gameType: String = "Society",
    val recurrence: String = "none",
    val visibility: String = GameVisibility.GROUP_ONLY.name,
    @SerialName("created_at") val createdAt: Long? = null,

    // Processamento
    @SerialName("xp_processed") val xpProcessed: Boolean = false,
    @SerialName("mvp_id") val mvpId: String? = null,

    // Placar
    @SerialName("team1_score") val team1Score: Int = 0,
    @SerialName("team2_score") val team2Score: Int = 0,
    @SerialName("team1_name") val team1Name: String = "Time 1",
    @SerialName("team2_name") val team2Name: String = "Time 2",

    // Grupo
    @SerialName("group_id") val groupId: String? = null,
    @SerialName("group_name") val groupName: String? = null
) {
    fun getStatusEnum(): GameStatus = try {
        GameStatus.valueOf(status)
    } catch (e: Exception) {
        GameStatus.SCHEDULED
    }

    fun getVisibilityEnum(): GameVisibility = try {
        GameVisibility.valueOf(visibility)
    } catch (e: Exception) {
        GameVisibility.GROUP_ONLY
    }

    fun isLive(): Boolean = getStatusEnum() == GameStatus.LIVE
    fun isFinished(): Boolean = getStatusEnum() == GameStatus.FINISHED
    fun isScheduled(): Boolean = getStatusEnum() == GameStatus.SCHEDULED
}

/**
 * Confirmacao de jogador em um jogo.
 */
@Serializable
data class GameConfirmation(
    val id: String = "",
    @SerialName("game_id") val gameId: String = "",
    @SerialName("user_id") val userId: String = "",
    @SerialName("user_name") val userName: String = "",
    @SerialName("user_photo") val userPhoto: String? = null,
    val position: String = "FIELD",
    @SerialName("team_id") val teamId: String? = null,
    val status: String = ConfirmationStatus.CONFIRMED.name,
    @SerialName("payment_status") val paymentStatus: String = PaymentStatus.PENDING.name,
    @SerialName("is_casual_player") val isCasualPlayer: Boolean = false,

    // Estatisticas do jogo
    val goals: Int = 0,
    val assists: Int = 0,
    val saves: Int = 0,
    @SerialName("yellow_cards") val yellowCards: Int = 0,
    @SerialName("red_cards") val redCards: Int = 0,

    val nickname: String? = null,
    @SerialName("xp_earned") val xpEarned: Int = 0,
    @SerialName("is_mvp") val isMvp: Boolean = false,
    @SerialName("is_best_gk") val isBestGk: Boolean = false,
    @SerialName("is_worst_player") val isWorstPlayer: Boolean = false,
    @SerialName("confirmed_at") val confirmedAt: Long? = null
) {
    fun getDisplayName(): String = nickname?.takeIf { it.isNotBlank() } ?: userName

    fun getStatusEnum(): ConfirmationStatus = try {
        ConfirmationStatus.valueOf(status)
    } catch (e: Exception) {
        ConfirmationStatus.CONFIRMED
    }

    fun getPaymentStatusEnum(): PaymentStatus = try {
        PaymentStatus.valueOf(paymentStatus)
    } catch (e: Exception) {
        PaymentStatus.PENDING
    }

    fun getPositionEnum(): PlayerPosition = PlayerPosition.fromString(position)
}

/**
 * Time em um jogo.
 */
@Serializable
data class Team(
    val id: String = "",
    @SerialName("game_id") val gameId: String = "",
    val name: String = "",
    val color: String = "",
    @SerialName("player_ids") val playerIds: List<String> = emptyList(),
    val score: Int = 0
)
