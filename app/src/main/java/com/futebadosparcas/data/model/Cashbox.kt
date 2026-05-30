package com.futebadosparcas.data.model

import com.futebadosparcas.domain.model.CashboxAppStatus
import com.futebadosparcas.domain.validation.ValidationHelper
import com.futebadosparcas.domain.validation.ValidationResult
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.Exclude
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import java.util.Date
import java.util.Locale

/**
 * Representa uma entrada no caixa do grupo
 * Subcoleção: groups/{groupId}/cashbox
 */
@IgnoreExtraProperties
data class CashboxEntry(
    @DocumentId
    var id: String = "",

    val type: String = CashboxEntryType.INCOME.name,

    val category: String = CashboxCategory.OTHER.name,

    @get:PropertyName("custom_category")
    @set:PropertyName("custom_category")
    var customCategory: String? = null,

    val amount: Double = 0.0,

    val description: String = "",

    @get:PropertyName("created_by_id")
    @set:PropertyName("created_by_id")
    var createdById: String = "",

    @get:PropertyName("created_by_name")
    @set:PropertyName("created_by_name")
    var createdByName: String = "",

    @get:PropertyName("reference_date")
    @set:PropertyName("reference_date")
    var referenceDate: Date = Date(),

    @ServerTimestamp
    @get:PropertyName("created_at")
    @set:PropertyName("created_at")
    var createdAt: Date? = null,

    @get:PropertyName("player_id")
    @set:PropertyName("player_id")
    var playerId: String? = null,

    @get:PropertyName("player_name")
    @set:PropertyName("player_name")
    var playerName: String? = null,

    @get:PropertyName("game_id")
    @set:PropertyName("game_id")
    var gameId: String? = null,

    @get:PropertyName("receipt_url")
    @set:PropertyName("receipt_url")
    var receiptUrl: String? = null,

    val status: String = CashboxAppStatus.ACTIVE.name,

    @ServerTimestamp
    @get:PropertyName("voided_at")
    @set:PropertyName("voided_at")
    var voidedAt: Date? = null,

    @get:PropertyName("voided_by")
    @set:PropertyName("voided_by")
    var voidedBy: String? = null
) {
    // Bloco de inicializacao para normalizar valores
    init {
        // Amount deve ser sempre positivo (tipo determina entrada/saída)
        amount.coerceAtLeast(0.0)
    }

    constructor() : this(id = "")

    // ==================== VALIDAÇÃO ====================

    /**
     * Valida todos os campos da entrada do caixa antes de salvar.
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

        // Validação de descrição (max 500 chars)
        val descResult = ValidationHelper.validateLength(description, "description", 0, 500)
        if (descResult is ValidationResult.Invalid) {
            errors.add(descResult)
        }

        // Validação de createdById obrigatório
        if (createdById.isBlank()) {
            errors.add(ValidationResult.Invalid("created_by_id", "Responsável é obrigatório"))
        }

        // Validação de tipo válido
        val typeResult = ValidationHelper.validateEnumValue<CashboxEntryType>(type, "type", required = true)
        if (typeResult is ValidationResult.Invalid) errors.add(typeResult)

        // Validação de categoria válida
        val catResult = ValidationHelper.validateEnumValue<CashboxCategory>(category, "category", required = true)
        if (catResult is ValidationResult.Invalid) errors.add(catResult)

        // Validação de URL do comprovante
        val receiptResult = ValidationHelper.validateUrl(receiptUrl, "receipt_url")
        if (receiptResult is ValidationResult.Invalid) errors.add(receiptResult)

        return errors
    }

    /**
     * Verifica se a entrada é válida para salvar.
     */
    @Exclude
    fun isValid(): Boolean = validate().isEmpty()

    fun getTypeEnum(): CashboxEntryType = try {
        CashboxEntryType.valueOf(type)
    } catch (e: Exception) {
        CashboxEntryType.INCOME
    }

    fun getCategoryEnum(): CashboxCategory = try {
        CashboxCategory.valueOf(category)
    } catch (e: Exception) {
        CashboxCategory.OTHER
    }

    fun isIncome(): Boolean = getTypeEnum() == CashboxEntryType.INCOME

    fun isExpense(): Boolean = getTypeEnum() == CashboxEntryType.EXPENSE

    /**
     * Retorna o nome da categoria para exibição
     */
    fun getCategoryDisplayName(): String {
        return if (getCategoryEnum() == CashboxCategory.OTHER && !customCategory.isNullOrEmpty()) {
            customCategory ?: getCategoryEnum().displayName
        } else {
            getCategoryEnum().displayName
        }
    }

    /**
     * Formata o valor para exibição com sinal
     */
    fun getFormattedAmount(): String {
        val sign = if (isIncome()) "+" else "-"
        return "$sign R$ ${String.format(Locale.getDefault(), "%.2f", amount)}"
    }

    /**
     * Formata a data para exibição
     */
    fun getFormattedDate(): String {
        val sdf = java.text.SimpleDateFormat("dd/MM/yyyy", java.util.Locale.forLanguageTag("pt-BR"))
        return sdf.format(createdAt ?: referenceDate)
    }

}

/**
 * Tipo de entrada no caixa
 */
enum class CashboxEntryType(val displayName: String) {
    INCOME("Entrada"),
    EXPENSE("Saída");

    companion object {
        fun fromString(value: String?): CashboxEntryType {
            return entries.find { it.name == value } ?: INCOME
        }
    }
}

/**
 * Categorias de entrada/saída do caixa
 */
enum class CashboxCategory(val displayName: String, val type: CashboxEntryType, val icon: String) {
    // Entradas
    MONTHLY_FEE("Mensalidade", CashboxEntryType.INCOME, "💵"),
    WEEKLY_FEE("Taxa Semanal", CashboxEntryType.INCOME, "💰"),
    SINGLE_PAYMENT("Avulso", CashboxEntryType.INCOME, "💳"),
    DONATION("Doação", CashboxEntryType.INCOME, "🎁"),

    // Saídas
    FIELD_RENTAL("Aluguel de Quadra", CashboxEntryType.EXPENSE, "⚽"),
    EQUIPMENT("Equipamentos", CashboxEntryType.EXPENSE, "🎽"),
    CELEBRATION("Confraternização", CashboxEntryType.EXPENSE, "🎉"),
    REFUND("Reembolso", CashboxEntryType.EXPENSE, "↩️"),

    // Comum
    OTHER("Outros", CashboxEntryType.INCOME, "📝");

    companion object {
        fun fromString(value: String?): CashboxCategory {
            return entries.find { it.name == value } ?: OTHER
        }

        fun getIncomeCategories(): List<CashboxCategory> {
            return entries.filter { it.type == CashboxEntryType.INCOME }
        }

        fun getExpenseCategories(): List<CashboxCategory> {
            return entries.filter { it.type == CashboxEntryType.EXPENSE }
        }
    }
}

/**
 * Resumo do caixa do grupo
 * Documento: groups/{groupId}/cashbox_summary/current
 */
@IgnoreExtraProperties
data class CashboxSummary(
    val balance: Double = 0.0,

    @get:PropertyName("total_income")
    @set:PropertyName("total_income")
    var totalIncome: Double = 0.0,

    @get:PropertyName("total_expense")
    @set:PropertyName("total_expense")
    var totalExpense: Double = 0.0,

    @get:PropertyName("last_entry_at")
    @set:PropertyName("last_entry_at")
    var lastEntryAt: Date? = null,

    @get:PropertyName("entry_count")
    @set:PropertyName("entry_count")
    var entryCount: Int = 0
) {
    constructor() : this(balance = 0.0)

    /**
     * Formata o saldo para exibição
     */
    fun getFormattedBalance(): String {
        val sign = if (balance >= 0) "" else "-"
        return "$sign R$ ${String.format(Locale.getDefault(), "%.2f", kotlin.math.abs(balance))}"
    }

    /**
     * Formata as entradas para exibição
     */
    fun getFormattedIncome(): String {
        return "+ R$ ${String.format(Locale.getDefault(), "%.2f", totalIncome)}"
    }

    /**
     * Formata as saídas para exibição
     */
    fun getFormattedExpense(): String {
        return "- R$ ${String.format(Locale.getDefault(), "%.2f", totalExpense)}"
    }


    /**
     * Verifica se há movimentações registradas
     */
    fun hasEntries(): Boolean = entryCount > 0
}

/**
 * Filtro para listagem do caixa
 * Usa enums do domain.model para consistência com o resto da UI
 */
data class CashboxFilter(
    val type: com.futebadosparcas.domain.model.CashboxEntryType? = null,
    val category: com.futebadosparcas.domain.model.CashboxCategory? = null,
    val startDate: Date? = null,
    val endDate: Date? = null,
    val playerId: String? = null
)
