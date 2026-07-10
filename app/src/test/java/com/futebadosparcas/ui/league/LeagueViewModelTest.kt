package com.futebadosparcas.ui.league

import com.futebadosparcas.data.model.Season as AndroidSeason
import com.futebadosparcas.domain.model.Season
import com.futebadosparcas.domain.repository.AuthRepository
import com.futebadosparcas.domain.repository.GamificationRepository
import com.futebadosparcas.domain.usecase.notification.ObserveUnreadCountUseCase
import com.futebadosparcas.util.MockLogExtension
import com.google.firebase.firestore.FirebaseFirestore
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertInstanceOf
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

@OptIn(ExperimentalCoroutinesApi::class)
@ExtendWith(MockLogExtension::class)
class LeagueViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private lateinit var gamificationRepository: GamificationRepository
    private lateinit var authRepository: AuthRepository
    private lateinit var firestore: FirebaseFirestore
    private lateinit var unreadCountUseCase: ObserveUnreadCountUseCase

    @BeforeEach
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        gamificationRepository = mockk()
        authRepository = mockk(relaxed = true)
        firestore = mockk(relaxed = true)
        unreadCountUseCase = mockk()
        every { unreadCountUseCase() } returns MutableStateFlow(0)
    }

    @AfterEach
    fun tearDown() { Dispatchers.resetMain() }

    private fun createViewModel() = LeagueViewModel(
        gamificationRepository, authRepository, firestore, unreadCountUseCase
    )

    @Test
    fun `refresh recupera falha da carga inicial de temporadas`() = runTest(dispatcher) {
        coEvery { gamificationRepository.getAllSeasons() } returnsMany listOf(
            Result.failure(IllegalStateException("offline")),
            Result.success(emptyList())
        )
        val viewModel = createViewModel()
        advanceUntilIdle()
        assertInstanceOf(LeagueUiState.Error::class.java, viewModel.uiState.value)
        viewModel.refresh()
        advanceUntilIdle()
        assertEquals(LeagueUiState.NoActiveSeason, viewModel.uiState.value)
        coVerify(exactly = 2) { gamificationRepository.getAllSeasons() }
    }

    @Test
    fun `troca rapida de temporada preserva a ultima selecao`() = runTest(dispatcher) {
        coEvery { gamificationRepository.getAllSeasons() } returns Result.success(emptyList<Season>())
        every { gamificationRepository.observeSeasonRanking(any(), any(), any()) } returns flowOf(emptyList())
        val viewModel = createViewModel()
        advanceUntilIdle()
        viewModel.selectSeason(AndroidSeason(id = "s1", name = "Temporada 1"))
        viewModel.selectSeason(AndroidSeason(id = "s2", name = "Temporada 2"))
        advanceUntilIdle()
        assertEquals("s2", viewModel.selectedSeason.value?.id)
    }
}
