package com.futebadosparcas.ui.messages

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.repository.DirectChat
import com.futebadosparcas.data.repository.DirectMessage
import com.futebadosparcas.data.repository.DirectMessagesRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch

data class ConversationUiState(
    val loading: Boolean = true,
    val chat: DirectChat? = null,
    val messages: List<DirectMessage> = emptyList(),
    val error: String? = null,
    val sending: Boolean = false
)

class ConversationViewModel(
    private val repository: DirectMessagesRepository
) : ViewModel() {
    private val _uiState = MutableStateFlow(ConversationUiState())
    val uiState: StateFlow<ConversationUiState> = _uiState.asStateFlow()

    val currentUserId: String?
        get() = repository.currentUserId()

    private var observedChatId: String? = null
    private var observationJob: Job? = null

    fun observe(chatId: String) {
        if (observedChatId == chatId && observationJob?.isActive == true) return
        startObservation(chatId)
    }

    fun retry(chatId: String) {
        startObservation(chatId)
    }

    private fun startObservation(chatId: String) {
        val previousObservation = observationJob
        observedChatId = chatId
        _uiState.value = _uiState.value.copy(loading = true, error = null)
        observationJob = viewModelScope.launch {
            previousObservation?.cancelAndJoin()
            launch {
                repository.observeChat(chatId)
                    .catch { error ->
                        _uiState.value = _uiState.value.copy(
                            loading = false,
                            error = error.message ?: "Erro ao carregar conversa"
                        )
                    }
                    .collect { chat ->
                        _uiState.value = _uiState.value.copy(
                            loading = false,
                            chat = chat,
                            error = null
                        )
                        val uid = currentUserId
                        if (uid != null && (chat?.unreadCount?.get(uid) ?: 0) > 0) {
                            repository.markRead(chatId)
                        }
                    }
            }
            launch {
                repository.observeMessages(chatId)
                    .catch { error ->
                        _uiState.value = _uiState.value.copy(
                            loading = false,
                            error = error.message ?: "Erro ao carregar mensagens"
                        )
                    }
                    .collect { messages ->
                        _uiState.value = _uiState.value.copy(
                            loading = false,
                            messages = messages,
                            error = null
                        )
                    }
            }
        }
    }

    fun send(text: String) {
        val chat = _uiState.value.chat ?: return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(sending = true)
            repository.sendMessage(chat, text)
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        error = error.message ?: "Erro ao enviar mensagem"
                    )
                }
            _uiState.value = _uiState.value.copy(sending = false)
        }
    }

    fun delete(messageId: String) {
        val chatId = observedChatId ?: return
        viewModelScope.launch {
            repository.deleteMessage(chatId, messageId)
                .onFailure { error ->
                    _uiState.value = _uiState.value.copy(
                        error = error.message ?: "Erro ao excluir mensagem"
                    )
                }
        }
    }
}
