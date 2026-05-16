package com.futebadosparcas.ui.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.repository.OnboardingRepository
import com.futebadosparcas.domain.model.onboarding.OnboardingState
import com.futebadosparcas.domain.model.onboarding.OnboardingStep
import com.futebadosparcas.util.AnalyticsHelper
import com.futebadosparcas.util.AppLogger
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * ViewModel do onboarding — carrossel de boas-vindas e checklist de primeiros passos.
 *
 * Gerencia:
 * - Estado do carrossel (slide atual, skip, complete)
 * - Estado do checklist (derivado de dados de domínio)
 * - Persistência via [OnboardingRepository]
 * - Analytics via [AnalyticsHelper]
 */
class OnboardingViewModel(
    private val onboardingRepository: OnboardingRepository,
    private val analyticsHelper: AnalyticsHelper
) : ViewModel() {

    sealed class UiState {
        object Loading : UiState()
        data class Success(val onboardingState: OnboardingState) : UiState()
        data class Error(val message: String) : UiState()
    }

    private val _uiState = MutableStateFlow<UiState>(UiState.Loading)
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    /** Controla exibição da CelebrationSheet após checklist completo. */
    private val _showCelebration = MutableStateFlow(false)
    val showCelebration: StateFlow<Boolean> = _showCelebration.asStateFlow()

    private var loadJob: Job? = null
    private var carouselStartMs: Long = 0L

    companion object {
        private const val TAG = "OnboardingViewModel"
    }

    /**
     * Carrega o estado de onboarding do usuário.
     *
     * @param userId UID do usuário autenticado
     */
    fun loadOnboardingState(userId: String) {
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            _uiState.value = UiState.Loading
            onboardingRepository.getOnboardingState(userId)
                .onSuccess { state ->
                    _uiState.value = UiState.Success(state)
                    AppLogger.d(TAG) { "Estado carregado: carouselDone=${state.hasSeenCarousel()}" }
                }
                .onFailure { error ->
                    AppLogger.e(TAG, "Erro ao carregar onboarding", error)
                    // Fallback: mostra estado default para não bloquear o usuário
                    _uiState.value = UiState.Success(OnboardingState())
                }
        }
    }

    /**
     * Chamado quando o carrossel é exibido pela primeira vez.
     */
    fun onCarouselStarted() {
        carouselStartMs = System.currentTimeMillis()
        analyticsHelper.logOnboardingStarted()
    }

    /**
     * Chamado quando o usuário visualiza um slide.
     */
    fun onSlideViewed(slideIndex: Int, slideId: String) {
        analyticsHelper.logOnboardingSlideViewed(slideIndex, slideId)
    }

    /**
     * Chamado quando o usuário clica em "Pular".
     *
     * @param userId UID do usuário
     * @param atSlideIndex índice do slide atual
     */
    fun onCarouselSkipped(userId: String, atSlideIndex: Int) {
        analyticsHelper.logOnboardingSkipped(atSlideIndex)
        viewModelScope.launch {
            onboardingRepository.markCarouselSkipped(userId, atSlideIndex)
                .onFailure { error ->
                    AppLogger.e(TAG, "Erro ao salvar skip do carrossel", error)
                }
        }
    }

    /**
     * Chamado quando o usuário conclui o carrossel (botão "Bora jogar!").
     *
     * @param userId UID do usuário
     */
    fun onCarouselCompleted(userId: String) {
        val durationMs = System.currentTimeMillis() - carouselStartMs
        analyticsHelper.logOnboardingCarouselCompleted(durationMs)
        viewModelScope.launch {
            onboardingRepository.markCarouselCompleted(userId, System.currentTimeMillis())
                .onFailure { error ->
                    AppLogger.e(TAG, "Erro ao salvar conclusão do carrossel", error)
                }
        }
    }

    /**
     * Deriva os passos completos do checklist a partir dos dados de domínio existentes.
     *
     * Os passos NÃO são checkboxes manuais — são derivados de eventos reais:
     * - COMPLETE_PROFILE: nickname != null && photoUrl != null
     * - JOIN_OR_CREATE_GROUP: groupCount > 0
     * - CONFIRM_PRESENCE: confirmationCount > 0
     * - PLAY_FIRST_GAME: gamesPlayedCount > 0
     *
     * @param hasNickname usuário tem apelido preenchido
     * @param hasPhoto usuário tem foto de perfil
     * @param groupCount número de grupos que o usuário participa
     * @param confirmationCount número de confirmações de presença feitas
     * @param gamesPlayedCount número de jogos encerrados que participou
     */
    fun deriveChecklistSteps(
        hasNickname: Boolean,
        hasPhoto: Boolean,
        groupCount: Int,
        confirmationCount: Int,
        gamesPlayedCount: Int
    ): Map<OnboardingStep, Boolean> {
        return mapOf(
            OnboardingStep.COMPLETE_PROFILE to (hasNickname && hasPhoto),
            OnboardingStep.JOIN_OR_CREATE_GROUP to (groupCount > 0),
            OnboardingStep.CONFIRM_PRESENCE to (confirmationCount > 0),
            OnboardingStep.PLAY_FIRST_GAME to (gamesPlayedCount > 0)
        )
    }

    /**
     * Chamado quando todos os passos do checklist são detectados como concluídos.
     * Persiste o estado e exibe CelebrationSheet.
     *
     * @param userId UID do usuário
     * @param totalDurationMs duração desde quando o checklist apareceu
     */
    fun onChecklistAllCompleted(userId: String, totalDurationMs: Long) {
        analyticsHelper.logChecklistCompleted(totalDurationMs)
        analyticsHelper.logOnboardingRewardGranted("badge_welcome")
        _showCelebration.value = true
        viewModelScope.launch {
            onboardingRepository.markChecklistCompleted(userId, System.currentTimeMillis())
                .onFailure { error ->
                    AppLogger.e(TAG, "Erro ao salvar conclusão do checklist", error)
                }
        }
    }

    /**
     * Chamado quando o usuário dispensa o checklist.
     *
     * @param userId UID do usuário
     * @param stepsDone número de passos concluídos
     * @param stepsTotal total de passos
     */
    fun onChecklistDismissed(userId: String, stepsDone: Int, stepsTotal: Int) {
        analyticsHelper.logChecklistDismissed(stepsDone, stepsTotal)
        viewModelScope.launch {
            onboardingRepository.markChecklistDismissed(userId)
                .onFailure { error ->
                    AppLogger.e(TAG, "Erro ao salvar dismiss do checklist", error)
                }
        }
    }

    /**
     * Chamado quando um passo individual do checklist é completado (evento de domínio detectado).
     */
    fun onChecklistStepCompleted(stepId: String, timeSinceStartMs: Long) {
        analyticsHelper.logChecklistStepCompleted(stepId, timeSinceStartMs)
    }

    /** Fecha a CelebrationSheet. */
    fun onCelebrationDismissed() {
        _showCelebration.value = false
    }

    override fun onCleared() {
        super.onCleared()
        loadJob?.cancel()
    }
}
