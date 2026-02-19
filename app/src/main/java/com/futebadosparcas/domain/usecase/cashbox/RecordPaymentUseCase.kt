package com.futebadosparcas.domain.usecase.cashbox

import com.futebadosparcas.domain.model.CashboxCategory
import com.futebadosparcas.domain.model.CashboxEntry
import com.futebadosparcas.domain.model.CashboxEntryType
import com.futebadosparcas.domain.repository.CashboxRepository
import com.futebadosparcas.domain.usecase.SuspendUseCase
import com.futebadosparcas.util.ValidationHelper
import kotlinx.datetime.Clock

/**
 * Record Payment Use Case
 *
 * Records a player payment for a game or periodic fee, adding it to the group's cashbox.
 *
 * Business logic:
 * - Validates player ID and amount
 * - Creates a CashboxEntry with INCOME type
 * - Categorizes payment as MONTHLY_FEE, WEEKLY_FEE, or SINGLE_PAYMENT
 * - Updates the group's financial summary
 * - Returns the entry ID
 *
 * Usage:
 * ```kotlin
 * val result = recordPaymentUseCase(RecordPaymentParams(
 *     groupId = "group123",
 *     playerId = "user456",
 *     playerName = "João Silva",
 *     amount = 50.00,
 *     category = CashboxCategory.MONTHLY_FEE,
 *     description = "Mensalidade - Janeiro 2025",
 *     gameId = "game789"
 * ))
 *
 * result.fold(
 *     onSuccess = { entryId ->
 *         println("Pagamento registrado: $entryId")
 *     },
 *     onFailure = { error ->
 *         println("Erro ao registrar: ${error.message}")
 *     }
 * )
 * ```
 */
class RecordPaymentUseCase constructor(
    private val cashboxRepository: CashboxRepository,
    private val validationHelper: ValidationHelper
) : SuspendUseCase<RecordPaymentParams, String>() {

    override suspend fun execute(params: RecordPaymentParams): String {
        // Validar ID do grupo
        require(params.groupId.isNotBlank()) {
            "ID do grupo é obrigatório"
        }

        // Validar ID do jogador
        require(params.playerId.isNotBlank()) {
            "ID do jogador é obrigatório"
        }

        // Validar nome do jogador
        require(params.playerName.isNotBlank()) {
            "Nome do jogador é obrigatório"
        }

        // Validar valor do pagamento
        require(params.amount > 0) {
            "Valor do pagamento deve ser maior que zero"
        }

        // Validar que a categoria é de entrada (receita)
        require(params.category.type == CashboxEntryType.INCOME) {
            "A categoria deve ser do tipo INCOME (receita)"
        }

        // Criar entrada no caixa
        val cashboxEntry = CashboxEntry(
            id = "", // Será preenchido pelo repositório
            type = CashboxEntryType.INCOME.name,
            category = params.category.name,
            customCategory = null,
            amount = params.amount,
            description = params.description.ifBlank { "Pagamento de ${params.playerName}" },
            createdById = params.createdByUserId,
            createdByName = params.createdByUserName,
            referenceDate = Clock.System.now(),
            createdAt = Clock.System.now(),
            playerId = params.playerId,
            playerName = params.playerName,
            gameId = params.gameId,
            receiptUrl = params.receiptUrl,
            status = "ACTIVE"
        )

        // Adicionar entrada ao caixa
        val result = cashboxRepository.addEntry(
            groupId = params.groupId,
            entry = cashboxEntry,
            receiptFilePath = params.receiptFilePath
        )

        return result.getOrThrow()
    }
}

/**
 * Parâmetros para registrar um pagamento
 *
 * @property groupId ID do grupo
 * @property playerId ID do jogador que fez o pagamento
 * @property playerName Nome do jogador para exibição
 * @property amount Valor do pagamento
 * @property category Categoria do pagamento (MONTHLY_FEE, WEEKLY_FEE, SINGLE_PAYMENT)
 * @property description Descrição do pagamento (opcional)
 * @property gameId ID do jogo relacionado (opcional)
 * @property receiptUrl URL do comprovante já enviado (opcional)
 * @property receiptFilePath Caminho do comprovante a ser enviado (opcional)
 * @property createdByUserId ID do usuário que registrou o pagamento
 * @property createdByUserName Nome do usuário que registrou o pagamento
 */
data class RecordPaymentParams(
    val groupId: String,
    val playerId: String,
    val playerName: String,
    val amount: Double,
    val category: CashboxCategory,
    val description: String = "",
    val gameId: String? = null,
    val receiptUrl: String? = null,
    val receiptFilePath: String? = null,
    val createdByUserId: String,
    val createdByUserName: String
)
