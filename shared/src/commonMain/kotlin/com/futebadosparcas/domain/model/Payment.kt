package com.futebadosparcas.domain.model

import kotlinx.serialization.Serializable

/**
 * Tipos de pagamento suportados.
 */
@Serializable
enum class PaymentType {
    /** Pagamento mensal (mensalista) */
    MONTHLY,
    /** Pagamento avulso (diária) */
    DAILY,
    /** Taxas extras */
    EXTRA
}

/**
 * Métodos de pagamento.
 */
@Serializable
enum class PaymentMethod {
    /** PIX (transferência instantânea) */
    PIX,
    /** Dinheiro em espécie */
    CASH,
    /** Cartão de crédito/débito */
    CARD,
    /** Transferência bancária */
    TRANSFER
}

/**
 * Representa um pagamento no sistema.
 *
 * @property id ID único do pagamento
 * @property userId ID do usuário que realizou o pagamento
 * @property gameId ID do jogo relacionado (opcional)
 * @property scheduleId ID da agenda recorrente (opcional)
 * @property type Tipo do pagamento (mensal, diário, extra)
 * @property amount Valor do pagamento
 * @property status Status atual do pagamento
 * @property paymentMethod Método utilizado (opcional até confirmar)
 * @property dueDate Data de vencimento (formato ISO)
 * @property paidAt Data em que foi pago (timestamp)
 * @property pixKey Chave PIX para pagamento
 * @property pixQrcode Código QR do PIX (codificado)
 * @property pixTxid TXID da transação PIX
 * @property receiptUrl URL do comprovante (armazenado no Storage)
 * @property notes Observações adicionais
 * @property createdAt Timestamp de criação
 */
@Serializable
data class Payment(
    val id: String = "",
    val userId: String = "",
    val gameId: String? = null,
    val scheduleId: String? = null,
    val type: PaymentType = PaymentType.DAILY,
    val amount: Double = 0.0,
    val status: PaymentStatus = PaymentStatus.PENDING,
    val paymentMethod: PaymentMethod? = null,
    val dueDate: String = "",
    val paidAt: Long? = null,
    val pixKey: String? = null,
    val pixQrcode: String? = null,
    val pixTxid: String? = null,
    val receiptUrl: String? = null,
    val notes: String? = null,
    val createdAt: Long? = null
) {
    init {
        require(amount >= 0.0) { "amount nao pode ser negativo: $amount" }
    }

    /**
     * Verifica se o pagamento está atrasado.
     * NOTA: Como PaymentStatus em Game.kt não tem OVERDUE/CANCELLED,
     * esta é uma implementação simplificada.
     */
    fun isOverdue(): Boolean {
        // Lógica simplificada - em produção compararia dueDate com data atual
        return status == PaymentStatus.PENDING && dueDate.isNotEmpty()
    }

    /**
     * Retorna a cor hexadecimal para representar o status visualmente.
     */
    fun getStatusColor(): String {
        return when (status) {
            PaymentStatus.PAID -> "#4CAF50"
            PaymentStatus.PARTIAL -> "#FFC107"
            PaymentStatus.REFUNDED -> "#9E9E9E"
            PaymentStatus.PENDING -> "#FF9600"
        }
    }

    /**
     * Retorna o texto descritivo do status em português.
     */
    fun getStatusText(): String {
        return when (status) {
            PaymentStatus.PAID -> "Pago"
            PaymentStatus.PARTIAL -> "Parcial"
            PaymentStatus.REFUNDED -> "Reembolsado"
            PaymentStatus.PENDING -> "Pendente"
        }
    }
}

// ========== VAQUINHA (CROWDFUNDING) ==========

/**
 * Tipos de vaquinha/crowdfunding.
 */
@Serializable
enum class CrowdfundingType {
    /** Churrasco pós-jogo */
    BBQ,
    /** Compra de uniforme */
    UNIFORM,
    /** Compra de equipamentos */
    EQUIPMENT,
    /** Festa ou confraternização */
    PARTY,
    /** Outros tipos */
    OTHER
}

/**
 * Status de uma vaquinha.
 */
@Serializable
enum class CrowdfundingStatus {
    /** Vaquinha ativa e aceitando contribuições */
    ACTIVE,
    /** Meta atingida e encerrada */
    COMPLETED,
    /** Cancelada */
    CANCELLED
}

/**
 * Representa uma vaquinha (crowdfunding) para arrecadação.
 *
 * @property id ID único da vaquinha
 * @property organizerId ID do usuário organizador
 * @property scheduleId ID da agenda relacionada (opcional)
 * @property title Título da vaquinha
 * @property description Descrição detalhada
 * @property type Tipo de vaquinha
 * @property targetAmount Meta de arrecadação
 * @property currentAmount Valor arrecadado até o momento
 * @property deadline Data limite (formato ISO)
 * @property status Status atual
 * @property pixKey Chave PIX para contribuições
 * @property imageUrl URL da imagem de capa
 * @property createdAt Timestamp de criação
 */
@Serializable
data class Crowdfunding(
    val id: String = "",
    val organizerId: String = "",
    val scheduleId: String? = null,
    val title: String = "",
    val description: String = "",
    val type: CrowdfundingType = CrowdfundingType.BBQ,
    val targetAmount: Double = 0.0,
    val currentAmount: Double = 0.0,
    val deadline: String = "",
    val status: CrowdfundingStatus = CrowdfundingStatus.ACTIVE,
    val pixKey: String? = null,
    val imageUrl: String? = null,
    val createdAt: Long? = null
) {
    init {
        require(targetAmount >= 0.0) { "targetAmount nao pode ser negativo: $targetAmount" }
        require(currentAmount >= 0.0) { "currentAmount nao pode ser negativo: $currentAmount" }
    }

    /**
     * Calcula o percentual de progresso da meta (0-100).
     */
    fun getProgressPercentage(): Int {
        return if (targetAmount > 0) {
            ((currentAmount / targetAmount) * 100).toInt().coerceIn(0, 100)
        } else 0
    }

    /**
     * Retorna o valor restante para atingir a meta.
     */
    fun getRemainingAmount(): Double {
        return (targetAmount - currentAmount).coerceAtLeast(0.0)
    }
}

/**
 * Representa uma contribuição em uma vaquinha.
 *
 * @property id ID único da contribuição
 * @property crowdfundingId ID da vaquinha
 * @property userId ID do usuário que contribuiu
 * @param amount Valor contribuído
 * @property isAnonymous Se a contribuição é anônima
 * @property message Mensagem de apoio (opcional)
 * @property receiptUrl URL do comprovante
 * @property contributedAt Timestamp da contribuição
 */
@Serializable
data class CrowdfundingContribution(
    val id: String = "",
    val crowdfundingId: String = "",
    val userId: String = "",
    val amount: Double = 0.0,
    val isAnonymous: Boolean = false,
    val message: String? = null,
    val receiptUrl: String? = null,
    val contributedAt: Long? = null
) {
    init {
        require(amount >= 0.0) { "amount nao pode ser negativo: $amount" }
    }
}
