package com.futebadosparcas.data.model

import com.futebadosparcas.domain.validation.ValidationHelper
import com.futebadosparcas.domain.validation.ValidationResult
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.Exclude
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

/**
 * Representa um convite para entrar em um grupo
 * Coleção: group_invites
 */
@IgnoreExtraProperties
data class GroupInvite(
    @DocumentId
    var id: String = "",

    @get:PropertyName("group_id")
    @set:PropertyName("group_id")
    var groupId: String = "",

    @get:PropertyName("group_name")
    @set:PropertyName("group_name")
    var groupName: String = "",

    @get:PropertyName("group_photo")
    @set:PropertyName("group_photo")
    var groupPhoto: String? = null,

    @get:PropertyName("invited_user_id")
    @set:PropertyName("invited_user_id")
    var invitedUserId: String = "",

    @get:PropertyName("invited_user_name")
    @set:PropertyName("invited_user_name")
    var invitedUserName: String = "",

    @get:PropertyName("invited_user_email")
    @set:PropertyName("invited_user_email")
    var invitedUserEmail: String = "",

    @get:PropertyName("invited_by_id")
    @set:PropertyName("invited_by_id")
    var invitedById: String = "",

    @get:PropertyName("invited_by_name")
    @set:PropertyName("invited_by_name")
    var invitedByName: String = "",

    val status: String = InviteStatus.PENDING.name,

    @ServerTimestamp
    @get:PropertyName("created_at")
    @set:PropertyName("created_at")
    var createdAt: Date? = null,

    @get:PropertyName("expires_at")
    @set:PropertyName("expires_at")
    var expiresAt: Date? = null,

    @get:PropertyName("responded_at")
    @set:PropertyName("responded_at")
    var respondedAt: Date? = null
) {
    constructor() : this(id = "")

    fun getStatusEnum(): InviteStatus = try {
        InviteStatus.valueOf(status)
    } catch (e: Exception) {
        InviteStatus.PENDING
    }

    fun isPending(): Boolean = getStatusEnum() == InviteStatus.PENDING

    fun isAccepted(): Boolean = getStatusEnum() == InviteStatus.ACCEPTED

    fun isDeclined(): Boolean = getStatusEnum() == InviteStatus.DECLINED

    fun isExpired(): Boolean = getStatusEnum() == InviteStatus.EXPIRED

    /**
     * Verifica se o convite expirou baseado na data atual
     */
    fun hasExpired(): Boolean {
        val now = Date()
        return expiresAt?.before(now) == true || isExpired()
    }

    /**
     * Verifica se o convite ainda pode ser respondido
     */
    fun canRespond(): Boolean = isPending() && !hasExpired()

    // ==================== VALIDAÇÃO ====================

    @Exclude
    fun validate(): List<ValidationResult.Invalid> {
        val errors = mutableListOf<ValidationResult.Invalid>()
        val gResult = ValidationHelper.validateRequiredId(groupId, "group_id")
        if (gResult is ValidationResult.Invalid) errors.add(gResult)
        val uResult = ValidationHelper.validateRequiredId(invitedUserId, "invited_user_id")
        if (uResult is ValidationResult.Invalid) errors.add(uResult)
        val iResult = ValidationHelper.validateRequiredId(invitedById, "invited_by_id")
        if (iResult is ValidationResult.Invalid) errors.add(iResult)
        val sResult = ValidationHelper.validateEnumValue<InviteStatus>(status, "status", required = true)
        if (sResult is ValidationResult.Invalid) errors.add(sResult)
        // Se respondido (aceito/recusado), deve ter respondedAt
        if ((isAccepted() || isDeclined()) && respondedAt == null) {
            errors.add(ValidationResult.Invalid(
                "responded_at",
                "Convite respondido deve ter data de resposta",
                com.futebadosparcas.domain.validation.ValidationErrorCode.LOGICAL_INCONSISTENCY
            ))
        }
        return errors
    }

    companion object {
        // Tempo de expiração em milissegundos (48 horas)
        const val EXPIRATION_TIME_MS = 48 * 60 * 60 * 1000L

        /**
         * Calcula a data de expiração (48 horas a partir de agora)
         */
        fun calculateExpirationDate(): Date {
            return Date(System.currentTimeMillis() + EXPIRATION_TIME_MS)
        }
    }
}

/**
 * Status do convite
 */
enum class InviteStatus(val displayName: String) {
    PENDING("Pendente"),       // Aguardando resposta
    ACCEPTED("Aceito"),        // Convite aceito
    DECLINED("Recusado"),      // Convite recusado
    EXPIRED("Expirado"),       // Convite expirado (48h)
    CANCELLED("Cancelado");    // Convite cancelado pelo remetente

    companion object {
        fun fromString(value: String?): InviteStatus {
            return entries.find { it.name == value } ?: PENDING
        }
    }
}
