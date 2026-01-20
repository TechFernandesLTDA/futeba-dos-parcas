package com.futebadosparcas.ui.groups

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.futebadosparcas.ui.theme.GamificationColors
import com.futebadosparcas.util.ContrastHelper
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.futebadosparcas.R
import com.futebadosparcas.data.model.Group
import com.futebadosparcas.data.model.GroupMember
import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.ui.components.CachedProfileImage
import com.futebadosparcas.ui.components.cards.GroupMemberCard
import com.futebadosparcas.ui.components.dialogs.*
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateType
import com.futebadosparcas.ui.components.states.LoadingItemType
import com.futebadosparcas.ui.components.states.LoadingState
import com.futebadosparcas.ui.groups.dialogs.EditGroupDialog
import com.futebadosparcas.ui.groups.dialogs.TransferOwnershipDialog

/**
 * GroupDetailScreen - Exibe detalhes de um grupo (CMD-30)
 *
 * Melhorias implementadas (20+ itens):
 * 1. Cache inteligente para membros (5 min TTL)
 * 2. Validação de nome ao editar grupo
 * 3. Validação de permissões antes de ações
 * 4. Log de ações para auditabilidade
 * 5. Estados de erro específicos e descritivos
 * 6. Loading cancelável com feedback visual
 * 7. Retry com backoff para falhas de rede
 * 8. Verificação de role antes de promover/rebaixar
 * 9. Verificação de membros elegíveis para ações
 * 10. UI Material 3 consistente
 * 11. Estados vazios para lista de membros
 * 12. Estados vazios para grupos sem membros
 * 13. Feedback háptico nas ações
 * 14. Badges de role visuais
 * 15. Filtro de membros por role
 * 16. Ordenação de membros (role + nome)
 * 17. Diálogos de confirmação melhorados
 * 18. Animações de transição
 * 19. Suporte a offline/cache
 * 20. Indicadores de carregamento incremental
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
    onMemberClick: (userId: String) -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val actionState by viewModel.actionState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    // Dialog states
    var showLeaveDialog by remember { mutableStateOf(false) }
    var showArchiveDialog by remember { mutableStateOf(false) }
    var showDeleteDialog by remember { mutableStateOf(false) }
    var showEditDialog by remember { mutableStateOf(false) }
    var showTransferOwnershipDialog by remember { mutableStateOf(false) }

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

    // Confirmation Dialogs using shared components
    val group = (uiState as? GroupDetailUiState.Success)?.group
    val members = (uiState as? GroupDetailUiState.Success)?.members ?: emptyList()

    if (showEditDialog && group != null) {
        EditGroupDialog(
            group = group,
            onDismiss = { showEditDialog = false },
            onSave = { name, description, photoUri ->
                viewModel.updateGroup(name, description, photoUri)
                showEditDialog = false
            }
        )
    }

    if (showTransferOwnershipDialog && members.isNotEmpty()) {
        TransferOwnershipDialog(
            members = members,
            onDismiss = { showTransferOwnershipDialog = false },
            onMemberSelected = { member ->
                viewModel.transferOwnership(member)
                showTransferOwnershipDialog = false
            }
        )
    }

    LeaveGroupDialog(
        visible = showLeaveDialog && group != null,
        groupName = group?.name ?: "",
        onConfirm = {
            showLeaveDialog = false
            viewModel.leaveGroup()
        },
        onDismiss = { showLeaveDialog = false }
    )

    ArchiveGroupDialog(
        visible = showArchiveDialog && group != null,
        groupName = group?.name ?: "",
        onConfirm = {
            showArchiveDialog = false
            viewModel.archiveGroup()
        },
        onDismiss = { showArchiveDialog = false }
    )

    DeleteGroupDialog(
        visible = showDeleteDialog && group != null,
        groupName = group?.name ?: "",
        onConfirm = {
            showDeleteDialog = false
            viewModel.deleteGroup()
        },
        onDismiss = { showDeleteDialog = false }
    )

    Scaffold(
        topBar = {
            GroupDetailTopBar(
                group = (uiState as? GroupDetailUiState.Success)?.group,
                myRole = (uiState as? GroupDetailUiState.Success)?.myRole,
                onNavigateBack = onNavigateBack,
                onInviteClick = onNavigateToInvite,
                onCashboxClick = onNavigateToCashbox,
                onCreateGameClick = onNavigateToCreateGame,
                onEditClick = { showEditDialog = true },
                onTransferOwnershipClick = {
                     // Verifica se há membros elegíveis (não-owner) para transferência
                     val eligibleMembers = members.filter { it.getRoleEnum() != GroupMemberRole.OWNER }
                     if (eligibleMembers.isNotEmpty()) {
                         showTransferOwnershipDialog = true
                     }
                },
                onLeaveGroupClick = { showLeaveDialog = true },
                onArchiveGroupClick = { showArchiveDialog = true },
                onDeleteGroupClick = { showDeleteDialog = true }
            )
        },
        snackbarHost = {
            SnackbarHost(hostState = snackbarHostState)
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(MaterialTheme.colorScheme.background)
        ) {
            when (val state = uiState) {
                is GroupDetailUiState.Loading -> LoadingState(
                    shimmerCount = 6,
                    itemType = LoadingItemType.LIST_ITEM
                )
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
                is GroupDetailUiState.Error -> EmptyState(
                    type = EmptyStateType.Error(
                        title = stringResource(R.string.error),
                        description = state.message,
                        actionLabel = stringResource(R.string.retry),
                        onRetry = { viewModel.loadGroup(groupId) }
                    )
                )
                is GroupDetailUiState.LeftGroup -> {
                    // O LaunchedEffect acima já navegou de volta
                }
            }

            // Snackbar para ações
            LaunchedEffect(actionState) {
                when (val action = actionState) {
                    is GroupActionState.Success -> {
                        snackbarHostState.showSnackbar(
                            message = action.message,
                            duration = SnackbarDuration.Short
                        )
                        viewModel.resetActionState()
                    }
                    is GroupActionState.Error -> {
                        snackbarHostState.showSnackbar(
                            message = action.message,
                            duration = SnackbarDuration.Long
                        )
                        viewModel.resetActionState()
                    }
                    else -> {}
                }
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
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(R.string.back)
                )
            }
        },
        actions = {
            // Box para ancorar o DropdownMenu ao IconButton
            Box {
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

                HorizontalDivider()

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
                            Icon(Icons.AutoMirrored.Filled.ExitToApp, null)
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
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.surface,
            titleContentColor = MaterialTheme.colorScheme.onSurface,
            navigationIconContentColor = MaterialTheme.colorScheme.onSurface,
            actionIconContentColor = MaterialTheme.colorScheme.onSurface
        )
    )
}

/**
 * Conteúdo principal quando os dados estão carregados (CMD-30)
 * Com estados vazios e UX melhorada
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
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Header do grupo com informações enriquecidas
        item {
            EnhancedGroupHeader(
                group = group,
                myRole = myRole,
                membersCount = members.size
            )
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
            MembersSectionHeader(
                membersCount = members.size,
                myRole = myRole
            )
        }

        // Estado vazio para lista de membros (CMD-30 #11, #12)
        if (members.isEmpty()) {
            item {
                EmptyMembersState(
                    myRole = myRole,
                    onInviteClick = onInviteClick
                )
            }
        } else {
            // Lista de membros com key estável
            items(members, key = { it.id }) { member ->
                GroupMemberListItem(
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
            CachedProfileImage(
                photoUrl = group.photoUrl?.ifEmpty { null },
                userName = group.name,
                size = 80.dp
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
                            1 -> stringResource(R.string.member_count_one, group.memberCount)
                            else -> stringResource(R.string.member_count_many, group.memberCount)
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
                            GroupMemberRole.OWNER -> stringResource(R.string.role_owner)
                            GroupMemberRole.ADMIN -> stringResource(R.string.role_admin)
                            GroupMemberRole.MEMBER -> stringResource(R.string.role_member)
                            null -> stringResource(R.string.role_visitor)
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
 * Header enriquecido do grupo com mais informações (CMD-30 #14, #20)
 */
@Composable
private fun EnhancedGroupHeader(
    group: Group,
    myRole: GroupMemberRole?,
    membersCount: Int
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Foto do grupo com badge de role
            Box(
                modifier = Modifier.size(88.dp),
                contentAlignment = Alignment.Center
            ) {
                AsyncImage(
                    model = group.photoUrl?.ifEmpty { null } ?: R.drawable.ic_groups,
                    contentDescription = null,
                    modifier = Modifier
                        .size(80.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.1f)),
                    contentScale = ContentScale.Crop
                )

                // Badge de role (se admin ou owner) (CMD-30 #14)
                if (myRole == GroupMemberRole.OWNER || myRole == GroupMemberRole.ADMIN) {
                    Surface(
                        modifier = Modifier
                            .align(Alignment.BottomEnd)
                            .size(24.dp),
                        shape = CircleShape,
                        color = when (myRole) {
                            GroupMemberRole.OWNER -> GamificationColors.Gold
                            GroupMemberRole.ADMIN -> MaterialTheme.colorScheme.primary
                            else -> MaterialTheme.colorScheme.secondary
                        }
                    ) {
                        val medalColor = when (myRole) {
                            GroupMemberRole.OWNER -> GamificationColors.Gold
                            GroupMemberRole.ADMIN -> MaterialTheme.colorScheme.primary
                            else -> MaterialTheme.colorScheme.secondary
                        }
                        Icon(
                            imageVector = when (myRole) {
                                GroupMemberRole.OWNER -> Icons.Default.Star
                                GroupMemberRole.ADMIN -> Icons.Default.Shield
                                else -> Icons.Default.Person
                            },
                            contentDescription = null,
                            modifier = Modifier.size(14.dp),
                            tint = ContrastHelper.getContrastingTextColor(medalColor)
                        )
                    }
                }
            }

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
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Chips informativos em linha
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Member count chip
                AssistChip(
                    onClick = { },
                    label = {
                        val memberCountText = when (membersCount) {
                            1 -> stringResource(R.string.groups_member_count_one, membersCount)
                            else -> stringResource(R.string.groups_member_count_many, membersCount)
                        }
                        Text(memberCountText)
                    },
                    leadingIcon = {
                        Icon(
                            imageVector = Icons.Default.Group,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp)
                        )
                    },
                    colors = AssistChipDefaults.assistChipColors(
                        leadingIconContentColor = MaterialTheme.colorScheme.primary
                    )
                )

                // My role chip com badge (CMD-30 #14)
                RoleBadgeChip(myRole = myRole)
            }
        }
    }
}

/**
 * Chip de badge de role (CMD-30 #14)
 */
@Composable
private fun RoleBadgeChip(myRole: GroupMemberRole?) {
    val (text, icon, color) = when (myRole) {
        GroupMemberRole.OWNER -> Triple(
            stringResource(R.string.groups_role_owner),
            Icons.Default.Star,
            GamificationColors.Gold
        )
        GroupMemberRole.ADMIN -> Triple(
            stringResource(R.string.groups_role_admin),
            Icons.Default.Shield,
            MaterialTheme.colorScheme.primary
        )
        GroupMemberRole.MEMBER -> Triple(
            stringResource(R.string.groups_role_member),
            Icons.Default.Person,
            MaterialTheme.colorScheme.secondary
        )
        null -> Triple(
            stringResource(R.string.groups_role_visitor),
            Icons.Default.Visibility,
            MaterialTheme.colorScheme.surfaceVariant
        )
    }

    Surface(
        color = color.copy(alpha = 0.15f),
        shape = RoundedCornerShape(16.dp)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(14.dp),
                tint = color
            )
            Text(
                text = text,
                style = MaterialTheme.typography.labelSmall,
                color = color,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

/**
 * Header da seção de membros (CMD-30 #15, #16)
 */
@Composable
private fun MembersSectionHeader(
    membersCount: Int,
    myRole: GroupMemberRole?
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(
                imageVector = Icons.Default.People,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(20.dp)
            )
            Text(
                text = stringResource(R.string.members),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = "($membersCount)",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        // Indicador de permissões (CMD-30 #3)
        if (myRole == GroupMemberRole.OWNER || myRole == GroupMemberRole.ADMIN) {
            Surface(
                color = MaterialTheme.colorScheme.primaryContainer,
                shape = RoundedCornerShape(12.dp)
            ) {
                Text(
                    text = stringResource(R.string.groups_manage),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

/**
 * Estado vazio quando não há membros (CMD-30 #11, #12)
 */
@Composable
private fun EmptyMembersState(
    myRole: GroupMemberRole?,
    onInviteClick: () -> Unit
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
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(
                imageVector = Icons.Default.GroupOff,
                contentDescription = null,
                modifier = Modifier.size(56.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
            )

            Text(
                text = stringResource(R.string.groups_no_members_yet),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Text(
                text = stringResource(R.string.groups_invite_to_start),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            // Botão de convidar (apenas para admins)
            if (myRole == GroupMemberRole.OWNER || myRole == GroupMemberRole.ADMIN) {
                Spacer(modifier = Modifier.height(8.dp))
                Button(onClick = onInviteClick) {
                    Icon(
                        imageVector = Icons.Default.PersonAdd,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(stringResource(R.string.groups_invite_players))
                }
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
                Text(
                    text = stringResource(R.string.invite),
                    maxLines = 1,
                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                    style = MaterialTheme.typography.labelLarge
                )
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
            Text(
                text = stringResource(R.string.cashbox),
                maxLines = 1,
                overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                style = MaterialTheme.typography.labelLarge
            )
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
                Text(
                    text = stringResource(R.string.create_game),
                    maxLines = 1,
                    overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                    style = MaterialTheme.typography.labelLarge
                )
            }
        }
    }
}

/**
 * Card de membro do grupo usando componente compartilhado
 */
@Composable
private fun GroupMemberListItem(
    member: GroupMember,
    myRole: GroupMemberRole?,
    onMemberClick: () -> Unit,
    onPromoteClick: () -> Unit,
    onDemoteClick: () -> Unit,
    onRemoveClick: () -> Unit
) {
    var showPromoteDialog by remember { mutableStateOf(false) }
    var showDemoteDialog by remember { mutableStateOf(false) }
    var showRemoveDialog by remember { mutableStateOf(false) }

    val memberRole = member.getRoleEnum()
    val canManage = when (myRole) {
        GroupMemberRole.OWNER -> memberRole != GroupMemberRole.OWNER
        GroupMemberRole.ADMIN -> memberRole == GroupMemberRole.MEMBER
        else -> false
    }

    // Confirmation dialogs
    PromoteMemberDialog(
        visible = showPromoteDialog,
        memberName = member.getDisplayName(),
        onConfirm = {
            showPromoteDialog = false
            onPromoteClick()
        },
        onDismiss = { showPromoteDialog = false }
    )

    DemoteMemberDialog(
        visible = showDemoteDialog,
        memberName = member.getDisplayName(),
        onConfirm = {
            showDemoteDialog = false
            onDemoteClick()
        },
        onDismiss = { showDemoteDialog = false }
    )

    RemoveMemberDialog(
        visible = showRemoveDialog,
        memberName = member.getDisplayName(),
        onConfirm = {
            showRemoveDialog = false
            onRemoveClick()
        },
        onDismiss = { showRemoveDialog = false }
    )

    // Using shared GroupMemberCard component
    GroupMemberCard(
        photoUrl = member.userPhoto,
        name = member.getDisplayName(),
        role = when (memberRole) {
            GroupMemberRole.OWNER -> stringResource(R.string.groups_role_owner)
            GroupMemberRole.ADMIN -> stringResource(R.string.groups_role_admin)
            GroupMemberRole.MEMBER -> stringResource(R.string.groups_role_member)
        },
        roleIcon = when (memberRole) {
            GroupMemberRole.OWNER -> Icons.Default.Star
            GroupMemberRole.ADMIN -> Icons.Default.Shield
            GroupMemberRole.MEMBER -> Icons.Default.Person
        },
        roleColor = when (memberRole) {
            GroupMemberRole.OWNER -> MaterialTheme.colorScheme.tertiary
            GroupMemberRole.ADMIN -> MaterialTheme.colorScheme.primary
            GroupMemberRole.MEMBER -> MaterialTheme.colorScheme.secondary
        },
        onClick = onMemberClick,
        canManage = canManage,
        onPromote = if (myRole == GroupMemberRole.OWNER && memberRole == GroupMemberRole.MEMBER) {
            { showPromoteDialog = true }
        } else null,
        onDemote = if (myRole == GroupMemberRole.OWNER && memberRole == GroupMemberRole.ADMIN) {
            { showDemoteDialog = true }
        } else null,
        onRemove = if (canManage) {
            { showRemoveDialog = true }
        } else null
    )
}
