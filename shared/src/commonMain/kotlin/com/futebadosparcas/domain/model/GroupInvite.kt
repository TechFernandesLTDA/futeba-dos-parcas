package com.futebadosparcas.domain.model

import kotlinx.datetime.Clock
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Status do convite de grupo.
 */
@Serializable
enum class InviteStatus(val displayName: String) {
    @SerialName("PENDING")
    PENDING("Pendente"),

    @SerialName("ACCEPTED")
    ACCEPTED("Aceito"),

    @SerialName("DECLINED")
    DECLINED("Recusado"),

    @SerialName("EXPIRED")
    EXPIRED("Expirado"),

    @SerialName("CANCELLED")
    CANCELLED("Cancelado");

    companion object {
        fun fromString(value: String?): InviteStatus {
            return entries.find { it.name == value } ?: PENDING
        }
    }
}

/**
 * Status do membro no grupo.
 */
@Serializable
enum class GroupMemberStatus {
    @SerialName("ACTIVE")
    ACTIVE,

    @SerialName("INACTIVE")
    INACTIVE,

    @SerialName("REMOVED")
    REMOVED
}

/**
 * Representa um convite para entrar em um grupo.
 * Coleção: group_invites
 */
@Serializable
data class GroupInvite(
    val id: String = "",

    @SerialName("group_id")
    val groupId: String = "",

    @SerialName("group_name")
    val groupName: String = "",

    @SerialName("group_photo")
    val groupPhoto: String? = null,

    @SerialName("invited_user_id")
    val invitedUserId: String = "",

    @SerialName("invited_user_name")
    val invitedUserName: String = "",

    @SerialName("invited_user_email")
    val invitedUserEmail: String = "",

    @SerialName("invited_by_id")
    val invitedById: String = "",

    @SerialName("invited_by_name")
    val invitedByName: String = "",

    val status: String = InviteStatus.PENDING.name,

    @SerialName("created_at")
    val createdAt: Long? = null,

    @SerialName("expires_at")
    val expiresAt: Long? = null,

    @SerialName("responded_at")
    val respondedAt: Long? = null
) {
    fun getStatusEnum(): InviteStatus = InviteStatus.fromString(status)

    fun isPending(): Boolean = getStatusEnum() == InviteStatus.PENDING

    fun isAccepted(): Boolean = getStatusEnum() == InviteStatus.ACCEPTED

    fun isDeclined(): Boolean = getStatusEnum() == InviteStatus.DECLINED

    fun isExpired(): Boolean = getStatusEnum() == InviteStatus.EXPIRED

    /**
     * Verifica se o convite expirou baseado na data atual
     */
    fun hasExpired(): Boolean {
        val now = Clock.System.now().toEpochMilliseconds()
        return expiresAt?.let { it < now } == true || isExpired()
    }

    /**
     * Verifica se o convite ainda pode ser respondido
     */
    fun canRespond(): Boolean = isPending() && !hasExpired()
}

// Tempo de expiração em milissegundos (48 horas)
private const val EXPIRATION_TIME_MS = 48 * 60 * 60 * 1000L

/**
 * Calcula a data de expiração (48 horas a partir de agora)
 */
fun calculateGroupInviteExpirationDate(): Long {
    return Clock.System.now().toEpochMilliseconds() + EXPIRATION_TIME_MS
}
