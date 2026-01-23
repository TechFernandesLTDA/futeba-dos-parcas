package com.futebadosparcas.domain.usecase.cashbox

import com.futebadosparcas.domain.model.CashboxSummary
import com.futebadosparcas.domain.repository.CashboxRepository
import com.futebadosparcas.domain.usecase.SuspendUseCase
import javax.inject.Inject

/**
 * Get Cashbox Summary Use Case
 *
 * Retrieves the financial summary for a group's cashbox, including balance, total income,
 * total expenses, and entry count.
 *
 * Business logic:
 * - Fetches the summary from the cashbox repository
 * - Returns aggregated financial data
 * - Calculates balance as (total income - total expenses)
 *
 * Usage:
 * ```kotlin
 * val result = getCashboxSummaryUseCase(GetCashboxSummaryParams(
 *     groupId = "group123"
 * ))
 *
 * result.fold(
 *     onSuccess = { summary ->
 *         println("Saldo atual: R$ ${summary.balance}")
 *         println("Receitas: R$ ${summary.totalIncome}")
 *         println("Despesas: R$ ${summary.totalExpense}")
 *         println("Movimentações: ${summary.entryCount}")
 *     },
 *     onFailure = { error ->
 *         println("Erro ao obter resumo: ${error.message}")
 *     }
 * )
 * ```
 */
class GetCashboxSummaryUseCase @Inject constructor(
    private val cashboxRepository: CashboxRepository
) : SuspendUseCase<GetCashboxSummaryParams, CashboxSummary>() {

    override suspend fun execute(params: GetCashboxSummaryParams): CashboxSummary {
        // Validar ID do grupo
        require(params.groupId.isNotBlank()) {
            "ID do grupo é obrigatório"
        }

        // Buscar resumo do caixa
        val result = cashboxRepository.getSummary(params.groupId)

        return result.getOrThrow()
    }
}

/**
 * Parâmetros para obter o resumo do caixa
 *
 * @property groupId ID do grupo para o qual obter o resumo
 */
data class GetCashboxSummaryParams(
    val groupId: String
)
