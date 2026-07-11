package com.futebadosparcas.ui.groups

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.GroupWallPost
import com.futebadosparcas.data.repository.GroupWallMediaTerminalException
import com.futebadosparcas.data.repository.GroupWallPage
import com.futebadosparcas.data.repository.GroupWallRealtimeSnapshot
import com.futebadosparcas.data.repository.GroupWallRepository
import com.futebadosparcas.data.repository.mergeWallPostTimeline
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.DocumentSnapshot
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import java.util.UUID

sealed class GroupWallUiState {
    object Loading : GroupWallUiState()
    object Empty : GroupWallUiState()
    data class Success(
        val posts: List<GroupWallPost>,
        val loadingMore: Boolean = false,
        val hasMore: Boolean = false,
        val loadMoreError: String? = null
    ) : GroupWallUiState()
    data class Error(val message: String) : GroupWallUiState()
}

sealed class GroupWallActionState {
    object Idle : GroupWallActionState()
    data class Sending(
        val progress: Int = 0,
        val processing: Boolean = false
    ) : GroupWallActionState()
    object Editing : GroupWallActionState()
    object Pinning : GroupWallActionState()
    object Reacting : GroupWallActionState()
    object Deleting : GroupWallActionState()
    data class PostCreated(val message: String) : GroupWallActionState()
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

    private var observeJob: Job? = null
    private var loadMoreJob: Job? = null
    private var createPostJob: Job? = null
    private var pendingPostRequest: PendingPostRequest? = null
    private var activeGroupId: String? = null
    private var realtimeRecentPosts = emptyList<GroupWallPost>()
    private var realtimePinnedPosts = emptyList<GroupWallPost>()
    private var olderPosts = emptyList<GroupWallPost>()
    private var nextCursor: DocumentSnapshot? = null
    private var hasMorePosts = false
    private var hasLoadedOlderPosts = false

    fun observePosts(groupId: String) {
        observeJob?.cancel()
        loadMoreJob?.cancel()
        activeGroupId = groupId
        realtimeRecentPosts = emptyList()
        realtimePinnedPosts = emptyList()
        olderPosts = emptyList()
        nextCursor = null
        hasMorePosts = false
        hasLoadedOlderPosts = false
        _uiState.value = GroupWallUiState.Loading
        observeJob = repository.observePosts(groupId)
            .onEach { snapshot ->
                if (activeGroupId == groupId) {
                    applyRealtimeSnapshot(snapshot)
                }
            }
            .catch { e ->
                if (activeGroupId == groupId) {
                    _uiState.value = GroupWallUiState.Error(
                        e.message ?: "Erro ao carregar mural"
                    )
                }
            }
            .launchIn(viewModelScope)
    }

    fun loadMore(groupId: String) {
        if (activeGroupId != groupId || !hasMorePosts || loadMoreJob?.isActive == true) {
            return
        }
        val cursor = nextCursor ?: return

        setTimelineState(loadingMore = true)
        loadMoreJob = viewModelScope.launch {
            val result = repository.loadOlderPosts(groupId, cursor)
            if (activeGroupId != groupId) return@launch

            result.fold(
                onSuccess = ::appendOlderPage,
                onFailure = { error ->
                    setTimelineState(
                        loadingMore = false,
                        loadMoreError = error.message ?: "Erro ao carregar mensagens antigas"
                    )
                }
            )
        }
    }

    private fun applyRealtimeSnapshot(snapshot: GroupWallRealtimeSnapshot) {
        val currentRecentIds = snapshot.recentPosts.mapTo(mutableSetOf()) { it.id }
        val realtimeWindowDiscontinuous = realtimeRecentPosts.isNotEmpty() &&
            snapshot.recentPosts.isNotEmpty() &&
            realtimeRecentPosts.none { it.id in currentRecentIds }
        val postsLeavingRealtimeWindow = realtimeRecentPosts.filterNot { it.id in currentRecentIds }
        val currentPinnedIds = snapshot.pinnedPosts.mapTo(mutableSetOf()) { it.id }
        val removedPinnedIds = realtimePinnedPosts
            .asSequence()
            .map { it.id }
            .filterNot { it in currentPinnedIds }
            .toSet()

        olderPosts = mergeWallPostTimeline(
            recentPosts = postsLeavingRealtimeWindow,
            olderPosts = olderPosts.filterNot { it.id in removedPinnedIds }
        )
        realtimeRecentPosts = snapshot.recentPosts
        realtimePinnedPosts = snapshot.pinnedPosts

        if (!hasLoadedOlderPosts || realtimeWindowDiscontinuous) {
            // Sem sobreposição após um reconnect, podem existir mensagens no intervalo
            // entre as duas janelas. Recomeça da nova borda e deixa o merge deduplicar.
            nextCursor = snapshot.nextCursor
            hasMorePosts = snapshot.hasMore && snapshot.nextCursor != null
        }

        val current = _uiState.value as? GroupWallUiState.Success
        setTimelineState(
            loadingMore = current?.loadingMore ?: false,
            loadMoreError = current?.loadMoreError
        )
    }

    private fun appendOlderPage(page: GroupWallPage) {
        olderPosts = mergeWallPostTimeline(
            recentPosts = page.posts,
            olderPosts = olderPosts
        )
        nextCursor = page.nextCursor
        hasMorePosts = page.hasMore && page.nextCursor != null
        hasLoadedOlderPosts = true
        setTimelineState(loadingMore = false)
    }

    private fun setTimelineState(
        loadingMore: Boolean,
        loadMoreError: String? = null
    ) {
        val posts = mergeWallPostTimeline(
            recentPosts = realtimeRecentPosts,
            olderPosts = olderPosts,
            pinnedPosts = realtimePinnedPosts
        )
        _uiState.value = if (posts.isEmpty() && !hasMorePosts && !loadingMore) {
            GroupWallUiState.Empty
        } else {
            GroupWallUiState.Success(
                posts = posts,
                loadingMore = loadingMore,
                hasMore = hasMorePosts,
                loadMoreError = loadMoreError
            )
        }
    }

    fun createPost(groupId: String, text: String, mediaUri: Uri? = null) {
        if (createPostJob?.isActive == true) return

        val normalizedText = text.trim()
        val fingerprint = PendingPostFingerprint(
            groupId = groupId,
            text = normalizedText,
            mediaUri = mediaUri?.toString()
        )
        val request = pendingPostRequest
            ?.takeIf { it.fingerprint == fingerprint }
            ?: PendingPostRequest(
                fingerprint = fingerprint,
                clientRequestId = UUID.randomUUID().toString()
            )
        pendingPostRequest = request

        createPostJob = viewModelScope.launch {
            try {
                _actionState.value = GroupWallActionState.Sending()
                val result = repository.createPost(
                    groupId = groupId,
                    text = normalizedText,
                    mediaUri = mediaUri,
                    clientRequestId = request.clientRequestId,
                    onProgress = { progress ->
                        _actionState.value = GroupWallActionState.Sending(
                            progress = progress.coerceIn(0, 100),
                            processing = mediaUri != null && progress >= 100
                        )
                    }
                )
                _actionState.value = result.fold(
                    onSuccess = {
                        pendingPostRequest = null
                        GroupWallActionState.PostCreated("Publicado no mural")
                    },
                    onFailure = { error ->
                        if (error is GroupWallMediaTerminalException) {
                            // Draft encerrado não aceita novo upload com o mesmo UUID.
                            pendingPostRequest = null
                        }
                        GroupWallActionState.Error(error.message ?: "Erro ao publicar")
                    }
                )
            } catch (cancellation: CancellationException) {
                _actionState.value = GroupWallActionState.Error(
                    "Envio cancelado. Seu rascunho foi mantido."
                )
                throw cancellation
            }
        }
    }

    fun cancelPostUpload() {
        if (createPostJob?.isActive == true) {
            createPostJob?.cancel()
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
            val result = repository.deletePost(groupId, post)
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
        loadMoreJob?.cancel()
        createPostJob?.cancel()
    }
}

private data class PendingPostFingerprint(
    val groupId: String,
    val text: String,
    val mediaUri: String?
)

private data class PendingPostRequest(
    val fingerprint: PendingPostFingerprint,
    val clientRequestId: String
)
