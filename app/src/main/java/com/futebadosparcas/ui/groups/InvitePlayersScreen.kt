package com.futebadosparcas.ui.groups

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.futebadosparcas.R
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.ui.components.CachedProfileImage
import com.futebadosparcas.ui.components.states.LoadingState
import com.futebadosparcas.ui.components.states.LoadingItemType
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
            when (val state = searchUsersState) {
                is SearchUsersState.Idle -> {
                    EmptySearchPrompt()
                }
                is SearchUsersState.Loading -> {
                    LoadingState(
                        shimmerCount = 8,
                        itemType = LoadingItemType.LIST_ITEM
                    )
                }
                is SearchUsersState.Empty -> {
                    EmptySearchResults()
                }
                is SearchUsersState.Success -> {
                    UsersList(
                        users = state.users,
                        pendingInviteIds = pendingInviteIds.value,
                        memberIds = memberIds.value,
                        onInviteClick = { user ->
                            viewModel.inviteUser(groupId, user.id)
                        }
                    )
                }
                is SearchUsersState.Error -> {
                    ErrorMessage(message = state.message)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun InvitePlayersTopBar(
    onNavigateBack: () -> Unit
) {
    TopAppBar(
        title = { Text("Convidar Jogadores") },
        navigationIcon = {
            IconButton(onClick = onNavigateBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar")
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
        placeholder = { Text("Buscar por nome, email ou nickname") },
        leadingIcon = {
            Icon(Icons.Default.Search, contentDescription = null)
        },
        trailingIcon = {
            if (query.isNotEmpty()) {
                IconButton(onClick = { onQueryChange("") }) {
                    Icon(Icons.Default.Close, contentDescription = "Limpar")
                }
            }
        },
        singleLine = true,
        shape = MaterialTheme.shapes.medium
    )
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
                label = { Text("Já é membro") },
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
                label = { Text("Pendente") },
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
                Text("Convidar")
            }
        }
    }
}

@Composable
private fun EmptySearchPrompt() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.Default.PersonSearch,
            contentDescription = null,
            modifier = Modifier.size(80.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Busque jogadores para convidar",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Digite o nome, email ou nickname do jogador",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
        )
    }
}

@Composable
private fun EmptySearchResults() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.Default.SearchOff,
            contentDescription = null,
            modifier = Modifier.size(80.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Nenhum jogador encontrado",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Tente buscar por outro termo",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
        )
    }
}

@Composable
private fun ErrorMessage(message: String) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.Default.Error,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.error.copy(alpha = 0.7f)
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
