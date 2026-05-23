package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Tipo de entrada no caixa
 */
@Serializable
enum class CashboxEntryType {
    INCOME,
    EXPENSE;

    companion object {
        fun fromString(value: String?): CashboxEntryType {
            return entries.find { it.name == value } ?: INCOME
        }
    }
}

/**
 * Status da entrada no caixa
 */
@Serializable
enum class CashboxAppStatus {
    ACTIVE,
    VOIDED // Anulado/Estornado
}

/**
 * Categorias de entrada/saída do caixa
 */
@Serializable
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

        /** Retorna categorias de receita */
        fun getIncomeCategories(): List<CashboxCategory> {
            return entries.filter { it.type == CashboxEntryType.INCOME }
        }

        /** Retorna categorias de despesa */
        fun getExpenseCategories(): List<CashboxCategory> {
            return entries.filter { it.type == CashboxEntryType.EXPENSE }
        }
    }
}

/**
 * Representa uma entrada no caixa do grupo
 * Subcoleção: groups/{groupId}/cashbox
 *
 * @property id ID único do documento
 * @property type Tipo de entrada (INCOME/EXPENSE)
 * @property category Categoria da entrada
 * @property customCategory Categoria personalizada (quando category = OTHER)
 * @property amount Valor da entrada
 * @property description Descrição da entrada
 * @property createdById ID do usuário que criou a entrada
 * @property createdByName Nome do usuário que criou a entrada
 * @property referenceDate Data de referência da entrada (epoch ms)
 * @property createdAt Data de criação no servidor (epoch ms)
 * @property playerId ID do jogador (para mensalidades)
 * @property playerName Nome do jogador (para mensalidades)
 * @property gameId ID do jogo relacionado (opcional)
 * @property receiptUrl URL do comprovante de pagamento (opcional)
 * @property status Status da entrada (ACTIVE/VOIDED)
 * @property voidedAt Data em que foi estornada (epoch ms)
 * @property voidedBy ID do usuário que estornou
 */
@Serializable
data class CashboxEntry(
    val id: String = "",
    val type: String = CashboxEntryType.INCOME.name,
    val category: String = CashboxCategory.OTHER.name,
    @SerialName("custom_category") val customCategory: String? = null,
    val amount: Double = 0.0,
    val description: String = "",
    @SerialName("created_by_id") val createdById: String = "",
    @SerialName("created_by_name") val createdByName: String = "",
    @SerialName("reference_date") val referenceDate: Long = 0L,
    @SerialName("created_at") val createdAt: Long? = null,
    @SerialName("player_id") val playerId: String? = null,
    @SerialName("player_name") val playerName: String? = null,
    @SerialName("game_id") val gameId: String? = null,
    @SerialName("receipt_url") val receiptUrl: String? = null,
    val status: String = CashboxAppStatus.ACTIVE.name,
    @SerialName("voided_at") val voidedAt: Long? = null,
    @SerialName("voided_by") val voidedBy: String? = null
) {
    /**
     * Retorna o enum do tipo de entrada
     */
    fun getTypeEnum(): CashboxEntryType = try {
        CashboxEntryType.valueOf(type)
    } catch (e: Exception) {
        CashboxEntryType.INCOME
    }

    /**
     * Retorna o enum da categoria
     */
    fun getCategoryEnum(): CashboxCategory = try {
        CashboxCategory.valueOf(category)
    } catch (e: Exception) {
        CashboxCategory.OTHER
    }

    /**
     * Verifica se é uma entrada (receita)
     */
    fun isIncome(): Boolean = getTypeEnum() == CashboxEntryType.INCOME

    /**
     * Verifica se é uma saída (despesa)
     */
    fun isExpense(): Boolean = getTypeEnum() == CashboxEntryType.EXPENSE

    /**
     * Retorna o nome da categoria para exibição
     */
    fun getCategoryDisplayName(): String {
        return if (getCategoryEnum() == CashboxCategory.OTHER && !customCategory.isNullOrEmpty()) {
            customCategory
        } else {
            getCategoryEnum().displayName
        }
    }

    /**
     * Verifica se a entrada foi anulada/estornada.
     */
    fun isVoided(): Boolean = try {
        CashboxAppStatus.valueOf(status) == CashboxAppStatus.VOIDED
    } catch (_: Exception) {
        false
    }

    /**
     * Verifica se a entrada esta ativa.
     */
    fun isActive(): Boolean = !isVoided()

    /**
     * Retorna o valor com sinal correto (positivo para receita, negativo para despesa).
     */
    fun getSignedAmount(): Double = if (isIncome()) amount else -amount

    companion object {
        /** Colecao Firestore (subcoleção de groups) */
        const val COLLECTION = "cashbox"

        /** Valor minimo permitido para uma entrada */
        const val MIN_AMOUNT = 0.01

        /** Valor maximo permitido para uma entrada */
        const val MAX_AMOUNT = 100_000.00
    }
}

/**
 * Resumo do caixa do grupo
 * Documento: groups/{groupId}/cashbox_summary/current
 *
 * @property balance Saldo atual (receitas - despesas)
 * @property totalIncome Total de receitas
 * @property totalExpense Total de despesas
 * @property lastEntryAt Data da última entrada (epoch ms)
 * @property entryCount Número total de entradas ativas
 */
@Serializable
data class CashboxSummary(
    val balance: Double = 0.0,
    @SerialName("total_income") val totalIncome: Double = 0.0,
    @SerialName("total_expense") val totalExpense: Double = 0.0,
    @SerialName("last_entry_at") val lastEntryAt: Long? = null,
    @SerialName("entry_count") val entryCount: Int = 0
) {
    /**
     * Verifica se há movimentações registradas
     */
    fun hasEntries(): Boolean = entryCount > 0
}

/**
 * Filtro para listagem do caixa
 *
 * @property type Filtra por tipo (INCOME/EXPENSE)
 * @property category Filtra por categoria
 * @property startDate Data inicial do período (epoch ms)
 * @property endDate Data final do período (epoch ms)
 * @property playerId Filtra por jogador específico
 */
data class CashboxFilter(
    val type: CashboxEntryType? = null,
    val category: CashboxCategory? = null,
    val startDate: Long? = null,
    val endDate: Long? = null,
    val playerId: String? = null
)
