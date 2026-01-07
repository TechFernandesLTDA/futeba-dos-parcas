package com.futebadosparcas.ui.notifications

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
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
import com.futebadosparcas.ui.theme.statusBarsPadding
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.TimeUnit

/**
 * Tela principal de notificações com Material Design 3
 *
 * Características:
 * - Pull-to-refresh
 * - Swipe-to-dismiss
 * - Agrupamento por data (Hoje, Ontem, Esta Semana, Antigas)
 * - Badge de não lidas
 * - Loading shimmer
 * - Empty states
 * - Action buttons (Aceitar/Recusar convites)
 */
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

    // Pull-to-refresh state
    var isRefreshing by remember { mutableStateOf(false) }

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

    // String resources (must be read at composable level)
    val emptyTitle = stringResource(R.string.fragment_notifications_text_1)
    val emptyDescription = stringResource(R.string.fragment_notifications_text_2)

    Scaffold(
        modifier = modifier.fillMaxSize(),
        topBar = {
            NotificationsTopBar(
                unreadCount = unreadCount,
                onBackClick = onBackClick,
                onMarkAllRead = { viewModel.markAllAsRead() },
                onDeleteOld = { viewModel.deleteOldNotifications() }
            )
        },
        snackbarHost = {
            SnackbarHost(hostState = snackbarHostState)
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
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
                        NotificationsContent(
                            notifications = state.notifications,
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
                                viewModel.deleteNotification(notification.id)
                            }
                        )
                    }

                    is NotificationsUiState.Error -> {
                        EmptyState(
                            type = EmptyStateType.Error(
                                title = "Erro ao carregar",
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

/**
 * TopBar com badge de não lidas e menu de ações
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

                // Badge de não lidas
                if (unreadCount > 0) {
                    Surface(
                        shape = CircleShape,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.defaultMinSize(minWidth = 24.dp, minHeight = 24.dp)
                    ) {
                        Box(
                            contentAlignment = Alignment.Center,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(
                                text = if (unreadCount > 99) "99+" else unreadCount.toString(),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onPrimary,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        },
        navigationIcon = {
            IconButton(onClick = onBackClick) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Voltar"
                )
            }
        },
        actions = {
            IconButton(onClick = { showMenu = true }) {
                Icon(
                    imageVector = Icons.Default.MoreVert,
                    contentDescription = "Menu"
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
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.surface,
            titleContentColor = MaterialTheme.colorScheme.onSurface
        ),
        modifier = Modifier.statusBarsPadding()
    )
}

/**
 * Conteúdo principal com notificações agrupadas
 */
@Composable
private fun NotificationsContent(
    notifications: List<AppNotification>,
    onNotificationClick: (AppNotification) -> Unit,
    onAccept: (AppNotification) -> Unit,
    onDecline: (AppNotification) -> Unit,
    onDelete: (AppNotification) -> Unit
) {
    // Agrupa notificações por data
    val groupedNotifications = remember(notifications) {
        groupNotificationsByDate(notifications)
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(vertical = 8.dp)
    ) {
        groupedNotifications.forEach { (section, notificationsList) ->
            // Cabeçalho da seção
            item(key = "header_$section") {
                NotificationSectionHeader(section)
            }

            // Itens da seção
            items(
                items = notificationsList,
                key = { it.id }
            ) { notification ->
                SwipeableNotificationCard(
                    notification = notification,
                    onClick = { onNotificationClick(notification) },
                    onAccept = { onAccept(notification) },
                    onDecline = { onDecline(notification) },
                    onDelete = { onDelete(notification) }
                )
            }
        }
    }
}

/**
 * Cabeçalho de seção (Hoje, Ontem, etc.)
 */
@Composable
private fun NotificationSectionHeader(section: String) {
    Text(
        text = section,
        style = MaterialTheme.typography.titleSmall,
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
    )
}

/**
 * Card de notificação com swipe-to-dismiss
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SwipeableNotificationCard(
    notification: AppNotification,
    onClick: () -> Unit,
    onAccept: () -> Unit,
    onDecline: () -> Unit,
    onDelete: () -> Unit
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

    SwipeToDismissBox(
        state = dismissState,
        backgroundContent = {
            // Fundo ao arrastar (ícone de lixeira)
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(MaterialTheme.colorScheme.error)
                    .padding(horizontal = 20.dp),
                contentAlignment = Alignment.CenterEnd
            ) {
                Icon(
                    imageVector = Icons.Default.Delete,
                    contentDescription = "Deletar",
                    tint = MaterialTheme.colorScheme.onError
                )
            }
        },
        enableDismissFromStartToEnd = false
    ) {
        NotificationCard(
            notification = notification,
            onClick = onClick,
            onAccept = onAccept,
            onDecline = onDecline
        )
    }
}

/**
 * Card individual de notificação
 */
@Composable
private fun NotificationCard(
    notification: AppNotification,
    onClick: () -> Unit,
    onAccept: () -> Unit,
    onDecline: () -> Unit
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        color = if (!notification.read) {
            MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
        } else {
            MaterialTheme.colorScheme.surface
        },
        tonalElevation = if (!notification.read) 2.dp else 1.dp
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Ícone da notificação
            NotificationIcon(
                type = notification.getTypeEnum(),
                isRead = notification.read
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
                    color = MaterialTheme.colorScheme.onSurface,
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

            // Indicador de não lida
            if (!notification.read) {
                Box(
                    modifier = Modifier
                        .size(12.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primary)
                )
            }
        }
    }
}

/**
 * Ícone da notificação baseado no tipo
 */
@Composable
private fun NotificationIcon(
    type: NotificationType,
    isRead: Boolean
) {
    val (icon, color) = when (type) {
        NotificationType.GROUP_INVITE -> Icons.Default.GroupAdd to MaterialTheme.colorScheme.secondary
        NotificationType.GROUP_INVITE_ACCEPTED -> Icons.Default.GroupAdd to MaterialTheme.colorScheme.primary
        NotificationType.GROUP_INVITE_DECLINED -> Icons.Default.GroupRemove to MaterialTheme.colorScheme.error
        NotificationType.GAME_SUMMON -> Icons.Default.SportsScore to MaterialTheme.colorScheme.tertiary
        NotificationType.GAME_REMINDER -> Icons.Default.AccessTime to MaterialTheme.colorScheme.tertiary
        NotificationType.GAME_CANCELLED -> Icons.Default.Cancel to MaterialTheme.colorScheme.error
        NotificationType.GAME_CONFIRMED -> Icons.Default.CheckCircle to MaterialTheme.colorScheme.primary
        NotificationType.MEMBER_JOINED -> Icons.Default.PersonAdd to MaterialTheme.colorScheme.secondary
        NotificationType.MEMBER_LEFT -> Icons.Default.PersonRemove to MaterialTheme.colorScheme.onSurfaceVariant
        NotificationType.CASHBOX_ENTRY -> Icons.Default.AttachMoney to MaterialTheme.colorScheme.primary
        NotificationType.CASHBOX_EXIT -> Icons.Default.MoneyOff to MaterialTheme.colorScheme.error
        NotificationType.ACHIEVEMENT -> Icons.Default.Star to Color(0xFFFFD700) // Gold
        NotificationType.ADMIN_MESSAGE -> Icons.Default.AdminPanelSettings to MaterialTheme.colorScheme.tertiary
        NotificationType.SYSTEM -> Icons.Default.Info to MaterialTheme.colorScheme.secondary
        NotificationType.GENERAL -> Icons.Default.Notifications to MaterialTheme.colorScheme.onSurfaceVariant
    }

    Surface(
        shape = CircleShape,
        color = color.copy(alpha = if (isRead) 0.2f else 0.3f),
        modifier = Modifier.size(48.dp)
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
private fun NotificationShimmerCard(brush: androidx.compose.ui.graphics.Brush) {
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
private fun groupNotificationsByDate(notifications: List<AppNotification>): Map<String, List<AppNotification>> {
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
            date == null -> "Antigas"
            date.time >= today.timeInMillis -> "Hoje"
            date.time >= yesterday.timeInMillis -> "Ontem"
            date.time >= weekAgo.timeInMillis -> "Esta Semana"
            else -> "Antigas"
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
