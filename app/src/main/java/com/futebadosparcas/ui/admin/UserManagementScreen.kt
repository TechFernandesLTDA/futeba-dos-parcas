package com.futebadosparcas.ui.admin

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.R
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.model.UserRole
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
            title = stringResource(R.string.admin_change_permission),
            message = stringResource(
                R.string.admin_confirm_permission,
                selectedUser!!.getDisplayName(),
                selectedNewRole!!.displayName
            ),
            confirmText = stringResource(R.string.admin_confirm),
            dismissText = stringResource(R.string.cancel),
            type = ConfirmationDialogType.WARNING,
            icon = Icons.Default.Security,
            onConfirm = {
                viewModel.updateUserRole(selectedUser!!, selectedNewRole!!.name)
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
        title = { Text(stringResource(R.string.admin_manage_users)) },
        navigationIcon = {
            IconButton(onClick = onNavigateBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.back))
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
        placeholder = { Text(stringResource(R.string.admin_search_hint)) },
        leadingIcon = {
            Icon(Icons.Default.Search, contentDescription = null)
        },
        trailingIcon = {
            if (query.isNotEmpty()) {
                IconButton(onClick = { onQueryChange("") }) {
                    Icon(Icons.Default.Close, contentDescription = stringResource(R.string.admin_clear))
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
                        label = stringResource(R.string.admin_change_permission) + " ${role.displayName}",
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
            text = stringResource(R.string.admin_no_users),
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = stringResource(R.string.admin_try_search),
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
