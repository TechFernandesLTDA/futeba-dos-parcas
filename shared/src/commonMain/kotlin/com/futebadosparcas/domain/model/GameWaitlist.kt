package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Status da entrada na lista de espera.
 */
// NOTA: WaitlistStatus nao usa @Serializable para evitar bug do
// compilador Kotlin 2.2.x com enums + companion object.
// O campo 'status' e serializado como String no modelo GameWaitlist.
enum class WaitlistStatus {
    WAITING,           // Aguardando vaga
    NOTIFIED,         // Notificado sobre vaga disponivel
    PROMOTED,         // Promovido para lista de confirmados
    EXPIRED,          // Nao respondeu no tempo limite
    CANCELLED;        // Cancelado pelo usuario

    companion object {
        fun fromString(value: String?): WaitlistStatus {
            return entries.find { it.name == value } ?: WAITING
        }
    }
}

/**
 * Representa uma entrada na lista de espera de um jogo (versao KMP).
 *
 * Quando o jogo atinge o limite de jogadores, novos jogadores
 * sao adicionados a lista de espera.
 *
 * Colecao Firestore: games/{gameId}/waitlist
 */
@Serializable
data class GameWaitlist(
    val id: String = "",
    @SerialName("game_id") val gameId: String = "",
    @SerialName("user_id") val userId: String = "",
    @SerialName("user_name") val userName: String = "",
    @SerialName("user_photo") val userPhoto: String? = null,
    val position: String = PlayerPosition.LINE.name,
    @SerialName("queue_position") val queuePosition: Int = 0,
    val status: String = WaitlistStatus.WAITING.name,
    @SerialName("added_at") val addedAt: Long? = null,
    @SerialName("notified_at") val notifiedAt: Long? = null,
    @SerialName("response_deadline") val responseDeadline: Long? = null
) {
    /**
     * Retorna o enum do status da entrada na lista de espera.
     */
    fun getStatusEnum(): WaitlistStatus = WaitlistStatus.fromString(status)

    /**
     * Retorna o enum da posicao do jogador.
     */
    fun getPositionEnum(): PlayerPosition = PlayerPosition.fromString(position)

    /**
     * Verifica se a entrada expirou (passou do deadline de resposta).
     */
    fun isExpired(currentTimeMs: Long): Boolean {
        val deadline = responseDeadline ?: return false
        return currentTimeMs > deadline
    }

    /**
     * Verifica se o jogador ja foi notificado sobre a vaga.
     */
    fun hasBeenNotified(): Boolean = notifiedAt != null

    companion object {
        /** Tempo padrao para responder a vaga: 30 minutos */
        const val DEFAULT_RESPONSE_TIME_MS = 30L * 60 * 1000
    }
}
