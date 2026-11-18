package com.futebadosparcas.permissions

import com.futebadosparcas.domain.model.CashboxCategory
import com.futebadosparcas.domain.model.CashboxEntry
import com.futebadosparcas.domain.model.CashboxSummary
import com.futebadosparcas.domain.repository.CashboxRepository
import com.futebadosparcas.domain.usecase.cashbox.GetCashboxSummaryParams
import com.futebadosparcas.domain.usecase.cashbox.GetCashboxSummaryUseCase
import com.futebadosparcas.domain.usecase.cashbox.RecordExpenseParams
import com.futebadosparcas.domain.usecase.cashbox.RecordExpenseUseCase
import com.futebadosparcas.domain.usecase.cashbox.RecordPaymentParams
import com.futebadosparcas.domain.usecase.cashbox.RecordPaymentUseCase
import com.futebadosparcas.util.MockLogExtension
import com.futebadosparcas.util.ValidationHelper
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

/**
 * Caixa do grupo (`cashbox`): lançamentos de receita e despesa, validações de valor e
 * categoria, descrição padrão sem nome do jogador e saldo.
 *
 * Os casos de papel (ADMIN/dono pode lançar, membro comum e visitante não) são
 * decididos no servidor (rules/Cloud Functions). Aqui, quando o repositório nega,
 * o caso de uso deve propagar a negativa sem mascarar o erro.
 */
@ExtendWith(MockLogExtension::class)
class CashboxPermissionsTest {

    private lateinit var cashboxRepository: CashboxRepository

    @BeforeEach
    fun setUp() {
        cashboxRepository = mockk()
    }

    private fun pagamento(
        amount: Double = 20.0,
        category: CashboxCategory = CashboxCategory.MONTHLY_FEE,
        description: String = ""
    ) = RecordPaymentParams(
        groupId = "group-1",
        playerId = "player-1",
        playerName = "Jogador Teste",
        amount = amount,
        category = category,
        description = description,
        createdByUserId = "owner-1",
        createdByUserName = "Dono"
    )

    // ---------- Receita (pagamento) ----------

    @Test
    fun recordPayment_dadosValidos_gravaEntradaDoTipoIncomeAtiva() = runTest {
        val entrada = slot<CashboxEntry>()
        coEvery {
            cashboxRepository.addEntry("group-1", capture(entrada), any())
        } returns Result.success("entry-1")

        val id = RecordPaymentUseCase(cashboxRepository, ValidationHelper)(pagamento()).getOrThrow()

        assertEquals("entry-1", id)
        assertEquals("INCOME", entrada.captured.type)
        assertEquals("ACTIVE", entrada.captured.status)
        assertEquals("owner-1", entrada.captured.createdById)
        assertEquals(20.0, entrada.captured.amount, 0.0)
    }

    @Test
    fun recordPayment_descricaoVazia_usaPadraoSemNomeDoJogador() = runTest {
        val entrada = slot<CashboxEntry>()
        coEvery {
            cashboxRepository.addEntry("group-1", capture(entrada), any())
        } returns Result.success("entry-1")

        RecordPaymentUseCase(cashboxRepository, ValidationHelper)(pagamento(description = ""))

        assertEquals("Pagamento", entrada.captured.description)
        assertFalse(entrada.captured.description.contains("Jogador Teste"))
        assertEquals("Jogador Teste", entrada.captured.playerName)
    }

    @Test
    fun recordPayment_valorZeroOuNegativo_rejeitaSemGravar() = runTest {
        val zero = RecordPaymentUseCase(cashboxRepository, ValidationHelper)(pagamento(amount = 0.0))
        val negativo = RecordPaymentUseCase(cashboxRepository, ValidationHelper)(pagamento(amount = -5.0))

        assertTrue(zero.isFailure)
        assertTrue(negativo.isFailure)
        coVerify(exactly = 0) { cashboxRepository.addEntry(any(), any(), any()) }
    }

    @Test
    fun recordPayment_categoriaDeDespesa_rejeitaNaReceita() = runTest {
        val result = RecordPaymentUseCase(cashboxRepository, ValidationHelper)(
            pagamento(category = CashboxCategory.FIELD_RENTAL)
        )

        assertTrue(result.isFailure)
        coVerify(exactly = 0) { cashboxRepository.addEntry(any(), any(), any()) }
    }

    @Test
    fun recordPayment_repositorioNegaPorPapel_propagaNegativa() = runTest {
        // Membro comum ou visitante: o servidor recusa e o erro chega inalterado ao chamador.
        coEvery {
            cashboxRepository.addEntry(any(), any(), any())
        } returns Result.failure(Exception("PERMISSION_DENIED"))

        val result = RecordPaymentUseCase(cashboxRepository, ValidationHelper)(pagamento())

        assertEquals("PERMISSION_DENIED", result.exceptionOrNull()?.message)
    }

    // ---------- Despesa ----------

    @Test
    fun recordExpense_categoriaDeReceita_rejeita() = runTest {
        val result = RecordExpenseUseCase(cashboxRepository, ValidationHelper)(
            RecordExpenseParams(
                groupId = "group-1",
                category = CashboxCategory.MONTHLY_FEE,
                amount = 50.0,
                description = "Bola nova",
                createdByUserId = "owner-1",
                createdByUserName = "Dono"
            )
        )

        assertTrue(result.isFailure)
        coVerify(exactly = 0) { cashboxRepository.addEntry(any(), any(), any()) }
    }

    @Test
    fun recordExpense_descricaoEmBranco_rejeita() = runTest {
        val result = RecordExpenseUseCase(cashboxRepository, ValidationHelper)(
            RecordExpenseParams(
                groupId = "group-1",
                category = CashboxCategory.EQUIPMENT,
                amount = 50.0,
                description = "   ",
                createdByUserId = "owner-1",
                createdByUserName = "Dono"
            )
        )

        assertTrue(result.isFailure)
        coVerify(exactly = 0) { cashboxRepository.addEntry(any(), any(), any()) }
    }

    // ---------- Saldo ----------

}
