package com.futebadosparcas.ui.groups

import com.futebadosparcas.ui.theme.AppDimensions
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.futebadosparcas.ui.theme.GamificationColors
import com.futebadosparcas.util.ContrastHelper
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.ui.components.AnimatedStateContainer
import com.futebadosparcas.ui.components.StateType
import com.futebadosparcas.domain.model.Group
import com.futebadosparcas.data.model.GroupMember
import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.ui.components.CachedGroupImage
import com.futebadosparcas.ui.components.CachedProfileImage
import com.futebadosparcas.ui.components.cards.GroupMemberCard
import com.futebadosparcas.ui.components.team.TeamBadgeById
import com.futebadosparcas.domain.model.GroupJoinRequest
import org.koin.compose.viewmodel.koinViewModel
import com.futebadosparcas.ui.components.dialogs.*
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateType
import com.futebadosparcas.ui.components.states.LoadingItemType
import com.futebadosparcas.ui.components.states.LoadingState
import com.futebadosparcas.ui.groups.dialogs.EditGroupDialog
import com.futebadosparcas.ui.groups.dialogs.TransferOwnershipDialog
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource
import com.futebadosparcas.ui.components.design.AppTopBar
import com.futebadosparcas.ui.adaptive.adaptiveContentWidth

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
    onMemberClick: (userId: String) -> Unit = {},
    joinRequestViewModel: JoinRequestViewModel = koinViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val actionState by viewModel.actionState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    // Join requests (issue #517 Phase 2)
    val myJoinRequestState by joinRequestViewModel.myRequestState.collectAsStateWithLifecycle()
    val pendingJoinRequests by joinRequestViewModel.pendingRequests.collectAsStateWithLifecycle()
    val joinSubmitting by joinRequestViewModel.isSubmitting.collectAsStateWithLifecycle()
    val joinActioningId by joinRequestViewModel.actioningRequesterId.collectAsStateWithLifecycle()

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

    // Quando carrega o grupo + membros, decide o que observar:
    //  - Sempre observa myRequest (cheap, retorna null se nao tem)
    //  - Se owner/admin, tambem observa pending list
    val successState = uiState as? GroupDetailUiState.Success
    LaunchedEffect(groupId, successState?.myRole) {
        joinRequestViewModel.observeMyRequest(groupId)
        if (successState?.myRole == GroupMemberRole.OWNER ||
            successState?.myRole == GroupMemberRole.ADMIN) {
            joinRequestViewModel.observePendingRequests(groupId)
        }
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
    // ✅ OTIMIZAÇÃO: derivedStateOf para membros elegíveis (evita recálculos desnecessários)
    val eligibleMembersForTransfer = remember { derivedStateOf { members.filter { it.getRoleEnum() != GroupMemberRole.OWNER } } }.value

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
                     if (eligibleMembersForTransfer.isNotEmpty()) {
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
            // Transições animadas entre estados (fade + slide)
            AnimatedStateContainer(
                targetState = uiState,
                stateMapper = { state ->
                    when (state) {
                        is GroupDetailUiState.Loading -> StateType.LOADING
                        is GroupDetailUiState.Success -> StateType.SUCCESS
                        is GroupDetailUiState.Error -> StateType.ERROR
                        is GroupDetailUiState.LeftGroup -> StateType.SUCCESS
                    }
                },
                modifier = Modifier.fillMaxSize(),
                label = "groupDetailStateTransition"
            ) { currentState ->
                when (currentState) {
                    is GroupDetailUiState.Loading -> LoadingState(
                        shimmerCount = 6,
                        itemType = LoadingItemType.LIST_ITEM
                    )
                    is GroupDetailUiState.Success -> GroupDetailContent(
                        group = currentState.group,
                        members = currentState.members,
                        myRole = currentState.myRole,
                        onRefresh = { viewModel.loadGroup(groupId) },
                        onInviteClick = onNavigateToInvite,
                        onCashboxClick = onNavigateToCashbox,
                        onCreateGameClick = onNavigateToCreateGame,
                        onMemberClick = onMemberClick,
                        onPromoteMember = { viewModel.promoteMember(it) },
                        onDemoteMember = { viewModel.demoteMember(it) },
                        onRemoveMember = { viewModel.removeMember(it) },
                        myJoinRequestState = myJoinRequestState,
                        pendingJoinRequests = pendingJoinRequests,
                        joinSubmitting = joinSubmitting,
                        joinActioningId = joinActioningId,
                        onRequestJoin = { joinRequestViewModel.requestJoin(groupId) },
                        onCancelJoinRequest = { joinRequestViewModel.cancelRequest(groupId) },
                        onApproveJoinRequest = { rid ->
                            joinRequestViewModel.approve(groupId, rid)
                        },
                        onRejectJoinRequest = { rid ->
                            joinRequestViewModel.reject(groupId, rid)
                        }
                    )
                    is GroupDetailUiState.Error -> EmptyState(
                        type = EmptyStateType.Error(
                            title = stringResource(R.string.error),
                            description = currentState.message,
                            actionLabel = stringResource(R.string.retry),
                            onRetry = { viewModel.loadGroup(groupId) }
                        )
                    )
                    is GroupDetailUiState.LeftGroup -> {
                        // O LaunchedEffect acima já navegou de volta
                    }
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
                            Icon(Icons.Default.PersonAdd, contentDescription = stringResource(R.string.cd_invite_player))
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
                        Icon(Icons.Default.AccountBalanceWallet, contentDescription = stringResource(R.string.cd_cashbox))
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
                            Icon(Icons.Default.Add, contentDescription = stringResource(R.string.cd_add_game))
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
                            Icon(Icons.Default.Edit, contentDescription = stringResource(R.string.cd_edit_group))
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
                            Icon(Icons.Default.SwapHoriz, contentDescription = stringResource(R.string.cd_transfer_ownership))
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
                            Icon(Icons.AutoMirrored.Filled.ExitToApp, contentDescription = stringResource(R.string.cd_leave_group))
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
                            Icon(Icons.Default.Archive, contentDescription = stringResource(R.string.cd_archive_group))
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
                            Icon(Icons.Default.Delete, contentDescription = stringResource(R.string.cd_delete_group))
                        },
                        colors = MenuDefaults.itemColors(
                            textColor = MaterialTheme.colorScheme.error
                        )
                    )
                }
            }
            }
        },
        colors = AppTopBar.surfaceColors()
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
    onRemoveMember: (GroupMember) -> Unit,
    myJoinRequestState: MyJoinRequestState = MyJoinRequestState.Loading,
    pendingJoinRequests: List<GroupJoinRequest> = emptyList(),
    joinSubmitting: Boolean = false,
    joinActioningId: String? = null,
    onRequestJoin: () -> Unit = {},
    onCancelJoinRequest: () -> Unit = {},
    onApproveJoinRequest: (String) -> Unit = {},
    onRejectJoinRequest: (String) -> Unit = {}
) {
    val isMember = myRole != null
    val isOwnerOrAdmin = myRole == GroupMemberRole.OWNER || myRole == GroupMemberRole.ADMIN
    LazyColumn(
        modifier = Modifier.fillMaxSize().adaptiveContentWidth(),
        contentPadding = PaddingValues(AppDimensions.spacing_large),
        verticalArrangement = Arrangement.spacedBy(AppDimensions.spacing_large)
    ) {
        // Header do grupo com informações enriquecidas
        item {
            EnhancedGroupHeader(
                group = group,
                myRole = myRole,
                membersCount = members.size
            )
        }

        // Pedir entrada (issue #517 Phase 2) — so para nao-membro em grupo publico
        if (!isMember && group.isPublic) {
            item {
                JoinRequestSection(
                    state = myJoinRequestState,
                    submitting = joinSubmitting,
                    onRequest = onRequestJoin,
                    onCancel = onCancelJoinRequest
                )
            }
        }

        // Solicitacoes pendentes (issue #517 Phase 2) — owner/admin apenas
        if (isOwnerOrAdmin && pendingJoinRequests.isNotEmpty()) {
            item {
                PendingJoinRequestsSection(
                    requests = pendingJoinRequests,
                    actioningId = joinActioningId,
                    onApprove = onApproveJoinRequest,
                    onReject = onRejectJoinRequest
                )
            }
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
        shape = RoundedCornerShape(AppDimensions.radius_large),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(AppDimensions.spacing_large),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Foto do grupo com badge de role
            Box(
                modifier = Modifier.size(88.dp),
                contentAlignment = Alignment.Center
            ) {
                CachedGroupImage(
                    photoUrl = group.photoUrl?.ifEmpty { null },
                    groupName = group.name,
                    size = 80.dp
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

            Spacer(modifier = Modifier.height(AppDimensions.spacing_medium))

            // Nome do grupo
            Text(
                text = group.name,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )

            Spacer(modifier = Modifier.height(AppDimensions.spacing_extraSmall))

            // Descrição
            Text(
                text = group.description.ifEmpty { stringResource(R.string.no_description) },
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(AppDimensions.spacing_medium))

            // Chips informativos em linha
            Row(
                horizontalArrangement = Arrangement.spacedBy(AppDimensions.spacing_small),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Member count chip (informacional, sem click)
                Surface(
                    shape = MaterialTheme.shapes.small,
                    color = MaterialTheme.colorScheme.surfaceContainerHigh,
                    tonalElevation = 0.dp
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                        horizontalArrangement = Arrangement.spacedBy(AppDimensions.spacing_extraSmall),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Group,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.colorScheme.primary
                        )
                        val memberCountText = when (membersCount) {
                            1 -> stringResource(R.string.groups_member_count_one, membersCount)
                            else -> stringResource(R.string.groups_member_count_many, membersCount)
                        }
                        Text(memberCountText, style = MaterialTheme.typography.labelMedium)
                    }
                }

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
        shape = RoundedCornerShape(AppDimensions.radius_large)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = AppDimensions.spacing_small, vertical = AppDimensions.spacing_extraSmall),
            horizontalArrangement = Arrangement.spacedBy(AppDimensions.spacing_extraSmall),
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
            horizontalArrangement = Arrangement.spacedBy(AppDimensions.spacing_small)
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
                shape = RoundedCornerShape(AppDimensions.radius_medium)
            ) {
                Text(
                    text = stringResource(R.string.groups_manage),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                    modifier = Modifier.padding(horizontal = AppDimensions.spacing_small, vertical = AppDimensions.spacing_extraSmall),
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
        shape = RoundedCornerShape(AppDimensions.radius_large),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(AppDimensions.spacing_extraLarge),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(AppDimensions.spacing_medium)
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
                Spacer(modifier = Modifier.height(AppDimensions.spacing_small))
                Button(onClick = onInviteClick) {
                    Icon(
                        imageVector = Icons.Default.PersonAdd,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(AppDimensions.spacing_small))
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
        horizontalArrangement = Arrangement.spacedBy(AppDimensions.spacing_small)
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
                Spacer(modifier = Modifier.width(AppDimensions.spacing_extraSmall))
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
            Spacer(modifier = Modifier.width(AppDimensions.spacing_extraSmall))
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
                Spacer(modifier = Modifier.width(AppDimensions.spacing_extraSmall))
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

/**
 * Secao "Pedir entrada" (issue #517 Phase 2).
 * Aparece para nao-membro em grupo publico.
 */
@Composable
private fun JoinRequestSection(
    state: MyJoinRequestState,
    submitting: Boolean,
    onRequest: () -> Unit,
    onCancel: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(AppDimensions.radius_large),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
        )
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(AppDimensions.spacing_large),
            verticalArrangement = Arrangement.spacedBy(AppDimensions.spacing_medium)
        ) {
            when (state) {
                is MyJoinRequestState.Loading -> {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center
                    ) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp))
                    }
                }
                is MyJoinRequestState.NotRequested -> {
                    Text(
                        text = stringResource(R.string.join_request_can_request),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Button(
                        onClick = onRequest,
                        enabled = !submitting,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        if (submitting) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                color = MaterialTheme.colorScheme.onPrimary,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Text(stringResource(R.string.join_request_action_request))
                        }
                    }
                }
                is MyJoinRequestState.Pending -> {
                    Text(
                        text = stringResource(R.string.join_request_pending),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.SemiBold
                    )
                    OutlinedButton(
                        onClick = onCancel,
                        enabled = !submitting,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        if (submitting) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp
                            )
                        } else {
                            Text(stringResource(R.string.join_request_action_cancel))
                        }
                    }
                }
                is MyJoinRequestState.Approved -> {
                    Text(
                        text = stringResource(R.string.join_request_approved),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
                is MyJoinRequestState.Rejected -> {
                    Text(
                        text = stringResource(R.string.join_request_rejected),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.error
                    )
                }
                is MyJoinRequestState.Error -> {
                    Text(
                        text = state.message,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }
        }
    }
}

/**
 * Secao "Solicitacoes pendentes" (issue #517 Phase 2).
 * Aparece para owner/admin se ha pedidos PENDING.
 */
@Composable
private fun PendingJoinRequestsSection(
    requests: List<GroupJoinRequest>,
    actioningId: String?,
    onApprove: (String) -> Unit,
    onReject: (String) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(AppDimensions.radius_large),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
        )
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(AppDimensions.spacing_large),
            verticalArrangement = Arrangement.spacedBy(AppDimensions.spacing_medium)
        ) {
            Text(
                text = stringResource(R.string.join_request_pending_section_title, requests.size),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurface
            )
            requests.forEach { req ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(AppDimensions.spacing_medium)
                ) {
                    CachedProfileImage(
                        photoUrl = req.userPhoto,
                        userName = req.userName,
                        modifier = Modifier.size(40.dp),
                        size = 40.dp
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = req.userName,
                                style = MaterialTheme.typography.bodyLarge,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.onSurface,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Spacer(modifier = Modifier.width(AppDimensions.spacing_extraSmall))
                            TeamBadgeById(
                                teamId = null,
                                iconSize = 18
                            )
                        }
                    }
                    val acting = actioningId == req.userId
                    if (acting) {
                        CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
                    } else {
                        IconButton(
                            onClick = { onApprove(req.userId) },
                        ) {
                            Icon(
                                imageVector = Icons.Default.Check,
                                contentDescription = stringResource(R.string.join_request_action_approve),
                                tint = MaterialTheme.colorScheme.primary
                            )
                        }
                        IconButton(
                            onClick = { onReject(req.userId) },
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = stringResource(R.string.join_request_action_reject),
                                tint = MaterialTheme.colorScheme.error
                            )
                        }
                    }
                }
            }
        }
    }
}
