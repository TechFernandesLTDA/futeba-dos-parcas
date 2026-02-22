package com.futebadosparcas.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

data class GameListItemData(
    val id: String,
    val title: String,
    val time: String,
    val locationName: String,
    val locationAddress: String,
    val status: String,
    val playersCount: Int,
    val maxPlayers: Int,
    val gameType: String
)

@Composable
fun GameListItem(
    game: GameListItemData,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        onClick = onClick,
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            TimeColumn(time = game.time)

            Spacer(modifier = Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = if (game.title.isNotEmpty()) game.title else game.locationName.ifEmpty { "Jogo" },
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                if (game.locationName.isNotEmpty()) {
                    Text(
                        text = "📍 ${game.locationName}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    GameTypeChip(gameType = game.gameType)
                    Text(
                        text = "👥 ${game.playersCount}/${game.maxPlayers}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            StatusChip(status = game.status)
        }
    }
}

@Composable
private fun TimeColumn(time: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        if (time.isNotEmpty()) {
            val parts = time.split(":")
            Text(
                text = parts.getOrElse(0) { "--" },
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
            Text(
                text = "h${parts.getOrElse(1) { "" }}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        } else {
            Text(
                text = "--:--",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun GameTypeChip(gameType: String) {
    val color = when (gameType.lowercase()) {
        "society" -> Color(0xFF4CAF50)
        "futsal" -> Color(0xFF2196F3)
        "grama", "campo" -> Color(0xFF8BC34A)
        "areia" -> Color(0xFFFF9800)
        else -> Color(0xFF9E9E9E)
    }

    Surface(
        shape = RoundedCornerShape(4.dp),
        color = color
    ) {
        Text(
            text = gameType,
            style = MaterialTheme.typography.labelSmall,
            color = Color.White,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}

@Composable
private fun StatusChip(status: String) {
    val (color, text, emoji) = when (status.uppercase()) {
        "SCHEDULED" -> Triple(MaterialTheme.colorScheme.primary, "Aberto", "🟢")
        "CONFIRMED" -> Triple(MaterialTheme.colorScheme.secondary, "Fechado", "🟡")
        "LIVE" -> Triple(MaterialTheme.colorScheme.error, "Ao Vivo", "🔴")
        "FINISHED" -> Triple(MaterialTheme.colorScheme.tertiary, "Finalizado", "✅")
        "CANCELLED" -> Triple(MaterialTheme.colorScheme.outline, "Cancelado", "❌")
        else -> Triple(MaterialTheme.colorScheme.outline, status, "⚪")
    }

    Surface(
        shape = RoundedCornerShape(12.dp),
        color = color
    ) {
        Text(
            text = "$emoji $text",
            style = MaterialTheme.typography.labelSmall,
            color = Color.White,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            fontWeight = FontWeight.Bold
        )
    }
}
