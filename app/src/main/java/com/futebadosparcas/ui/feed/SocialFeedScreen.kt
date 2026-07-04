package com.futebadosparcas.ui.feed

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.R
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateType
import com.futebadosparcas.ui.components.states.LoadingItemType
import com.futebadosparcas.ui.components.states.LoadingState
import com.futebadosparcas.ui.groups.WallPostCard
import kotlinx.coroutines.launch
import org.koin.compose.viewmodel.koinViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SocialFeedScreen(
    onNavigateBack: () -> Unit,
    onOpenGroup: (String) -> Unit,
    onDiscoverGroups: () -> Unit,
    viewModel: SocialFeedViewModel = koinViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val hiddenSuccess = stringResource(R.string.social_feed_hidden_success)
    val hiddenError = stringResource(R.string.social_feed_hidden_error)
    val reportSuccess = stringResource(R.string.social_feed_report_success)
    val reportError = stringResource(R.string.social_feed_report_error)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.social_feed_title)) },
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
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { paddingValues ->
        when (val state = uiState) {
            SocialFeedUiState.Loading -> {
                LoadingState(
                    shimmerCount = 4,
                    itemType = LoadingItemType.CARD,
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                )
            }
            SocialFeedUiState.EmptyGroups -> {
                EmptyState(
                    type = EmptyStateType.NoData(
                        title = stringResource(R.string.social_feed_empty_groups_title),
                        description = stringResource(R.string.social_feed_empty_groups_desc),
                        icon = Icons.Default.Groups,
                        actionLabel = stringResource(R.string.discover_groups_title),
                        onAction = onDiscoverGroups
                    ),
                    modifier = Modifier.padding(paddingValues)
                )
            }
            SocialFeedUiState.Empty -> {
                EmptyState(
                    type = EmptyStateType.NoData(
                        title = stringResource(R.string.social_feed_empty_title),
                        description = stringResource(R.string.social_feed_empty_desc),
                        icon = Icons.Default.Groups
                    ),
                    modifier = Modifier.padding(paddingValues)
                )
            }
            is SocialFeedUiState.Error -> {
                EmptyState(
                    type = EmptyStateType.Error(
                        title = stringResource(R.string.error),
                        description = state.message,
                        actionLabel = stringResource(R.string.retry),
                        onRetry = viewModel::load
                    ),
                    modifier = Modifier.padding(paddingValues)
                )
            }
            is SocialFeedUiState.Success -> {
                val currentUserId = viewModel.currentUserId()
                LazyColumn(
                    contentPadding = PaddingValues(
                        start = 16.dp,
                        top = paddingValues.calculateTopPadding() + 16.dp,
                        end = 16.dp,
                        bottom = 16.dp
                    ),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(state.posts, key = { "${it.post.groupId}-${it.post.id}" }) { feedPost ->
                        WallPostCard(
                            post = feedPost.post,
                            isOwn = feedPost.post.authorId == currentUserId,
                            canManage = false,
                            currentUserId = currentUserId,
                            originLabel = feedPost.groupName,
                            onOriginClick = { onOpenGroup(feedPost.post.groupId) },
                            onToggleReaction = { emoji ->
                                viewModel.toggleReaction(feedPost, emoji)
                            },
                            onHide = {
                                viewModel.hidePost(feedPost) { success ->
                                    scope.launch {
                                        snackbarHostState.showSnackbar(
                                            if (success) hiddenSuccess else hiddenError
                                        )
                                    }
                                }
                            },
                            onReport = {
                                viewModel.reportPost(feedPost) { success ->
                                    scope.launch {
                                        snackbarHostState.showSnackbar(
                                            if (success) reportSuccess else reportError
                                        )
                                    }
                                }
                            }
                        )
                    }
                }
            }
        }
    }
}
