package com.futebadosparcas.ui.games

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.GameComment
import com.futebadosparcas.data.repository.GameCommentsRepository
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch

/**
 * ViewModel dos comentários livres por jogo (issue #3234, épico #3240).
 */
class GameCommentsViewModel(
    private val gameCommentsRepository: GameCommentsRepository,
    private val auth: FirebaseAuth
) : ViewModel() {

    private val _uiState = MutableStateFlow<GameCommentsUiState>(GameCommentsUiState.Loading)
    val uiState: StateFlow<GameCommentsUiState> = _uiState.asStateFlow()

    private val _actionState = MutableStateFlow<GameCommentsActionState>(GameCommentsActionState.Idle)
    val actionState: StateFlow<GameCommentsActionState> = _actionState.asStateFlow()

    private var commentsJob: Job? = null

    val currentUserId: String?
        get() = auth.currentUser?.uid

    fun observeComments(gameId: String, context: String = "game") {
        commentsJob?.cancel()
        _uiState.value = GameCommentsUiState.Loading

        commentsJob = gameCommentsRepository.observeComments(gameId, context)
            .onEach { comments ->
                _uiState.value = if (comments.isEmpty()) {
                    GameCommentsUiState.Empty
                } else {
                    GameCommentsUiState.Success(comments)
                }
            }
            .catch { e ->
                AppLogger.e(TAG, "Erro ao observar comentários", e)
                _uiState.value = GameCommentsUiState.Error(
                    e.message ?: "Erro ao carregar comentários"
                )
            }
            .launchIn(viewModelScope)
    }

    fun addComment(gameId: String, text: String, parentId: String? = null, context: String = "game") {
        val cleanText = text.trim()
        if (cleanText.isEmpty()) return

        viewModelScope.launch {
            _actionState.value = GameCommentsActionState.Saving
            val result = gameCommentsRepository.addComment(gameId, cleanText, parentId, context)
            _actionState.value = if (result.isSuccess) {
                GameCommentsActionState.Idle
            } else {
                GameCommentsActionState.Error(
                    result.exceptionOrNull()?.message ?: "Erro ao enviar comentário"
                )
            }
        }
    }

    fun editComment(gameId: String, commentId: String, text: String) {
        val cleanText = text.trim()
        if (cleanText.isEmpty()) return

        viewModelScope.launch {
            _actionState.value = GameCommentsActionState.Saving
            val result = gameCommentsRepository.editComment(gameId, commentId, cleanText)
            _actionState.value = if (result.isSuccess) {
                GameCommentsActionState.Idle
            } else {
                GameCommentsActionState.Error(
                    result.exceptionOrNull()?.message ?: "Erro ao editar comentário"
                )
            }
        }
    }

    fun deleteComment(gameId: String, commentId: String) {
        viewModelScope.launch {
            _actionState.value = GameCommentsActionState.Deleting
            val result = gameCommentsRepository.deleteComment(gameId, commentId)
            _actionState.value = if (result.isSuccess) {
                GameCommentsActionState.Idle
            } else {
                GameCommentsActionState.Error(
                    result.exceptionOrNull()?.message ?: "Erro ao apagar comentário"
                )
            }
        }
    }

    fun toggleReaction(gameId: String, comment: GameComment, emoji: String) {
        viewModelScope.launch {
            _actionState.value = GameCommentsActionState.Reacting
            val result = gameCommentsRepository.toggleReaction(gameId, comment, emoji)
            _actionState.value = if (result.isSuccess) {
                GameCommentsActionState.Idle
            } else {
                GameCommentsActionState.Error(
                    result.exceptionOrNull()?.message ?: "Erro ao atualizar reação"
                )
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        commentsJob?.cancel()
    }

    companion object {
        private const val TAG = "GameCommentsViewModel"
    }
}

sealed class GameCommentsUiState {
    object Loading : GameCommentsUiState()
    object Empty : GameCommentsUiState()
    data class Success(val comments: List<GameComment>) : GameCommentsUiState()
    data class Error(val message: String) : GameCommentsUiState()
}

sealed class GameCommentsActionState {
    object Idle : GameCommentsActionState()
    object Saving : GameCommentsActionState()
    object Deleting : GameCommentsActionState()
    object Reacting : GameCommentsActionState()
    data class Error(val message: String) : GameCommentsActionState()
}
