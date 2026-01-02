package com.futebadosparcas.data.model

import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

/**
 * Níveis de visibilidade de um jogo
 */
enum class GameVisibility(val displayName: String, val description: String) {
    GROUP_ONLY(
        displayName = "Apenas Grupo",
        description = "Visível apenas para membros do grupo"
    ),
    PUBLIC_CLOSED(
        displayName = "Público Fechado",
        description = "Visível para todos, mas fechado para novos jogadores"
    ),
    PUBLIC_OPEN(
        displayName = "Público Aberto",
        description = "Visível para todos e aceita solicitações de participação"
    );

    companion object {
        fun fromString(value: String?): GameVisibility {
            return entries.find { it.name == value } ?: GROUP_ONLY
        }
    }
}

/**
 * Status de uma solicitação de participação em jogo
 */
enum class RequestStatus(val displayName: String) {
    PENDING("Pendente"),
    APPROVED("Aprovada"),
    REJECTED("Rejeitada");

    companion object {
        fun fromString(value: String?): RequestStatus {
            return entries.find { it.name == value } ?: PENDING
        }
    }
}

/**
 * Solicitação de participação em jogo público por jogador externo ao grupo
 */
data class GameJoinRequest(
    @DocumentId
    val id: String = "",

    @get:PropertyName("game_id")
    @set:PropertyName("game_id")
    var gameId: String = "",

    @get:PropertyName("user_id")
    @set:PropertyName("user_id")
    var userId: String = "",

    @get:PropertyName("user_name")
    @set:PropertyName("user_name")
    var userName: String = "",

    @get:PropertyName("user_photo")
    @set:PropertyName("user_photo")
    var userPhoto: String? = null,

    @get:PropertyName("user_level")
    @set:PropertyName("user_level")
    var userLevel: Int = 1,

    @get:PropertyName("user_position")
    @set:PropertyName("user_position")
    var userPosition: String? = null, // Posição preferida do jogador

    val message: String = "", // Mensagem do jogador ao dono do jogo

    val status: String = RequestStatus.PENDING.name,

    @ServerTimestamp
    @get:PropertyName("requested_at")
    @set:PropertyName("requested_at")
    var requestedAt: Date? = null,

    @get:PropertyName("reviewed_at")
    @set:PropertyName("reviewed_at")
    var reviewedAt: Date? = null,

    @get:PropertyName("reviewed_by")
    @set:PropertyName("reviewed_by")
    var reviewedBy: String? = null, // ID do usuário que aprovou/rejeitou

    @get:PropertyName("rejection_reason")
    @set:PropertyName("rejection_reason")
    var rejectionReason: String? = null
) {
    constructor() : this(id = "")

    /**
     * Retorna o enum de status
     */
    fun getStatusEnum(): RequestStatus = try {
        RequestStatus.valueOf(status)
    } catch (e: Exception) {
        RequestStatus.PENDING
    }

    /**
     * Verifica se a solicitação está pendente
     */
    fun isPending(): Boolean = getStatusEnum() == RequestStatus.PENDING

    /**
     * Verifica se a solicitação foi aprovada
     */
    fun isApproved(): Boolean = getStatusEnum() == RequestStatus.APPROVED

    /**
     * Verifica se a solicitação foi rejeitada
     */
    fun isRejected(): Boolean = getStatusEnum() == RequestStatus.REJECTED
}
