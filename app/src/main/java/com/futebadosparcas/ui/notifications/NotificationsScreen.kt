package com.futebadosparcas.ui.notifications

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.R
import com.futebadosparcas.data.model.AppNotification
import com.futebadosparcas.data.model.NotificationType
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateType
import com.futebadosparcas.ui.components.ShimmerListContent
import com.futebadosparcas.ui.components.ShimmerBox
import com.futebadosparcas.ui.components.design.AppTopBar
import com.futebadosparcas.ui.theme.GamificationColors
import com.futebadosparcas.ui.theme.statusBarsPadding
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Tela principal de notificações com Material Design 3
 *
 * Características:
 * - Pull-to-refresh
 * - Swipe-to-dismiss com undo
 * - Agrupamento por data (Hoje, Ontem, Esta Semana, Antigas)
 * - Badge animado de não lidas
 * - Loading shimmer
 * - Empty states
 * - Action buttons (Aceitar/Recusar convites)
 * - Filtro por tipo de notificação
 * - Destaque especial para conquistas
 * - Feedback háptico
 * - Animações de entrada
 */

// ========== Filtros de Notificação ==========

/**
 * Tipos de filtro disponíveis
 */
enum class NotificationFilter(val labelRes: Int, val icon: ImageVector) {
    ALL(R.string.notifications_filter_all, Icons.Default.AllInbox),
    GAMES(R.string.notifications_filter_games, Icons.Default.SportsScore),
    GROUPS(R.string.notifications_filter_groups, Icons.Default.Groups),
    ACHIEVEMENTS(R.string.notifications_filter_achievements, Icons.Default.Star),
    SYSTEM(R.string.notifications_filter_system, Icons.Default.Info)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsScreen(
    viewModel: NotificationsViewModel,
    onNotificationClick: (AppNotification) -> Unit,
    onBackClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val actionState by viewModel.actionState.collectAsStateWithLifecycle()
    val unreadCount by viewModel.unreadCount.collectAsStateWithLifecycle()

    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    // Melhoria 2: Filtro por tipo
    var selectedFilter by remember { mutableStateOf(NotificationFilter.ALL) }

    // Pull-to-refresh state
    var isRefreshing by remember { mutableStateOf(false) }

    // Melhoria 5: Dialog de confirmação para excluir antigas
    var showDeleteConfirmDialog by remember { mutableStateOf(false) }

    // Melhoria 8: Estado para undo de delete
    var lastDeletedNotification by remember { mutableStateOf<AppNotification?>(null) }

    // Reseta o estado de refresh quando terminar
    LaunchedEffect(uiState) {
        if (uiState !is NotificationsUiState.Loading) {
            isRefreshing = false
        }
    }

    // Snackbar para ações
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(actionState) {
        when (actionState) {
            is NotificationActionState.Success -> {
                snackbarHostState.showSnackbar((actionState as NotificationActionState.Success).message)
                viewModel.resetActionState()
            }
            is NotificationActionState.InviteAccepted -> {
                snackbarHostState.showSnackbar((actionState as NotificationActionState.InviteAccepted).message)
                viewModel.resetActionState()
            }
            is NotificationActionState.InviteDeclined -> {
                snackbarHostState.showSnackbar((actionState as NotificationActionState.InviteDeclined).message)
                viewModel.resetActionState()
            }
            is NotificationActionState.Error -> {
                snackbarHostState.showSnackbar((actionState as NotificationActionState.Error).message)
                viewModel.resetActionState()
            }
            else -> {}
        }
    }

    // Melhoria 8: Mostrar snackbar com undo após delete
    LaunchedEffect(lastDeletedNotification) {
        lastDeletedNotification?.let { notification ->
            val result = snackbarHostState.showSnackbar(
                message = context.getString(R.string.notifications_deleted),
                actionLabel = context.getString(R.string.notifications_undo),
                duration = SnackbarDuration.Short
            )
            if (result == SnackbarResult.ActionPerformed) {
                // Restaurar notificação
                viewModel.restoreNotification(notification)
            }
            lastDeletedNotification = null
        }
    }

    // String resources (must be read at composable level)
    val emptyTitle = stringResource(R.string.fragment_notifications_text_1)
    val emptyDescription = stringResource(R.string.fragment_notifications_text_2)

    // Melhoria 5: Dialog de confirmação
    if (showDeleteConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirmDialog = false },
            icon = { Icon(Icons.Default.DeleteSweep, contentDescription = null) },
            title = { Text(stringResource(R.string.notifications_delete_old_title)) },
            text = { Text(stringResource(R.string.notifications_delete_old_message)) },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.deleteOldNotifications()
                        showDeleteConfirmDialog = false
                    },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Text(stringResource(R.string.notifications_delete_confirm))
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirmDialog = false }) {
                    Text(stringResource(R.string.cancel))
                }
            }
        )
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        topBar = {
            NotificationsTopBar(
                unreadCount = unreadCount,
                onBackClick = onBackClick,
                onMarkAllRead = { viewModel.markAllAsRead() },
                onDeleteOld = { showDeleteConfirmDialog = true } // Melhoria 5
            )
        },
        snackbarHost = {
            SnackbarHost(hostState = snackbarHostState)
        },
        // Melhoria 13: FAB para limpar todas (quando há muitas)
        floatingActionButton = {
            val state = uiState
            if (state is NotificationsUiState.Success && state.notifications.size > 20) {
                ExtendedFloatingActionButton(
                    onClick = { showDeleteConfirmDialog = true },
                    icon = { Icon(Icons.Default.ClearAll, contentDescription = null) },
                    text = { Text(stringResource(R.string.notifications_clear_all)) },
                    containerColor = MaterialTheme.colorScheme.errorContainer,
                    contentColor = MaterialTheme.colorScheme.onErrorContainer
                )
            }
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Melhoria 2: Filtros de tipo
            NotificationFilterChips(
                selectedFilter = selectedFilter,
                onFilterSelected = { selectedFilter = it },
                modifier = Modifier.padding(vertical = 8.dp)
            )

            Box(modifier = Modifier.weight(1f)) {
                PullToRefreshBox(
                    isRefreshing = isRefreshing,
                    onRefresh = {
                        isRefreshing = true
                        viewModel.loadNotifications()
                    },
                    modifier = Modifier.fillMaxSize()
                ) {
                    when (val state = uiState) {
                        is NotificationsUiState.Loading -> {
                            NotificationsLoadingState()
                        }

                        is NotificationsUiState.Empty -> {
                            EmptyState(
                                type = EmptyStateType.NoData(
                                    title = emptyTitle,
                                    description = emptyDescription,
                                    icon = Icons.Default.Notifications
                                )
                            )
                        }

                        is NotificationsUiState.Success -> {
                            // Melhoria 2: Aplicar filtro
                            val filteredNotifications = remember(state.notifications, selectedFilter) {
                                filterNotifications(state.notifications, selectedFilter)
                            }

                            if (filteredNotifications.isEmpty()) {
                                EmptyState(
                                    type = EmptyStateType.NoData(
                                        title = stringResource(R.string.notifications_filter_empty),
                                        description = stringResource(R.string.notifications_filter_empty_desc),
                                        icon = Icons.Default.FilterList
                                    )
                                )
                            } else {
                                NotificationsContent(
                                    notifications = filteredNotifications,
                                    onNotificationClick = { notification ->
                                        viewModel.markAsRead(notification.id)
                                        onNotificationClick(notification)
                                    },
                                    onAccept = { notification ->
                                        viewModel.handleNotificationAction(notification, accept = true)
                                    },
                                    onDecline = { notification ->
                                        viewModel.handleNotificationAction(notification, accept = false)
                                    },
                                    onDelete = { notification ->
                                        // Melhoria 11: Feedback háptico
                                        vibrateDevice(context)
                                        viewModel.deleteNotification(notification.id)
                                        // Melhoria 8: Guardar para undo
                                        lastDeletedNotification = notification
                                    },
                                    onToggleRead = { notification ->
                                        // Melhoria 3: Toggle lida/não lida
                                        if (notification.read) {
                                            viewModel.markAsUnread(notification.id)
                                        } else {
                                            viewModel.markAsRead(notification.id)
                                        }
                                    }
                                )
                            }
                        }

                        is NotificationsUiState.Error -> {
                            EmptyState(
                                type = EmptyStateType.Error(
                                    title = stringResource(R.string.notifications_load_error),
                                    description = state.message,
                                    onRetry = { viewModel.loadNotifications() }
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
 * Melhoria 2: Chips de filtro por tipo
 */
@Composable
private fun NotificationFilterChips(
    selectedFilter: NotificationFilter,
    onFilterSelected: (NotificationFilter) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyRow(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        contentPadding = PaddingValues(horizontal = 16.dp)
    ) {
        items(NotificationFilter.entries) { filter ->
            FilterChip(
                selected = selectedFilter == filter,
                onClick = { onFilterSelected(filter) },
                label = { Text(stringResource(filter.labelRes)) },
                leadingIcon = {
                    Icon(
                        imageVector = filter.icon,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                    selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        }
    }
}

/**
 * Filtra notificações por tipo
 */
private fun filterNotifications(
    notifications: List<AppNotification>,
    filter: NotificationFilter
): List<AppNotification> {
    if (filter == NotificationFilter.ALL) return notifications

    return notifications.filter { notification ->
        when (filter) {
            NotificationFilter.ALL -> true
            NotificationFilter.GAMES -> notification.getTypeEnum() in listOf(
                NotificationType.GAME_SUMMON,
                NotificationType.GAME_REMINDER,
                NotificationType.GAME_CANCELLED,
                NotificationType.GAME_CONFIRMED,
                NotificationType.GAME_VACANCY
            )
            NotificationFilter.GROUPS -> notification.getTypeEnum() in listOf(
                NotificationType.GROUP_INVITE,
                NotificationType.GROUP_INVITE_ACCEPTED,
                NotificationType.GROUP_INVITE_DECLINED,
                NotificationType.MEMBER_JOINED,
                NotificationType.MEMBER_LEFT
            )
            NotificationFilter.ACHIEVEMENTS -> notification.getTypeEnum() == NotificationType.ACHIEVEMENT
            NotificationFilter.SYSTEM -> notification.getTypeEnum() in listOf(
                NotificationType.ADMIN_MESSAGE,
                NotificationType.SYSTEM,
                NotificationType.GENERAL,
                NotificationType.CASHBOX_ENTRY,
                NotificationType.CASHBOX_EXIT
            )
        }
    }
}

/**
 * TopBar com badge animado de não lidas e menu de ações
 * Melhoria 6 e 14: Badge com animação de pulsação/bounce
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NotificationsTopBar(
    unreadCount: Int,
    onBackClick: () -> Unit,
    onMarkAllRead: () -> Unit,
    onDeleteOld: () -> Unit
) {
    var showMenu by remember { mutableStateOf(false) }

    // Melhoria 14: Animação quando o badge muda
    var previousCount by remember { mutableIntStateOf(unreadCount) }
    val badgeScale = remember { Animatable(1f) }

    LaunchedEffect(unreadCount) {
        if (unreadCount != previousCount && unreadCount > 0) {
            // Bounce animation
            badgeScale.animateTo(
                targetValue = 1.3f,
                animationSpec = spring(
                    dampingRatio = Spring.DampingRatioMediumBouncy,
                    stiffness = Spring.StiffnessLow
                )
            )
            badgeScale.animateTo(
                targetValue = 1f,
                animationSpec = spring(
                    dampingRatio = Spring.DampingRatioMediumBouncy
                )
            )
        }
        previousCount = unreadCount
    }

    // Melhoria 6: Pulsação contínua quando há não lidas
    val pulseAnimation = rememberInfiniteTransition(label = "pulse")
    val pulseScale by pulseAnimation.animateFloat(
        initialValue = 1f,
        targetValue = 1.1f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "badgePulse"
    )

    TopAppBar(
        title = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = stringResource(R.string.notifications),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )

                // Badge de não lidas com animação
                AnimatedVisibility(
                    visible = unreadCount > 0,
                    enter = scaleIn() + fadeIn(),
                    exit = scaleOut() + fadeOut()
                ) {
                    Surface(
                        shape = CircleShape,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier
                            .defaultMinSize(minWidth = 24.dp, minHeight = 24.dp)
                            .scale(badgeScale.value * pulseScale)
                    ) {
                        Box(
                            contentAlignment = Alignment.Center,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = if (unreadCount > 99) "99+" else unreadCount.toString(),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onError,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        },
        navigationIcon = {
            IconButton(
                onClick = onBackClick,
                modifier = Modifier.semantics {
                    role = Role.Button
                }
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(R.string.notifications_cd_back)
                )
            }
        },
        actions = {
            IconButton(onClick = { showMenu = true }) {
                Icon(
                    imageVector = Icons.Default.MoreVert,
                    contentDescription = stringResource(R.string.notifications_cd_menu)
                )
            }

            DropdownMenu(
                expanded = showMenu,
                onDismissRequest = { showMenu = false }
            ) {
                DropdownMenuItem(
                    text = { Text(stringResource(R.string.menu_notifications_title_1)) },
                    onClick = {
                        onMarkAllRead()
                        showMenu = false
                    },
                    leadingIcon = {
                        Icon(Icons.Default.DoneAll, contentDescription = null)
                    }
                )
                DropdownMenuItem(
                    text = { Text(stringResource(R.string.menu_notifications_title_2)) },
                    onClick = {
                        onDeleteOld()
                        showMenu = false
                    },
                    leadingIcon = {
                        Icon(Icons.Default.Delete, contentDescription = null)
                    }
                )
            }
        },
        colors = AppTopBar.surfaceColors(),
        modifier = Modifier.statusBarsPadding()
    )
}

/**
 * Conteúdo principal com notificações agrupadas
 * Melhoria 1: Animação de entrada
 */
@Composable
private fun NotificationsContent(
    notifications: List<AppNotification>,
    onNotificationClick: (AppNotification) -> Unit,
    onAccept: (AppNotification) -> Unit,
    onDecline: (AppNotification) -> Unit,
    onDelete: (AppNotification) -> Unit,
    onToggleRead: (AppNotification) -> Unit // Melhoria 3
) {
    val context = LocalContext.current
    val listState = rememberLazyListState()

    // Agrupa notificações por data
    val groupedNotifications = remember(notifications) {
        groupNotificationsByDate(context, notifications)
    }

    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(vertical = 8.dp)
    ) {
        groupedNotifications.forEach { (section, notificationsList) ->
            // Melhoria 7 e 12: Cabeçalho melhorado com contagem
            item(key = "header_$section") {
                NotificationSectionHeader(
                    section = section,
                    count = notificationsList.size
                )
            }

            // Melhoria 1: Itens com animação de entrada
            itemsIndexed(
                items = notificationsList,
                key = { _, notification -> notification.id }
            ) { index, notification ->
                AnimatedNotificationItem(
                    notification = notification,
                    index = index,
                    onClick = { onNotificationClick(notification) },
                    onAccept = { onAccept(notification) },
                    onDecline = { onDecline(notification) },
                    onDelete = { onDelete(notification) },
                    onToggleRead = { onToggleRead(notification) }
                )
            }
        }

        // Melhoria 9: Espaço final para FAB
        item {
            Spacer(modifier = Modifier.height(80.dp))
        }
    }
}

/**
 * Melhoria 1: Item com animação de entrada
 */
@Composable
private fun AnimatedNotificationItem(
    notification: AppNotification,
    index: Int,
    onClick: () -> Unit,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
    onDelete: () -> Unit,
    onToggleRead: () -> Unit
) {
    var visible by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        delay(index * 50L) // Stagger effect
        visible = true
    }

    AnimatedVisibility(
        visible = visible,
        enter = slideInHorizontally(
            initialOffsetX = { it },
            animationSpec = spring(
                dampingRatio = Spring.DampingRatioMediumBouncy,
                stiffness = Spring.StiffnessLow
            )
        ) + fadeIn(animationSpec = tween(300))
    ) {
        SwipeableNotificationCard(
            notification = notification,
            onClick = onClick,
            onAccept = onAccept,
            onDecline = onDecline,
            onDelete = onDelete,
            onToggleRead = onToggleRead
        )
    }
}

/**
 * Melhoria 7 e 12: Cabeçalho de seção melhorado
 */
@Composable
private fun NotificationSectionHeader(
    section: String,
    count: Int
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Linha decorativa
        HorizontalDivider(
            modifier = Modifier.width(24.dp),
            thickness = 2.dp,
            color = MaterialTheme.colorScheme.primary
        )

        Text(
            text = section,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )

        // Melhoria 12: Badge com contagem
        Surface(
            shape = CircleShape,
            color = MaterialTheme.colorScheme.primaryContainer,
            modifier = Modifier.defaultMinSize(minWidth = 24.dp, minHeight = 24.dp)
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
            ) {
                Text(
                    text = count.toString(),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        // Linha decorativa expandida
        HorizontalDivider(
            modifier = Modifier.weight(1f),
            thickness = 1.dp,
            color = MaterialTheme.colorScheme.outlineVariant
        )
    }
}

/**
 * Card de notificação com swipe-to-dismiss
 * Melhoria 4: Animação do ícone de delete
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SwipeableNotificationCard(
    notification: AppNotification,
    onClick: () -> Unit,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
    onDelete: () -> Unit,
    onToggleRead: () -> Unit
) {
    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { dismissValue ->
            when (dismissValue) {
                SwipeToDismissBoxValue.EndToStart -> {
                    onDelete()
                    true
                }
                else -> false
            }
        }
    )

    // Melhoria 4: Escala do ícone baseada no progresso do swipe
    val progress = dismissState.progress
    val iconScale = remember(progress) {
        when {
            progress < 0.3f -> 0.8f
            progress < 0.6f -> 1f + (progress - 0.3f)
            else -> 1.3f
        }
    }

    SwipeToDismissBox(
        state = dismissState,
        backgroundContent = {
            // Fundo só aparece durante o swipe
            val isSwipeActive = dismissState.targetValue != SwipeToDismissBoxValue.Settled

            if (isSwipeActive) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(MaterialTheme.colorScheme.error)
                        .padding(horizontal = 20.dp),
                    contentAlignment = Alignment.CenterEnd
                ) {
                    Icon(
                        imageVector = Icons.Default.Delete,
                        contentDescription = stringResource(R.string.notifications_cd_delete),
                        tint = MaterialTheme.colorScheme.onError,
                        modifier = Modifier
                            .scale(iconScale)
                            .graphicsLayer {
                                rotationZ = if (progress > 0.5f) -15f else 0f
                            }
                    )
                }
            }
        },
        enableDismissFromStartToEnd = false
    ) {
        NotificationCard(
            notification = notification,
            onClick = onClick,
            onAccept = onAccept,
            onDecline = onDecline,
            onToggleRead = onToggleRead
        )
    }
}

/**
 * Card individual de notificação
 * Melhoria 10: Destaque especial para conquistas
 * Melhoria 15: Acessibilidade melhorada
 */
@Composable
private fun NotificationCard(
    notification: AppNotification,
    onClick: () -> Unit,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
    onToggleRead: () -> Unit
) {
    val isAchievement = notification.getTypeEnum() == NotificationType.ACHIEVEMENT

    // Melhoria 10: Gradiente dourado para conquistas
    val cardBackground = if (isAchievement && !notification.read) {
        Brush.linearGradient(
            colors = listOf(
                GamificationColors.Gold.copy(alpha = 0.15f),
                GamificationColors.Gold.copy(alpha = 0.05f)
            )
        )
    } else {
        null
    }

    // Melhoria 15: Descrição de acessibilidade completa
    val accessibilityDescription = buildString {
        append(notification.title)
        append(". ")
        append(notification.message)
        if (!notification.read) append(". Não lida")
        notification.createdAt?.let {
            append(". ")
            append(formatRelativeTime(it))
        }
    }

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .semantics {
                contentDescription = accessibilityDescription
                role = Role.Button
            }
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        color = if (!notification.read) {
            MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
        } else {
            MaterialTheme.colorScheme.surface
        },
        tonalElevation = if (!notification.read) 2.dp else 1.dp,
        border = if (isAchievement && !notification.read) {
            androidx.compose.foundation.BorderStroke(
                width = 1.dp,
                color = GamificationColors.Gold.copy(alpha = 0.5f)
            )
        } else null
    ) {
        Box(
            modifier = if (cardBackground != null) {
                Modifier.background(cardBackground)
            } else Modifier
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Ícone da notificação (com efeito especial para conquistas)
                NotificationIcon(
                    type = notification.getTypeEnum(),
                    isRead = notification.read,
                    isAchievement = isAchievement
                )

                // Conteúdo
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    // Título
                    Text(
                        text = notification.title,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = if (!notification.read) FontWeight.Bold else FontWeight.Normal,
                        color = if (isAchievement) GamificationColors.Gold else MaterialTheme.colorScheme.onSurface,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )

                    // Mensagem
                    Text(
                        text = notification.message,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )

                    // Data/hora
                    notification.createdAt?.let { date ->
                        Text(
                            text = formatRelativeTime(date),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                        )
                    }

                    // Botões de ação (se necessário)
                    if (notification.requiresResponse() && !notification.read) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(top = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedButton(
                                onClick = onDecline,
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.outlinedButtonColors(
                                    contentColor = MaterialTheme.colorScheme.error
                                )
                            ) {
                                Text(stringResource(R.string.item_notification_text_1))
                            }

                            Button(
                                onClick = onAccept,
                                modifier = Modifier.weight(1f)
                            ) {
                                Text(stringResource(R.string.item_notification_text_2))
                            }
                        }
                    }
                }

                // Coluna de indicadores e ações
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Indicador de não lida / botão toggle
                    IconButton(
                        onClick = onToggleRead,
                        modifier = Modifier.size(32.dp)
                    ) {
                        if (!notification.read) {
                            Box(
                                modifier = Modifier
                                    .size(12.dp)
                                    .clip(CircleShape)
                                    .background(
                                        if (isAchievement) GamificationColors.Gold
                                        else MaterialTheme.colorScheme.primary
                                    )
                            )
                        } else {
                            Icon(
                                imageVector = Icons.Default.MarkEmailUnread,
                                contentDescription = stringResource(R.string.notifications_mark_unread),
                                modifier = Modifier.size(16.dp),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Ícone da notificação baseado no tipo
 * Melhoria 10: Efeito especial para conquistas
 */
@Composable
private fun NotificationIcon(
    type: NotificationType,
    isRead: Boolean,
    isAchievement: Boolean = false
) {
    val (icon, color) = when (type) {
        // Grupo
        NotificationType.GROUP_INVITE -> Icons.Default.GroupAdd to MaterialTheme.colorScheme.secondary
        NotificationType.GROUP_INVITE_ACCEPTED -> Icons.Default.GroupAdd to MaterialTheme.colorScheme.primary
        NotificationType.GROUP_INVITE_DECLINED -> Icons.Default.GroupRemove to MaterialTheme.colorScheme.error
        NotificationType.MEMBER_JOINED -> Icons.Default.PersonAdd to MaterialTheme.colorScheme.secondary
        NotificationType.MEMBER_LEFT -> Icons.Default.PersonRemove to MaterialTheme.colorScheme.onSurfaceVariant
        // Jogo
        NotificationType.GAME_INVITE -> Icons.Default.SportsScore to MaterialTheme.colorScheme.primary
        NotificationType.GAME_SUMMON -> Icons.Default.SportsScore to MaterialTheme.colorScheme.tertiary
        NotificationType.GAME_REMINDER -> Icons.Default.AccessTime to MaterialTheme.colorScheme.tertiary
        NotificationType.GAME_CANCELLED -> Icons.Default.Cancel to MaterialTheme.colorScheme.error
        NotificationType.GAME_CONFIRMED -> Icons.Default.CheckCircle to MaterialTheme.colorScheme.primary
        NotificationType.GAME_UPDATED -> Icons.Default.Update to MaterialTheme.colorScheme.secondary
        NotificationType.GAME_VACANCY -> Icons.Default.PersonAdd to MaterialTheme.colorScheme.primary
        // Financeiro
        NotificationType.CASHBOX_ENTRY -> Icons.Default.AttachMoney to MaterialTheme.colorScheme.primary
        NotificationType.CASHBOX_EXIT -> Icons.Default.MoneyOff to MaterialTheme.colorScheme.error
        // Gamificacao
        NotificationType.ACHIEVEMENT -> Icons.Default.Star to GamificationColors.Gold
        NotificationType.LEVEL_UP -> Icons.Default.TrendingUp to GamificationColors.XpGreen
        NotificationType.MVP_RECEIVED -> Icons.Default.EmojiEvents to GamificationColors.Gold
        NotificationType.RANKING_CHANGED -> Icons.Default.Leaderboard to MaterialTheme.colorScheme.tertiary
        // Sistema
        NotificationType.ADMIN_MESSAGE -> Icons.Default.AdminPanelSettings to MaterialTheme.colorScheme.tertiary
        NotificationType.SYSTEM -> Icons.Default.Info to MaterialTheme.colorScheme.secondary
        NotificationType.GENERAL -> Icons.Default.Notifications to MaterialTheme.colorScheme.onSurfaceVariant
    }

    // Melhoria 10: Animação de brilho para conquistas
    val shimmerAnimation = rememberInfiniteTransition(label = "shimmer")
    val shimmerAlpha by shimmerAnimation.animateFloat(
        initialValue = 0.3f,
        targetValue = 0.6f,
        animationSpec = infiniteRepeatable(
            animation = tween(1500, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "shimmerAlpha"
    )

    Surface(
        shape = CircleShape,
        color = if (isAchievement && !isRead) {
            GamificationColors.Gold.copy(alpha = shimmerAlpha)
        } else {
            color.copy(alpha = if (isRead) 0.2f else 0.3f)
        },
        modifier = Modifier.size(48.dp),
        border = if (isAchievement && !isRead) {
            androidx.compose.foundation.BorderStroke(
                width = 1.dp,
                color = GamificationColors.Gold
            )
        } else null
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier.fillMaxSize()
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = color.copy(alpha = if (isRead) 0.6f else 1f),
                modifier = Modifier.size(24.dp)
            )
        }
    }
}

/**
 * Estado de loading com shimmer
 */
@Composable
private fun NotificationsLoadingState() {
    ShimmerListContent(
        count = 8,
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) { brush ->
        NotificationShimmerCard(brush)
    }
}

/**
 * Card shimmer para notificação
 */
@Composable
private fun NotificationShimmerCard(brush: Brush) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 1.dp
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Ícone shimmer
            ShimmerBox(
                modifier = Modifier.size(48.dp),
                cornerRadius = 24.dp
            )

            // Conteúdo shimmer
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                ShimmerBox(
                    modifier = Modifier
                        .fillMaxWidth(0.6f)
                        .height(20.dp)
                )
                ShimmerBox(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(40.dp)
                )
                ShimmerBox(
                    modifier = Modifier
                        .fillMaxWidth(0.3f)
                        .height(16.dp)
                )
            }
        }
    }
}

/**
 * Agrupa notificações por data (Hoje, Ontem, Esta Semana, Antigas)
 */
private fun groupNotificationsByDate(
    context: android.content.Context,
    notifications: List<AppNotification>
): Map<String, List<AppNotification>> {
    val grouped = LinkedHashMap<String, MutableList<AppNotification>>()
    val now = Calendar.getInstance()
    val today = Calendar.getInstance().apply {
        set(Calendar.HOUR_OF_DAY, 0)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
    }
    val yesterday = Calendar.getInstance().apply {
        timeInMillis = today.timeInMillis - TimeUnit.DAYS.toMillis(1)
    }
    val weekAgo = Calendar.getInstance().apply {
        timeInMillis = today.timeInMillis - TimeUnit.DAYS.toMillis(7)
    }

    notifications.forEach { notification ->
        val date = notification.createdAt
        val section = when {
            date == null -> context.getString(R.string.notifications_old)
            date.time >= today.timeInMillis -> context.getString(R.string.notifications_today)
            date.time >= yesterday.timeInMillis -> context.getString(R.string.notifications_yesterday)
            date.time >= weekAgo.timeInMillis -> context.getString(R.string.notifications_this_week)
            else -> context.getString(R.string.notifications_old)
        }

        grouped.getOrPut(section) { mutableListOf() }.add(notification)
    }

    return grouped
}

/**
 * Formata data/hora relativa (ex: "5 min atrás", "2 horas atrás")
 */
private fun formatRelativeTime(date: Date): String {
    val now = System.currentTimeMillis()
    val diff = now - date.time

    return when {
        diff < TimeUnit.MINUTES.toMillis(1) -> "Agora"
        diff < TimeUnit.HOURS.toMillis(1) -> {
            val minutes = TimeUnit.MILLISECONDS.toMinutes(diff)
            "${minutes}min atrás"
        }
        diff < TimeUnit.DAYS.toMillis(1) -> {
            val hours = TimeUnit.MILLISECONDS.toHours(diff)
            "${hours}h atrás"
        }
        diff < TimeUnit.DAYS.toMillis(7) -> {
            val days = TimeUnit.MILLISECONDS.toDays(diff)
            "${days}d atrás"
        }
        else -> {
            SimpleDateFormat("dd/MM/yyyy", Locale("pt", "BR")).format(date)
        }
    }
}

/**
 * Melhoria 11: Feedback háptico ao deletar
 */
@Suppress("DEPRECATION")
private fun vibrateDevice(context: Context) {
    try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            val vibrator = vibratorManager.defaultVibrator
            vibrator.vibrate(VibrationEffect.createOneShot(50, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
            val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createOneShot(50, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                vibrator.vibrate(50)
            }
        }
    } catch (e: Exception) {
        // Ignora erros de vibração
    }
}
