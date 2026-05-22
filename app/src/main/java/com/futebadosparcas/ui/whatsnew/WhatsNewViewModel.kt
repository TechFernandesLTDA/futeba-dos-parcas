package com.futebadosparcas.ui.whatsnew

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.BuildConfig
import com.futebadosparcas.domain.model.ReleaseNote
import com.futebadosparcas.domain.repository.ReleaseNotesRepository
import com.futebadosparcas.domain.usecase.GetUnseenReleaseNotesUseCase
import com.futebadosparcas.util.AnalyticsHelper
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Estados da Tela "Novidades" (histórico de release notes).
 *
 * Spec: feat-2026-05-22-version-control-release-notes.md — Fase E, task #16.
 */
sealed interface WhatsNewUiState {
    /** Buscando o histórico (shimmer). */
    data object Loading : WhatsNewUiState

    /** Nenhuma nota disponível — raro (Firestore vazio e sem fallback). */
    data object Empty : WhatsNewUiState

    /** Falha irrecuperável — exibe mensagem + botão de retry. */
    data class Error(val message: String) : WhatsNewUiState

    /** Histórico carregado, mais recente primeiro. */
    data class Success(val notes: List<ReleaseNote>) : WhatsNewUiState
}

/**
 * ViewModel da feature "Novidades".
 *
 * Cobre dois consumidores independentes (instâncias diferentes de ViewModel):
 * - **Tela "Novidades"** ([uiState]/[loadHistory]) — histórico completo, acessada
 *   via Ajustes/Sobre.
 * - **Pop-up no boot** ([popupNote]/[checkForPopup]/[dismissPopup]) — exibido em
 *   `MainScreen` quando há uma nota não vista com `showPopup`.
 *
 * A lógica de decisão do pop-up vive 100% em [GetUnseenReleaseNotesUseCase]
 * (`shared/commonMain`); aqui só orquestramos o estado de UI e analytics.
 */
class WhatsNewViewModel(
    private val getUnseenReleaseNotes: GetUnseenReleaseNotesUseCase,
    private val releaseNotesRepository: ReleaseNotesRepository,
    private val analytics: AnalyticsHelper,
    private val currentBuild: Int = BuildConfig.VERSION_CODE,
    private val platform: String = PLATFORM_ANDROID,
) : ViewModel() {

    private val _uiState = MutableStateFlow<WhatsNewUiState>(WhatsNewUiState.Loading)
    val uiState: StateFlow<WhatsNewUiState> = _uiState.asStateFlow()

    private val _popupNote = MutableStateFlow<ReleaseNote?>(null)
    val popupNote: StateFlow<ReleaseNote?> = _popupNote.asStateFlow()

    private var loadJob: Job? = null
    private var popupChecked = false

    /**
     * Carrega o histórico completo de novidades (`sinceBuild = 0`) para a Tela
     * "Novidades". Usa o repositório direto — o use case filtra pelo último build
     * visto, o que esconderia o histórico já lido.
     */
    fun loadHistory() {
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            _uiState.value = WhatsNewUiState.Loading
            releaseNotesRepository.getReleaseNotes(platform, sinceBuild = 0)
                .onSuccess { notes ->
                    val sorted = notes.sortedByDescending { it.buildNumber }
                    _uiState.value = if (sorted.isEmpty()) {
                        WhatsNewUiState.Empty
                    } else {
                        WhatsNewUiState.Success(sorted)
                    }
                }
                .onFailure { error ->
                    _uiState.value = WhatsNewUiState.Error(
                        error.message ?: DEFAULT_ERROR_MESSAGE,
                    )
                }
        }
    }

    /** Registra a abertura da Tela "Novidades" via menu (analytics). */
    fun onScreenOpened() {
        analytics.logWhatsNewOpened(source = "settings")
    }

    /**
     * Verifica, no boot, se há um pop-up "Novidades" a exibir.
     *
     * Idempotente por instância de ViewModel: roda a verificação uma única vez.
     * Falha é silenciosa — o pop-up nunca bloqueia o boot (spec §3.10); se os
     * dados não chegarem, ele simplesmente não aparece neste boot.
     */
    fun checkForPopup() {
        if (popupChecked) return
        popupChecked = true
        viewModelScope.launch {
            getUnseenReleaseNotes(platform, currentBuild)
                .onSuccess { unseen ->
                    val note = unseen.popupNote ?: return@onSuccess
                    _popupNote.value = note
                    // Log disparado aqui (uma vez), não na composição do BottomSheet,
                    // para evitar duplicação em recomposições.
                    analytics.logWhatsNewPopupShown(note.version, platform)
                }
        }
    }

    /**
     * Fecha o pop-up e marca o build atual como visto.
     *
     * Marca [currentBuild] — e não o build da nota — de propósito: garante "um
     * pop-up por atualização". Se a nota for de um build anterior ao instalado,
     * ainda assim não reaparece no próximo boot. Spec §2.1.
     */
    fun dismissPopup() {
        val note = _popupNote.value
        _popupNote.value = null
        viewModelScope.launch {
            note?.let { analytics.logWhatsNewDismissed(it.version) }
            getUnseenReleaseNotes.markSeen(currentBuild)
        }
    }

    override fun onCleared() {
        super.onCleared()
        loadJob?.cancel()
    }

    companion object {
        const val PLATFORM_ANDROID = "android"
        private const val DEFAULT_ERROR_MESSAGE = "Erro ao carregar novidades"
    }
}
