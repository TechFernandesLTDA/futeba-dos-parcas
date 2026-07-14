package com.futebadosparcas.ui.games

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.repository.GameVideo
import com.futebadosparcas.data.repository.GameVideosRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch

sealed class GameVideosUiState {
    data object Loading : GameVideosUiState()
    data object Empty : GameVideosUiState()
    data class Success(val videos: List<GameVideo>) : GameVideosUiState()
    data class Error(val message: String) : GameVideosUiState()
}

class GameVideosViewModel(
    private val repository: GameVideosRepository
) : ViewModel() {
    private val _uiState = MutableStateFlow<GameVideosUiState>(GameVideosUiState.Loading)
    val uiState: StateFlow<GameVideosUiState> = _uiState.asStateFlow()

    private val _uploading = MutableStateFlow(false)
    val uploading: StateFlow<Boolean> = _uploading.asStateFlow()

    private var observeJob: Job? = null
    private var observedGameId: String? = null

    fun observe(gameId: String) {
        if (observedGameId == gameId && observeJob?.isActive == true) return
        observeJob?.cancel()
        observedGameId = gameId
        _uiState.value = GameVideosUiState.Loading
        observeJob = viewModelScope.launch {
            repository.observeVideos(gameId)
                .catch { error ->
                    _uiState.value = GameVideosUiState.Error(
                        error.message ?: "Erro ao carregar vídeos"
                    )
                }
                .collect { videos ->
                    _uiState.value = if (videos.isEmpty()) {
                        GameVideosUiState.Empty
                    } else {
                        GameVideosUiState.Success(videos)
                    }
                }
        }
    }

    fun upload(
        gameId: String,
        uri: Uri,
        fileName: String,
        caption: String,
        sizeBytes: Long,
        onDone: (Boolean) -> Unit
    ) {
        viewModelScope.launch {
            _uploading.value = true
            repository.uploadVideo(
                gameId = gameId,
                uri = uri,
                fileName = fileName,
                caption = caption,
                sizeBytes = sizeBytes
            )
                .onSuccess { onDone(true) }
                .onFailure { onDone(false) }
            _uploading.value = false
        }
    }

    fun delete(video: GameVideo, onDone: (Boolean) -> Unit) {
        viewModelScope.launch {
            repository.deleteVideo(video)
                .onSuccess { onDone(true) }
                .onFailure { onDone(false) }
        }
    }

    fun toggleReaction(video: GameVideo, emoji: String, onDone: (Boolean) -> Unit) {
        viewModelScope.launch {
            repository.toggleReaction(video, emoji)
                .onSuccess { onDone(true) }
                .onFailure { onDone(false) }
        }
    }

    fun currentUserId(): String? = repository.currentUserId()
}
