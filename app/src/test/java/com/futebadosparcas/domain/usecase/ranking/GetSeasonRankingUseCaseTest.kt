package com.futebadosparcas.domain.usecase.ranking

import com.futebadosparcas.domain.model.Season
import com.futebadosparcas.domain.model.SeasonParticipation
import com.futebadosparcas.domain.repository.GamificationRepository
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource

@DisplayName("GetSeasonRankingUseCase Tests")
@ExtendWith(MockLogExtension::class)
class GetSeasonRankingUseCaseTest {

    private lateinit var gamificationRepository: GamificationRepository
    private lateinit var useCase: GetSeasonRankingUseCase

    private val activeSeason = Season(id = "season-1", name = "Temporada 2026", isActive = true)

    @BeforeEach
    fun setup() {
        gamificationRepository = mockk(relaxed = true)
        useCase = GetSeasonRankingUseCase(gamificationRepository)
    }

    @Nested
    @DisplayName("execute")
    inner class ExecuteTests {

        @Test
        @DisplayName("Retorna ranking da temporada ativa com sucesso")
        fun `returns active season ranking successfully`() = runTest {
            val participations = listOf(
                SeasonParticipation(id = "p1", seasonId = "season-1", userId = "user-1", points = 100),
                SeasonParticipation(id = "p2", seasonId = "season-1", userId = "user-2", points = 80),
                SeasonParticipation(id = "p3", seasonId = "season-1", userId = "user-3", points = 60)
            )
            coEvery { gamificationRepository.getActiveSeason() } returns Result.success(activeSeason)
            coEvery { gamificationRepository.getSeasonRanking("season-1", 50) } returns Result.success(participations)

            val result = useCase(GetSeasonRankingParams(limit = 50))

            assertTrue(result.isSuccess)
            val ranking = result.getOrNull()
            assertEquals(3, ranking?.size)
            assertEquals(100, ranking?.get(0)?.points)
        }

        @Test
        @DisplayName("Sem temporada ativa retorna falha")
        fun `no active season returns failure`() = runTest {
            coEvery { gamificationRepository.getActiveSeason() } returns Result.success(null)

            val result = useCase(GetSeasonRankingParams())

            assertTrue(result.isFailure)
            assertTrue(result.exceptionOrNull()?.message?.contains("Nenhuma temporada ativa") == true)
        }

        @Test
        @DisplayName("Erro ao buscar temporada ativa propaga falha")
        fun `active season fetch error propagates`() = runTest {
            coEvery { gamificationRepository.getActiveSeason() } returns Result.failure(RuntimeException("Erro de conexao"))

            val result = useCase(GetSeasonRankingParams())

            assertTrue(result.isFailure)
        }

        @Test
        @DisplayName("Ranking vazio retorna lista vazia")
        fun `empty ranking returns empty list`() = runTest {
            coEvery { gamificationRepository.getActiveSeason() } returns Result.success(activeSeason)
            coEvery { gamificationRepository.getSeasonRanking("season-1", 50) } returns Result.success(emptyList())

            val result = useCase(GetSeasonRankingParams())

            assertTrue(result.isSuccess)
            assertTrue(result.getOrNull()?.isEmpty() == true)
        }

        @ParameterizedTest
        @CsvSource("0", "-1", "1001", "2000")
        @DisplayName("Limite invalido eh ajustado para valores permitidos")
        fun `invalid limit is clamped to allowed range`(limit: Int) = runTest {
            coEvery { gamificationRepository.getActiveSeason() } returns Result.success(activeSeason)
            coEvery { gamificationRepository.getSeasonRanking(any(), any()) } returns Result.success(emptyList())

            val result = useCase(GetSeasonRankingParams(limit = limit))

            assertTrue(result.isSuccess)
        }

        @Test
        @DisplayName("Erro ao buscar ranking propaga falha")
        fun `ranking fetch error propagates failure`() = runTest {
            coEvery { gamificationRepository.getActiveSeason() } returns Result.success(activeSeason)
            coEvery { gamificationRepository.getSeasonRanking("season-1", 50) } returns Result.failure(RuntimeException("Erro ao buscar ranking"))

            val result = useCase(GetSeasonRankingParams())

            assertTrue(result.isFailure)
        }
    }
}
