package com.futebadosparcas.ui.messages

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.repository.DirectChat
import com.futebadosparcas.data.repository.DirectMessagesRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch

sealed class DirectMessagesUiState {
    data object Loading : DirectMessagesUiState()
    data class Success(val chats: List<DirectChat>) : DirectMessagesUiState()
    data class Error(val message: String) : DirectMessagesUiState()
}

class DirectMessagesViewModel(
    private val repository: DirectMessagesRepository
) : ViewModel() {
    private val _uiState = MutableStateFlow<DirectMessagesUiState>(DirectMessagesUiState.Loading)
    val uiState: StateFlow<DirectMessagesUiState> = _uiState.asStateFlow()

    val currentUserId: String?
        get() = repository.currentUserId()

    init {
        observeChats()
    }

    fun observeChats() {
        viewModelScope.launch {
            _uiState.value = DirectMessagesUiState.Loading
            repository.observeChats()
                .catch { error ->
                    _uiState.value = DirectMessagesUiState.Error(
                        error.message ?: "Erro ao carregar mensagens"
                    )
                }
                .collect { chats ->
                    _uiState.value = DirectMessagesUiState.Success(chats)
                }
        }
    }
}
