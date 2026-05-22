package com.futebadosparcas.ui.whatsnew

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.ReleaseNote
import com.futebadosparcas.domain.repository.ReleaseNotesRepository
import com.futebadosparcas.domain.usecase.GetUnseenReleaseNotesUseCase
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Estados da Tela "Novidades" (histórico de release notes).
 *
 * Spec: feat-2026-05-22-version-control-release-notes.md — Fase G, task #23.
 */
sealed interface WhatsNewUiState {
    /** Buscando o histórico. */
    data object Loading : WhatsNewUiState

    /** Nenhuma nota disponível. */
    data object Empty : WhatsNewUiState

    /** Falha irrecuperável — exibe mensagem + botão de retry. */
    data class Error(val message: String) : WhatsNewUiState

    /** Histórico carregado, mais recente primeiro. */
    data class Success(val notes: List<ReleaseNote>) : WhatsNewUiState
}

/**
 * ViewModel da feature "Novidades" no `composeApp` (UI iOS via Compose-MP).
 *
 * Cobre dois consumidores independentes (instâncias diferentes de ViewModel):
 * - **Tela "Novidades"** ([uiState]/[loadHistory]) — histórico completo, acessada
 *   via menu na Home.
 * - **Pop-up no boot** ([popupNote]/[checkForPopup]/[dismissPopup]) — exibido em
 *   [WhatsNewPopupHost] quando há uma nota não vista com `showPopup`.
 *
 * A lógica de decisão do pop-up vive 100% em [GetUnseenReleaseNotesUseCase]
 * (`shared/commonMain`); aqui só orquestramos o estado de UI.
 *
 * @param getUnseenReleaseNotes `null` em targets não-shipping do `composeApp`
 *        (harness Android, wasmJs): sem fonte de notas, o pop-up nunca aparece.
 *        No iOS — o alvo real desta UI — é sempre não-nulo. Ver [releaseNotesModule].
 */
class WhatsNewViewModel(
    private val repository: ReleaseNotesRepository,
    private val getUnseenReleaseNotes: GetUnseenReleaseNotesUseCase?,
    private val currentBuild: Int,
    private val platform: String,
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
            repository.getReleaseNotes(platform, sinceBuild = 0)
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

    /**
     * Verifica, no boot, se há um pop-up "Novidades" a exibir.
     *
     * Idempotente por instância de ViewModel: roda a verificação uma única vez
     * (mesmo se [WhatsNewPopupHost] recompor). Falha é silenciosa — o pop-up
     * nunca bloqueia o boot (spec §3.10).
     */
    fun checkForPopup() {
        if (popupChecked) return
        popupChecked = true
        val useCase = getUnseenReleaseNotes ?: return
        viewModelScope.launch {
            useCase(platform, currentBuild).onSuccess { unseen ->
                _popupNote.value = unseen.popupNote
            }
        }
    }

    /**
     * Fecha o pop-up e marca o build atual como visto.
     *
     * Marca [currentBuild] — e não o build da nota — de propósito: garante "um
     * pop-up por atualização" (spec §2.1).
     */
    fun dismissPopup() {
        _popupNote.value = null
        val useCase = getUnseenReleaseNotes ?: return
        viewModelScope.launch {
            useCase.markSeen(currentBuild)
        }
    }

    override fun onCleared() {
        super.onCleared()
        loadJob?.cancel()
    }

    private companion object {
        const val DEFAULT_ERROR_MESSAGE = "Erro ao carregar novidades"
    }
}
