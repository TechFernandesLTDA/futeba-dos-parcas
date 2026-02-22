package com.futebadosparcas.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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

@Composable
fun TeamFormationCard(
    team1: TeamData,
    team2: TeamData,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            TeamColumn(
                team = team1,
                modifier = Modifier.weight(1f)
            )

            VerticalDivider(
                modifier = Modifier.height(200.dp).padding(vertical = 8.dp),
                thickness = 2.dp
            )

            TeamColumn(
                team = team2,
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun TeamColumn(
    team: TeamData,
    modifier: Modifier = Modifier
) {
    val teamColor = parseTeamColor(team.color)

    Column(
        modifier = modifier.padding(4.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(12.dp)
                    .clip(CircleShape)
                    .background(teamColor)
            )
            Text(
                text = team.name,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                color = teamColor
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        team.players.forEach { player ->
            PlayerRow(
                player = player,
                teamColor = teamColor,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(4.dp))
        }
    }
}

@Composable
private fun PlayerRow(
    player: PlayerData,
    teamColor: Color,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surface
    ) {
        Row(
            modifier = Modifier
                .padding(horizontal = 8.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(28.dp)
                    .clip(CircleShape)
                    .background(teamColor.copy(alpha = 0.2f)),
                contentAlignment = Alignment.Center
            ) {
                if (player.position == "GK") {
                    Text("🧤", style = MaterialTheme.typography.labelSmall)
                } else {
                    Text(
                        text = player.name.take(1).uppercase(),
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                        color = teamColor
                    )
                }
            }

            Spacer(modifier = Modifier.width(6.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = player.name,
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                PlayerStatsRow(
                    goals = player.goals,
                    assists = player.assists,
                    saves = player.saves,
                    yellowCards = player.yellowCards,
                    redCards = player.redCards
                )
            }
        }
    }
}

@Composable
private fun PlayerStatsRow(
    goals: Int,
    assists: Int,
    saves: Int,
    yellowCards: Int,
    redCards: Int
) {
    if (goals == 0 && assists == 0 && saves == 0 && yellowCards == 0 && redCards == 0) {
        return
    }

    Row(
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        if (goals > 0) {
            StatBadge("⚽$goals")
        }
        if (assists > 0) {
            StatBadge("🎯$assists")
        }
        if (saves > 0) {
            StatBadge("🧤$saves")
        }
        if (yellowCards > 0) {
            StatBadge("🟨$yellowCards")
        }
        if (redCards > 0) {
            StatBadge("🟥$redCards")
        }
    }
}

@Composable
private fun StatBadge(
    text: String
) {
    Surface(
        shape = RoundedCornerShape(4.dp),
        color = MaterialTheme.colorScheme.surfaceVariant
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier.padding(horizontal = 4.dp, vertical = 1.dp)
        )
    }
}

@Composable
fun TeamFormationExpandedCard(
    team1: TeamData,
    team2: TeamData,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        TeamExpandedSection(
            team = team1,
            isPrimary = true
        )

        HorizontalDivider()

        TeamExpandedSection(
            team = team2,
            isPrimary = false
        )
    }
}

@Composable
private fun TeamExpandedSection(
    team: TeamData,
    isPrimary: Boolean
) {
    val teamColor = parseTeamColor(team.color)

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = teamColor.copy(alpha = 0.08f)
        )
    ) {
        Column(
            modifier = Modifier.padding(12.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(16.dp)
                        .clip(CircleShape)
                        .background(teamColor)
                )
                Text(
                    text = team.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = teamColor
                )

                Spacer(modifier = Modifier.weight(1f))

                Text(
                    text = "${team.players.size} jogadores",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            team.players.forEach { player ->
                PlayerDetailedRow(
                    player = player,
                    teamColor = teamColor
                )
                if (player != team.players.last()) {
                    Spacer(modifier = Modifier.height(8.dp))
                }
            }
        }
    }
}

@Composable
private fun PlayerDetailedRow(
    player: PlayerData,
    teamColor: Color
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth()
    ) {
        Surface(
            modifier = Modifier.size(40.dp),
            shape = CircleShape,
            color = teamColor.copy(alpha = 0.15f)
        ) {
            Box(
                contentAlignment = Alignment.Center
            ) {
                if (player.position == "GK") {
                    Text("🧤", style = MaterialTheme.typography.titleMedium)
                } else {
                    Text(
                        text = player.name.take(2).uppercase(),
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = teamColor
                    )
                }
            }
        }

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = player.name,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium
            )
            Text(
                text = getPositionLabel(player.position),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Row(
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            if (player.goals > 0) {
                PlayerStatChip("⚽ ${player.goals}")
            }
            if (player.assists > 0) {
                PlayerStatChip("🎯 ${player.assists}")
            }
            if (player.saves > 0) {
                PlayerStatChip("🧤 ${player.saves}")
            }
        }
    }
}

@Composable
private fun PlayerStatChip(
    text: String
) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.primaryContainer
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            color = MaterialTheme.colorScheme.onPrimaryContainer
        )
    }
}

private fun parseTeamColor(colorHex: String): Color {
    return try {
        val hex = colorHex.removePrefix("#")
        val color = hex.toLong(16)
        Color(color)
    } catch (e: Exception) {
        if (colorHex.contains("Azul", ignoreCase = true)) Color(0xFF2196F3)
        else if (colorHex.contains("Vermelho", ignoreCase = true)) Color(0xFFF44336)
        else Color.Gray
    }
}

private fun getPositionLabel(position: String): String {
    return when (position) {
        "GK" -> "Goleiro"
        "DEF" -> "Defensor"
        "MID" -> "Meio-campo"
        "ATK" -> "Atacante"
        "LINE" -> "Linha"
        else -> position
    }
}
