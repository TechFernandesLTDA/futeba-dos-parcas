package com.futebadosparcas.domain.usecase

import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.domain.usecase.game.ConfirmPresenceUseCase
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource

/**
 * Testes unitários para ConfirmPresenceUseCase.
 * Verifica validações de parâmetros e integração com o repositório.
 */
@DisplayName("ConfirmPresenceUseCase Tests")
class ConfirmPresenceUseCaseTest {

    private lateinit var gameRepository: GameRepository
    private lateinit var useCase: ConfirmPresenceUseCase

    @BeforeEach
    fun setup() {
        gameRepository = mockk()
        useCase = ConfirmPresenceUseCase(gameRepository)
    }

    @Test
    @DisplayName("Deve confirmar presença com sucesso usando FIELD")
    fun `invoke should confirm presence as field player successfully`() = runTest {
        // Given - Dado um jogo válido e confirmação bem-sucedida
        val gameId = "game123"
        val expectedConfirmation = createGameConfirmation(gameId, "user123", "FIELD")
        coEvery {
            gameRepository.confirmPresence(gameId, "FIELD", false)
        } returns Result.success(expectedConfirmation)

        // When - Quando confirmar presença
        val result = useCase(gameId, "FIELD", false)

        // Then - Então deve retornar a confirmação com sucesso
        assertTrue(result.isSuccess)
        val confirmation = result.getOrNull()!!
        assertEquals(gameId, confirmation.gameId)
        assertEquals("FIELD", confirmation.position)
        assertEquals(false, confirmation.isCasual)
        coVerify(exactly = 1) { gameRepository.confirmPresence(gameId, "FIELD", false) }
    }

    @Test
    @DisplayName("Deve confirmar presença com sucesso usando GOALKEEPER")
    fun `invoke should confirm presence as goalkeeper successfully`() = runTest {
        // Given - Dado um jogo válido e posição de goleiro
        val gameId = "game456"
        val expectedConfirmation = createGameConfirmation(gameId, "user456", "GOALKEEPER")
        coEvery {
            gameRepository.confirmPresence(gameId, "GOALKEEPER", false)
        } returns Result.success(expectedConfirmation)

        // When - Quando confirmar presença como goleiro
        val result = useCase(gameId, "GOALKEEPER", false)

        // Then - Então deve retornar a confirmação com sucesso
        assertTrue(result.isSuccess)
        val confirmation = result.getOrNull()!!
        assertEquals("GOALKEEPER", confirmation.position)
        coVerify(exactly = 1) { gameRepository.confirmPresence(gameId, "GOALKEEPER", false) }
    }

    @Test
    @DisplayName("Deve confirmar presença como casual")
    fun `invoke should confirm presence as casual player`() = runTest {
        // Given - Dado um jogador casual
        val gameId = "game789"
        val expectedConfirmation = createGameConfirmation(gameId, "user789", "FIELD", isCasual = true)
        coEvery {
            gameRepository.confirmPresence(gameId, "FIELD", true)
        } returns Result.success(expectedConfirmation)

        // When - Quando confirmar presença como casual
        val result = useCase(gameId, "FIELD", true)

        // Then - Então deve marcar como casual
        assertTrue(result.isSuccess)
        assertEquals(true, result.getOrNull()?.isCasual)
        coVerify(exactly = 1) { gameRepository.confirmPresence(gameId, "FIELD", true) }
    }

    @Test
    @DisplayName("Deve falhar quando gameId está vazio")
    fun `invoke should fail when gameId is empty`() = runTest {
        // When - Quando tentar confirmar com gameId vazio
        val result = useCase("", "FIELD", false)

        // Then - Então deve retornar erro
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is IllegalArgumentException)
        assertEquals("ID do jogo não pode estar vazio", result.exceptionOrNull()?.message)
        coVerify(exactly = 0) { gameRepository.confirmPresence(any(), any(), any()) }
    }

    @Test
    @DisplayName("Deve falhar quando gameId está em branco")
    fun `invoke should fail when gameId is blank`() = runTest {
        // When - Quando tentar confirmar com gameId em branco
        val result = useCase("   ", "FIELD", false)

        // Then - Então deve retornar erro
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is IllegalArgumentException)
        assertEquals("ID do jogo não pode estar vazio", result.exceptionOrNull()?.message)
    }

    @ParameterizedTest
    @ValueSource(strings = ["", "  "])
    @DisplayName("Deve falhar quando posição está vazia ou em branco")
    fun `invoke should fail when position is empty or blank`(position: String) = runTest {
        // When - Quando tentar confirmar com posição vazia/branco
        val result = useCase("game123", position, false)

        // Then - Então deve retornar erro
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is IllegalArgumentException)
        assertEquals("Posição não pode estar vazia", result.exceptionOrNull()?.message)
        coVerify(exactly = 0) { gameRepository.confirmPresence(any(), any(), any()) }
    }

    @ParameterizedTest
    @ValueSource(strings = ["INVALID", "field", "goalkeeper", "ATACANTE", "DEFESA"])
    @DisplayName("Deve falhar quando posição é inválida")
    fun `invoke should fail when position is invalid`(invalidPosition: String) = runTest {
        // When - Quando tentar confirmar com posição inválida
        val result = useCase("game123", invalidPosition, false)

        // Then - Então deve retornar erro
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is IllegalArgumentException)
        assertEquals(
            "Posição inválida. Use FIELD ou GOALKEEPER",
            result.exceptionOrNull()?.message
        )
        coVerify(exactly = 0) { gameRepository.confirmPresence(any(), any(), any()) }
    }

    @Test
    @DisplayName("Deve propagar erro do repositório")
    fun `invoke should propagate repository error`() = runTest {
        // Given - Dado que o repositório retorna erro
        val gameId = "game123"
        val exception = Exception("Jogo não encontrado")
        coEvery {
            gameRepository.confirmPresence(gameId, "FIELD", false)
        } returns Result.failure(exception)

        // When - Quando tentar confirmar presença
        val result = useCase(gameId, "FIELD", false)

        // Then - Então deve retornar o erro do repositório
        assertTrue(result.isFailure)
        assertEquals("Jogo não encontrado", result.exceptionOrNull()?.message)
        coVerify(exactly = 1) { gameRepository.confirmPresence(gameId, "FIELD", false) }
    }

    @Test
    @DisplayName("Deve usar valores padrão corretamente")
    fun `invoke should use default parameters correctly`() = runTest {
        // Given - Dado apenas o gameId
        val gameId = "game999"
        val expectedConfirmation = createGameConfirmation(gameId, "user999", "FIELD")
        coEvery {
            gameRepository.confirmPresence(gameId, "FIELD", false)
        } returns Result.success(expectedConfirmation)

        // When - Quando confirmar com valores padrão
        val result = useCase(gameId)

        // Then - Então deve usar FIELD e isCasual=false como padrão
        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { gameRepository.confirmPresence(gameId, "FIELD", false) }
    }

    // Helper function para criar confirmações de teste
    private fun createGameConfirmation(
        gameId: String,
        userId: String,
        position: String,
        isCasual: Boolean = false
    ) = GameConfirmation(
        gameId = gameId,
        userId = userId,
        userName = "Test User",
        userPhotoUrl = "",
        position = position,
        isCasual = isCasual,
        confirmedAt = System.currentTimeMillis(),
        isPaid = false
    )
}
