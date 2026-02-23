package com.futebadosparcas.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

object WebIcons {
    val Home = "⌂"
    val Event = "📅"
    val SportsSoccer = "⚽"
    val Group = "👥"
    val Person = "👤"
    val LocationOn = "📍"
    val EmojiEvents = "🏆"
    val Notifications = "🔔"
    val AccountCircle = "◉"
    val AdminPanelSettings = "👑"
    val ArrowBack = "←"
    val ChevronRight = "›"
    val Email = "✉"
    val Lock = "🔒"
    val Visibility = "👁"
    val VisibilityOff = "●"
    val Edit = "✎"
    val Logout = "⏻"
    val Settings = "⚙"
    val CalendarMonth = "📅"
    val Info = "ℹ"
    val Build = "🔧"
    val Refresh = "↻"
    val ErrorOutline = "⚠"
    val StarRate = "★"
    val QueryStats = "📊"
    val BarChart = "📊"
    val Add = "+"
    val Close = "✕"
    val Check = "✓"
    val Menu = "☰"
    val Search = "🔍"
    val Filter = "⚲"
    val Sort = "⇅"
    val Share = "↗"
    val Delete = "🗑"
    val Save = "💾"
    val Cancel = "✕"
    val Confirm = "✓"
    val Warning = "⚠"
    val Success = "✓"
    val Fire = "🔥"
    val Lightning = "⚡"
    val XP = "✨"
    val Level = "📈"
    val Badge = "🎖"
    val Streak = "🔥"
    val MVP = "👑"
    val Trophy = "🏆"
    val Medal = "🏅"
    val Star = "★"
    val Google = "G"
    val User = "👤"
}

@Composable
fun WebIcon(
    icon: String,
    modifier: Modifier = Modifier,
    size: Dp = 24.dp,
    tint: Color = MaterialTheme.colorScheme.onSurface,
    backgroundColor: Color? = null
) {
    val iconSize = when {
        size <= 20.dp -> 14.sp
        size <= 24.dp -> 18.sp
        size <= 32.dp -> 24.sp
        else -> 28.sp
    }

    if (backgroundColor != null) {
        Box(
            modifier = modifier
                .size(size)
                .clip(RoundedCornerShape(size / 4))
                .background(backgroundColor),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = icon,
                style = TextStyle(
                    fontSize = iconSize,
                    color = tint,
                    fontWeight = FontWeight.Medium
                )
            )
        }
    } else {
        Text(
            text = icon,
            modifier = modifier,
            style = TextStyle(
                fontSize = iconSize,
                color = tint,
                fontWeight = FontWeight.Medium
            )
        )
    }
}

@Composable
fun WebIconBadge(
    icon: String,
    modifier: Modifier = Modifier,
    size: Dp = 40.dp,
    iconSize: Dp = 22.dp,
    backgroundColor: Color,
    iconTint: Color
) {
    val textStyleSize = when {
        iconSize <= 18.dp -> 14.sp
        iconSize <= 22.dp -> 18.sp
        else -> 22.sp
    }
    
    Surface(
        modifier = modifier.size(size),
        shape = RoundedCornerShape(size / 4),
        color = backgroundColor,
        shadowElevation = 2.dp
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier.size(size)
        ) {
            Text(
                text = icon,
                style = TextStyle(
                    fontSize = textStyleSize,
                    color = iconTint,
                    fontWeight = FontWeight.Medium
                )
            )
        }
    }
}

@Composable
fun WebFab(
    icon: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    contentDescription: String? = null
) {
    androidx.compose.material3.FloatingActionButton(
        onClick = onClick,
        modifier = modifier,
        containerColor = MaterialTheme.colorScheme.primary,
        contentColor = MaterialTheme.colorScheme.onPrimary
    ) {
        Text(
            text = icon,
            style = TextStyle(
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold
            )
        )
    }
}
