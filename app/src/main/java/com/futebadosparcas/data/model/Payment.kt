package com.futebadosparcas.data.model

import com.futebadosparcas.domain.validation.ValidationHelper
import com.futebadosparcas.domain.validation.ValidationResult
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.Exclude
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

enum class PaymentType {
    MONTHLY, // Mensalista
    DAILY, // Avulso/Diária
    EXTRA // Taxas extras
}

enum class PaymentMethod {
    PIX, CASH, CARD, TRANSFER
}

@IgnoreExtraProperties
data class Payment(
    @DocumentId
    val id: String = "",
    @get:PropertyName("user_id")
    @set:PropertyName("user_id")
    var userId: String = "",
    @get:PropertyName("game_id")
    @set:PropertyName("game_id")
    var gameId: String? = null,
    @get:PropertyName("schedule_id")
    @set:PropertyName("schedule_id")
    var scheduleId: String? = null,

    // Referência ao grupo para queries (#8 - Validação Firebase)
    @get:PropertyName("group_id")
    @set:PropertyName("group_id")
    var groupId: String? = null,
    val type: PaymentType = PaymentType.DAILY,
    val amount: Double = 0.0,
    val status: PaymentStatus = PaymentStatus.PENDING,
    @get:PropertyName("payment_method")
    @set:PropertyName("payment_method")
    var paymentMethod: PaymentMethod? = null,
    @get:PropertyName("due_date")
    @set:PropertyName("due_date")
    var dueDate: String = "",
    @get:PropertyName("paid_at")
    @set:PropertyName("paid_at")
    var paidAt: Date? = null,
    @get:PropertyName("pix_key")
    @set:PropertyName("pix_key")
    var pixKey: String? = null,
    @get:PropertyName("pix_qrcode")
    @set:PropertyName("pix_qrcode")
    var pixQrcode: String? = null,
    @get:PropertyName("pix_txid")
    @set:PropertyName("pix_txid")
    var pixTxid: String? = null,
    @get:PropertyName("receipt_url")
    @set:PropertyName("receipt_url")
    var receiptUrl: String? = null,
    val notes: String? = null,
    @ServerTimestamp
    @get:PropertyName("created_at")
    @set:PropertyName("created_at")
    var createdAt: Date? = null,

    // Auditoria: última atualização (#8 - Validação Firebase)
    @get:PropertyName("updated_at")
    @set:PropertyName("updated_at")
    var updatedAt: Date? = null
) {
    // Bloco de inicializacao para normalizar valores
    init {
        // Amount deve ser sempre positivo
        amount.coerceAtLeast(0.0)
    }

    constructor() : this(id = "")

    // ==================== VALIDAÇÃO ====================

    /**
     * Valida todos os campos do pagamento antes de salvar.
     *
     * @return Lista de erros de validação (vazia se tudo válido)
     */
    @Exclude
    fun validate(): List<ValidationResult.Invalid> {
        val errors = mutableListOf<ValidationResult.Invalid>()

        // Validação de amount (> 0)
        if (amount <= 0) {
            errors.add(ValidationResult.Invalid("amount", "Valor deve ser maior que zero"))
        }

        // Validação de userId obrigatório
        if (userId.isBlank()) {
            errors.add(ValidationResult.Invalid("user_id", "Usuário é obrigatório"))
        }

        // Validação de dueDate obrigatória
        if (dueDate.isBlank()) {
            errors.add(ValidationResult.Invalid(
                "due_date", "Data de vencimento é obrigatória",
                com.futebadosparcas.domain.validation.ValidationErrorCode.REQUIRED_FIELD
            ))
        }

        // Validação de valor máximo
        if (amount > ValidationHelper.MAX_PAYMENT_VALUE) {
            errors.add(ValidationResult.Invalid(
                "amount", "Valor máximo é R$ ${ValidationHelper.MAX_PAYMENT_VALUE}",
                com.futebadosparcas.domain.validation.ValidationErrorCode.OUT_OF_RANGE
            ))
        }

        // Validação de URL do comprovante
        val receiptResult = ValidationHelper.validateUrl(receiptUrl, "receipt_url")
        if (receiptResult is ValidationResult.Invalid) errors.add(receiptResult)

        // Validação de timestamps
        val tsResult = ValidationHelper.validateTimestampOrder(createdAt, updatedAt)
        if (tsResult is ValidationResult.Invalid) errors.add(tsResult)

        // Se pago, deve ter paidAt
        if (status == PaymentStatus.PAID && paidAt == null) {
            errors.add(ValidationResult.Invalid(
                "paid_at", "Pagamento marcado como pago deve ter data de pagamento",
                com.futebadosparcas.domain.validation.ValidationErrorCode.LOGICAL_INCONSISTENCY
            ))
        }

        // Validação de notas (máx 500 chars)
        notes?.let {
            val notesResult = ValidationHelper.validateLength(it, "notes", 0, ValidationHelper.DESCRIPTION_MAX_LENGTH)
            if (notesResult is ValidationResult.Invalid) errors.add(notesResult)
        }

        return errors
    }

    /**
     * Verifica se o pagamento é válido para salvar.
     */
    @Exclude
    fun isValid(): Boolean = validate().isEmpty()

    fun isOverdue(): Boolean {
        if (status == PaymentStatus.PAID || status == PaymentStatus.CANCELLED) return false
        // Implementar lógica de verificação de vencimento
        return status == PaymentStatus.OVERDUE
    }

    fun getStatusColor(): String {
        return when (status) {
            PaymentStatus.PAID -> "#4CAF50"
            PaymentStatus.PENDING -> "#FF9600"
            PaymentStatus.OVERDUE -> "#F44336"
            PaymentStatus.CANCELLED -> "#9E9E9E"
            PaymentStatus.PARTIAL -> "#FFC107"
        }
    }

    fun getStatusText(): String {
        return when (status) {
            PaymentStatus.PAID -> "Pago"
            PaymentStatus.PENDING -> "Pendente"
            PaymentStatus.OVERDUE -> "Atrasado"
            PaymentStatus.CANCELLED -> "Cancelado"
            PaymentStatus.PARTIAL -> "Parcial"
        }
    }
}

// ========== VAQUINHA (CROWDFUNDING) ==========

enum class CrowdfundingType {
    BBQ, // Churrasco
    UNIFORM, // Uniforme
    EQUIPMENT, // Equipamento
    PARTY, // Festa/Confraternização
    OTHER // Outros
}

enum class CrowdfundingStatus {
    ACTIVE, COMPLETED, CANCELLED
}

@IgnoreExtraProperties
data class Crowdfunding(
    @DocumentId
    val id: String = "",
    @get:PropertyName("organizer_id")
    @set:PropertyName("organizer_id")
    var organizerId: String = "",
    @get:PropertyName("schedule_id")
    @set:PropertyName("schedule_id")
    var scheduleId: String? = null,
    val title: String = "",
    val description: String = "",
    val type: CrowdfundingType = CrowdfundingType.BBQ,
    @get:PropertyName("target_amount")
    @set:PropertyName("target_amount")
    var targetAmount: Double = 0.0,
    @get:PropertyName("current_amount")
    @set:PropertyName("current_amount")
    var currentAmount: Double = 0.0,
    val deadline: String = "",
    val status: CrowdfundingStatus = CrowdfundingStatus.ACTIVE,
    @get:PropertyName("pix_key")
    @set:PropertyName("pix_key")
    var pixKey: String? = null,
    @get:PropertyName("image_url")
    @set:PropertyName("image_url")
    var imageUrl: String? = null,
    @ServerTimestamp
    @get:PropertyName("created_at")
    @set:PropertyName("created_at")
    var createdAt: Date? = null
) {
    // Bloco de inicializacao para normalizar valores
    init {
        targetAmount = targetAmount.coerceAtLeast(0.0)
        currentAmount = currentAmount.coerceAtLeast(0.0)
    }

    constructor() : this(id = "")

    // ==================== VALIDAÇÃO ====================

    /**
     * Valida todos os campos da vaquinha antes de salvar.
     *
     * @return Lista de erros de validação (vazia se tudo válido)
     */
    @Exclude
    fun validate(): List<ValidationResult.Invalid> {
        val errors = mutableListOf<ValidationResult.Invalid>()

        // Validação de título (obrigatório, 3-100 chars)
        val titleResult = ValidationHelper.validateName(title, "title", 3, 100)
        if (titleResult is ValidationResult.Invalid) {
            errors.add(titleResult)
        }

        // Validação de targetAmount (> 0)
        if (targetAmount <= 0) {
            errors.add(ValidationResult.Invalid("target_amount", "Meta deve ser maior que zero"))
        }

        // Validação de organizerId obrigatório
        if (organizerId.isBlank()) {
            errors.add(ValidationResult.Invalid("organizer_id", "Organizador é obrigatório"))
        }

        // Validação de tipo válido
        val typeResult = ValidationHelper.validateEnumValue<CrowdfundingType>(type.name, "type", required = true)
        if (typeResult is ValidationResult.Invalid) errors.add(typeResult)

        // Validação de deadline obrigatória
        if (deadline.isBlank()) {
            errors.add(ValidationResult.Invalid(
                "deadline", "Data limite é obrigatória",
                com.futebadosparcas.domain.validation.ValidationErrorCode.REQUIRED_FIELD
            ))
        }

        // Validação de currentAmount <= targetAmount (consistência)
        if (currentAmount > targetAmount && targetAmount > 0) {
            errors.add(ValidationResult.Invalid(
                "current_amount",
                "Valor arrecadado não pode exceder a meta",
                com.futebadosparcas.domain.validation.ValidationErrorCode.LOGICAL_INCONSISTENCY
            ))
        }

        return errors
    }

    /**
     * Verifica se a vaquinha é válida para salvar.
     */
    @Exclude
    fun isValid(): Boolean = validate().isEmpty()

    fun getProgressPercentage(): Int {
        return if (targetAmount > 0) {
            ((currentAmount / targetAmount) * 100).toInt().coerceIn(0, 100)
        } else 0
    }

    fun getRemainingAmount(): Double {
        return (targetAmount - currentAmount).coerceAtLeast(0.0)
    }
}

data class CrowdfundingContribution(
    @DocumentId
    val id: String = "",
    @get:PropertyName("crowdfunding_id")
    @set:PropertyName("crowdfunding_id")
    var crowdfundingId: String = "",
    @get:PropertyName("user_id")
    @set:PropertyName("user_id")
    var userId: String = "",
    val amount: Double = 0.0,
    @get:PropertyName("is_anonymous")
    @set:PropertyName("is_anonymous")
    var isAnonymous: Boolean = false,
    val message: String? = null,
    @get:PropertyName("receipt_url")
    @set:PropertyName("receipt_url")
    var receiptUrl: String? = null,
    @ServerTimestamp
    @get:PropertyName("contributed_at")
    @set:PropertyName("contributed_at")
    var contributedAt: Date? = null
) {
    constructor() : this(id = "")
}
