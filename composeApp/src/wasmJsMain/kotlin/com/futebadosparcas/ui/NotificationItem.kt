package com.futebadosparcas.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
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
import com.futebadosparcas.platform.Date as JsDate

data class WebNotification(
    val id: String,
    val type: String,
    val title: String,
    val message: String,
    val read: Boolean,
    val createdAt: Long,
    val referenceId: String?,
    val referenceType: String?
)

fun Map<String, Any?>.toWebNotification(): WebNotification {
    return WebNotification(
        id = this["id"] as? String ?: "",
        type = this["type"] as? String ?: "GENERAL",
        title = this["title"] as? String ?: "",
        message = this["message"] as? String ?: "",
        read = this["read"] as? Boolean ?: false,
        createdAt = (this["createdAt"] as? Double)?.toLong() ?: 0L,
        referenceId = this["referenceId"] as? String,
        referenceType = this["referenceType"] as? String
    )
}

fun WebNotification.getEmoji(): String {
    return when (type) {
        "GAME_SUMMON", "GAME_INVITE" -> "📅"
        "GROUP_INVITE" -> "✉️"
        "GAME_CONFIRMED" -> "✅"
        "GAME_REMINDER" -> "⏰"
        "GAME_CANCELLED" -> "❌"
        "GAME_UPDATED" -> "🔄"
        "GAME_VACANCY" -> "👋"
        "MVP_RECEIVED" -> "🏆"
        "ACHIEVEMENT" -> "🏅"
        "LEVEL_UP" -> "⬆️"
        "RANKING_CHANGED" -> "📊"
        "MEMBER_JOINED" -> "👋"
        "CASHBOX_ENTRY" -> "💰"
        "CASHBOX_EXIT" -> "💸"
        else -> "🔔"
    }
}

fun WebNotification.requiresResponse(): Boolean {
    return type in listOf("GROUP_INVITE", "GAME_SUMMON")
}

private fun formatRelativeTime(timestamp: Long): String {
    val now = JsDate.now().toLong()
    val diff = now - timestamp

    return when {
        diff < 60000 -> "Agora"
        diff < 3600000 -> "${diff / 60000}min atrás"
        diff < 86400000 -> "${diff / 3600000}h atrás"
        diff < 604800000 -> "${diff / 86400000}d atrás"
        else -> jsFormatDate(timestamp)
    }
}

private external fun jsFormatDate(timestamp: Long): String

@Composable
fun NotificationItem(
    notification: WebNotification,
    onClick: () -> Unit,
    onAccept: () -> Unit = {},
    onDecline: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val isAchievement = notification.type == "ACHIEVEMENT"
    val isMvp = notification.type == "MVP_RECEIVED"
    val isLevelUp = notification.type == "LEVEL_UP"

    val backgroundColor = when {
        !notification.read && isAchievement -> MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.2f)
        !notification.read && isMvp -> MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.2f)
        !notification.read && isLevelUp -> MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.2f)
        !notification.read -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
        else -> MaterialTheme.colorScheme.surface
    }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = backgroundColor),
        elevation = CardDefaults.cardElevation(
            defaultElevation = if (!notification.read) 2.dp else 1.dp
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.Top
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(
                        when {
                            isAchievement -> Color(0xFFFFD700)
                            isMvp -> Color(0xFFFFD700)
                            isLevelUp -> Color(0xFF4CAF50)
                            !notification.read -> MaterialTheme.colorScheme.primary
                            else -> MaterialTheme.colorScheme.outline
                        }.copy(alpha = if (notification.read) 0.5f else 1f)
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = notification.getEmoji(),
                    style = MaterialTheme.typography.titleLarge
                )
            }

            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = notification.title,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = if (!notification.read) FontWeight.Bold else FontWeight.Normal,
                        color = when {
                            isAchievement || isMvp -> Color(0xFFFFD700)
                            isLevelUp -> Color(0xFF4CAF50)
                            else -> MaterialTheme.colorScheme.onSurface
                        },
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )

                    if (!notification.read) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.primary)
                        )
                    }
                }

                Text(
                    text = notification.message,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                Text(
                    text = formatRelativeTime(notification.createdAt),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                )

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
                            Text("Recusar")
                        }

                        Button(
                            onClick = onAccept,
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Aceitar")
                        }
                    }
                }
            }
        }
    }
}
