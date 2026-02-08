package com.futebadosparcas.domain.usecase.gamification

import com.futebadosparcas.domain.model.BadgeCategory
import com.futebadosparcas.domain.model.BadgeDefinition
import com.futebadosparcas.domain.model.BadgeRarity
import com.futebadosparcas.domain.model.UserBadge
import com.futebadosparcas.domain.repository.GamificationRepository
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.*
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.extension.ExtendWith

/**
 * Testes unitarios para GetUserBadgesUseCase.
 * Verifica busca de badges, calculo de estatisticas, distribuicao por raridade e categoria.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("GetUserBadgesUseCase Tests")
@ExtendWith(MockLogExtension::class)
class GetUserBadgesUseCaseTest {

    private val testDispatcher = StandardTestDispatcher()

    private lateinit var gamificationRepository: GamificationRepository
    private lateinit var useCase: GetUserBadgesUseCase

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        gamificationRepository = mockk()
        useCase = GetUserBadgesUseCase(gamificationRepository)
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    // ========== Busca com Sucesso ==========

    @Test
    @DisplayName("Deve retornar badges do usuario com estatisticas completas")
    fun invoke_validUser_returnsCompleteResult() = runTest {
        // Given
        val userBadges = listOf(
            UserBadge(id = "ub1", userId = "user1", badgeId = "b1", unlockedAt = 1000L),
            UserBadge(id = "ub2", userId = "user1", badgeId = "b2", unlockedAt = 2000L)
        )
        val allBadges = listOf(
            createBadgeDefinition("b1", "Hat Trick", BadgeCategory.PERFORMANCE, BadgeRarity.RARE),
            createBadgeDefinition("b2", "Streak 7", BadgeCategory.PRESENCE, BadgeRarity.EPIC),
            createBadgeDefinition("b3", "Lenda", BadgeCategory.LEVEL, BadgeRarity.LEGENDARY)
        )
        coEvery { gamificationRepository.getUserBadges("user1") } returns Result.success(userBadges)
        coEvery { gamificationRepository.getAvailableBadges() } returns Result.success(allBadges)

        // When
        val result = useCase(GetUserBadgesParams(userId = "user1"))

        // Then
        assertTrue(result.isSuccess)
        val data = result.getOrNull()!!
        assertEquals("user1", data.userId)
        assertEquals(2, data.totalEarned)
        assertEquals(3, data.totalAvailable)
        assertEquals(2, data.unlockedBadges.size)
        assertEquals(1, data.lockedBadges.size)
        assertEquals("b3", data.lockedBadges[0].id)
    }

    @Test
    @DisplayName("Deve calcular percentual de conclusao corretamente")
    fun invoke_withBadges_calculatesCompletionPercentage() = runTest {
        // Given - 2 de 4 badges conquistadas = 50%
        val userBadges = listOf(
            UserBadge(id = "ub1", userId = "user1", badgeId = "b1"),
            UserBadge(id = "ub2", userId = "user1", badgeId = "b2")
        )
        val allBadges = listOf(
            createBadgeDefinition("b1", "Badge 1"),
            createBadgeDefinition("b2", "Badge 2"),
            createBadgeDefinition("b3", "Badge 3"),
            createBadgeDefinition("b4", "Badge 4")
        )
        coEvery { gamificationRepository.getUserBadges("user1") } returns Result.success(userBadges)
        coEvery { gamificationRepository.getAvailableBadges() } returns Result.success(allBadges)

        // When
        val result = useCase(GetUserBadgesParams("user1"))

        // Then
        val data = result.getOrNull()!!
        assertEquals(50.0, data.completionPercentage, 0.01)
    }

    @Test
    @DisplayName("Deve retornar 0% quando nenhuma badge foi conquistada")
    fun invoke_noBadgesEarned_zeroCompletion() = runTest {
        // Given
        coEvery { gamificationRepository.getUserBadges("user1") } returns Result.success(emptyList())
        coEvery { gamificationRepository.getAvailableBadges() } returns Result.success(
            listOf(createBadgeDefinition("b1", "Badge 1"))
        )

        // When
        val result = useCase(GetUserBadgesParams("user1"))

        // Then
        val data = result.getOrNull()!!
        assertEquals(0.0, data.completionPercentage, 0.01)
        assertEquals(0, data.totalEarned)
        assertEquals(1, data.totalAvailable)
    }

    @Test
    @DisplayName("Deve retornar 0% quando nao ha badges disponiveis")
    fun invoke_noBadgesAvailable_zeroCompletion() = runTest {
        // Given
        coEvery { gamificationRepository.getUserBadges("user1") } returns Result.success(emptyList())
        coEvery { gamificationRepository.getAvailableBadges() } returns Result.success(emptyList())

        // When
        val result = useCase(GetUserBadgesParams("user1"))

        // Then
        val data = result.getOrNull()!!
        assertEquals(0.0, data.completionPercentage, 0.01)
    }

    // ========== Distribuicao por Raridade ==========

    @Test
    @DisplayName("Deve calcular distribuicao por raridade corretamente")
    fun invoke_withMixedRarities_calculatesDistribution() = runTest {
        // Given
        val userBadges = listOf(
            UserBadge(id = "ub1", userId = "user1", badgeId = "b1"),
            UserBadge(id = "ub2", userId = "user1", badgeId = "b2"),
            UserBadge(id = "ub3", userId = "user1", badgeId = "b3")
        )
        val allBadges = listOf(
            createBadgeDefinition("b1", "B1", BadgeCategory.PERFORMANCE, BadgeRarity.COMMON),
            createBadgeDefinition("b2", "B2", BadgeCategory.PERFORMANCE, BadgeRarity.COMMON),
            createBadgeDefinition("b3", "B3", BadgeCategory.LEVEL, BadgeRarity.EPIC)
        )
        coEvery { gamificationRepository.getUserBadges("user1") } returns Result.success(userBadges)
        coEvery { gamificationRepository.getAvailableBadges() } returns Result.success(allBadges)

        // When
        val result = useCase(GetUserBadgesParams("user1"))

        // Then
        val data = result.getOrNull()!!
        assertEquals(2, data.rarityDistribution["Comum"])
        assertEquals(1, data.rarityDistribution["Epico"])
    }

    // ========== Badges Recentes ==========

    @Test
    @DisplayName("Deve retornar ultimas 5 badges como recentes")
    fun invoke_multipleBadges_returnsTop5Recent() = runTest {
        // Given
        val userBadges = (1..8).map {
            UserBadge(id = "ub$it", userId = "user1", badgeId = "b$it", unlockedAt = it * 1000L)
        }
        val allBadges = (1..8).map { createBadgeDefinition("b$it", "Badge $it") }
        coEvery { gamificationRepository.getUserBadges("user1") } returns Result.success(userBadges)
        coEvery { gamificationRepository.getAvailableBadges() } returns Result.success(allBadges)

        // When
        val result = useCase(GetUserBadgesParams("user1"))

        // Then
        val data = result.getOrNull()!!
        assertEquals(5, data.recentBadges.size)
        // Mais recentes primeiro (ordered by unlockedAt desc)
        assertEquals("ub8", data.recentBadges[0].id)
    }

    // ========== Validacao de Parametros ==========

    @Test
    @DisplayName("Deve falhar quando userId esta vazio")
    fun invoke_emptyUserId_fails() = runTest {
        // When
        val result = useCase(GetUserBadgesParams(userId = ""))

        // Then
        assertTrue(result.isFailure)
        assertTrue(result.exceptionOrNull()?.message?.contains("vazio") == true ||
                   result.exceptionOrNull() is IllegalArgumentException)
    }

    @Test
    @DisplayName("Deve falhar quando userId esta em branco")
    fun invoke_blankUserId_fails() = runTest {
        // When
        val result = useCase(GetUserBadgesParams(userId = "   "))

        // Then
        assertTrue(result.isFailure)
    }

    // ========== Erros de Repositorio ==========

    @Test
    @DisplayName("Deve falhar quando getUserBadges retorna erro")
    fun invoke_getUserBadgesFailure_fails() = runTest {
        // Given
        coEvery { gamificationRepository.getUserBadges("user1") } returns
            Result.failure(Exception("Network error"))

        // When
        val result = useCase(GetUserBadgesParams("user1"))

        // Then
        assertTrue(result.isFailure)
    }

    @Test
    @DisplayName("Deve falhar quando getAvailableBadges retorna erro")
    fun invoke_getAvailableBadgesFailure_fails() = runTest {
        // Given
        coEvery { gamificationRepository.getUserBadges("user1") } returns Result.success(emptyList())
        coEvery { gamificationRepository.getAvailableBadges() } returns
            Result.failure(Exception("Firestore error"))

        // When
        val result = useCase(GetUserBadgesParams("user1"))

        // Then
        assertTrue(result.isFailure)
    }

    // ========== Distribuicao por Categoria ==========

    @Test
    @DisplayName("Deve calcular distribuicao por categoria corretamente")
    fun invoke_withMixedCategories_calculatesCategoryDistribution() = runTest {
        // Given
        val userBadges = listOf(
            UserBadge(id = "ub1", userId = "user1", badgeId = "b1"),
            UserBadge(id = "ub2", userId = "user1", badgeId = "b2"),
            UserBadge(id = "ub3", userId = "user1", badgeId = "b3")
        )
        val allBadges = listOf(
            createBadgeDefinition("b1", "B1", BadgeCategory.PERFORMANCE, BadgeRarity.COMMON),
            createBadgeDefinition("b2", "B2", BadgeCategory.PRESENCE, BadgeRarity.RARE),
            createBadgeDefinition("b3", "B3", BadgeCategory.PERFORMANCE, BadgeRarity.EPIC)
        )
        coEvery { gamificationRepository.getUserBadges("user1") } returns Result.success(userBadges)
        coEvery { gamificationRepository.getAvailableBadges() } returns Result.success(allBadges)

        // When
        val result = useCase(GetUserBadgesParams("user1"))

        // Then
        val data = result.getOrNull()!!
        assertEquals(2, data.categoryDistribution["Desempenho"])
        assertEquals(1, data.categoryDistribution["Presenca"])
    }

    // ========== Helpers ==========

    private fun createBadgeDefinition(
        id: String,
        name: String,
        category: BadgeCategory = BadgeCategory.PERFORMANCE,
        rarity: BadgeRarity = BadgeRarity.COMMON
    ) = BadgeDefinition(
        id = id,
        name = name,
        description = "Descricao da badge $name",
        emoji = "🏆",
        category = category,
        rarity = rarity,
        requiredValue = 1
    )
}
