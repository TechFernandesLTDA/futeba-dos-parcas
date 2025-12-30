package com.futebadosparcas.data.model

import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

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
    constructor() : this(id = "")

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
            customCategory!!
        } else {
            getCategoryEnum().displayName
        }
    }

    /**
     * Formata o valor para exibição com sinal
     */
    fun getFormattedAmount(): String {
        val sign = if (isIncome()) "+" else "-"
        return "$sign R$ ${String.format("%.2f", amount)}"
    }

    /**
     * Formata a data para exibição
     */
    fun getFormattedDate(): String {
        val sdf = java.text.SimpleDateFormat("dd/MM/yyyy", java.util.Locale("pt", "BR"))
        return sdf.format(createdAt ?: referenceDate)
    }

    /**
     * Retorna a cor apropriada (verde para entrada, vermelho para saída)
     */
    fun getAmountColor(): Int {
        return if (isIncome()) {
            android.graphics.Color.parseColor("#4CAF50") // Verde
        } else {
            android.graphics.Color.parseColor("#F44336") // Vermelho
        }
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
        return "$sign R$ ${String.format("%.2f", kotlin.math.abs(balance))}"
    }

    /**
     * Formata as entradas para exibição
     */
    fun getFormattedIncome(): String {
        return "+ R$ ${String.format("%.2f", totalIncome)}"
    }

    /**
     * Formata as saídas para exibição
     */
    fun getFormattedExpense(): String {
        return "- R$ ${String.format("%.2f", totalExpense)}"
    }

    /**
     * Retorna a cor do saldo (verde positivo, vermelho negativo)
     */
    fun getBalanceColor(): Int {
        return if (balance >= 0) {
            android.graphics.Color.parseColor("#4CAF50") // Verde
        } else {
            android.graphics.Color.parseColor("#F44336") // Vermelho
        }
    }

    /**
     * Verifica se há movimentações registradas
     */
    fun hasEntries(): Boolean = entryCount > 0
}

/**
 * Filtro para listagem do caixa
 */
data class CashboxFilter(
    val type: CashboxEntryType? = null,
    val category: CashboxCategory? = null,
    val startDate: Date? = null,
    val endDate: Date? = null,
    val playerId: String? = null
)
