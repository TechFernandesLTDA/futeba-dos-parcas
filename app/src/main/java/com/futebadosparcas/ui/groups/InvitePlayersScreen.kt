package com.futebadosparcas.ui.groups

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.PersonSearch
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.SearchOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.futebadosparcas.R
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateType
import com.futebadosparcas.ui.components.lists.ShimmerBox
import com.futebadosparcas.ui.theme.systemBarsPadding

/**
 * InvitePlayersScreen - Convidar jogadores para grupo
 *
 * Screen Compose para buscar e convidar jogadores para um grupo.
 * Exibe lista de usuários com botões de convite que indicam status (já membro, pendente, convidar).
 */
@Composable
fun InvitePlayersScreen(
    viewModel: InviteViewModel,
    groupId: String,
    onNavigateBack: () -> Unit = {}
) {
    val searchUsersState by viewModel.searchUsersState.collectAsStateWithLifecycle()
    val groupPendingInvitesState by viewModel.groupPendingInvitesState.collectAsStateWithLifecycle()
    val groupMembersState by viewModel.groupMembersState.collectAsStateWithLifecycle()
    val inviteActionState by viewModel.inviteActionState.collectAsStateWithLifecycle()

    var searchQuery by remember { mutableStateOf("") }
    val snackbarHostState = remember { SnackbarHostState() }

    // IDs de usuários já convidados e já membros
    val pendingInviteIds = remember { mutableStateOf(setOf<String>()) }
    val memberIds = remember { mutableStateOf(setOf<String>()) }

    LaunchedEffect(groupId) {
        viewModel.loadGroupPendingInvites(groupId)
        viewModel.loadGroupMembers(groupId)
        viewModel.searchUsers("") // Load initial users
    }

    // Observa convites pendentes
    LaunchedEffect(groupPendingInvitesState) {
        if (groupPendingInvitesState is GroupPendingInvitesState.Success) {
            pendingInviteIds.value = (groupPendingInvitesState as GroupPendingInvitesState.Success)
                .invites.map { it.invitedUserId }.toSet()
        }
    }

    // Observa membros do grupo
    LaunchedEffect(groupMembersState) {
        if (groupMembersState is GroupMembersState.Success) {
            memberIds.value = (groupMembersState as GroupMembersState.Success)
                .members.map { it.userId }.toSet()
        }
    }

    // Mostra feedback de ações
    LaunchedEffect(inviteActionState) {
        when (val state = inviteActionState) {
            is InviteActionState.InviteSent -> {
                snackbarHostState.showSnackbar(state.message)
                viewModel.loadGroupPendingInvites(groupId) // Atualiza convites pendentes
                viewModel.resetActionState()
            }
            is InviteActionState.Error -> {
                snackbarHostState.showSnackbar(state.message)
                viewModel.resetActionState()
            }
            else -> {}
        }
    }

    Scaffold(
        topBar = {
            InvitePlayersTopBar(
                onNavigateBack = onNavigateBack
            )
        },
        snackbarHost = {
            SnackbarHost(hostState = snackbarHostState)
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .systemBarsPadding()
        ) {
            // Campo de busca
            SearchField(
                query = searchQuery,
                onQueryChange = { query ->
                    searchQuery = query
                    viewModel.searchUsers(query)
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
            )

            // Conteúdo baseado no estado
            InvitePlayersContent(
                state = searchUsersState,
                pendingInviteIds = pendingInviteIds.value,
                memberIds = memberIds.value,
                searchQuery = searchQuery,
                onInviteClick = { user ->
                    viewModel.inviteUser(groupId, user.id)
                },
                onRetrySearch = {
                    viewModel.searchUsers(searchQuery)
                },
                onClearSearch = {
                    searchQuery = ""
                    viewModel.searchUsers("")
                }
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun InvitePlayersTopBar(
    onNavigateBack: () -> Unit
) {
    TopAppBar(
        title = { Text(stringResource(R.string.invite_players_title)) },
        navigationIcon = {
            IconButton(onClick = onNavigateBack) {
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(R.string.invite_players_back)
                )
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    )
}

@Composable
private fun SearchField(
    query: String,
    onQueryChange: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    OutlinedTextField(
        value = query,
        onValueChange = onQueryChange,
        modifier = modifier,
        placeholder = { Text(stringResource(R.string.invite_players_search_hint)) },
        leadingIcon = {
            Icon(
                Icons.Default.Search,
                contentDescription = stringResource(R.string.invite_players_search_icon)
            )
        },
        trailingIcon = {
            if (query.isNotEmpty()) {
                IconButton(onClick = { onQueryChange("") }) {
                    Icon(
                        Icons.Default.Close,
                        contentDescription = stringResource(R.string.invite_players_clear)
                    )
                }
            }
        },
        singleLine = true,
        shape = MaterialTheme.shapes.medium
    )
}

@Composable
private fun InvitePlayersContent(
    state: SearchUsersState,
    pendingInviteIds: Set<String>,
    memberIds: Set<String>,
    searchQuery: String,
    onInviteClick: (User) -> Unit,
    onRetrySearch: () -> Unit,
    onClearSearch: () -> Unit
) {
    when (state) {
        is SearchUsersState.Idle -> {
            EmptyState(
                type = EmptyStateType.NoData(
                    title = stringResource(R.string.invite_players_empty_title),
                    description = stringResource(R.string.invite_players_empty_description),
                    icon = Icons.Default.PersonSearch
                )
            )
        }
        is SearchUsersState.Loading -> {
            LoadingUsersList()
        }
        is SearchUsersState.Empty -> {
            EmptyState(
                type = EmptyStateType.NoResults(
                    title = stringResource(R.string.invite_players_no_results_title),
                    description = stringResource(R.string.invite_players_no_results_description),
                    icon = Icons.Default.SearchOff,
                    actionLabel = if (searchQuery.isNotEmpty()) {
                        stringResource(R.string.action_clear_search)
                    } else null,
                    onAction = if (searchQuery.isNotEmpty()) onClearSearch else null
                )
            )
        }
        is SearchUsersState.Success -> {
            UsersList(
                users = state.users,
                pendingInviteIds = pendingInviteIds,
                memberIds = memberIds,
                onInviteClick = onInviteClick
            )
        }
        is SearchUsersState.Error -> {
            EmptyState(
                type = EmptyStateType.Error(
                    title = stringResource(R.string.invite_players_error_title),
                    description = state.message,
                    icon = Icons.Default.Error,
                    actionLabel = stringResource(R.string.invite_players_try_again),
                    onRetry = onRetrySearch
                )
            )
        }
    }
}

@Composable
private fun LoadingUsersList() {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(8) {
            UserItemShimmer()
        }
    }
}

@Composable
private fun UserItemShimmer() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Avatar shimmer
            ShimmerBox(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
            )

            Column(modifier = Modifier.weight(1f)) {
                ShimmerBox(
                    modifier = Modifier
                        .fillMaxWidth(0.6f)
                        .height(20.dp)
                )
                Spacer(modifier = Modifier.height(4.dp))
                ShimmerBox(
                    modifier = Modifier
                        .fillMaxWidth(0.4f)
                        .height(14.dp)
                )
            }

            // Botão shimmer
            ShimmerBox(
                modifier = Modifier
                    .width(80.dp)
                    .height(36.dp)
            )
        }
    }
}

@Composable
private fun UsersList(
    users: List<User>,
    pendingInviteIds: Set<String>,
    memberIds: Set<String>,
    onInviteClick: (User) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(users, key = { it.id }) { user ->
            InvitePlayerCard(
                user = user,
                isPending = pendingInviteIds.contains(user.id),
                isMember = memberIds.contains(user.id),
                onInviteClick = { onInviteClick(user) }
            )
        }
    }
}

@Composable
private fun InvitePlayerCard(
    user: User,
    isPending: Boolean,
    isMember: Boolean,
    onInviteClick: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Avatar
            CachedProfileImage(
                photoUrl = user.photoUrl,
                userName = user.getDisplayName(),
                size = 48.dp
            )

            // Nome e info secundária
            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = user.getDisplayName(),
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSurface
                )

                val secondaryInfo = when {
                    !user.nickname.isNullOrEmpty() -> "@${user.nickname}"
                    user.email.isNotEmpty() -> user.email
                    else -> null
                }

                if (secondaryInfo != null) {
                    Text(
                        text = secondaryInfo,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Botão de convite com estados
            InviteButton(
                isMember = isMember,
                isPending = isPending,
                onClick = onInviteClick
            )
        }
    }
}

@Composable
private fun InviteButton(
    isMember: Boolean,
    isPending: Boolean,
    onClick: () -> Unit
) {
    when {
        isMember -> {
            AssistChip(
                onClick = { },
                label = { Text(stringResource(R.string.invite_players_already_member)) },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                },
                colors = AssistChipDefaults.assistChipColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant,
                    labelColor = MaterialTheme.colorScheme.onSurfaceVariant,
                    leadingIconContentColor = MaterialTheme.colorScheme.onSurfaceVariant
                ),
                enabled = false
            )
        }
        isPending -> {
            AssistChip(
                onClick = { },
                label = { Text(stringResource(R.string.invite_players_pending)) },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.Schedule,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                },
                colors = AssistChipDefaults.assistChipColors(
                    containerColor = MaterialTheme.colorScheme.secondaryContainer,
                    labelColor = MaterialTheme.colorScheme.onSecondaryContainer,
                    leadingIconContentColor = MaterialTheme.colorScheme.onSecondaryContainer
                ),
                enabled = false
            )
        }
        else -> {
            Button(
                onClick = onClick,
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.PersonAdd,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(stringResource(R.string.invite_players_invite_button))
            }
        }
    }
}
