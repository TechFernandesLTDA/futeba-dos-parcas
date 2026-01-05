package com.futebadosparcas.ui.groups

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.futebadosparcas.R
import com.futebadosparcas.data.model.Group
import com.futebadosparcas.data.model.GroupMember
import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.ui.components.ShimmerBox

/**
 * GroupDetailScreen - Exibe detalhes de um grupo
 *
 * Permite:
 * - Visualizar informações do grupo (nome, descrição, foto, membros)
 * - Gerenciar membros (promover, rebaixar, remover)
 * - Editar grupo (nome, descrição, foto) - admin+
 * - Convidar jogadores - admin+
 * - Acessar cashbox do grupo
 * - Criar jogos no grupo - admin+
 * - Transferir propriedade - owner
 * - Sair do grupo - non-owner
 * - Arquivar grupo - owner
 * - Excluir grupo - owner
 *
 * Features:
 * - 8 ações no toolbar (visibilidade por role)
 * - Lista de membros com ações
 * - Múltiplos diálogos de confirmação
 * - Estados: Loading, Success, Error
 * - Swipe-to-refresh
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GroupDetailScreen(
    viewModel: GroupDetailViewModel,
    groupId: String,
    onNavigateBack: () -> Unit = {},
    onNavigateToInvite: () -> Unit = {},
    onNavigateToCashbox: () -> Unit = {},
    onNavigateToCreateGame: () -> Unit = {},
    onMemberClick: (userId: String) -> Unit = {},
    onShowEditDialog: (group: Group) -> Unit = {},
    onShowTransferOwnershipDialog: (members: List<GroupMember>) -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val actionState by viewModel.actionState.collectAsStateWithLifecycle()

    // Dialog states
    var showLeaveDialog by remember { mutableStateOf(false) }
    var showArchiveDialog by remember { mutableStateOf(false) }
    var showDeleteDialog by remember { mutableStateOf(false) }

    // Carrega os dados do grupo na primeira composição
    LaunchedEffect(groupId) {
        viewModel.loadGroup(groupId)
    }

    // Observa o actionState para mostrar mensagens e navegar
    LaunchedEffect(actionState) {
        when (actionState) {
            is GroupActionState.GroupDeleted,
            is GroupActionState.LeftGroup -> {
                onNavigateBack()
            }
            else -> {}
        }
    }

    // Confirmation Dialogs
    val group = (uiState as? GroupDetailUiState.Success)?.group

    if (showLeaveDialog && group != null) {
        AlertDialog(
            onDismissRequest = { showLeaveDialog = false },
            title = { Text("Sair do Grupo") },
            text = { Text("Tem certeza que deseja sair do grupo \"${group.name}\"?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        showLeaveDialog = false
                        viewModel.leaveGroup()
                    }
                ) {
                    Text("Sair")
                }
            },
            dismissButton = {
                TextButton(onClick = { showLeaveDialog = false }) {
                    Text("Cancelar")
                }
            }
        )
    }

    if (showArchiveDialog && group != null) {
        AlertDialog(
            onDismissRequest = { showArchiveDialog = false },
            title = { Text("Arquivar Grupo") },
            text = { Text("Tem certeza que deseja arquivar o grupo \"${group.name}\"?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        showArchiveDialog = false
                        viewModel.archiveGroup()
                    }
                ) {
                    Text("Arquivar")
                }
            },
            dismissButton = {
                TextButton(onClick = { showArchiveDialog = false }) {
                    Text("Cancelar")
                }
            }
        )
    }

    if (showDeleteDialog && group != null) {
        AlertDialog(
            onDismissRequest = { showDeleteDialog = false },
            title = { Text("Excluir Grupo") },
            text = { Text("Tem certeza que deseja excluir permanentemente o grupo \"${group.name}\"? Esta ação não pode ser desfeita.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        showDeleteDialog = false
                        viewModel.deleteGroup()
                    },
                    colors = ButtonDefaults.textButtonColors(
                        contentColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Text("Excluir")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteDialog = false }) {
                    Text("Cancelar")
                }
            }
        )
    }

    Scaffold(
        topBar = {
            GroupDetailTopBar(
                group = (uiState as? GroupDetailUiState.Success)?.group,
                myRole = (uiState as? GroupDetailUiState.Success)?.myRole,
                onNavigateBack = onNavigateBack,
                onInviteClick = onNavigateToInvite,
                onCashboxClick = onNavigateToCashbox,
                onCreateGameClick = onNavigateToCreateGame,
                onEditClick = {
                    (uiState as? GroupDetailUiState.Success)?.group?.let { group ->
                        onShowEditDialog(group)
                    }
                },
                onTransferOwnershipClick = {
                    (uiState as? GroupDetailUiState.Success)?.let { state ->
                        if (state.members.size >= 2) {
                            onShowTransferOwnershipDialog(state.members)
                        }
                    }
                },
                onLeaveGroupClick = { showLeaveDialog = true },
                onArchiveGroupClick = { showArchiveDialog = true },
                onDeleteGroupClick = { showDeleteDialog = true }
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(MaterialTheme.colorScheme.background)
        ) {
            when (val state = uiState) {
                is GroupDetailUiState.Loading -> GroupDetailLoadingState()
                is GroupDetailUiState.Success -> GroupDetailContent(
                    group = state.group,
                    members = state.members,
                    myRole = state.myRole,
                    onRefresh = { viewModel.loadGroup(groupId) },
                    onInviteClick = onNavigateToInvite,
                    onCashboxClick = onNavigateToCashbox,
                    onCreateGameClick = onNavigateToCreateGame,
                    onMemberClick = onMemberClick,
                    onPromoteMember = { viewModel.promoteMember(it) },
                    onDemoteMember = { viewModel.demoteMember(it) },
                    onRemoveMember = { viewModel.removeMember(it) }
                )
                is GroupDetailUiState.Error -> GroupDetailErrorState(
                    message = state.message,
                    onRetry = { viewModel.loadGroup(groupId) }
                )
                is GroupDetailUiState.LeftGroup -> {
                    // O LaunchedEffect acima já navegou de volta
                }
            }

            // Snackbar para ações
            when (val action = actionState) {
                is GroupActionState.Success -> {
                    LaunchedEffect(action) {
                        // Mostrar snackbar com sucesso
                        viewModel.resetActionState()
                    }
                }
                is GroupActionState.Error -> {
                    LaunchedEffect(action) {
                        // Mostrar snackbar com erro
                        viewModel.resetActionState()
                    }
                }
                else -> {}
            }
        }
    }
}

/**
 * TopAppBar com menu de ações do grupo
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun GroupDetailTopBar(
    group: Group?,
    myRole: GroupMemberRole?,
    onNavigateBack: () -> Unit,
    onInviteClick: () -> Unit,
    onCashboxClick: () -> Unit,
    onCreateGameClick: () -> Unit,
    onEditClick: () -> Unit,
    onTransferOwnershipClick: () -> Unit,
    onLeaveGroupClick: () -> Unit,
    onArchiveGroupClick: () -> Unit,
    onDeleteGroupClick: () -> Unit
) {
    var showMenu by remember { mutableStateOf(false) }
    val isOwner = myRole == GroupMemberRole.OWNER
    val isOwnerOrAdmin = myRole == GroupMemberRole.OWNER || myRole == GroupMemberRole.ADMIN

    TopAppBar(
        title = {
            Text(
                text = group?.name ?: stringResource(R.string.group_detail),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        },
        navigationIcon = {
            IconButton(onClick = onNavigateBack) {
                Icon(
                    imageVector = Icons.Default.ArrowBack,
                    contentDescription = stringResource(R.string.back)
                )
            }
        },
        actions = {
            IconButton(onClick = { showMenu = true }) {
                Icon(
                    imageVector = Icons.Default.MoreVert,
                    contentDescription = stringResource(R.string.more_options)
                )
            }

            DropdownMenu(
                expanded = showMenu,
                onDismissRequest = { showMenu = false }
            ) {
                // Invite (admin+)
                if (isOwnerOrAdmin) {
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.invite_players)) },
                        onClick = {
                            showMenu = false
                            onInviteClick()
                        },
                        leadingIcon = {
                            Icon(Icons.Default.PersonAdd, null)
                        }
                    )
                }

                // Cashbox (all)
                DropdownMenuItem(
                    text = { Text(stringResource(R.string.cashbox)) },
                    onClick = {
                        showMenu = false
                        onCashboxClick()
                    },
                    leadingIcon = {
                        Icon(Icons.Default.AccountBalanceWallet, null)
                    }
                )

                // Create Game (admin+)
                if (isOwnerOrAdmin) {
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.create_game)) },
                        onClick = {
                            showMenu = false
                            onCreateGameClick()
                        },
                        leadingIcon = {
                            Icon(Icons.Default.Add, null)
                        }
                    )
                }

                Divider()

                // Edit (admin+)
                if (isOwnerOrAdmin) {
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.edit_group)) },
                        onClick = {
                            showMenu = false
                            onEditClick()
                        },
                        leadingIcon = {
                            Icon(Icons.Default.Edit, null)
                        }
                    )
                }

                // Transfer Ownership (owner)
                if (isOwner) {
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.transfer_ownership)) },
                        onClick = {
                            showMenu = false
                            onTransferOwnershipClick()
                        },
                        leadingIcon = {
                            Icon(Icons.Default.SwapHoriz, null)
                        }
                    )
                }

                // Leave Group (non-owner)
                if (!isOwner && myRole != null) {
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.leave_group)) },
                        onClick = {
                            showMenu = false
                            onLeaveGroupClick()
                        },
                        leadingIcon = {
                            Icon(Icons.Default.ExitToApp, null)
                        }
                    )
                }

                // Archive (owner)
                if (isOwner) {
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.archive_group)) },
                        onClick = {
                            showMenu = false
                            onArchiveGroupClick()
                        },
                        leadingIcon = {
                            Icon(Icons.Default.Archive, null)
                        }
                    )
                }

                // Delete (owner)
                if (isOwner) {
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.delete_group)) },
                        onClick = {
                            showMenu = false
                            onDeleteGroupClick()
                        },
                        leadingIcon = {
                            Icon(Icons.Default.Delete, null)
                        },
                        colors = MenuDefaults.itemColors(
                            textColor = MaterialTheme.colorScheme.error
                        )
                    )
                }
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.surface,
            titleContentColor = MaterialTheme.colorScheme.onSurface
        )
    )
}

/**
 * Conteúdo principal quando os dados estão carregados
 */
@Composable
private fun GroupDetailContent(
    group: Group,
    members: List<GroupMember>,
    myRole: GroupMemberRole?,
    onRefresh: () -> Unit,
    onInviteClick: () -> Unit,
    onCashboxClick: () -> Unit,
    onCreateGameClick: () -> Unit,
    onMemberClick: (userId: String) -> Unit,
    onPromoteMember: (GroupMember) -> Unit,
    onDemoteMember: (GroupMember) -> Unit,
    onRemoveMember: (GroupMember) -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .systemBarsPadding(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Header do grupo
        item {
            GroupHeader(group = group, myRole = myRole)
        }

        // Action buttons (visibilidade baseada no role)
        item {
            GroupActionButtons(
                myRole = myRole,
                onInviteClick = onInviteClick,
                onCashboxClick = onCashboxClick,
                onCreateGameClick = onCreateGameClick
            )
        }

        // Seção de membros
        item {
            Text(
                text = stringResource(R.string.members),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(top = 8.dp)
            )
        }

        // Lista de membros
        items(members, key = { it.id }) { member ->
            GroupMemberCard(
                member = member,
                myRole = myRole,
                onMemberClick = { onMemberClick(member.userId) },
                onPromoteClick = { onPromoteMember(member) },
                onDemoteClick = { onDemoteMember(member) },
                onRemoveClick = { onRemoveMember(member) }
            )
        }
    }
}

/**
 * Header com informações do grupo
 */
@Composable
private fun GroupHeader(
    group: Group,
    myRole: GroupMemberRole?
) {
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
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Foto do grupo
            AsyncImage(
                model = group.photoUrl?.ifEmpty { null } ?: R.drawable.ic_groups,
                contentDescription = null,
                modifier = Modifier
                    .size(80.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.1f)),
                contentScale = ContentScale.Crop
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Nome do grupo
            Text(
                text = group.name,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )

            Spacer(modifier = Modifier.height(4.dp))

            // Descrição
            Text(
                text = group.description.ifEmpty { stringResource(R.string.no_description) },
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Chips: Member count e My role
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Member count chip
                AssistChip(
                    onClick = { },
                    label = {
                        val memberCountText = when (group.memberCount) {
                            1 -> "1 membro"
                            else -> "${group.memberCount} membros"
                        }
                        Text(memberCountText)
                    },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Default.Group,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                )

                // My role chip
                AssistChip(
                    onClick = { },
                    label = {
                        val roleText = when (myRole) {
                            GroupMemberRole.OWNER -> "Dono"
                            GroupMemberRole.ADMIN -> "Admin"
                            GroupMemberRole.MEMBER -> "Membro"
                            null -> "Visitante"
                        }
                        Text(roleText)
                    },
                    leadingIcon = {
                        val roleIcon = when (myRole) {
                            GroupMemberRole.OWNER -> Icons.Default.Star
                            GroupMemberRole.ADMIN -> Icons.Default.Shield
                            else -> Icons.Default.Person
                        }
                        Icon(
                            imageVector = roleIcon,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                )
            }
        }
    }
}

/**
 * Botões de ação (Invite, Cashbox, Create Game)
 */
@Composable
private fun GroupActionButtons(
    myRole: GroupMemberRole?,
    onInviteClick: () -> Unit,
    onCashboxClick: () -> Unit,
    onCreateGameClick: () -> Unit
) {
    val isOwnerOrAdmin = myRole == GroupMemberRole.OWNER || myRole == GroupMemberRole.ADMIN

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Invite Players (admin+)
        if (isOwnerOrAdmin) {
            OutlinedButton(
                onClick = onInviteClick,
                modifier = Modifier.weight(1f)
            ) {
                Icon(
                    imageVector = Icons.Default.PersonAdd,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(stringResource(R.string.invite))
            }
        }

        // Cashbox (all)
        OutlinedButton(
            onClick = onCashboxClick,
            modifier = Modifier.weight(1f)
        ) {
            Icon(
                imageVector = Icons.Default.AccountBalanceWallet,
                contentDescription = null,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(stringResource(R.string.cashbox))
        }

        // Create Game (admin+)
        if (isOwnerOrAdmin) {
            Button(
                onClick = onCreateGameClick,
                modifier = Modifier.weight(1f)
            ) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = null,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(stringResource(R.string.create_game))
            }
        }
    }
}

/**
 * Card de membro do grupo
 */
@Composable
private fun GroupMemberCard(
    member: GroupMember,
    myRole: GroupMemberRole?,
    onMemberClick: () -> Unit,
    onPromoteClick: () -> Unit,
    onDemoteClick: () -> Unit,
    onRemoveClick: () -> Unit
) {
    var showMemberMenu by remember { mutableStateOf(false) }
    var showPromoteDialog by remember { mutableStateOf(false) }
    var showDemoteDialog by remember { mutableStateOf(false) }
    var showRemoveDialog by remember { mutableStateOf(false) }

    val memberRole = member.getRoleEnum()

    // Determina se o usuário atual pode gerenciar este membro
    val canManage = when (myRole) {
        GroupMemberRole.OWNER -> memberRole != GroupMemberRole.OWNER
        GroupMemberRole.ADMIN -> memberRole == GroupMemberRole.MEMBER
        else -> false
    }

    // Confirmation dialogs for member actions
    if (showPromoteDialog) {
        AlertDialog(
            onDismissRequest = { showPromoteDialog = false },
            title = { Text("Promover Membro") },
            text = { Text("Tem certeza que deseja promover ${member.getDisplayName()} a administrador?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        showPromoteDialog = false
                        onPromoteClick()
                    }
                ) {
                    Text("Promover")
                }
            },
            dismissButton = {
                TextButton(onClick = { showPromoteDialog = false }) {
                    Text("Cancelar")
                }
            }
        )
    }

    if (showDemoteDialog) {
        AlertDialog(
            onDismissRequest = { showDemoteDialog = false },
            title = { Text("Rebaixar Membro") },
            text = { Text("Tem certeza que deseja rebaixar ${member.getDisplayName()} para membro comum?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        showDemoteDialog = false
                        onDemoteClick()
                    }
                ) {
                    Text("Rebaixar")
                }
            },
            dismissButton = {
                TextButton(onClick = { showDemoteDialog = false }) {
                    Text("Cancelar")
                }
            }
        )
    }

    if (showRemoveDialog) {
        AlertDialog(
            onDismissRequest = { showRemoveDialog = false },
            title = { Text("Remover Membro") },
            text = { Text("Tem certeza que deseja remover ${member.getDisplayName()} do grupo?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        showRemoveDialog = false
                        onRemoveClick()
                    },
                    colors = ButtonDefaults.textButtonColors(
                        contentColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Text("Remover")
                }
            },
            dismissButton = {
                TextButton(onClick = { showRemoveDialog = false }) {
                    Text("Cancelar")
                }
            }
        )
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onMemberClick),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Foto do membro
            AsyncImage(
                model = member.userPhoto?.ifEmpty { null } ?: R.drawable.ic_person,
                contentDescription = null,
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.1f)),
                contentScale = ContentScale.Crop
            )

            // Nome e role
            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = member.getDisplayName(),
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSurface
                )

                Text(
                    text = when (memberRole) {
                        GroupMemberRole.OWNER -> "Dono"
                        GroupMemberRole.ADMIN -> "Admin"
                        GroupMemberRole.MEMBER -> "Membro"
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            // Botão de mais opções (se pode gerenciar)
            if (canManage) {
                Box {
                    IconButton(onClick = { showMemberMenu = true }) {
                        Icon(
                            imageVector = Icons.Default.MoreVert,
                            contentDescription = stringResource(R.string.more_options)
                        )
                    }

                    DropdownMenu(
                        expanded = showMemberMenu,
                        onDismissRequest = { showMemberMenu = false }
                    ) {
                        // Owner pode promover/rebaixar e remover
                        if (myRole == GroupMemberRole.OWNER) {
                            when (memberRole) {
                                GroupMemberRole.ADMIN -> {
                                    DropdownMenuItem(
                                        text = { Text("Rebaixar para Membro") },
                                        onClick = {
                                            showMemberMenu = false
                                            showDemoteDialog = true
                                        }
                                    )
                                }
                                GroupMemberRole.MEMBER -> {
                                    DropdownMenuItem(
                                        text = { Text("Promover a Admin") },
                                        onClick = {
                                            showMemberMenu = false
                                            showPromoteDialog = true
                                        }
                                    )
                                }
                                else -> {}
                            }
                            DropdownMenuItem(
                                text = { Text("Remover do Grupo") },
                                onClick = {
                                    showMemberMenu = false
                                    showRemoveDialog = true
                                },
                                colors = MenuDefaults.itemColors(
                                    textColor = MaterialTheme.colorScheme.error
                                )
                            )
                        }

                        // Admin só pode remover membros
                        if (myRole == GroupMemberRole.ADMIN && memberRole == GroupMemberRole.MEMBER) {
                            DropdownMenuItem(
                                text = { Text("Remover do Grupo") },
                                onClick = {
                                    showMemberMenu = false
                                    showRemoveDialog = true
                                },
                                colors = MenuDefaults.itemColors(
                                    textColor = MaterialTheme.colorScheme.error
                                )
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Estado de loading com shimmer
 */
@Composable
private fun GroupDetailLoadingState() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Header shimmer
        ShimmerBox(
            modifier = Modifier
                .fillMaxWidth()
                .height(200.dp)
        )

        // Action buttons shimmer
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            repeat(3) {
                ShimmerBox(
                    modifier = Modifier
                        .weight(1f)
                        .height(40.dp)
                )
            }
        }

        // Members list shimmer
        repeat(5) {
            ShimmerBox(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(72.dp)
            )
        }
    }
}

/**
 * Estado de erro
 */
@Composable
private fun GroupDetailErrorState(
    message: String,
    onRetry: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.Default.Error,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.error
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = stringResource(R.string.error),
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onBackground
        )

        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 8.dp)
        )

        Spacer(modifier = Modifier.height(16.dp))

        Button(onClick = onRetry) {
            Text(stringResource(R.string.retry))
        }
    }
}
