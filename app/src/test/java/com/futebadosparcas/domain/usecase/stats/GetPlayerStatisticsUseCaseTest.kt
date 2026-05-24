package com.futebadosparcas.domain.usecase.stats

import com.futebadosparcas.domain.model.Statistics
import com.futebadosparcas.domain.repository.StatisticsRepository
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNotNull
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

@DisplayName("GetPlayerStatisticsUseCase Tests")
@ExtendWith(MockLogExtension::class)
class GetPlayerStatisticsUseCaseTest {

    private lateinit var statisticsRepository: StatisticsRepository
    private lateinit var useCase: GetPlayerStatisticsUseCase

    @BeforeEach
    fun setup() {
        statisticsRepository = mockk(relaxed = true)
        useCase = GetPlayerStatisticsUseCase(statisticsRepository)
    }

    @Nested
    @DisplayName("execute")
    inner class ExecuteTests {

        @Test
        @DisplayName("Busca estatisticas do jogador com sucesso")
        fun `returns player statistics successfully`() = runTest {
            val stats = Statistics(
                id = "stats-1", userId = "user-1",
                totalGames = 20, totalGoals = 15, totalAssists = 10,
                totalWins = 12
            )
            coEvery { statisticsRepository.getUserStatistics("user-1") } returns Result.success(stats)

            val result = useCase(GetPlayerStatisticsParams("user-1"))

            assertTrue(result.isSuccess)
            val playerStats = result.getOrNull()
            assertNotNull(playerStats)
            assertEquals(20, playerStats?.totalGames)
            assertEquals(15, playerStats?.totalGoals)
        }

        @Test
        @DisplayName("UserId vazio retorna falha")
        fun `empty userId returns failure`() = runTest {
            val result = useCase(GetPlayerStatisticsParams(""))

            assertTrue(result.isFailure)
        }

        @Test
        @DisplayName("Erro do repositorio propaga falha")
        fun `repository error propagates failure`() = runTest {
            coEvery { statisticsRepository.getUserStatistics("user-1") } returns Result.failure(RuntimeException("Erro ao buscar"))

            val result = useCase(GetPlayerStatisticsParams("user-1"))

            assertTrue(result.isFailure)
            assertEquals("Erro ao buscar", result.exceptionOrNull()?.message)
        }

        @Test
        @DisplayName("Jogador sem estatisticas retorna Statistics com valores default")
        fun `player without stats returns default Statistics`() = runTest {
            val emptyStats = Statistics()
            coEvery { statisticsRepository.getUserStatistics("user-1") } returns Result.success(emptyStats)

            val result = useCase(GetPlayerStatisticsParams("user-1"))

            assertTrue(result.isSuccess)
            val stats = result.getOrNull()
            assertEquals(0, stats?.totalGames)
            assertEquals(0, stats?.totalGoals)
        }

        @Test
        @DisplayName("Calcula win rate corretamente")
        fun `calculates win rate correctly`() = runTest {
            val stats = Statistics(id = "stats-1", userId = "user-1", totalGames = 20, totalWins = 15)
            coEvery { statisticsRepository.getUserStatistics("user-1") } returns Result.success(stats)

            val result = useCase(GetPlayerStatisticsParams("user-1"))

            assertTrue(result.isSuccess)
            assertEquals(0.75, result.getOrNull()?.winRate)
        }
    }
}
