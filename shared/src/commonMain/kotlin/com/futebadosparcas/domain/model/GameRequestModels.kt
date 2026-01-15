package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Status de uma solicitacao de participacao em jogo.
 */
@Serializable
enum class RequestStatus {
    @SerialName("PENDING")
    PENDING,

    @SerialName("APPROVED")
    APPROVED,

    @SerialName("REJECTED")
    REJECTED
}

/**
 * Solicitacao de participacao em jogo publico por jogador externo ao grupo.
 * Colecao: game_requests
 */
@Serializable
data class GameJoinRequest(
    val id: String = "",
    @SerialName("game_id") val gameId: String = "",
    @SerialName("user_id") val userId: String = "",
    @SerialName("user_name") val userName: String = "",
    @SerialName("user_photo") val userPhoto: String? = null,
    @SerialName("user_level") val userLevel: Int = 1,
    @SerialName("user_position") val userPosition: String? = null,
    val message: String = "",
    val status: String = RequestStatus.PENDING.name,
    @SerialName("requested_at") val requestedAt: Long? = null,
    @SerialName("reviewed_at") val reviewedAt: Long? = null,
    @SerialName("reviewed_by") val reviewedBy: String? = null,
    @SerialName("rejection_reason") val rejectionReason: String? = null
) {
    fun getStatusEnum(): RequestStatus = try {
        RequestStatus.valueOf(status)
    } catch (e: Exception) {
        RequestStatus.PENDING
    }

    fun isPending(): Boolean = getStatusEnum() == RequestStatus.PENDING
    fun isApproved(): Boolean = getStatusEnum() == RequestStatus.APPROVED
    fun isRejected(): Boolean = getStatusEnum() == RequestStatus.REJECTED
}

/**
 * Status da convocacao.
 */
@Serializable
enum class SummonStatus {
    @SerialName("PENDING")
    PENDING,

    @SerialName("CONFIRMED")
    CONFIRMED,

    @SerialName("DECLINED")
    DECLINED,

    @SerialName("CANCELLED")
    CANCELLED
}

/**
 * Representa uma convocacao de jogador para um jogo especifico.
 * Colecao: game_summons
 * ID do documento: {gameId}_{userId}
 */
@Serializable
data class GameSummon(
    val id: String = "",
    @SerialName("game_id") val gameId: String = "",
    @SerialName("group_id") val groupId: String = "",
    @SerialName("user_id") val userId: String = "",
    @SerialName("user_name") val userName: String = "",
    @SerialName("user_photo") val userPhoto: String? = null,
    val status: String = SummonStatus.PENDING.name,
    val position: String? = null,
    @SerialName("summoned_by") val summonedBy: String = "",
    @SerialName("summoned_by_name") val summonedByName: String = "",
    @SerialName("summoned_at") val summonedAt: Long? = null,
    @SerialName("responded_at") val respondedAt: Long? = null
) {
    fun getStatusEnum(): SummonStatus = try {
        SummonStatus.valueOf(status)
    } catch (e: Exception) {
        SummonStatus.PENDING
    }

    fun isPending(): Boolean = getStatusEnum() == SummonStatus.PENDING
    fun isConfirmed(): Boolean = getStatusEnum() == SummonStatus.CONFIRMED
    fun isDeclined(): Boolean = getStatusEnum() == SummonStatus.DECLINED
    fun canRespond(): Boolean = isPending()
}

/** Gera o ID do documento no formato {gameId}_{userId} */
fun generateGameSummonId(gameId: String, userId: String): String {
    return "${gameId}_${userId}"
}

/**
 * Representa um jogo na agenda do usuario (proximas 2 semanas).
 * Subcolecao: users/{userId}/upcoming_games
 */
@Serializable
data class UpcomingGame(
    val id: String = "",
    @SerialName("game_id") val gameId: String = "",
    @SerialName("group_id") val groupId: String? = null,
    @SerialName("group_name") val groupName: String? = null,
    @SerialName("date_time") val dateTime: Long = 0L,
    @SerialName("location_name") val locationName: String = "",
    @SerialName("location_address") val locationAddress: String = "",
    @SerialName("field_name") val fieldName: String = "",
    val status: String = GameStatus.SCHEDULED.name,
    @SerialName("my_position") val myPosition: String? = null,
    @SerialName("confirmed_count") val confirmedCount: Int = 0,
    @SerialName("max_players") val maxPlayers: Int = 0
) {
    fun getStatusEnum(): GameStatus = try {
        GameStatus.valueOf(status)
    } catch (e: Exception) {
        GameStatus.SCHEDULED
    }

    fun isFromGroup(): Boolean = !groupId.isNullOrEmpty()
}
