package com.futebadosparcas.data.model

import com.futebadosparcas.domain.validation.ValidationHelper
import com.futebadosparcas.domain.validation.ValidationResult
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.Exclude
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
    var createdAt: Date? = null
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
        }
    }

    fun getStatusText(): String {
        return when (status) {
            PaymentStatus.PAID -> "Pago"
            PaymentStatus.PENDING -> "Pendente"
            PaymentStatus.OVERDUE -> "Atrasado"
            PaymentStatus.CANCELLED -> "Cancelado"
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
