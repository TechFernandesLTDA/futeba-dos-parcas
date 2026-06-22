package com.futebadosparcas.ui.core

import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.filled.PersonSearch
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.SearchOff
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.ui.UiStrings

// ---------- Componentes auxiliares (para evitar dependências do módulo :app) ----------

/**
 * Placeholder shimmer simples (sem animação real, apenas um bloco com cor variante).
 */
@Composable
private fun ShimmerBox(modifier: Modifier = Modifier) {
    val infiniteTransition = rememberInfiniteTransition(label = "shimmer")
    val alpha by infiniteTransition.animateFloat(
        initialValue = 0.3f,
        targetValue = 0.7f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 800)
        ),
        label = "alpha"
    )
    Box(
        modifier = modifier
            .graphicsLayer(alpha = alpha)
            .background(
                color = MaterialTheme.colorScheme.surfaceVariant,
                shape = RoundedCornerShape(4.dp)
            )
    )
}

/**
 * Avatar com fallback.
 */
@Composable
private fun PlayerAvatar(photoUrl: String?, userName: String, modifier: Modifier = Modifier) {
    if (photoUrl != null && photoUrl.isNotBlank()) {
        AsyncImage(
            model = photoUrl,
            contentDescription = "Avatar de $userName",
            modifier = modifier.clip(CircleShape),
            contentScale = ContentScale.Crop
        )
    } else {
        Box(
            modifier = modifier
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.primaryContainer),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = userName.firstOrNull()?.toString() ?: "?",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )
        }
    }
}

/**
 * Estado vazio genérico.
 */
@Composable
private fun EmptyState(
    icon: ImageVector,
    title: String,
    description: String,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = description,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        if (actionLabel != null && onAction != null) {
            Spacer(modifier = Modifier.height(24.dp))
            Button(onClick = onAction) {
                Text(actionLabel)
            }
        }
    }
}

// ---------- Componentes da tela ----------

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InvitePlayersScreen(
    viewModel: InviteViewModel,
    groupId: String,
    onNavigateBack: () -> Unit = {}
) {
    val searchUsersState by viewModel.searchUsersState.collectAsState()
    val groupPendingInvitesState by viewModel.groupPendingInvitesState.collectAsState()
    val groupMembersState by viewModel.groupMembersState.collectAsState()
    val inviteActionState by viewModel.inviteActionState.collectAsState()

    var searchQuery by remember { mutableStateOf("") }
    val snackbarHostState = remember { SnackbarHostState() }

    // IDs de usuários já convidados e já membros
    val pendingInviteIds = remember { mutableStateOf(setOf<String>()) }
    val memberIds = remember { mutableStateOf(setOf<String>()) }

    LaunchedEffect(groupId) {
        viewModel.loadGroupPendingInvites(groupId)
        viewModel.loadGroupMembers(groupId)
        viewModel.searchUsers("") // Carrega lista inicial de usuários
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

    // Mostra feedback de ações via snackbar
    LaunchedEffect(inviteActionState) {
        when (val state = inviteActionState) {
            is InviteActionState.InviteSent -> {
                snackbarHostState.showSnackbar(state.message)
                viewModel.loadGroupPendingInvites(groupId) // Atualiza lista de convites pendentes
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
            InvitePlayersTopBar(onNavigateBack = onNavigateBack)
        },
        snackbarHost = {
            SnackbarHost(hostState = snackbarHostState)
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
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
private fun InvitePlayersTopBar(onNavigateBack: () -> Unit) {
    TopAppBar(
        title = { Text("Convidar Jogadores") },
        navigationIcon = {
            IconButton(onClick = onNavigateBack) {
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = UiStrings.CD_BACK
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
        placeholder = { Text("Buscar jogadores por nome ou email") },
        leadingIcon = {
            Icon(Icons.Default.Search, contentDescription = null)
        },
        trailingIcon = {
            if (query.isNotEmpty()) {
                IconButton(onClick = { onQueryChange("") }) {
                    Icon(Icons.Default.Close, contentDescription = UiStrings.CD_CLEAR_SEARCH)
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
                icon = Icons.Default.PersonSearch,
                title = "Nenhuma busca realizada",
                description = "Digite o nome de um jogador para encontrá-lo."
            )
        }
        is SearchUsersState.Loading -> {
            LoadingUsersList()
        }
        is SearchUsersState.Empty -> {
            EmptyState(
                icon = Icons.Default.SearchOff,
                title = "Nenhum resultado encontrado",
                description = if (searchQuery.isNotEmpty())
                    "Nenhum jogador corresponde a '$searchQuery'."
                else
                    "Nenhum jogador disponível para convite.",
                actionLabel = if (searchQuery.isNotEmpty()) "Limpar busca" else null,
                onAction = if (searchQuery.isNotEmpty()) onClearSearch else null
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
                icon = Icons.Default.Error,
                title = "Erro ao buscar jogadores",
                description = state.message,
                actionLabel = "Tentar novamente",
                onAction = onRetrySearch
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
            PlayerAvatar(
                photoUrl = user.photoUrl,
                userName = user.getDisplayName(),
                modifier = Modifier.size(48.dp)
            )

            // Nome e informação secundária
            Column(modifier = Modifier.weight(1f)) {
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
                label = { Text("Membro") },
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
