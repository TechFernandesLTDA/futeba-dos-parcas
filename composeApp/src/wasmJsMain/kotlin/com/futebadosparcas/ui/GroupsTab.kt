package com.futebadosparcas.ui

import androidx.compose.animation.core.*
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.futebadosparcas.firebase.FirebaseManager
import kotlinx.coroutines.launch

private sealed class GroupsUiState {
    object Loading : GroupsUiState()
    object Empty : GroupsUiState()
    data class Success(val groups: List<Map<String, Any?>>) : GroupsUiState()
    data class Error(val message: String) : GroupsUiState()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GroupsTab(
    onGroupClick: (String) -> Unit = {}
) {
    var uiState by remember { mutableStateOf<GroupsUiState>(GroupsUiState.Loading) }
    var searchQuery by remember { mutableStateOf("") }
    var showCreateDialog by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    fun loadGroups() {
        scope.launch {
            uiState = GroupsUiState.Loading
            try {
                val groups = FirebaseManager.getUserGroups()
                uiState = if (groups.isEmpty()) {
                    GroupsUiState.Empty
                } else {
                    GroupsUiState.Success(groups)
                }
            } catch (e: Exception) {
                uiState = GroupsUiState.Error(e.message ?: "Erro ao carregar grupos")
            }
        }
    }

    LaunchedEffect(Unit) {
        loadGroups()
    }

    Scaffold(
        floatingActionButton = {
            if (uiState is GroupsUiState.Success || (uiState is GroupsUiState.Empty && searchQuery.isEmpty())) {
                FloatingActionButton(
                    onClick = { showCreateDialog = true },
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary
                ) {
                    Text("➕", style = MaterialTheme.typography.titleLarge)
                }
            }
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp)
        ) {
            Text(
                text = "👥 Meus Grupos",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(vertical = 16.dp)
            )

            when (val state = uiState) {
                is GroupsUiState.Loading -> GroupsLoadingContent()

                is GroupsUiState.Empty -> {
                    if (searchQuery.isEmpty()) {
                        EmptyGroupsState(
                            onCreateGroup = { showCreateDialog = true }
                        )
                    }
                }

                is GroupsUiState.Success -> {
                    val filteredGroups = if (searchQuery.isNotEmpty()) {
                        state.groups.filter {
                            (it["groupName"] as? String ?: "")
                                .lowercase()
                                .contains(searchQuery.lowercase())
                        }
                    } else {
                        state.groups
                    }

                    SearchBar(
                        query = searchQuery,
                        onQueryChange = { searchQuery = it },
                        modifier = Modifier.padding(bottom = 12.dp)
                    )

                    if (filteredGroups.isEmpty() && searchQuery.isNotEmpty()) {
                        EmptySearchState(
                            query = searchQuery,
                            onClearSearch = { searchQuery = "" }
                        )
                    } else {
                        GroupsList(
                            groups = filteredGroups,
                            onGroupClick = onGroupClick
                        )
                    }
                }

                is GroupsUiState.Error -> {
                    ErrorState(
                        message = state.message,
                        onRetry = { loadGroups() }
                    )
                }
            }
        }
    }

    if (showCreateDialog) {
        CreateGroupDialog(
            onDismiss = { showCreateDialog = false },
            onGroupCreated = { groupId ->
                showCreateDialog = false
                loadGroups()
                onGroupClick(groupId)
            }
        )
    }
}

@Composable
private fun GroupsLoadingContent() {
    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(5) {
            ShimmerGroupCard()
        }
    }
}

@Composable
private fun ShimmerGroupCard() {
    val shimmerColors = listOf(
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f)
    )

    val transition = rememberInfiniteTransition(label = "shimmer")
    val translateAnim = transition.animateFloat(
        initialValue = 0f,
        targetValue = 1000f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmer_translate"
    )

    val brush = Brush.linearGradient(
        colors = shimmerColors,
        start = androidx.compose.ui.geometry.Offset(translateAnim.value - 1000f, 0f),
        end = androidx.compose.ui.geometry.Offset(translateAnim.value, 0f)
    )

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .clip(CircleShape)
                    .background(brush)
            )
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Box(
                    modifier = Modifier
                        .width(150.dp)
                        .height(20.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(brush)
                )
                Spacer(modifier = Modifier.height(8.dp))
                Box(
                    modifier = Modifier
                        .width(100.dp)
                        .height(16.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(brush)
                )
            }
            Box(
                modifier = Modifier
                    .size(24.dp)
                    .clip(CircleShape)
                    .background(brush)
            )
        }
    }
}

@Composable
private fun SearchBar(
    query: String,
    onQueryChange: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    OutlinedTextField(
        value = query,
        onValueChange = onQueryChange,
        modifier = modifier.fillMaxWidth(),
        placeholder = { Text("🔍 Buscar grupo...") },
        singleLine = true,
        shape = RoundedCornerShape(28.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = MaterialTheme.colorScheme.primary,
            unfocusedBorderColor = MaterialTheme.colorScheme.outline
        ),
        trailingIcon = {
            if (query.isNotEmpty()) {
                TextButton(onClick = { onQueryChange("") }) {
                    Text("✕")
                }
            }
        }
    )
}

@Composable
private fun GroupsList(
    groups: List<Map<String, Any?>>,
    onGroupClick: (String) -> Unit
) {
    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(8.dp),
        contentPadding = PaddingValues(bottom = 80.dp)
    ) {
        items(groups, key = { it["id"] as? String ?: it.hashCode() }) { group ->
            GroupCard(
                group = group,
                onClick = { onGroupClick(group["id"] as? String ?: "") }
            )
        }
    }
}

@Composable
private fun GroupCard(
    group: Map<String, Any?>,
    onClick: () -> Unit
) {
    val groupName = group["groupName"] as? String ?: "Grupo sem nome"
    val memberCount = (group["memberCount"] as? Number)?.toInt() ?: (group["members"] as? Number)?.toInt() ?: 0
    val role = group["role"] as? String ?: "MEMBER"
    val nextGame = group["nextGame"] as? String

    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            GroupPhoto(
                groupName = groupName,
                modifier = Modifier.size(56.dp)
            )

            Spacer(modifier = Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = groupName,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(4.dp))

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "👥 $memberCount ${if (memberCount == 1) "membro" else "membros"}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    RoleBadge(role = role)
                }

                if (nextGame != null) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "⚽ $nextGame",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Medium
                    )
                }
            }

            Text(
                text = "›",
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
fun GroupPhoto(
    groupName: String,
    modifier: Modifier = Modifier
) {
    val initial = groupName.firstOrNull()?.uppercase() ?: "?"
    val gradientColors = listOf(
        MaterialTheme.colorScheme.primary,
        MaterialTheme.colorScheme.tertiary
    )

    Box(
        modifier = modifier
            .clip(CircleShape)
            .background(Brush.linearGradient(gradientColors)),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = initial,
            style = MaterialTheme.typography.headlineMedium,
            color = Color.White,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
private fun RoleBadge(role: String) {
    if (role != "MEMBER") {
        val (color, icon) = when (role) {
            "OWNER" -> MaterialTheme.colorScheme.tertiaryContainer to "⭐"
            "ADMIN" -> MaterialTheme.colorScheme.primaryContainer to "🛡️"
            else -> MaterialTheme.colorScheme.surfaceVariant to "👤"
        }

        Surface(
            shape = RoundedCornerShape(12.dp),
            color = color
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(text = icon, style = MaterialTheme.typography.labelSmall)
                Text(
                    text = when (role) {
                        "OWNER" -> "Dono"
                        "ADMIN" -> "Admin"
                        else -> role
                    },
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

@Composable
private fun EmptyGroupsState(
    onCreateGroup: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "👥",
            style = MaterialTheme.typography.displayLarge
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Nenhum grupo ainda",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Crie um grupo para começar a organizar suas peladas!",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(24.dp))
        Button(onClick = onCreateGroup) {
            Text("➕ Criar Grupo")
        }
    }
}

@Composable
private fun EmptySearchState(
    query: String,
    onClearSearch: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "🔍",
            style = MaterialTheme.typography.displayLarge
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Nenhum resultado",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Não encontramos grupos com \"$query\"",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(16.dp))
        TextButton(onClick = onClearSearch) {
            Text("Limpar busca")
        }
    }
}

@Composable
fun ErrorState(
    message: String,
    onRetry: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "❌",
            style = MaterialTheme.typography.displayLarge
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Erro ao carregar",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(16.dp))
        Button(onClick = onRetry) {
            Text("🔄 Tentar novamente")
        }
    }
}
