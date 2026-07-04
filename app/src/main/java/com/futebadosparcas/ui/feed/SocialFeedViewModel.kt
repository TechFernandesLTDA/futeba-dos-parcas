package com.futebadosparcas.ui.feed

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.repository.SocialFeedPost
import com.futebadosparcas.data.repository.SocialFeedRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class SocialFeedUiState {
    data object Loading : SocialFeedUiState()
    data object EmptyGroups : SocialFeedUiState()
    data object Empty : SocialFeedUiState()
    data class Success(val posts: List<SocialFeedPost>) : SocialFeedUiState()
    data class Error(val message: String) : SocialFeedUiState()
}

class SocialFeedViewModel(
    private val repository: SocialFeedRepository
) : ViewModel() {
    private val _uiState = MutableStateFlow<SocialFeedUiState>(SocialFeedUiState.Loading)
    val uiState: StateFlow<SocialFeedUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _uiState.value = SocialFeedUiState.Loading
            repository.loadFeed()
                .onSuccess { result ->
                    _uiState.value = when {
                        !result.hasGroups -> SocialFeedUiState.EmptyGroups
                        result.posts.isEmpty() -> SocialFeedUiState.Empty
                        else -> SocialFeedUiState.Success(result.posts)
                    }
                }
                .onFailure { error ->
                    _uiState.value = SocialFeedUiState.Error(
                        error.message ?: "Erro ao carregar feed"
                    )
                }
        }
    }

    fun toggleReaction(feedPost: SocialFeedPost, emoji: String) {
        viewModelScope.launch {
            repository.toggleReaction(feedPost, emoji)
                .onSuccess { load() }
        }
    }

    fun hidePost(feedPost: SocialFeedPost, onDone: (Boolean) -> Unit) {
        viewModelScope.launch {
            repository.hidePost(feedPost)
                .onSuccess {
                    load()
                    onDone(true)
                }
                .onFailure { onDone(false) }
        }
    }

    fun reportPost(feedPost: SocialFeedPost, onDone: (Boolean) -> Unit) {
        viewModelScope.launch {
            repository.reportPost(feedPost)
                .onSuccess { onDone(true) }
                .onFailure { onDone(false) }
        }
    }

    fun currentUserId(): String? = repository.currentUserId()
}
