package com.futebadosparcas.domain.usecase

import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.GameStatus
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.domain.usecase.game.GetUpcomingGamesUseCase
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.DisplayName

/**
 * Testes unitários para GetUpcomingGamesUseCase.
 * Verifica o comportamento de obtenção de jogos futuros confirmados.
 */
@DisplayName("GetUpcomingGamesUseCase Tests")
class GetUpcomingGamesUseCaseTest {

    private lateinit var gameRepository: GameRepository
    private lateinit var useCase: GetUpcomingGamesUseCase

    @BeforeEach
    fun setup() {
        gameRepository = mockk()
        useCase = GetUpcomingGamesUseCase(gameRepository)
    }

    @Test
    @DisplayName("Deve retornar lista de jogos futuros com sucesso")
    fun `invoke should return upcoming games successfully`() = runTest {
        // Given - Dado um conjunto de jogos futuros
        val expectedGames = listOf(
            createGame("1", "2026-01-10", "20:00", GameStatus.SCHEDULED),
            createGame("2", "2026-01-15", "21:00", GameStatus.SCHEDULED)
        )
        coEvery { gameRepository.getConfirmedUpcomingGamesForUser() } returns Result.success(expectedGames)

        // When - Quando buscar jogos futuros
        val result = useCase()

        // Then - Então deve retornar os jogos com sucesso
        assertTrue(result.isSuccess)
        assertEquals(2, result.getOrNull()?.size)
        assertEquals(expectedGames, result.getOrNull())
        coVerify(exactly = 1) { gameRepository.getConfirmedUpcomingGamesForUser() }
    }

    @Test
    @DisplayName("Deve retornar lista vazia quando não há jogos futuros")
    fun `invoke should return empty list when no upcoming games`() = runTest {
        // Given - Dado que não há jogos futuros
        coEvery { gameRepository.getConfirmedUpcomingGamesForUser() } returns Result.success(emptyList())

        // When - Quando buscar jogos futuros
        val result = useCase()

        // Then - Então deve retornar lista vazia
        assertTrue(result.isSuccess)
        assertTrue(result.getOrNull()?.isEmpty() == true)
        coVerify(exactly = 1) { gameRepository.getConfirmedUpcomingGamesForUser() }
    }

    @Test
    @DisplayName("Deve retornar erro quando o repositório falhar")
    fun `invoke should return failure when repository fails`() = runTest {
        // Given - Dado que o repositório retorna erro
        val exception = Exception("Erro ao buscar jogos")
        coEvery { gameRepository.getConfirmedUpcomingGamesForUser() } returns Result.failure(exception)

        // When - Quando buscar jogos futuros
        val result = useCase()

        // Then - Então deve retornar falha
        assertTrue(result.isFailure)
        assertEquals("Erro ao buscar jogos", result.exceptionOrNull()?.message)
        coVerify(exactly = 1) { gameRepository.getConfirmedUpcomingGamesForUser() }
    }

    @Test
    @DisplayName("Deve retornar jogos ordenados por data")
    fun `invoke should return games in order`() = runTest {
        // Given - Dado jogos em ordem específica
        val games = listOf(
            createGame("1", "2026-01-08", "18:00", GameStatus.SCHEDULED),
            createGame("2", "2026-01-10", "20:00", GameStatus.SCHEDULED),
            createGame("3", "2026-01-12", "19:00", GameStatus.SCHEDULED)
        )
        coEvery { gameRepository.getConfirmedUpcomingGamesForUser() } returns Result.success(games)

        // When - Quando buscar jogos futuros
        val result = useCase()

        // Then - Então deve retornar os jogos na mesma ordem
        assertTrue(result.isSuccess)
        val returnedGames = result.getOrNull()!!
        assertEquals(3, returnedGames.size)
        assertEquals("1", returnedGames[0].id)
        assertEquals("2", returnedGames[1].id)
        assertEquals("3", returnedGames[2].id)
    }

    // Helper function para criar jogos de teste
    private fun createGame(
        id: String,
        date: String,
        time: String,
        status: GameStatus
    ) = Game(
        id = id,
        date = date,
        time = time,
        status = status.name,
        locationName = "Arena Test",
        fieldName = "Quadra 1",
        maxPlayers = 14,
        playersCount = 10,
        ownerId = "user123",
        ownerName = "Test User"
    )
}
