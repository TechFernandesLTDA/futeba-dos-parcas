package com.futebadosparcas.ui.onboarding

import com.futebadosparcas.data.repository.OnboardingRepository
import com.futebadosparcas.domain.model.onboarding.OnboardingState
import com.futebadosparcas.domain.model.onboarding.OnboardingStep
import com.futebadosparcas.util.AnalyticsHelper
import com.futebadosparcas.util.MockLogExtension
import io.mockk.coEvery
import io.mockk.mockk
import io.mockk.verify
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertInstanceOf
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith

/**
 * Testes unitários para OnboardingViewModel.
 *
 * Verifica:
 * - Estado inicial de carregamento
 * - Transição de estados (Loading → Success/Error)
 * - Fallback para estado default quando repositório falha
 * - Lógica de derivação do checklist
 * - Disparo de analytics
 */
@OptIn(ExperimentalCoroutinesApi::class)
@DisplayName("OnboardingViewModel Tests")
@ExtendWith(MockLogExtension::class)
class OnboardingViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var onboardingRepository: OnboardingRepository
    private lateinit var analyticsHelper: AnalyticsHelper
    private lateinit var viewModel: OnboardingViewModel

    private val userId = "test-user-id"

    @BeforeEach
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        onboardingRepository = mockk(relaxed = true)
        analyticsHelper = mockk(relaxed = true)
        viewModel = OnboardingViewModel(onboardingRepository, analyticsHelper)
    }

    @AfterEach
    fun tearDown() {
        Dispatchers.resetMain()
    }

    // ─── Estado inicial ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("Estado inicial deve ser Loading")
    fun initialState_isLoading() {
        assertInstanceOf(OnboardingViewModel.UiState.Loading::class.java, viewModel.uiState.value)
    }

    @Test
    @DisplayName("showCelebration inicial é false")
    fun initialShowCelebration_isFalse() {
        assertFalse(viewModel.showCelebration.value)
    }

    // ─── loadOnboardingState ─────────────────────────────────────────────────────

    @Test
    @DisplayName("loadOnboardingState_comSucesso_retornaSuccess")
    fun loadOnboardingState_success_setsSuccessState() = runTest {
        val expectedState = OnboardingState(carouselSkipped = true, version = 1)
        coEvery { onboardingRepository.getOnboardingState(userId) } returns Result.success(expectedState)

        viewModel.loadOnboardingState(userId)
        advanceUntilIdle()

        val currentState = viewModel.uiState.value
        assertInstanceOf(OnboardingViewModel.UiState.Success::class.java, currentState)
        assertEquals(expectedState, (currentState as OnboardingViewModel.UiState.Success).onboardingState)
    }

    @Test
    @DisplayName("loadOnboardingState_comFalha_fallbackParaEstadoDefault")
    fun loadOnboardingState_failure_fallbackToDefault() = runTest {
        coEvery { onboardingRepository.getOnboardingState(userId) } returns
            Result.failure(RuntimeException("Erro de rede"))

        viewModel.loadOnboardingState(userId)
        advanceUntilIdle()

        // Não deve travar — deve usar estado default
        val currentState = viewModel.uiState.value
        assertInstanceOf(OnboardingViewModel.UiState.Success::class.java, currentState)
        val state = (currentState as OnboardingViewModel.UiState.Success).onboardingState
        assertEquals(OnboardingState(), state)
    }

    // ─── Derivação do checklist ──────────────────────────────────────────────────

    @Test
    @DisplayName("deriveChecklistSteps_perfilCompleto_retornaVerdadeiro")
    fun deriveChecklistSteps_withNicknameAndPhoto_profileStepTrue() {
        val steps = viewModel.deriveChecklistSteps(
            hasNickname = true,
            hasPhoto = true,
            groupCount = 0,
            confirmationCount = 0,
            gamesPlayedCount = 0
        )

        assertTrue(steps[OnboardingStep.COMPLETE_PROFILE] == true)
        assertFalse(steps[OnboardingStep.JOIN_OR_CREATE_GROUP] == true)
    }

    @Test
    @DisplayName("deriveChecklistSteps_comGrupo_joinStepVerdadeiro")
    fun deriveChecklistSteps_withGroup_joinStepTrue() {
        val steps = viewModel.deriveChecklistSteps(
            hasNickname = false,
            hasPhoto = false,
            groupCount = 1,
            confirmationCount = 0,
            gamesPlayedCount = 0
        )

        assertTrue(steps[OnboardingStep.JOIN_OR_CREATE_GROUP] == true)
    }

    @Test
    @DisplayName("deriveChecklistSteps_comConfirmacao_presenceStepVerdadeiro")
    fun deriveChecklistSteps_withConfirmation_presenceStepTrue() {
        val steps = viewModel.deriveChecklistSteps(
            hasNickname = false,
            hasPhoto = false,
            groupCount = 0,
            confirmationCount = 1,
            gamesPlayedCount = 0
        )

        assertTrue(steps[OnboardingStep.CONFIRM_PRESENCE] == true)
    }

    @Test
    @DisplayName("deriveChecklistSteps_comJogo_gameStepVerdadeiro")
    fun deriveChecklistSteps_withGame_gameStepTrue() {
        val steps = viewModel.deriveChecklistSteps(
            hasNickname = false,
            hasPhoto = false,
            groupCount = 0,
            confirmationCount = 0,
            gamesPlayedCount = 1
        )

        assertTrue(steps[OnboardingStep.PLAY_FIRST_GAME] == true)
    }

    @Test
    @DisplayName("deriveChecklistSteps_semNada_todosPassosFalsos")
    fun deriveChecklistSteps_withNothing_allStepsFalse() {
        val steps = viewModel.deriveChecklistSteps(
            hasNickname = false,
            hasPhoto = false,
            groupCount = 0,
            confirmationCount = 0,
            gamesPlayedCount = 0
        )

        assertFalse(steps.values.any { it })
    }

    // ─── Analytics ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("onCarouselStarted_disparaAnalytics")
    fun onCarouselStarted_logsAnalytics() {
        viewModel.onCarouselStarted()

        verify { analyticsHelper.logOnboardingStarted() }
    }

    @Test
    @DisplayName("onSlideViewed_disparaAnalytics")
    fun onSlideViewed_logsAnalytics() {
        viewModel.onSlideViewed(2, "invite")

        verify { analyticsHelper.logOnboardingSlideViewed(2, "invite") }
    }

    @Test
    @DisplayName("onCarouselSkipped_disparaAnalyticsEPersiste")
    fun onCarouselSkipped_logsAndPersists() = runTest {
        coEvery { onboardingRepository.markCarouselSkipped(userId, 1) } returns Result.success(Unit)

        viewModel.onCarouselSkipped(userId, 1)
        advanceUntilIdle()

        verify { analyticsHelper.logOnboardingSkipped(1) }
    }

    @Test
    @DisplayName("onChecklistAllCompleted_exibeCelebration")
    fun onChecklistAllCompleted_showsCelebration() = runTest {
        coEvery { onboardingRepository.markChecklistCompleted(userId, any()) } returns Result.success(Unit)

        viewModel.onChecklistAllCompleted(userId, 5000L)
        advanceUntilIdle()

        assertTrue(viewModel.showCelebration.value)
        verify { analyticsHelper.logChecklistCompleted(5000L) }
        verify { analyticsHelper.logOnboardingRewardGranted("badge_welcome") }
    }

    @Test
    @DisplayName("onCelebrationDismissed_ocultaCelebration")
    fun onCelebrationDismissed_hidesCelebration() = runTest {
        coEvery { onboardingRepository.markChecklistCompleted(userId, any()) } returns Result.success(Unit)

        viewModel.onChecklistAllCompleted(userId, 1000L)
        advanceUntilIdle()
        assertTrue(viewModel.showCelebration.value)

        viewModel.onCelebrationDismissed()
        assertFalse(viewModel.showCelebration.value)
    }
}
