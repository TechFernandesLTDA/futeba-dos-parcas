package com.futebadosparcas.ui

import androidx.compose.animation.core.*
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.background
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.layout.*
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.lazy.LazyColumn
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.lazy.items
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.shape.CircleShape
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.shape.RoundedCornerShape
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.material3.*
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.runtime.*
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.Alignment
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.Modifier
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.draw.clip
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.graphics.Brush
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.graphics.Color
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.text.font.FontWeight
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.text.style.TextAlign
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.text.style.TextOverflow
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.unit.dp
import com.futebadosparcas.ui.components.states.ErrorState
import com.futebadosparcas.firebase.FirebaseManager
import com.futebadosparcas.ui.components.states.ErrorState
import kotlinx.coroutines.launch
import com.futebadosparcas.ui.components.states.ErrorState

private sealed class GroupDetailUiState {
    object Loading : GroupDetailUiState()
    data class Success(
        val group: Map<String, Any?>,
        val members: List<Map<String, Any?>>
    ) : GroupDetailUiState()
    data class Error(val message: String) : GroupDetailUiState()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GroupDetailScreen(
    groupId: String,
    onBackClick: () -> Unit
) {
    var uiState by remember { mutableStateOf<GroupDetailUiState>(GroupDetailUiState.Loading) }
    var showLeaveDialog by remember { mutableStateOf(false) }
    var showMenu by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    fun loadGroup() {
        scope.launch {
            uiState = GroupDetailUiState.Loading
            try {
                val group = FirebaseManager.getGroupById(groupId)
                if (group != null) {
                    val members = FirebaseManager.getGroupMembers(groupId)
                    uiState = GroupDetailUiState.Success(group, members)
                } else {
                    uiState = GroupDetailUiState.Error("Grupo não encontrado")
                }
            } catch (e: Exception) {
                uiState = GroupDetailUiState.Error(e.message ?: "Erro ao carregar grupo")
            }
        }
    }

    LaunchedEffect(groupId) {
        loadGroup()
    }

    val group = (uiState as? GroupDetailUiState.Success)?.group
    val members = (uiState as? GroupDetailUiState.Success)?.members ?: emptyList()
    val myRole = group?.get("role") as? String ?: "MEMBER"
    val isOwnerOrAdmin = myRole == "OWNER" || myRole == "ADMIN"

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = group?.get("groupName") as? String ?: "Grupo",
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Text("←", style = MaterialTheme.typography.titleLarge)
                    }
                },
                actions = {
                    Box {
                        IconButton(onClick = { showMenu = true }) {
                            Text("⋮", style = MaterialTheme.typography.titleLarge)
                        }
                        DropdownMenu(
                            expanded = showMenu,
                            onDismissRequest = { showMenu = false }
                        ) {
                            if (isOwnerOrAdmin) {
                                DropdownMenuItem(
                                    text = { Text("👤 Convidar Jogadores") },
                                    onClick = {
                                        showMenu = false
                                        scope.launch {
                                            snackbarHostState.showSnackbar("Funcionalidade em desenvolvimento")
                                        }
                                    }
                                )
                                DropdownMenuItem(
                                    text = { Text("⚽ Criar Jogo") },
                                    onClick = {
                                        showMenu = false
                                        scope.launch {
                                            snackbarHostState.showSnackbar("Funcionalidade em desenvolvimento")
                                        }
                                    }
                                )
                                HorizontalDivider()
                            }
                            DropdownMenuItem(
                                text = { Text("💰 Caixa do Grupo") },
                                onClick = {
                                    showMenu = false
                                    scope.launch {
                                        snackbarHostState.showSnackbar("Funcionalidade em desenvolvimento")
                                    }
                                }
                            )
                            if (myRole != "OWNER") {
                                HorizontalDivider()
                                DropdownMenuItem(
                                    text = {
                                        Text(
                                            "🚪 Sair do Grupo",
                                            color = MaterialTheme.colorScheme.error
                                        )
                                    },
                                    onClick = {
                                        showMenu = false
                                        showLeaveDialog = true
                                    }
                                )
                            }
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        snackbarHost = {
            SnackbarHost(hostState = snackbarHostState)
        }
    ) { paddingValues ->
        when (val state = uiState) {
            is GroupDetailUiState.Loading -> GroupDetailLoadingContent()

            is GroupDetailUiState.Success -> GroupDetailContent(
                group = state.group,
                members = state.members,
                myRole = myRole,
                paddingValues = paddingValues
            )

            is GroupDetailUiState.Error -> ErrorState(
                message = state.message,
                onRetry = { loadGroup() }
            )
        }
    }

    if (showLeaveDialog && group != null) {
        LeaveGroupDialog(
            groupName = group["groupName"] as? String ?: "Grupo",
            onDismiss = { showLeaveDialog = false },
            onConfirm = {
                scope.launch {
                    try {
                        val success = FirebaseManager.leaveGroup(groupId)
                        if (success) {
                            showLeaveDialog = false
                            onBackClick()
                        } else {
                            snackbarHostState.showSnackbar("Erro ao sair do grupo")
                        }
                    } catch (e: Exception) {
                        snackbarHostState.showSnackbar(e.message ?: "Erro ao sair do grupo")
                    }
                }
            }
        )
    }
}

@Composable
private fun GroupDetailLoadingContent() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        repeat(6) {
            ShimmerListItem()
        }
    }
}

@Composable
private fun ShimmerListItem() {
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
                    .background(brush)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Box(
                    modifier = Modifier
                        .width(120.dp)
                        .height(16.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(brush)
                )
                Spacer(modifier = Modifier.height(8.dp))
                Box(
                    modifier = Modifier
                        .width(80.dp)
                        .height(12.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(brush)
                )
            }
        }
    }
}

@Composable
private fun GroupDetailContent(
    group: Map<String, Any?>,
    members: List<Map<String, Any?>>,
    myRole: String,
    paddingValues: PaddingValues
) {
    val isOwnerOrAdmin = myRole == "OWNER" || myRole == "ADMIN"

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(paddingValues),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            GroupHeader(group = group, myRole = myRole)
        }

        item {
            GroupActionButtons(
                isOwnerOrAdmin = isOwnerOrAdmin,
                onInviteClick = { },
                onCashboxClick = { },
                onCreateGameClick = { }
            )
        }

        item {
            MembersSectionHeader(membersCount = members.size)
        }

        if (members.isEmpty()) {
            item {
                EmptyMembersState(isOwnerOrAdmin = isOwnerOrAdmin)
            }
        } else {
            items(members, key = { it["id"] as? String ?: it.hashCode() }) { member ->
                MemberCard(member = member)
            }
        }
    }
}

@Composable
private fun GroupHeader(
    group: Map<String, Any?>,
    myRole: String
) {
    val groupName = group["groupName"] as? String ?: "Grupo"
    val description = group["description"] as? String ?: ""
    val memberCount = (group["memberCount"] as? Number)?.toInt() ?: (group["members"] as? Number)?.toInt() ?: 0

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier.size(88.dp),
                contentAlignment = Alignment.Center
            ) {
                GroupPhoto(
                    groupName = groupName,
                    modifier = Modifier.size(80.dp)
                )

                if (myRole == "OWNER" || myRole == "ADMIN") {
                    Surface(
                        modifier = Modifier.align(Alignment.BottomEnd),
                        shape = CircleShape,
                        color = when (myRole) {
                            "OWNER" -> Color(0xFFFFD700)
                            else -> MaterialTheme.colorScheme.primary
                        }
                    ) {
                        Text(
                            text = if (myRole == "OWNER") "⭐" else "🛡️",
                            modifier = Modifier.padding(4.dp),
                            style = MaterialTheme.typography.labelMedium
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = groupName,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )

            if (description.isNotEmpty()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    shape = RoundedCornerShape(16.dp),
                    color = MaterialTheme.colorScheme.surfaceContainerHigh
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        Text("👥")
                        Text(
                            text = "$memberCount ${if (memberCount == 1) "membro" else "membros"}",
                            style = MaterialTheme.typography.labelMedium
                        )
                    }
                }

                RoleBadgeChip(myRole = myRole)
            }
        }
    }
}

@Composable
private fun RoleBadgeChip(myRole: String) {
    val (text, icon, color) = when (myRole) {
        "OWNER" -> Triple("Dono", "⭐", Color(0xFFFFD700))
        "ADMIN" -> Triple("Admin", "🛡️", MaterialTheme.colorScheme.primary)
        else -> Triple("Membro", "👤", MaterialTheme.colorScheme.secondary)
    }

    Surface(
        color = color.copy(alpha = 0.15f),
        shape = RoundedCornerShape(16.dp)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(text = icon, style = MaterialTheme.typography.labelSmall)
            Text(
                text = text,
                style = MaterialTheme.typography.labelSmall,
                color = color,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

@Composable
private fun GroupActionButtons(
    isOwnerOrAdmin: Boolean,
    onInviteClick: () -> Unit,
    onCashboxClick: () -> Unit,
    onCreateGameClick: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        if (isOwnerOrAdmin) {
            OutlinedButton(
                onClick = onInviteClick,
                modifier = Modifier.weight(1f)
            ) {
                Text("👤", style = MaterialTheme.typography.labelLarge)
                Spacer(modifier = Modifier.width(4.dp))
                Text("Convidar", maxLines = 1)
            }
        }

        OutlinedButton(
            onClick = onCashboxClick,
            modifier = Modifier.weight(1f)
        ) {
            Text("💰", style = MaterialTheme.typography.labelLarge)
            Spacer(modifier = Modifier.width(4.dp))
            Text("Caixa", maxLines = 1)
        }

        if (isOwnerOrAdmin) {
            Button(
                onClick = onCreateGameClick,
                modifier = Modifier.weight(1f)
            ) {
                Text("⚽", style = MaterialTheme.typography.labelLarge)
                Spacer(modifier = Modifier.width(4.dp))
                Text("Jogo", maxLines = 1)
            }
        }
    }
}

@Composable
private fun MembersSectionHeader(membersCount: Int) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = "👥",
                style = MaterialTheme.typography.titleMedium
            )
            Text(
                text = "Membros",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "($membersCount)",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun EmptyMembersState(isOwnerOrAdmin: Boolean) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Text(
                text = "👥",
                style = MaterialTheme.typography.displayMedium
            )
            Text(
                text = "Nenhum membro ainda",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = if (isOwnerOrAdmin) {
                    "Convide jogadores para começar!"
                } else {
                    "Aguarde o administrador adicionar membros"
                },
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun MemberCard(member: Map<String, Any?>) {
    val userName = member["userName"] as? String ?: "Jogador"
    val nickname = member["nickname"] as? String
    val displayName = nickname?.takeIf { it.isNotBlank() } ?: userName
    val role = member["role"] as? String ?: "MEMBER"

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            MemberPhoto(
                userName = userName,
                modifier = Modifier.size(48.dp)
            )

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = displayName,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                if (nickname != null && nickname.isNotBlank()) {
                    Text(
                        text = userName,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1
                    )
                }
            }

            MemberRoleBadge(role = role)
        }
    }
}

@Composable
private fun MemberPhoto(
    userName: String,
    modifier: Modifier = Modifier
) {
    val initial = userName.firstOrNull()?.uppercase() ?: "?"
    val gradientColors = listOf(
        MaterialTheme.colorScheme.secondary,
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
            style = MaterialTheme.typography.titleMedium,
            color = Color.White,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
private fun MemberRoleBadge(role: String) {
    if (role != "MEMBER") {
        val (text, icon) = when (role) {
            "OWNER" -> "Dono" to "⭐"
            "ADMIN" -> "Admin" to "🛡️"
            else -> role to "👤"
        }

        Surface(
            shape = RoundedCornerShape(8.dp),
            color = when (role) {
                "OWNER" -> Color(0xFFFFD700).copy(alpha = 0.2f)
                "ADMIN" -> MaterialTheme.colorScheme.primaryContainer
                else -> MaterialTheme.colorScheme.surfaceVariant
            }
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                Text(text = icon, style = MaterialTheme.typography.labelSmall)
                Text(
                    text = text,
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

@Composable
private fun LeaveGroupDialog(
    groupName: String,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("🚪 Sair do Grupo") },
        text = {
            Text("Tem certeza que deseja sair de \"$groupName\"?\n\nVocê perderá acesso aos jogos e histórico do grupo.")
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error
                )
            ) {
                Text("Sair")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar")
            }
        }
    )
}
