package com.futebadosparcas.ui

import androidx.compose.animation.core.*
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.background
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.layout.*
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.lazy.LazyColumn
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.lazy.LazyRow
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
import androidx.compose.ui.unit.dp
import com.futebadosparcas.ui.components.states.ErrorState
import com.futebadosparcas.firebase.FirebaseManager
import com.futebadosparcas.ui.components.states.ErrorState
import kotlinx.coroutines.launch
import com.futebadosparcas.ui.components.states.ErrorState

private sealed class NotificationsUiState {
    object Loading : NotificationsUiState()
    object Empty : NotificationsUiState()
    data class Success(val notifications: List<WebNotification>) : NotificationsUiState()
    data class Error(val message: String) : NotificationsUiState()
}

private sealed class NotificationFilter(val label: String, val emoji: String) {
    object All : NotificationFilter("Todas", "📬")
    object Unread : NotificationFilter("Não lidas", "🔴")
    object Games : NotificationFilter("Jogos", "⚽")
    object Achievements : NotificationFilter("Conquistas", "🏆")
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsTab(
    onNotificationClick: (WebNotification) -> Unit = {}
) {
    var uiState by remember { mutableStateOf<NotificationsUiState>(NotificationsUiState.Loading) }
    var selectedFilter by remember { mutableStateOf<NotificationFilter>(NotificationFilter.All) }
    var unreadCount by remember { mutableIntStateOf(0) }
    val scope = rememberCoroutineScope()

    fun loadNotifications() {
        scope.launch {
            uiState = NotificationsUiState.Loading
            try {
                val notifications = FirebaseManager.getNotifications()
                    .map { it.toWebNotification() }
                    .sortedByDescending { it.createdAt }
                unreadCount = FirebaseManager.getUnreadNotificationsCount()
                uiState = if (notifications.isEmpty()) {
                    NotificationsUiState.Empty
                } else {
                    NotificationsUiState.Success(notifications)
                }
            } catch (e: Exception) {
                uiState = NotificationsUiState.Error(e.message ?: "Erro ao carregar notificações")
            }
        }
    }

    fun markAsRead(notificationId: String) {
        scope.launch {
            FirebaseManager.markNotificationAsRead(notificationId)
            unreadCount = FirebaseManager.getUnreadNotificationsCount()
            loadNotifications()
        }
    }

    fun markAllAsRead() {
        scope.launch {
            FirebaseManager.markAllNotificationsAsRead()
            unreadCount = 0
            loadNotifications()
        }
    }

    fun deleteNotification(notificationId: String) {
        scope.launch {
            FirebaseManager.deleteNotification(notificationId)
            unreadCount = FirebaseManager.getUnreadNotificationsCount()
            loadNotifications()
        }
    }

    LaunchedEffect(Unit) {
        loadNotifications()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "🔔 Notificações",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold
                )

                if (unreadCount > 0) {
                    Surface(
                        shape = CircleShape,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.defaultMinSize(minWidth = 24.dp, minHeight = 24.dp)
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

            if (unreadCount > 0) {
                TextButton(onClick = { markAllAsRead() }) {
                    Text("Marcar todas como lidas")
                }
            }
        }

        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(bottom = 12.dp)
        ) {
            listOf(
                NotificationFilter.All,
                NotificationFilter.Unread,
                NotificationFilter.Games,
                NotificationFilter.Achievements
            ).forEach { filter ->
                item {
                    FilterChip(
                        selected = selectedFilter == filter,
                        onClick = { selectedFilter = filter },
                        label = { Text("${filter.emoji} ${filter.label}") },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = MaterialTheme.colorScheme.primaryContainer
                        )
                    )
                }
            }
        }

        when (val state = uiState) {
            is NotificationsUiState.Loading -> NotificationsLoadingContent()

            is NotificationsUiState.Empty -> EmptyNotificationsState()

            is NotificationsUiState.Success -> {
                val filteredNotifications = remember(state.notifications, selectedFilter) {
                    when (selectedFilter) {
                        is NotificationFilter.All -> state.notifications
                        is NotificationFilter.Unread -> state.notifications.filter { !it.read }
                        is NotificationFilter.Games -> state.notifications.filter {
                            it.type in listOf("GAME_SUMMON", "GAME_INVITE", "GAME_CONFIRMED", "GAME_REMINDER", "GAME_CANCELLED", "GAME_UPDATED", "GAME_VACANCY")
                        }
                        is NotificationFilter.Achievements -> state.notifications.filter {
                            it.type in listOf("ACHIEVEMENT", "LEVEL_UP", "MVP_RECEIVED", "RANKING_CHANGED")
                        }
                    }
                }

                if (filteredNotifications.isEmpty()) {
                    EmptyFilterState(filter = selectedFilter)
                } else {
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        contentPadding = PaddingValues(bottom = 80.dp)
                    ) {
                        items(filteredNotifications, key = { it.id }) { notification ->
                            NotificationItem(
                                notification = notification,
                                onClick = {
                                    markAsRead(notification.id)
                                    onNotificationClick(notification)
                                },
                                onAccept = {
                                    markAsRead(notification.id)
                                },
                                onDecline = {
                                    markAsRead(notification.id)
                                }
                            )
                        }
                    }
                }
            }

            is NotificationsUiState.Error -> ErrorState(
                message = state.message,
                onRetry = { loadNotifications() }
            )
        }
    }
}

@Composable
private fun NotificationsLoadingContent() {
    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(5) {
            ShimmerNotificationCard()
        }
    }
}

@Composable
private fun ShimmerNotificationCard() {
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
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(brush)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Box(
                    modifier = Modifier
                        .width(200.dp)
                        .height(20.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(brush)
                )
                Spacer(modifier = Modifier.height(8.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(40.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(brush)
                )
            }
        }
    }
}

@Composable
private fun EmptyNotificationsState() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "📬",
            style = MaterialTheme.typography.displayLarge
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Nenhuma notificação",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Você está em dia! Novas notificações aparecerão aqui.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun EmptyFilterState(filter: NotificationFilter) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = filter.emoji,
            style = MaterialTheme.typography.displayLarge
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Nenhuma notificação",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Não há notificações neste filtro.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
