package com.futebadosparcas.domain.usecase

import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.data.model.Team
import com.futebadosparcas.domain.ai.AiTeamBalancer
import com.futebadosparcas.domain.usecase.game.CalculateTeamBalanceUseCase
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.DisplayName

/**
 * Testes unitários para CalculateTeamBalanceUseCase.
 * Verifica validações e integração com TeamBalancer.
 */
@DisplayName("CalculateTeamBalanceUseCase Tests")
class CalculateTeamBalanceUseCaseTest {

    private lateinit var teamBalancer: AiTeamBalancer
    private lateinit var useCase: CalculateTeamBalanceUseCase

    @BeforeEach
    fun setup() {
        teamBalancer = mockk()
        useCase = CalculateTeamBalanceUseCase(teamBalancer)
    }

    @Test
    @DisplayName("Deve calcular balanceamento de 2 times com sucesso")
    fun `invoke should balance teams successfully for 2 teams`() = runTest {
        // Given - Dado 10 jogadores confirmados
        val gameId = "game123"
        val players = createPlayerList(10)
        val expectedTeams = listOf(
            Team(gameId = gameId, name = "Time 1", playerIds = players.take(5).map { it.userId }),
            Team(gameId = gameId, name = "Time 2", playerIds = players.drop(5).map { it.userId })
        )
        coEvery {
            teamBalancer.balanceTeams(gameId, players, 2)
        } returns Result.success(expectedTeams)

        // When - Quando calcular balanceamento
        val result = useCase(gameId, players, 2)

        // Then - Então deve retornar times balanceados
        assertTrue(result.isSuccess)
        val teams = result.getOrNull()!!
        assertEquals(2, teams.size)
        assertEquals(5, teams[0].playerIds.size)
        assertEquals(5, teams[1].playerIds.size)
        coVerify(exactly = 1) { teamBalancer.balanceTeams(gameId, players, 2) }
    }

    @Test
    @DisplayName("Deve calcular balanceamento de 3 times com sucesso")
    fun `invoke should balance teams successfully for 3 teams`() = runTest {
        // Given - Dado 12 jogadores e 3 times
        val gameId = "game456"
        val players = createPlayerList(12)
        val expectedTeams = listOf(
            Team(gameId = gameId, name = "Time 1", playerIds = players.take(4).map { it.userId }),
            Team(gameId = gameId, name = "Time 2", playerIds = players.drop(4).take(4).map { it.userId }),
            Team(gameId = gameId, name = "Time 3", playerIds = players.drop(8).map { it.userId })
        )
        coEvery {
            teamBalancer.balanceTeams(gameId, players, 3)
        } returns Result.success(expectedTeams)

        // When - Quando calcular balanceamento para 3 times
        val result = useCase(gameId, players, 3)

        // Then - Então deve retornar 3 times balanceados
        assertTrue(result.isSuccess)
        val teams = result.getOrNull()!!
        assertEquals(3, teams.size)
        coVerify(exactly = 1) { teamBalancer.balanceTeams(gameId, players, 3) }
    }

    @Test
    @DisplayName("Deve usar valor padrão de 2 times")
    fun `invoke should use default value of 2 teams`() = runTest {
        // Given - Dado jogadores sem especificar número de times
        val gameId = "game789"
        val players = createPlayerList(8)
        val expectedTeams = listOf(
            Team(gameId = gameId, name = "Time 1", playerIds = emptyList()),
            Team(gameId = gameId, name = "Time 2", playerIds = emptyList())
        )
        coEvery {
            teamBalancer.balanceTeams(gameId, players, 2)
        } returns Result.success(expectedTeams)

        // When - Quando calcular sem especificar número de times
        val result = useCase(gameId, players)

        // Then - Então deve usar 2 times como padrão
        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { teamBalancer.balanceTeams(gameId, players, 2) }
    }

    @Test
    @DisplayName("Deve falhar quando gameId está vazio")
    fun `invoke should fail when gameId is empty`() = runTest {
        // Given - Dado gameId vazio
        val players = createPlayerList(10)

        // When - Quando tentar calcular com gameId vazio
        val result = useCase("", players, 2)

        // Then - Então deve retornar erro
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is IllegalArgumentException)
        assertEquals("ID do jogo não pode estar vazio", result.exceptionOrNull()?.message)
        coVerify(exactly = 0) { teamBalancer.balanceTeams(any(), any(), any()) }
    }

    @Test
    @DisplayName("Deve falhar quando lista de jogadores está vazia")
    fun `invoke should fail when players list is empty`() = runTest {
        // Given - Dado lista vazia de jogadores
        val gameId = "game123"

        // When - Quando tentar calcular com lista vazia
        val result = useCase(gameId, emptyList(), 2)

        // Then - Então deve retornar erro
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is IllegalArgumentException)
        assertEquals("Lista de jogadores não pode estar vazia", result.exceptionOrNull()?.message)
        coVerify(exactly = 0) { teamBalancer.balanceTeams(any(), any(), any()) }
    }

    @Test
    @DisplayName("Deve falhar quando número de times é menor que 2")
    fun `invoke should fail when numberOfTeams is less than 2`() = runTest {
        // Given - Dado número de times menor que 2
        val gameId = "game123"
        val players = createPlayerList(10)

        // When - Quando tentar calcular com 1 time
        val result = useCase(gameId, players, 1)

        // Then - Então deve retornar erro
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is IllegalArgumentException)
        assertEquals("Número de times deve ser no mínimo 2", result.exceptionOrNull()?.message)
        coVerify(exactly = 0) { teamBalancer.balanceTeams(any(), any(), any()) }
    }

    @Test
    @DisplayName("Deve falhar quando número de times é maior que número de jogadores")
    fun `invoke should fail when numberOfTeams is greater than players count`() = runTest {
        // Given - Dado número de times maior que jogadores
        val gameId = "game123"
        val players = createPlayerList(5)

        // When - Quando tentar criar 6 times com 5 jogadores
        val result = useCase(gameId, players, 6)

        // Then - Então deve retornar erro
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull() is IllegalArgumentException)
        assertTrue(result.exceptionOrNull()?.message?.contains("não pode ser maior que número de jogadores") == true)
        coVerify(exactly = 0) { teamBalancer.balanceTeams(any(), any(), any()) }
    }

    @Test
    @DisplayName("Deve propagar erro do TeamBalancer")
    fun `invoke should propagate TeamBalancer error`() = runTest {
        // Given - Dado que o TeamBalancer retorna erro
        val gameId = "game123"
        val players = createPlayerList(10)
        val exception = Exception("Erro ao calcular balanceamento")
        coEvery {
            teamBalancer.balanceTeams(gameId, players, 2)
        } returns Result.failure(exception)

        // When - Quando tentar calcular balanceamento
        val result = useCase(gameId, players, 2)

        // Then - Então deve propagar o erro
        assertTrue(result.isFailure)
        assertEquals("Erro ao calcular balanceamento", result.exceptionOrNull()?.message)
        coVerify(exactly = 1) { teamBalancer.balanceTeams(gameId, players, 2) }
    }

    @Test
    @DisplayName("Deve validar caso limite com exatamente 2 jogadores e 2 times")
    fun `invoke should handle edge case with exactly 2 players and 2 teams`() = runTest {
        // Given - Dado 2 jogadores e 2 times (caso mínimo)
        val gameId = "game999"
        val players = createPlayerList(2)
        val expectedTeams = listOf(
            Team(gameId = gameId, name = "Time 1", playerIds = listOf(players[0].userId)),
            Team(gameId = gameId, name = "Time 2", playerIds = listOf(players[1].userId))
        )
        coEvery {
            teamBalancer.balanceTeams(gameId, players, 2)
        } returns Result.success(expectedTeams)

        // When - Quando calcular com caso mínimo
        val result = useCase(gameId, players, 2)

        // Then - Então deve funcionar corretamente
        assertTrue(result.isSuccess)
        assertEquals(2, result.getOrNull()?.size)
        coVerify(exactly = 1) { teamBalancer.balanceTeams(gameId, players, 2) }
    }

    @Test
    @DisplayName("Deve lidar com jogadores com posições diferentes")
    fun `invoke should handle players with different positions`() = runTest {
        // Given - Dado jogadores com posições FIELD e GOALKEEPER
        val gameId = "game888"
        val players = listOf(
            createPlayer("user1", "FIELD"),
            createPlayer("user2", "FIELD"),
            createPlayer("user3", "GOALKEEPER"),
            createPlayer("user4", "FIELD"),
            createPlayer("user5", "GOALKEEPER")
        )
        val expectedTeams = listOf(
            Team(gameId = gameId, name = "Time 1", playerIds = listOf("user1", "user3", "user4")),
            Team(gameId = gameId, name = "Time 2", playerIds = listOf("user2", "user5"))
        )
        coEvery {
            teamBalancer.balanceTeams(gameId, players, 2)
        } returns Result.success(expectedTeams)

        // When - Quando calcular balanceamento
        val result = useCase(gameId, players, 2)

        // Then - Então deve balancear considerando posições
        assertTrue(result.isSuccess)
        coVerify(exactly = 1) { teamBalancer.balanceTeams(gameId, players, 2) }
    }

    // Helper functions para criar dados de teste
    private fun createPlayerList(count: Int): List<GameConfirmation> {
        return (1..count).map { i ->
            createPlayer("user$i", if (i % 5 == 0) "GOALKEEPER" else "FIELD")
        }
    }

    private fun createPlayer(userId: String, position: String) = GameConfirmation(
        gameId = "",
        userId = userId,
        userName = "Player $userId",
        userPhoto = "",
        position = position,
        isCasualPlayer = false,
        confirmedAt = java.util.Date()
    )
}
