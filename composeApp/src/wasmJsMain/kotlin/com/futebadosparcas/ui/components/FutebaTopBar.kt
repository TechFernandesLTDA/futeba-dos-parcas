package com.futebadosparcas.ui.components

import androidx.compose.animation.core.*
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import com.futebadosparcas.util.WebLevelHelper

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FutebaTopBar(
    title: String = "Futeba dos Parças",
    unreadCount: Int = 0,
    userLevel: Int = 1,
    userXP: Long = 0L,
    userPhotoUrl: String? = null,
    userName: String? = null,
    onNavigateNotifications: () -> Unit = {},
    onNavigateProfile: () -> Unit = {},
    onNavigateSettings: () -> Unit = {},
    onLogout: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    var showMenu by remember { mutableStateOf(false) }
    val levelEmoji = WebLevelHelper.getLevelEmoji(userLevel)
    val levelProgress = WebLevelHelper.getProgressPercentage(userXP)

    Surface(
        modifier = modifier
            .fillMaxWidth()
            .shadow(
                elevation = 4.dp,
                shape = RoundedCornerShape(bottomStart = 16.dp, bottomEnd = 16.dp),
                clip = false
            ),
        color = MaterialTheme.colorScheme.primaryContainer,
        tonalElevation = 2.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            AvatarWithLevel(
                photoUrl = userPhotoUrl,
                userName = userName,
                level = userLevel,
                levelEmoji = levelEmoji,
                levelProgress = levelProgress,
                onClick = onNavigateProfile,
                modifier = Modifier.size(44.dp)
            )

            Spacer(modifier = Modifier.width(12.dp))

            Text(
                text = title,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.width(12.dp))

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                NotificationBadge(
                    unreadCount = unreadCount,
                    onClick = onNavigateNotifications
                )

                Box {
                    IconButton(
                        onClick = { showMenu = true },
                        modifier = Modifier.size(44.dp)
                    ) {
                        Text(
                            text = "⚙️",
                            fontSize = 22.sp
                        )
                    }

                    if (showMenu) {
                        ActionMenuPopup(
                            onDismiss = { showMenu = false },
                            onNavigateSettings = onNavigateSettings,
                            onLogout = onLogout
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun AvatarWithLevel(
    photoUrl: String?,
    userName: String?,
    level: Int,
    levelEmoji: String,
    levelProgress: Int,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.primary)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        val initial = userName?.firstOrNull()?.uppercase() ?: "?"
        val bgColor = getLevelBackgroundColor(level)

        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.radialGradient(
                        colors = listOf(bgColor, bgColor.copy(alpha = 0.8f))
                    )
                ),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = initial,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }

        Box(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .size(18.dp)
                .background(
                    color = MaterialTheme.colorScheme.primary,
                    shape = CircleShape
                ),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = levelEmoji,
                fontSize = 10.sp,
                modifier = Modifier.graphicsLayer { 
                    scaleX = 0.9f
                    scaleY = 0.9f
                }
            )
        }

        if (levelProgress > 0 && levelProgress < 100) {
            CircularProgressIndicator(
                progress = { levelProgress / 100f },
                modifier = Modifier
                    .fillMaxSize()
                    .padding(1.dp),
                color = getProgressColor(level),
                strokeWidth = 2.dp,
                trackColor = Color.Transparent
            )
        }
    }
}

@Composable
private fun NotificationBadge(
    unreadCount: Int,
    onClick: () -> Unit
) {
    Box {
        IconButton(
            onClick = onClick,
            modifier = Modifier.size(44.dp)
        ) {
            Text(
                text = "🔔",
                fontSize = 22.sp
            )
        }

        if (unreadCount > 0) {
            val pulseAnimation = rememberInfiniteTransition(label = "pulse")
            val pulseScale by pulseAnimation.animateFloat(
                initialValue = 1f,
                targetValue = 1.15f,
                animationSpec = infiniteRepeatable(
                    animation = tween(600, easing = FastOutSlowInEasing),
                    repeatMode = RepeatMode.Reverse
                ),
                label = "badgePulse"
            )

            Surface(
                shape = CircleShape,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .offset(x = 4.dp, y = (-4).dp)
                    .size(18.dp)
                    .graphicsLayer { 
                        scaleX = pulseScale
                        scaleY = pulseScale 
                    }
            ) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.fillMaxSize()
                ) {
                    Text(
                        text = if (unreadCount > 99) "99+" else unreadCount.toString(),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onError,
                        fontWeight = FontWeight.Bold,
                        fontSize = 10.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}

@Composable
private fun ActionMenuPopup(
    onDismiss: () -> Unit,
    onNavigateSettings: () -> Unit,
    onLogout: () -> Unit
) {
    Popup(
        alignment = Alignment.TopEnd,
        onDismissRequest = onDismiss,
        properties = PopupProperties(
            focusable = true,
            dismissOnBackPress = true,
            dismissOnClickOutside = true
        )
    ) {
        Surface(
            modifier = Modifier
                .width(180.dp)
                .padding(top = 48.dp, end = 8.dp)
                .shadow(8.dp, RoundedCornerShape(12.dp)),
            color = MaterialTheme.colorScheme.surface,
            shape = RoundedCornerShape(12.dp),
            tonalElevation = 3.dp
        ) {
            Column(
                modifier = Modifier.padding(vertical = 8.dp)
            ) {
                MenuItem(
                    emoji = "⚙️",
                    text = "Configurações",
                    onClick = {
                        onDismiss()
                        onNavigateSettings()
                    }
                )

                HorizontalDivider(
                    modifier = Modifier.padding(horizontal = 12.dp),
                    color = MaterialTheme.colorScheme.outlineVariant
                )

                MenuItem(
                    emoji = "🚪",
                    text = "Sair",
                    textColor = MaterialTheme.colorScheme.error,
                    onClick = {
                        onDismiss()
                        onLogout()
                    }
                )
            }
        }
    }
}

@Composable
private fun MenuItem(
    emoji: String,
    text: String,
    textColor: Color = MaterialTheme.colorScheme.onSurface,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = emoji,
            fontSize = 18.sp,
            modifier = Modifier.width(28.dp)
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(
            text = text,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            color = textColor
        )
    }
}

private fun getLevelBackgroundColor(level: Int): Color {
    return when {
        level >= 50 -> Color(0xFFFFD700)
        level >= 40 -> Color(0xFF9C27B0)
        level >= 30 -> Color(0xFF673AB7)
        level >= 20 -> Color(0xFF2196F3)
        level >= 10 -> Color(0xFF4CAF50)
        level >= 5 -> Color(0xFF00BCD4)
        else -> Color(0xFF1976D2)
    }
}

private fun getProgressColor(level: Int): Color {
    return when {
        level >= 50 -> Color(0xFFFFD700)
        level >= 40 -> Color(0xFFE1BEE7)
        level >= 30 -> Color(0xFFB39DDB)
        level >= 20 -> Color(0xFF90CAF9)
        level >= 10 -> Color(0xFFA5D6A7)
        level >= 5 -> Color(0xFF80DEEA)
        else -> Color(0xFF90CAF9)
    }
}

@Composable
private fun getPlatformName(): String = "Web"
