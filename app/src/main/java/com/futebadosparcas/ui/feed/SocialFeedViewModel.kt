package com.futebadosparcas.ui.feed

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.repository.SocialFeedCursor
import com.futebadosparcas.data.repository.SocialFeedPost
import com.futebadosparcas.data.repository.SocialFeedRepository
import com.futebadosparcas.util.RealtimeTelemetry
import com.futebadosparcas.util.RealtimeTelemetryFlow
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class SocialFeedUiState {
    data object Loading : SocialFeedUiState()
    data object EmptyGroups : SocialFeedUiState()
    data object Empty : SocialFeedUiState()
    data class Success(
        val posts: List<SocialFeedPost>,
        val hasMore: Boolean = false,
        val isLoadingMore: Boolean = false
    ) : SocialFeedUiState()
    data class Error(val message: String) : SocialFeedUiState()
}

class SocialFeedViewModel(
    private val repository: SocialFeedRepository,
    private val realtimeTelemetry: RealtimeTelemetry = RealtimeTelemetry.disabled()
) : ViewModel() {
    private val _uiState = MutableStateFlow<SocialFeedUiState>(SocialFeedUiState.Loading)
    val uiState: StateFlow<SocialFeedUiState> = _uiState.asStateFlow()

    private var observeJob: Job? = null
    private var loadMoreJob: Job? = null
    private var cursor: SocialFeedCursor? = null
    private var firstPagePosts = emptyList<SocialFeedPost>()
    private var historicalPosts = emptyList<SocialFeedPost>()
    private var hasGroups = true
    private var hasMore = false
    private val realtimeTracker = realtimeTelemetry.tracker(RealtimeTelemetryFlow.SOCIAL_FEED)

    init {
        load()
    }

    fun load() {
        when (_uiState.value) {
            is SocialFeedUiState.Error -> realtimeTracker.startReconnect()
            SocialFeedUiState.Loading -> Unit
            else -> realtimeTracker.startApply()
        }
        observeJob?.cancel()
        loadMoreJob?.cancel()
        cursor = null
        firstPagePosts = emptyList()
        historicalPosts = emptyList()
        hasGroups = true
        hasMore = false
        _uiState.value = SocialFeedUiState.Loading

        observeJob = viewModelScope.launch {
            repository.observeFirstPage().collect { result ->
                result.onSuccess { page ->
                    realtimeTracker.recordApply()
                    val previousScope = cursor?.scopeKey
                    val nextScope = page.cursor?.scopeKey
                    if (previousScope != null && previousScope != nextScope) {
                        historicalPosts = emptyList()
                    }
                    cursor = page.cursor
                    firstPagePosts = page.posts
                    hasGroups = page.hasGroups
                    hasMore = page.hasMore
                    render()
                }.onFailure { error ->
                    realtimeTracker.recordError()
                    _uiState.value = SocialFeedUiState.Error(
                        error.message ?: "Erro ao carregar feed"
                    )
                }
            }
        }
    }

    /** Carrega a proxima pagina global sem interromper os listeners realtime. */
    fun loadMore() {
        val pageCursor = cursor ?: return
        if (!hasMore || loadMoreJob?.isActive == true) return
        realtimeTracker.startApply()
        render(isLoadingMore = true)
        loadMoreJob = viewModelScope.launch {
            repository.loadMore(pageCursor)
                .onSuccess { page ->
                    if (cursor?.scopeKey != page.cursor?.scopeKey) return@onSuccess
                    realtimeTracker.recordApply()
                    historicalPosts = mergePosts(historicalPosts, page.posts)
                    cursor = page.cursor
                    hasMore = page.hasMore
                    render()
                }
                .onFailure { error ->
                    realtimeTracker.recordError()
                    val current = mergedPosts()
                    _uiState.value = if (current.isEmpty()) {
                        SocialFeedUiState.Error(error.message ?: "Erro ao carregar feed")
                    } else {
                        SocialFeedUiState.Success(current, hasMore = hasMore)
                    }
                }
        }
    }

    fun toggleReaction(feedPost: SocialFeedPost, emoji: String) {
        viewModelScope.launch {
            repository.toggleReaction(feedPost, emoji)
            // O listener da primeira pagina entrega a reacao dos dois clientes.
        }
    }

    fun hidePost(feedPost: SocialFeedPost, onDone: (Boolean) -> Unit) {
        viewModelScope.launch {
            repository.hidePost(feedPost)
                .onSuccess {
                    val hiddenKey = feedPost.key()
                    firstPagePosts = firstPagePosts.filterNot { post -> post.key() == hiddenKey }
                    historicalPosts = historicalPosts.filterNot { post -> post.key() == hiddenKey }
                    render()
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

    private fun render(isLoadingMore: Boolean = false) {
        val posts = mergedPosts()
        _uiState.value = when {
            !hasGroups -> SocialFeedUiState.EmptyGroups
            posts.isEmpty() -> SocialFeedUiState.Empty
            else -> SocialFeedUiState.Success(posts, hasMore, isLoadingMore)
        }
    }

    private fun mergedPosts(): List<SocialFeedPost> =
        mergePosts(firstPagePosts, historicalPosts)

    private fun mergePosts(
        preferred: List<SocialFeedPost>,
        additional: List<SocialFeedPost>
    ): List<SocialFeedPost> = (preferred + additional)
        .distinctBy { it.key() }
        .sortedByDescending { it.post.createdAt?.time ?: 0L }

    private fun SocialFeedPost.key(): String = "${post.groupId}_${post.id}"
}
