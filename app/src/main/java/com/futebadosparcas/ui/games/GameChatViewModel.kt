package com.futebadosparcas.ui.games

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.GameChatMessage
import com.futebadosparcas.data.repository.GameChatRepository
import com.futebadosparcas.util.AppLogger
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch

/**
 * ViewModel do chat em tempo real por jogo (issue #3230, épico #3240).
 *
 * Espelha [com.futebadosparcas.ui.notifications.NotificationsViewModel]:
 * - StateFlow<UiState> (Loading/Empty/Success/Error)
 * - Job tracking com cancel em onCleared() (limpa listener)
 * - .catch{} propaga erro do callbackFlow
 */
class GameChatViewModel(
    private val gameChatRepository: GameChatRepository,
    private val auth: com.google.firebase.auth.FirebaseAuth
) : ViewModel() {

    private val _uiState = MutableStateFlow<GameChatUiState>(GameChatUiState.Loading)
    val uiState: StateFlow<GameChatUiState> = _uiState.asStateFlow()

    private val _actionState = MutableStateFlow<GameChatActionState>(GameChatActionState.Idle)
    val actionState: StateFlow<GameChatActionState> = _actionState.asStateFlow()

    private var messagesJob: Job? = null

    val currentUserId: String?
        get() = auth.currentUser?.uid

    /**
     * Inicia observação do chat do jogo. Idempotente (cancela job anterior).
     */
    fun observeMessages(gameId: String) {
        messagesJob?.cancel()
        _uiState.value = GameChatUiState.Loading

        messagesJob = gameChatRepository.observeMessages(gameId)
            .onEach { messages ->
                _uiState.value = if (messages.isEmpty()) {
                    GameChatUiState.Empty
                } else {
                    GameChatUiState.Success(messages = messages)
                }
            }
            .catch { e ->
                AppLogger.e(TAG, "Erro ao observar chat", e)
                _uiState.value = GameChatUiState.Error(
                    e.message ?: "Erro ao carregar mensagens"
                )
            }
            .launchIn(viewModelScope)
    }

    /**
     * Envia mensagem. Validação de input no repository.
     */
    fun sendMessage(gameId: String, text: String) {
        val cleanText = text.trim()
        if (cleanText.isEmpty()) return

        viewModelScope.launch {
            _actionState.value = GameChatActionState.Sending
            val result = gameChatRepository.sendMessage(gameId, cleanText)
            _actionState.value = if (result.isSuccess) {
                GameChatActionState.Idle
            } else {
                GameChatActionState.Error(
                    result.exceptionOrNull()?.message ?: "Erro ao enviar mensagem"
                )
            }
        }
    }

    /**
     * Soft-deleta mensagem.
     */
    fun deleteMessage(gameId: String, messageId: String) {
        viewModelScope.launch {
            _actionState.value = GameChatActionState.Deleting
            val result = gameChatRepository.deleteMessage(gameId, messageId)
            _actionState.value = if (result.isSuccess) {
                GameChatActionState.Idle
            } else {
                GameChatActionState.Error(
                    result.exceptionOrNull()?.message ?: "Erro ao deletar mensagem"
                )
            }
        }
    }

    fun clearActionError() {
        if (_actionState.value is GameChatActionState.Error) {
            _actionState.value = GameChatActionState.Idle
        }
    }

    override fun onCleared() {
        super.onCleared()
        messagesJob?.cancel()
    }

    companion object {
        private const val TAG = "GameChatViewModel"
    }
}

sealed class GameChatUiState {
    object Loading : GameChatUiState()
    object Empty : GameChatUiState()
    data class Success(val messages: List<GameChatMessage>) : GameChatUiState()
    data class Error(val message: String) : GameChatUiState()
}

sealed class GameChatActionState {
    object Idle : GameChatActionState()
    object Sending : GameChatActionState()
    object Deleting : GameChatActionState()
    data class Error(val message: String) : GameChatActionState()
}
