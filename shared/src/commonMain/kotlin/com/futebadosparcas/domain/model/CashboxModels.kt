package com.futebadosparcas.domain.model

import kotlinx.datetime.Instant

/**
 * Tipo de entrada no caixa
 */
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
enum class CashboxAppStatus {
    ACTIVE,
    VOIDED // Anulado/Estornado
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
 * @property referenceDate Data de referência da entrada
 * @property createdAt Data de criação no servidor
 * @property playerId ID do jogador (para mensalidades)
 * @property playerName Nome do jogador (para mensalidades)
 * @property gameId ID do jogo relacionado (opcional)
 * @property receiptUrl URL do comprovante de pagamento (opcional)
 * @property status Status da entrada (ACTIVE/VOIDED)
 * @property voidedAt Data em que foi estornada
 * @property voidedBy ID do usuário que estornou
 */
data class CashboxEntry(
    val id: String = "",
    val type: String = CashboxEntryType.INCOME.name,
    val category: String = CashboxCategory.OTHER.name,
    val customCategory: String? = null,
    val amount: Double = 0.0,
    val description: String = "",
    val createdById: String = "",
    val createdByName: String = "",
    val referenceDate: Instant,
    val createdAt: Instant?,
    val playerId: String? = null,
    val playerName: String? = null,
    val gameId: String? = null,
    val receiptUrl: String? = null,
    val status: String = CashboxAppStatus.ACTIVE.name,
    val voidedAt: Instant? = null,
    val voidedBy: String? = null
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
            customCategory!!
        } else {
            getCategoryEnum().displayName
        }
    }
}

/**
 * Resumo do caixa do grupo
 * Documento: groups/{groupId}/cashbox_summary/current
 *
 * @property balance Saldo atual (receitas - despesas)
 * @property totalIncome Total de receitas
 * @property totalExpense Total de despesas
 * @property lastEntryAt Data da última entrada
 * @property entryCount Número total de entradas ativas
 */
data class CashboxSummary(
    val balance: Double = 0.0,
    val totalIncome: Double = 0.0,
    val totalExpense: Double = 0.0,
    val lastEntryAt: Instant? = null,
    val entryCount: Int = 0
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
 * @property startDate Data inicial do período
 * @property endDate Data final do período
 * @property playerId Filtra por jogador específico
 */
data class CashboxFilter(
    val type: CashboxEntryType? = null,
    val category: CashboxCategory? = null,
    val startDate: Instant? = null,
    val endDate: Instant? = null,
    val playerId: String? = null
)
