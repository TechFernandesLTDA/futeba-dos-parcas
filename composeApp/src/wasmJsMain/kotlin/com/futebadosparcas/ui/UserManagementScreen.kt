package com.futebadosparcas.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.futebadosparcas.firebase.FirebaseManager
import com.futebadosparcas.firebase.FirebaseManager.AdminUser
import kotlinx.coroutines.launch

private sealed class UserManagementState {
    object Loading : UserManagementState()
    data class Success(val users: List<AdminUser>, val filteredUsers: List<AdminUser>) : UserManagementState()
    data class Error(val message: String) : UserManagementState()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UserManagementScreen(
    onBackClick: () -> Unit = {}
) {
    val scope = rememberCoroutineScope()
    var uiState by remember { mutableStateOf<UserManagementState>(UserManagementState.Loading) }
    var searchQuery by remember { mutableStateOf("") }
    var selectedUser by remember { mutableStateOf<AdminUser?>(null) }
    var showRoleDialog by remember { mutableStateOf(false) }
    var showUserDetails by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        scope.launch {
            try {
                val users = FirebaseManager.getAllUsers()
                uiState = UserManagementState.Success(users, users)
            } catch (e: Exception) {
                uiState = UserManagementState.Error(e.message ?: "Erro ao carregar usuários")
            }
        }
    }

    LaunchedEffect(searchQuery, uiState) {
        if (uiState is UserManagementState.Success) {
            val state = uiState as UserManagementState.Success
            val filtered = if (searchQuery.isBlank()) {
                state.users
            } else {
                state.users.filter {
                    it.name.contains(searchQuery, ignoreCase = true) ||
                    it.email.contains(searchQuery, ignoreCase = true)
                }
            }
            uiState = UserManagementState.Success(state.users, filtered)
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = {
                Text(
                    text = "👥 Gerenciar Usuários",
                    fontWeight = FontWeight.Bold
                )
            },
            navigationIcon = {
                IconButton(onClick = onBackClick) {
                    Text("←", style = MaterialTheme.typography.titleLarge)
                }
            },
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = MaterialTheme.colorScheme.primaryContainer,
                titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
            )
        )

        when (val state = uiState) {
            is UserManagementState.Loading -> UserManagementLoading()
            is UserManagementState.Success -> {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp)
                ) {
                    Spacer(modifier = Modifier.height(8.dp))

                    OutlinedTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("Buscar por nome ou email...") },
                        leadingIcon = { Text("🔍") },
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp)
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "${state.filteredUsers.size} usuários encontrados",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        RoleFilterChips(
                            onFilterChange = { role ->
                                scope.launch {
                                    val allUsers = (uiState as UserManagementState.Success).users
                                    val filtered = if (role == null) {
                                        allUsers
                                    } else {
                                        allUsers.filter { it.role == role }
                                    }
                                    val searchFiltered = if (searchQuery.isBlank()) {
                                        filtered
                                    } else {
                                        filtered.filter {
                                            it.name.contains(searchQuery, ignoreCase = true) ||
                                            it.email.contains(searchQuery, ignoreCase = true)
                                        }
                                    }
                                    uiState = UserManagementState.Success(allUsers, searchFiltered)
                                }
                            }
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        contentPadding = PaddingValues(vertical = 8.dp)
                    ) {
                        items(state.filteredUsers, key = { it.id }) { user ->
                            UserCard(
                                user = user,
                                onClick = {
                                    selectedUser = user
                                    showUserDetails = true
                                },
                                onRoleChange = {
                                    selectedUser = user
                                    showRoleDialog = true
                                }
                            )
                        }
                    }
                }
            }
            is UserManagementState.Error -> UserManagementError(
                message = state.message,
                onRetry = { uiState = UserManagementState.Loading }
            )
        }
    }

    if (showRoleDialog && selectedUser != null) {
        RoleChangeDialog(
            user = selectedUser!!,
            onDismiss = { showRoleDialog = false },
            onConfirm = { newRole ->
                scope.launch {
                    val success = FirebaseManager.updateUserRole(selectedUser!!.id, newRole)
                    if (success) {
                        val currentState = uiState as UserManagementState.Success
                        val updatedUsers = currentState.users.map {
                            if (it.id == selectedUser!!.id) it.copy(role = newRole) else it
                        }
                        uiState = UserManagementState.Success(updatedUsers, updatedUsers)
                    }
                }
                showRoleDialog = false
            }
        )
    }

    if (showUserDetails && selectedUser != null) {
        UserDetailsDialog(
            user = selectedUser!!,
            onDismiss = { showUserDetails = false },
            onRoleChange = {
                showUserDetails = false
                showRoleDialog = true
            }
        )
    }
}

@Composable
private fun RoleFilterChips(onFilterChange: (String?) -> Unit) {
    var selectedFilter by remember { mutableStateOf<String?>(null) }

    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        FilterChip(
            selected = selectedFilter == null,
            onClick = {
                selectedFilter = null
                onFilterChange(null)
            },
            label = { Text("Todos") }
        )
        FilterChip(
            selected = selectedFilter == "ADMIN",
            onClick = {
                selectedFilter = "ADMIN"
                onFilterChange("ADMIN")
            },
            label = { Text("👑 Admin") }
        )
        FilterChip(
            selected = selectedFilter == "PLAYER",
            onClick = {
                selectedFilter = "PLAYER"
                onFilterChange("PLAYER")
            },
            label = { Text("Player") }
        )
    }
}

@Composable
private fun UserCard(
    user: AdminUser,
    onClick: () -> Unit,
    onRoleChange: () -> Unit
) {
    val roleColor = when (user.role) {
        "ADMIN" -> Color(0xFFE91E63)
        "FIELD_OWNER" -> Color(0xFFFF9800)
        else -> MaterialTheme.colorScheme.primary
    }

    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(roleColor.copy(alpha = 0.2f)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = getInitials(user.name),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = roleColor
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = user.name,
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false)
                    )
                    if (user.role == "ADMIN") {
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "👑",
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
                Text(
                    text = user.email,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "Nível ${user.level}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = "•",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = "${user.totalGames} jogos",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            FilledTonalButton(
                onClick = onRoleChange,
                shape = RoundedCornerShape(8.dp),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Text("Cargo", style = MaterialTheme.typography.labelMedium)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RoleChangeDialog(
    user: AdminUser,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit
) {
    var selectedRole by remember { mutableStateOf(user.role) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text("Alterar Cargo")
        },
        text = {
            Column {
                Text(
                    text = "Selecione o novo cargo para ${user.name}:",
                    style = MaterialTheme.typography.bodyMedium
                )
                Spacer(modifier = Modifier.height(16.dp))
                
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    RoleOption(
                        role = "PLAYER",
                        label = "Player",
                        description = "Usuário comum",
                        emoji = "🎮",
                        selected = selectedRole == "PLAYER",
                        onClick = { selectedRole = "PLAYER" }
                    )
                    RoleOption(
                        role = "FIELD_OWNER",
                        label = "Organizador",
                        description = "Pode criar grupos e jogos",
                        emoji = "🏟️",
                        selected = selectedRole == "FIELD_OWNER",
                        onClick = { selectedRole = "FIELD_OWNER" }
                    )
                    RoleOption(
                        role = "ADMIN",
                        label = "Admin",
                        description = "Acesso completo ao painel",
                        emoji = "👑",
                        selected = selectedRole == "ADMIN",
                        onClick = { selectedRole = "ADMIN" }
                    )
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onConfirm(selectedRole) }
            ) {
                Text("Confirmar")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar")
            }
        }
    )
}

@Composable
private fun RoleOption(
    role: String,
    label: String,
    description: String,
    emoji: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (selected) {
                MaterialTheme.colorScheme.primaryContainer
            } else {
                MaterialTheme.colorScheme.surfaceVariant
            }
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = emoji,
                style = MaterialTheme.typography.titleMedium
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = label,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            if (selected) {
                Text(
                    text = "✓",
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

@Composable
private fun UserDetailsDialog(
    user: AdminUser,
    onDismiss: () -> Unit,
    onRoleChange: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = getInitials(user.name),
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primary)
                        .wrapContentSize(Alignment.Center),
                    color = MaterialTheme.colorScheme.onPrimary,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.width(12.dp))
                Text(user.name)
            }
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                DetailRow(label = "Email", value = user.email)
                DetailRow(label = "Cargo", value = user.role)
                DetailRow(label = "Nível", value = user.level.toString())
                DetailRow(label = "Jogos", value = user.totalGames.toString())
                DetailRow(label = "Status", value = if (user.isActive) "Ativo" else "Inativo")
            }
        },
        confirmButton = {
            TextButton(onClick = onRoleChange) {
                Text("Alterar Cargo")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Fechar")
            }
        }
    )
}

@Composable
private fun DetailRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
private fun UserManagementLoading() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        repeat(8) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.surfaceVariant)
                    )
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Box(
                            modifier = Modifier
                                .width(150.dp)
                                .height(16.dp)
                                .clip(RoundedCornerShape(4.dp))
                                .background(MaterialTheme.colorScheme.surfaceVariant)
                        )
                        Box(
                            modifier = Modifier
                                .width(200.dp)
                                .height(12.dp)
                                .clip(RoundedCornerShape(4.dp))
                                .background(MaterialTheme.colorScheme.surfaceVariant)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun UserManagementError(message: String, onRetry: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 24.dp, vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "❌",
            style = MaterialTheme.typography.displayLarge
        )
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            text = message,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(24.dp))
        Button(onClick = onRetry) {
            Text("🔄")
            Spacer(modifier = Modifier.width(8.dp))
            Text("Tentar novamente")
        }
    }
}

private fun getInitials(name: String): String {
    val parts = name.trim().split(" ")
    return when {
        parts.size >= 2 -> "${parts.first().first()}${parts.last().first()}".uppercase()
        parts.isNotEmpty() -> parts.first().take(2).uppercase()
        else -> "??"
    }
}
