package com.futebadosparcas.ui.groups

import android.net.Uri
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
import androidx.compose.material.icons.filled.ChatBubbleOutline
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
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
    val listState = rememberLazyListState()
    var showComposer by remember { mutableStateOf(false) }
    var editingPost by remember { mutableStateOf<GroupWallPost?>(null) }
    var deletingPost by remember { mutableStateOf<GroupWallPost?>(null) }
    var lightboxUrl by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(groupId) {
        viewModel.observePosts(groupId)
    }

    LaunchedEffect(actionState) {
        when (val action = actionState) {
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
        floatingActionButton = {
            if (canPost && !showComposer) {
                FloatingActionButton(onClick = { showComposer = true }) {
                    Icon(
                        imageVector = Icons.Default.ChatBubbleOutline,
                        contentDescription = stringResource(R.string.group_wall_create_post)
                    )
                }
            }
        },
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
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
                    val pinned = state.posts.filter { it.pinned }
                    val regular = state.posts.filter { !it.pinned }

                    LazyColumn(
                        state = listState,
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        if (showComposer && canPost) {
                            item(key = "composer") {
                                WallPostComposer(
                                    sending = actionState is GroupWallActionState.Sending,
                                    onSubmit = { text, imageUri ->
                                        viewModel.createPost(groupId, text, imageUri)
                                        showComposer = false
                                    },
                                    onCancel = { showComposer = false }
                                )
                            }
                        }

                        items(pinned, key = { "pinned-${it.id}" }) { post ->
                            WallPostCard(
                                post = post,
                                isOwn = viewModel.isCurrentUser(post.authorId),
                                canManage = canManage,
                                onEdit = if (viewModel.isCurrentUser(post.authorId)) {
                                    { editingPost = post }
                                } else null,
                                onDelete = { deletingPost = post },
                                onTogglePin = if (canManage) {
                                    { viewModel.togglePin(groupId, post.id, !post.pinned) }
                                } else null,
                                onImageClick = { lightboxUrl = it }
                            )
                        }

                        items(regular, key = { it.id }) { post ->
                            WallPostCard(
                                post = post,
                                isOwn = viewModel.isCurrentUser(post.authorId),
                                canManage = canManage,
                                onEdit = if (viewModel.isCurrentUser(post.authorId)) {
                                    { editingPost = post }
                                } else null,
                                onDelete = { deletingPost = post },
                                onTogglePin = if (canManage) {
                                    { viewModel.togglePin(groupId, post.id, !post.pinned) }
                                } else null,
                                onImageClick = { lightboxUrl = it }
                            )
                        }
                    }
                }
            }

            if (uiState is GroupWallUiState.Success && !canPost) {
                Text(
                    text = stringResource(R.string.group_wall_must_be_member),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
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
                    onSubmit = { text, _ ->
                        viewModel.editPost(groupId, editingPost!!.id, text)
                        editingPost = null
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
