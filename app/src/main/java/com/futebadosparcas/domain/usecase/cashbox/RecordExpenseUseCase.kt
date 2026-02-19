package com.futebadosparcas.domain.usecase.cashbox

import com.futebadosparcas.domain.model.CashboxCategory
import com.futebadosparcas.domain.model.CashboxEntry
import com.futebadosparcas.domain.model.CashboxEntryType
import com.futebadosparcas.domain.repository.CashboxRepository
import com.futebadosparcas.domain.usecase.SuspendUseCase
import com.futebadosparcas.util.ValidationHelper
import kotlinx.datetime.Clock

/**
 * Record Expense Use Case
 *
 * Records a group expense (field rental, equipment purchases, celebrations, etc.) in the cashbox.
 *
 * Business logic:
 * - Validates group ID and expense amount
 * - Creates a CashboxEntry with EXPENSE type
 * - Supports categories: FIELD_RENTAL, EQUIPMENT, CELEBRATION, REFUND, or custom
 * - Updates the group's financial summary
 * - Optionally stores receipt image
 * - Returns the entry ID
 *
 * Usage:
 * ```kotlin
 * val result = recordExpenseUseCase(RecordExpenseParams(
 *     groupId = "group123",
 *     category = CashboxCategory.FIELD_RENTAL,
 *     amount = 150.00,
 *     description = "Aluguel da quadra - 15/01/2025",
 *     createdByUserId = "admin789",
 *     createdByUserName = "Admin User",
 *     receiptFilePath = "/path/to/receipt.jpg"
 * ))
 *
 * result.fold(
 *     onSuccess = { entryId ->
 *         println("Despesa registrada: $entryId")
 *     },
 *     onFailure = { error ->
 *         println("Erro ao registrar: ${error.message}")
 *     }
 * )
 * ```
 */
class RecordExpenseUseCase constructor(
    private val cashboxRepository: CashboxRepository,
    private val validationHelper: ValidationHelper
) : SuspendUseCase<RecordExpenseParams, String>() {

    override suspend fun execute(params: RecordExpenseParams): String {
        // Validar ID do grupo
        require(params.groupId.isNotBlank()) {
            "ID do grupo é obrigatório"
        }

        // Validar valor da despesa
        require(params.amount > 0) {
            "Valor da despesa deve ser maior que zero"
        }

        // Validar descrição
        require(params.description.isNotBlank()) {
            "Descrição da despesa é obrigatória"
        }

        // Validar que a categoria é de saída (despesa)
        require(params.category.type == CashboxEntryType.EXPENSE) {
            "A categoria deve ser do tipo EXPENSE (despesa)"
        }

        // Validar ID do usuário que criou a entrada
        require(params.createdByUserId.isNotBlank()) {
            "ID do usuário que registrou a despesa é obrigatório"
        }

        // Validar nome do usuário que criou a entrada
        require(params.createdByUserName.isNotBlank()) {
            "Nome do usuário que registrou a despesa é obrigatório"
        }

        // Criar entrada de despesa no caixa
        val cashboxEntry = CashboxEntry(
            id = "", // Será preenchido pelo repositório
            type = CashboxEntryType.EXPENSE.name,
            category = params.category.name,
            customCategory = if (params.category == CashboxCategory.OTHER) params.customCategory else null,
            amount = params.amount,
            description = params.description,
            createdById = params.createdByUserId,
            createdByName = params.createdByUserName,
            referenceDate = Clock.System.now(),
            createdAt = Clock.System.now(),
            playerId = null, // Despesas gerais não são atribuídas a jogador
            playerName = null,
            gameId = params.gameId,
            receiptUrl = params.receiptUrl,
            status = "ACTIVE"
        )

        // Adicionar entrada de despesa ao caixa
        val result = cashboxRepository.addEntry(
            groupId = params.groupId,
            entry = cashboxEntry,
            receiptFilePath = params.receiptFilePath
        )

        return result.getOrThrow()
    }
}

/**
 * Parâmetros para registrar uma despesa
 *
 * @property groupId ID do grupo
 * @property category Categoria da despesa (FIELD_RENTAL, EQUIPMENT, CELEBRATION, REFUND, OTHER)
 * @property customCategory Nome customizado da categoria (apenas se category = OTHER)
 * @property amount Valor da despesa
 * @property description Descrição detalhada da despesa
 * @property gameId ID do jogo relacionado (opcional)
 * @property receiptUrl URL do comprovante já enviado (opcional)
 * @property receiptFilePath Caminho do comprovante a ser enviado (opcional)
 * @property createdByUserId ID do usuário que registrou a despesa
 * @property createdByUserName Nome do usuário que registrou a despesa
 */
data class RecordExpenseParams(
    val groupId: String,
    val category: CashboxCategory,
    val amount: Double,
    val description: String,
    val customCategory: String? = null,
    val gameId: String? = null,
    val receiptUrl: String? = null,
    val receiptFilePath: String? = null,
    val createdByUserId: String,
    val createdByUserName: String
)
