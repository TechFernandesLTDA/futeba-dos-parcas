package com.futebadosparcas.domain.usecase.cashbox

import com.futebadosparcas.domain.model.CashboxCategory
import com.futebadosparcas.domain.model.CashboxEntry
import com.futebadosparcas.domain.repository.CashboxRepository
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
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource

@DisplayName("RecordPaymentUseCase Tests")
@ExtendWith(MockLogExtension::class)
class RecordPaymentUseCaseTest {

    private lateinit var cashboxRepository: CashboxRepository
    private lateinit var useCase: RecordPaymentUseCase
    private val entrySlot = slot<CashboxEntry>()

    @BeforeEach
    fun setup() {
        cashboxRepository = mockk()
        coEvery {
            cashboxRepository.addEntry(any(), capture(entrySlot), any())
        } returns Result.success("entry-1")
        useCase = RecordPaymentUseCase(cashboxRepository, ValidationHelper)
    }

    private fun params(description: String = "") = RecordPaymentParams(
        groupId = "group-1",
        playerId = "player-1",
        playerName = "Fulano da Silva",
        amount = 30.0,
        category = CashboxCategory.SINGLE_PAYMENT,
        description = description,
        createdByUserId = "owner-1",
        createdByUserName = "Dono do Grupo"
    )

    @ParameterizedTest(name = "descrição \"{0}\"")
    @ValueSource(strings = ["", "   "])
    @DisplayName("#4113: descrição em branco usa o padrão neutro, sem o nome do jogador")
    fun blankDescription_usesNeutralDefaultWithoutPlayerName(description: String) = runTest {
        val result = useCase(params(description = description))

        assertTrue(result.isSuccess)
        val entry = entrySlot.captured
        assertEquals(RecordPaymentUseCase.DEFAULT_PAYMENT_DESCRIPTION, entry.description)
        assertEquals("Pagamento", entry.description)
        assertFalse(entry.description.contains("Fulano"))
        // O nome continua indo no campo estruturado (anonimizado no cleanup LGPD).
        assertEquals("player-1", entry.playerId)
        assertEquals("Fulano da Silva", entry.playerName)
    }

    @Test
    @DisplayName("Descrição informada é gravada como veio")
    fun providedDescription_isKept() = runTest {
        val result = useCase(params(description = "Mensalidade - Janeiro 2026"))

        assertTrue(result.isSuccess)
        assertEquals("entry-1", result.getOrNull())
        assertEquals("Mensalidade - Janeiro 2026", entrySlot.captured.description)
        coVerify(exactly = 1) { cashboxRepository.addEntry("group-1", any(), null) }
    }
}
