package com.futebadosparcas.ui.groups

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.SearchOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.R
import com.futebadosparcas.data.model.Group
import com.futebadosparcas.ui.adaptive.adaptiveContentWidth
import com.futebadosparcas.ui.components.CachedProfileImage
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateType
import com.futebadosparcas.ui.components.states.ErrorState
import com.futebadosparcas.ui.components.states.LoadingItemType
import com.futebadosparcas.ui.components.states.LoadingState
import org.koin.compose.viewmodel.koinViewModel

/**
 * Tela de descoberta de grupos publicos (issue #517 Phase 1.b).
 *
 * Lista todos os grupos com is_public=true (excluindo soft-deleted).
 * Phase 1.b e read-only: usuario pode ver mas nao pode pedir para entrar.
 * Phase 2 adiciona "Pedir entrada" + aprovacao do owner.
 *
 * Espelha PR #521 (web/DiscoverGroupsScreen.tsx) para paridade Android/Web.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DiscoverGroupsScreen(
    viewModel: DiscoverGroupsViewModel = koinViewModel(),
    onGroupClick: (String) -> Unit,
    onBackClick: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val searchQuery by viewModel.searchQuery.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            DiscoverTopBar(
                onBackClick = onBackClick,
                onRefreshClick = { viewModel.load() }
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (val state = uiState) {
                is DiscoverGroupsUiState.Loading -> {
                    LoadingState(
                        shimmerCount = 6,
                        itemType = LoadingItemType.CARD
                    )
                }

                is DiscoverGroupsUiState.Error -> {
                    ErrorState(
                        message = state.message,
                        onRetry = { viewModel.load() }
                    )
                }

                is DiscoverGroupsUiState.Empty -> {
                    DiscoverEmptyContent(
                        searchQuery = searchQuery,
                        onClearSearch = { viewModel.onSearchQueryChange("") }
                    )
                }

                is DiscoverGroupsUiState.Success -> {
                    DiscoverSuccessContent(
                        groups = state.groups,
                        searchQuery = searchQuery,
                        onSearchQueryChange = viewModel::onSearchQueryChange,
                        onGroupClick = onGroupClick
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DiscoverTopBar(
    onBackClick: () -> Unit,
    onRefreshClick: () -> Unit
) {
    TopAppBar(
        title = {
            Text(
                text = stringResource(R.string.discover_groups_title),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
        },
        navigationIcon = {
            IconButton(onClick = onBackClick) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(R.string.cd_back)
                )
            }
        },
        actions = {
            IconButton(onClick = onRefreshClick) {
                Icon(
                    imageVector = Icons.Default.Refresh,
                    contentDescription = stringResource(R.string.cd_refresh)
                )
            }
        }
    )
}

@Composable
private fun DiscoverSuccessContent(
    groups: List<Group>,
    searchQuery: String,
    onSearchQueryChange: (String) -> Unit,
    onGroupClick: (String) -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .adaptiveContentWidth(),
        contentPadding = PaddingValues(vertical = 8.dp)
    ) {
        item {
            DiscoverSearchBar(
                query = searchQuery,
                onQueryChange = onSearchQueryChange,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
            )
        }

        items(
            items = groups,
            key = { it.id }
        ) { group ->
            DiscoverGroupCard(
                group = group,
                onClick = { onGroupClick(group.id) },
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)
            )
        }
    }
}

@Composable
private fun DiscoverEmptyContent(
    searchQuery: String,
    onClearSearch: () -> Unit
) {
    if (searchQuery.isNotBlank()) {
        EmptyState(
            type = EmptyStateType.NoResults(
                description = stringResource(R.string.discover_groups_no_results, searchQuery),
                icon = Icons.Default.SearchOff,
                actionLabel = stringResource(R.string.discover_groups_clear_search),
                onAction = onClearSearch
            )
        )
    } else {
        EmptyState(
            type = EmptyStateType.NoData(
                title = stringResource(R.string.discover_groups_empty_title),
                description = stringResource(R.string.discover_groups_empty_description),
                icon = Icons.Default.Public
            )
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DiscoverSearchBar(
    query: String,
    onQueryChange: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    TextField(
        value = query,
        onValueChange = onQueryChange,
        modifier = modifier.fillMaxWidth(),
        placeholder = {
            Text(text = stringResource(R.string.discover_groups_search_hint))
        },
        leadingIcon = {
            Icon(
                imageVector = Icons.Default.Search,
                contentDescription = stringResource(R.string.search),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        },
        trailingIcon = {
            if (query.isNotEmpty()) {
                IconButton(onClick = { onQueryChange("") }) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = stringResource(R.string.close),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        },
        shape = RoundedCornerShape(28.dp),
        colors = TextFieldDefaults.colors(
            focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
            unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
            focusedIndicatorColor = Color.Transparent,
            unfocusedIndicatorColor = Color.Transparent,
            disabledIndicatorColor = Color.Transparent
        ),
        singleLine = true
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DiscoverGroupCard(
    group: Group,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        onClick = onClick,
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
        ),
        elevation = CardDefaults.cardElevation(
            defaultElevation = 2.dp,
            pressedElevation = 6.dp
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            CachedProfileImage(
                photoUrl = group.photoUrl,
                userName = group.name,
                modifier = Modifier.size(56.dp),
                size = 56.dp
            )

            Spacer(modifier = Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = group.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                if (group.description.isNotBlank()) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = group.description,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    PublicChip()
                    MemberCountChip(memberCount = group.memberCount)
                }
            }
        }
    }
}

@Composable
private fun PublicChip() {
    AssistChip(
        onClick = { },
        enabled = false,
        label = {
            Text(
                text = stringResource(R.string.discover_groups_chip_public),
                style = MaterialTheme.typography.labelSmall
            )
        },
        leadingIcon = {
            Icon(
                imageVector = Icons.Default.Public,
                contentDescription = null,
                modifier = Modifier.size(16.dp)
            )
        },
        colors = AssistChipDefaults.assistChipColors(
            disabledContainerColor = MaterialTheme.colorScheme.primaryContainer,
            disabledLabelColor = MaterialTheme.colorScheme.onPrimaryContainer,
            disabledLeadingIconContentColor = MaterialTheme.colorScheme.onPrimaryContainer
        )
    )
}

@Composable
private fun MemberCountChip(memberCount: Int) {
    AssistChip(
        onClick = { },
        enabled = false,
        label = {
            Text(
                text = stringResource(
                    R.string.discover_groups_chip_member_count,
                    memberCount,
                    if (memberCount == 1) "membro" else "membros"
                ),
                style = MaterialTheme.typography.labelSmall
            )
        },
        leadingIcon = {
            Icon(
                imageVector = Icons.Default.People,
                contentDescription = null,
                modifier = Modifier.size(16.dp)
            )
        },
        colors = AssistChipDefaults.assistChipColors(
            disabledContainerColor = MaterialTheme.colorScheme.surfaceContainer,
            disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
            disabledLeadingIconContentColor = MaterialTheme.colorScheme.onSurfaceVariant
        )
    )
}
