package com.futebadosparcas.ui.admin

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.data.model.User
import com.futebadosparcas.data.model.UserRole
import com.futebadosparcas.ui.components.cards.UserCard
import com.futebadosparcas.ui.components.cards.UserCardMenuItem
import com.futebadosparcas.ui.components.dialogs.ConfirmationDialog
import com.futebadosparcas.ui.components.dialogs.ConfirmationDialogType
import com.futebadosparcas.ui.components.states.ErrorState
import com.futebadosparcas.ui.components.states.LoadingState
import com.futebadosparcas.ui.components.states.LoadingItemType
import com.futebadosparcas.ui.theme.systemBarsPadding

/**
 * UserManagementScreen - Gerenciamento de usuários (admin)
 *
 * Screen Compose para administradores gerenciarem permissões de usuários.
 * Permite buscar usuários e alterar seus níveis de acesso.
 */
@Composable
fun UserManagementScreen(
    viewModel: UserManagementViewModel,
    onNavigateBack: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var searchQuery by remember { mutableStateOf("") }
    var showRoleChangeDialog by remember { mutableStateOf(false) }
    var selectedUser by remember { mutableStateOf<User?>(null) }
    var selectedNewRole by remember { mutableStateOf<UserRole?>(null) }

    // Dialog de confirmação de mudança de role
    if (showRoleChangeDialog && selectedUser != null && selectedNewRole != null) {
        ConfirmationDialog(
            visible = true,
            title = "Alterar Permissão",
            message = "Tem certeza que deseja alterar o nível de acesso de ${selectedUser!!.getDisplayName()} para ${selectedNewRole!!.displayName}?",
            confirmText = "Confirmar",
            dismissText = "Cancelar",
            type = ConfirmationDialogType.WARNING,
            icon = Icons.Default.Security,
            onConfirm = {
                viewModel.updateUserRole(selectedUser!!, selectedNewRole!!)
                showRoleChangeDialog = false
                selectedUser = null
                selectedNewRole = null
            },
            onDismiss = {
                showRoleChangeDialog = false
                selectedUser = null
                selectedNewRole = null
            }
        )
    }

    Scaffold(
        topBar = {
            UserManagementTopBar(
                onNavigateBack = onNavigateBack
            )
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
            when (val state = uiState) {
                is UserManagementUiState.Loading -> {
                    LoadingState(
                        shimmerCount = 8,
                        itemType = LoadingItemType.LIST_ITEM
                    )
                }
                is UserManagementUiState.Success -> {
                    if (state.users.isEmpty()) {
                        EmptySearchResults()
                    } else {
                        UsersList(
                            users = state.users,
                            onRoleChangeRequested = { user, newRole ->
                                selectedUser = user
                                selectedNewRole = newRole
                                showRoleChangeDialog = true
                            }
                        )
                    }
                }
                is UserManagementUiState.Error -> {
                    ErrorState(
                        message = state.message,
                        onRetry = { viewModel.loadUsers() }
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun UserManagementTopBar(
    onNavigateBack: () -> Unit
) {
    TopAppBar(
        title = { Text("Gerenciar Usuários") },
        navigationIcon = {
            IconButton(onClick = onNavigateBack) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Voltar")
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
        placeholder = { Text("Buscar por nome ou email") },
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
    onRoleChangeRequested: (User, UserRole) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(users, key = { it.id }) { user ->
            UserManagementCard(
                user = user,
                onRoleChangeRequested = onRoleChangeRequested
            )
        }
    }
}

@Composable
private fun UserManagementCard(
    user: User,
    onRoleChangeRequested: (User, UserRole) -> Unit
) {
    val currentRole = user.getRoleEnum()
    val (roleIcon, roleColor) = getRoleIconAndColor(currentRole)

    // Menu items para trocar role (exclui o role atual)
    val menuItems = buildList {
        UserRole.entries.forEach { role ->
            if (role != currentRole) {
                val (icon, _) = getRoleIconAndColor(role)
                add(
                    UserCardMenuItem(
                        label = "Alterar para ${role.displayName}",
                        icon = icon,
                        isDestructive = false,
                        onClick = { onRoleChangeRequested(user, role) }
                    )
                )
            }
        }
    }

    UserCard(
        photoUrl = user.photoUrl,
        name = user.getDisplayName(),
        subtitle = user.email,
        badge = currentRole.displayName,
        badgeColor = roleColor,
        badgeIcon = roleIcon,
        onClick = null, // Sem ação no clique do card
        showMenu = true,
        menuItems = menuItems
    )
}

@Composable
private fun EmptySearchResults() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.Default.SearchOff,
            contentDescription = null,
            modifier = Modifier.size(80.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Nenhum usuário encontrado",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Tente buscar por outro nome ou email",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
        )
    }
}

/**
 * Retorna ícone e cor para cada tipo de role
 */
@Composable
private fun getRoleIconAndColor(role: UserRole): Pair<ImageVector, androidx.compose.ui.graphics.Color> {
    return when (role) {
        UserRole.ADMIN -> Icons.Default.Shield to MaterialTheme.colorScheme.error
        UserRole.FIELD_OWNER -> Icons.Default.Stadium to MaterialTheme.colorScheme.primary
        UserRole.PLAYER -> Icons.Default.Person to MaterialTheme.colorScheme.secondary
    }
}
