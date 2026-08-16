package com.futebadosparcas.ui.groups

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.R
import com.futebadosparcas.data.model.GroupWallPost
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateType
import com.futebadosparcas.ui.components.states.LoadingItemType
import com.futebadosparcas.ui.components.states.LoadingState
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.distinctUntilChanged
import org.koin.compose.viewmodel.koinViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GroupWallScreen(
    groupId: String,
    canPost: Boolean,
    canManage: Boolean,
    onNavigateBack: () -> Unit,
    viewModel: GroupWallViewModel = koinViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val actionState by viewModel.actionState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState()
    var clearDraftSignal by remember(groupId) { mutableIntStateOf(0) }
    var editingPost by remember { mutableStateOf<GroupWallPost?>(null) }
    var deletingPost by remember { mutableStateOf<GroupWallPost?>(null) }
    var lightboxUrl by remember { mutableStateOf<String?>(null) }
    val sendingState = actionState as? GroupWallActionState.Sending

    LaunchedEffect(groupId) {
        viewModel.observePosts(groupId)
    }

    val paginationState = uiState as? GroupWallUiState.Success
    val latestPaginationState by rememberUpdatedState(paginationState)
    LaunchedEffect(groupId, listState) {
        snapshotFlow {
            val state = latestPaginationState ?: return@snapshotFlow false
            val layoutInfo = listState.layoutInfo
            shouldRequestMoreWallPosts(
                hasMore = state.hasMore,
                loadingMore = state.loadingMore,
                hasLoadMoreError = state.loadMoreError != null,
                postsEmpty = state.posts.isEmpty(),
                lastVisibleItemIndex = layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: -1,
                totalItems = layoutInfo.totalItemsCount
            )
        }
            .distinctUntilChanged()
            .collect { nearEnd ->
                if (nearEnd) viewModel.loadMore(groupId)
            }
    }

    LaunchedEffect(actionState) {
        when (val action = actionState) {
            is GroupWallActionState.PostCreated -> {
                clearDraftSignal++
                snackbarHostState.showSnackbar(action.message)
                viewModel.resetActionState()
            }
            is GroupWallActionState.Success -> {
                snackbarHostState.showSnackbar(action.message)
                viewModel.resetActionState()
            }
            is GroupWallActionState.Error -> {
                snackbarHostState.showSnackbar(action.message)
                viewModel.resetActionState()
            }
            else -> {}
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.group_wall_title)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.back)
                        )
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            Box(modifier = Modifier.weight(1f)) {
                when (val state = uiState) {
                    is GroupWallUiState.Loading -> {
                        LoadingState(
                            shimmerCount = 4,
                            itemType = LoadingItemType.CARD
                        )
                    }
                    is GroupWallUiState.Empty -> {
                        EmptyState(
                            type = EmptyStateType.NoData(
                                title = stringResource(R.string.group_wall_empty_title),
                                description = stringResource(R.string.group_wall_empty_desc)
                            )
                        )
                    }
                    is GroupWallUiState.Error -> {
                        EmptyState(
                            type = EmptyStateType.Error(
                                title = stringResource(R.string.error),
                                description = state.message,
                                actionLabel = stringResource(R.string.retry),
                                onRetry = { viewModel.observePosts(groupId) }
                            )
                        )
                    }
                    is GroupWallUiState.Success -> {
                        val pinned = remember(state.posts) { state.posts.filter { it.pinned } }
                        val regular = remember(state.posts) { state.posts.filter { !it.pinned } }
                        val currentUserId = viewModel.currentUserId()

                        LazyColumn(
                            state = listState,
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier.fillMaxSize()
                        ) {
                            items(pinned, key = { "pinned-${it.id}" }) { post ->
                                WallPostCard(
                                    post = post,
                                    isOwn = viewModel.isCurrentUser(post.authorId),
                                    canManage = canManage,
                                    currentUserId = currentUserId,
                                    onEdit = if (viewModel.isCurrentUser(post.authorId)) {
                                        { editingPost = post }
                                    } else null,
                                    onDelete = { deletingPost = post },
                                    onTogglePin = if (canManage) {
                                        { viewModel.togglePin(groupId, post.id, !post.pinned) }
                                    } else null,
                                    onToggleReaction = { emoji ->
                                        viewModel.toggleReaction(groupId, post, emoji)
                                    },
                                    onImageClick = { lightboxUrl = it }
                                )
                            }

                            items(regular, key = { it.id }) { post ->
                                WallPostCard(
                                    post = post,
                                    isOwn = viewModel.isCurrentUser(post.authorId),
                                    canManage = canManage,
                                    currentUserId = currentUserId,
                                    onEdit = if (viewModel.isCurrentUser(post.authorId)) {
                                        { editingPost = post }
                                    } else null,
                                    onDelete = { deletingPost = post },
                                    onTogglePin = if (canManage) {
                                        { viewModel.togglePin(groupId, post.id, !post.pinned) }
                                    } else null,
                                    onToggleReaction = { emoji ->
                                        viewModel.toggleReaction(groupId, post, emoji)
                                    },
                                    onImageClick = { lightboxUrl = it }
                                )
                            }

                            if (state.loadingMore) {
                                item(key = "wall-loading-more") {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(16.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        CircularProgressIndicator()
                                    }
                                }
                            } else if (state.loadMoreError != null) {
                                item(key = "wall-load-more-error") {
                                    Column(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(vertical = 12.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally
                                    ) {
                                        Text(
                                            text = state.loadMoreError,
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.error
                                        )
                                        TextButton(onClick = { viewModel.loadMore(groupId) }) {
                                            Text(stringResource(R.string.retry))
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (canPost) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                ) {
                    WallPostComposer(
                        sending = sendingState != null,
                        clearDraftSignal = clearDraftSignal,
                        uploadProgress = sendingState?.progress ?: 0,
                        processing = sendingState?.processing == true,
                        onSubmit = { text, mediaUri ->
                            viewModel.createPost(groupId, text, mediaUri)
                        },
                        onImageError = { message ->
                            scope.launch {
                                snackbarHostState.showSnackbar(message)
                            }
                        },
                        onCancelUpload = viewModel::cancelPostUpload
                    )
                }
            } else if (uiState is GroupWallUiState.Success) {
                Text(
                    text = stringResource(R.string.group_wall_must_be_member),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .align(Alignment.CenterHorizontally)
                        .padding(16.dp)
                )
            }
        }
    }

    if (editingPost != null) {
        AlertDialog(
            onDismissRequest = { editingPost = null },
            title = { Text(stringResource(R.string.group_wall_edit_post)) },
            text = {
                WallPostComposer(
                    sending = actionState is GroupWallActionState.Editing,
                    initialText = editingPost!!.text,
                    mediaEnabled = false,
                    onSubmit = { text, _ ->
                        viewModel.editPost(groupId, editingPost!!.id, text)
                        editingPost = null
                    },
                    onImageError = { message ->
                        scope.launch {
                            snackbarHostState.showSnackbar(message)
                        }
                    }
                )
            },
            confirmButton = {},
            dismissButton = {
                TextButton(onClick = { editingPost = null }) {
                    Text(stringResource(R.string.cancel))
                }
            }
        )
    }

    if (deletingPost != null) {
        AlertDialog(
            onDismissRequest = { deletingPost = null },
            title = { Text(stringResource(R.string.group_wall_delete_confirm)) },
            text = { Text(stringResource(R.string.group_wall_delete_message)) },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.deletePost(groupId, deletingPost!!)
                        deletingPost = null
                    }
                ) {
                    Text(stringResource(R.string.delete))
                }
            },
            dismissButton = {
                TextButton(onClick = { deletingPost = null }) {
                    Text(stringResource(R.string.cancel))
                }
            }
        )
    }

    if (lightboxUrl != null) {
        AlertDialog(
            onDismissRequest = { lightboxUrl = null },
            text = {
                AsyncImage(
                    model = lightboxUrl,
                    contentDescription = null,
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                TextButton(onClick = { lightboxUrl = null }) {
                    Text(stringResource(R.string.close))
                }
            }
        )
    }
}

@Composable
private fun AsyncImage(model: String?, contentDescription: String?, modifier: Modifier = Modifier) {
    coil3.compose.AsyncImage(
        model = model,
        contentDescription = contentDescription,
        modifier = modifier
    )
}

internal fun shouldLoadMoreWallPosts(
    lastVisibleItemIndex: Int,
    totalItems: Int,
    prefetchDistance: Int = 4
): Boolean {
    if (lastVisibleItemIndex < 0 || totalItems <= 0) return false
    val triggerIndex = (totalItems - 1 - prefetchDistance.coerceAtLeast(0)).coerceAtLeast(0)
    return lastVisibleItemIndex >= triggerIndex
}

internal fun shouldRequestMoreWallPosts(
    hasMore: Boolean,
    loadingMore: Boolean,
    hasLoadMoreError: Boolean,
    postsEmpty: Boolean,
    lastVisibleItemIndex: Int,
    totalItems: Int
): Boolean = hasMore &&
    !loadingMore &&
    !hasLoadMoreError &&
    (
        postsEmpty || shouldLoadMoreWallPosts(
            lastVisibleItemIndex = lastVisibleItemIndex,
            totalItems = totalItems
        )
    )
