package com.futebadosparcas.ui.groups

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.GroupWallPost
import com.futebadosparcas.data.repository.GroupWallRepository
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch

sealed class GroupWallUiState {
    object Loading : GroupWallUiState()
    object Empty : GroupWallUiState()
    data class Success(val posts: List<GroupWallPost>) : GroupWallUiState()
    data class Error(val message: String) : GroupWallUiState()
}

sealed class GroupWallActionState {
    object Idle : GroupWallActionState()
    object Sending : GroupWallActionState()
    object Editing : GroupWallActionState()
    object Pinning : GroupWallActionState()
    object Reacting : GroupWallActionState()
    object Deleting : GroupWallActionState()
    data class Success(val message: String) : GroupWallActionState()
    data class Error(val message: String) : GroupWallActionState()
}

class GroupWallViewModel(
    private val repository: GroupWallRepository,
    private val auth: FirebaseAuth
) : ViewModel() {

    private val _uiState = MutableStateFlow<GroupWallUiState>(GroupWallUiState.Loading)
    val uiState: StateFlow<GroupWallUiState> = _uiState.asStateFlow()

    private val _actionState = MutableStateFlow<GroupWallActionState>(GroupWallActionState.Idle)
    val actionState: StateFlow<GroupWallActionState> = _actionState.asStateFlow()

    private var observeJob: kotlinx.coroutines.Job? = null

    fun observePosts(groupId: String) {
        observeJob?.cancel()
        _uiState.value = GroupWallUiState.Loading
        observeJob = repository.observePosts(groupId)
            .onEach { posts ->
                _uiState.value = if (posts.isEmpty()) {
                    GroupWallUiState.Empty
                } else {
                    GroupWallUiState.Success(posts)
                }
            }
            .catch { e ->
                _uiState.value = GroupWallUiState.Error(
                    e.message ?: "Erro ao carregar mural"
                )
            }
            .launchIn(viewModelScope)
    }

    fun createPost(groupId: String, text: String, imageUri: Uri? = null) {
        viewModelScope.launch {
            _actionState.value = GroupWallActionState.Sending
            val result = repository.createPost(groupId, text, imageUri)
            _actionState.value = result.fold(
                onSuccess = { GroupWallActionState.Success("Publicado no mural") },
                onFailure = { GroupWallActionState.Error(it.message ?: "Erro ao publicar") }
            )
        }
    }

    fun editPost(groupId: String, postId: String, text: String) {
        viewModelScope.launch {
            _actionState.value = GroupWallActionState.Editing
            val result = repository.editPost(groupId, postId, text)
            _actionState.value = result.fold(
                onSuccess = { GroupWallActionState.Success("Post atualizado") },
                onFailure = { GroupWallActionState.Error(it.message ?: "Erro ao editar") }
            )
        }
    }

    fun togglePin(groupId: String, postId: String, pinned: Boolean) {
        viewModelScope.launch {
            _actionState.value = GroupWallActionState.Pinning
            val result = repository.togglePin(groupId, postId, pinned)
            _actionState.value = result.fold(
                onSuccess = { GroupWallActionState.Success(if (pinned) "Post fixado" else "Post desfixado") },
                onFailure = { GroupWallActionState.Error(it.message ?: "Erro ao alterar fixação") }
            )
        }
    }

    fun toggleReaction(
        groupId: String,
        post: GroupWallPost,
        emoji: String
    ) {
        viewModelScope.launch {
            _actionState.value = GroupWallActionState.Reacting
            val result = repository.toggleReaction(groupId, post.id, post.reactions, emoji)
            _actionState.value = result.fold(
                onSuccess = { GroupWallActionState.Idle },
                onFailure = { GroupWallActionState.Error(it.message ?: "Erro ao reagir") }
            )
        }
    }

    fun deletePost(groupId: String, post: GroupWallPost) {
        viewModelScope.launch {
            _actionState.value = GroupWallActionState.Deleting
            val result = repository.deletePost(groupId, post.id, post.mediaPath)
            _actionState.value = result.fold(
                onSuccess = { GroupWallActionState.Success("Post removido") },
                onFailure = { GroupWallActionState.Error(it.message ?: "Erro ao remover") }
            )
        }
    }

    fun resetActionState() {
        _actionState.value = GroupWallActionState.Idle
    }

    fun currentUserId(): String? = auth.currentUser?.uid

    fun isCurrentUser(userId: String): Boolean = auth.currentUser?.uid == userId

    override fun onCleared() {
        super.onCleared()
        observeJob?.cancel()
    }
}
