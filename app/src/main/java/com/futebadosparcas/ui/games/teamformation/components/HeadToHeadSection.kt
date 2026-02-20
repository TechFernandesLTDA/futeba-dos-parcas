package com.futebadosparcas.ui.games.teamformation.components

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.futebadosparcas.domain.model.HeadToHeadHistory
import com.futebadosparcas.data.model.HeadToHeadMatch
import com.futebadosparcas.domain.model.TeamColor
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource

/**
 * Secao de historico de confrontos diretos.
 * Mostra estatisticas de Time A vs Time B.
 */
@Composable
fun HeadToHeadSection(
    headToHead: HeadToHeadHistory?,
    teamAColor: TeamColor,
    teamBColor: TeamColor,
    modifier: Modifier = Modifier
) {
    if (headToHead == null || headToHead.totalMatches == 0) {
        // Nenhum historico
        NoHistoryCard(modifier = modifier)
        return
    }

    var isExpanded by remember { mutableStateOf(false) }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .animateContentSize(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        ),
        onClick = { isExpanded = !isExpanded }
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.History,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = stringResource(R.string.head_to_head),
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )
                }

                Icon(
                    imageVector = if (isExpanded) {
                        Icons.Default.ExpandLess
                    } else {
                        Icons.Default.ExpandMore
                    },
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(Modifier.height(16.dp))

            // Estatisticas resumidas
            HeadToHeadSummary(
                headToHead = headToHead,
                teamAColor = teamAColor,
                teamBColor = teamBColor
            )

            // Historico detalhado (expansivel)
            if (isExpanded && headToHead.lastMatches.isNotEmpty()) {
                Spacer(Modifier.height(16.dp))
                HorizontalDivider()
                Spacer(Modifier.height(16.dp))

                Text(
                    text = stringResource(R.string.head_to_head_last_matches, headToHead.lastMatches.size),
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold
                )

                Spacer(Modifier.height(8.dp))

                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(headToHead.lastMatches, key = { it.gameId }) { match ->
                        MatchResultChip(
                            match = match,
                            teamAColor = teamAColor,
                            teamBColor = teamBColor
                        )
                    }
                }
            }
        }
    }
}

/**
 * Resumo visual do confronto.
 */
@Composable
private fun HeadToHeadSummary(
    headToHead: HeadToHeadHistory,
    teamAColor: TeamColor,
    teamBColor: TeamColor
) {
    val teamAColorValue = Color(teamAColor.hexValue)
    val teamBColorValue = Color(teamBColor.hexValue)

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Vitorias Time A
        StatBox(
            value = headToHead.team1Wins,
            label = "V",
            color = teamAColorValue,
            isHighlighted = headToHead.team1Wins > headToHead.team2Wins
        )

        // Empates
        StatBox(
            value = headToHead.draws,
            label = "E",
            color = MaterialTheme.colorScheme.surfaceVariant,
            isHighlighted = false
        )

        // Vitorias Time B
        StatBox(
            value = headToHead.team2Wins,
            label = "D",
            color = teamBColorValue,
            isHighlighted = headToHead.team2Wins > headToHead.team1Wins
        )
    }

    Spacer(Modifier.height(12.dp))

    // Barra de proporcao
    val totalGames = headToHead.totalMatches.toFloat()
    val team1Percent = if (totalGames > 0) headToHead.team1Wins / totalGames else 0f
    val drawPercent = if (totalGames > 0) headToHead.draws / totalGames else 0f
    val team2Percent = if (totalGames > 0) headToHead.team2Wins / totalGames else 0f

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(12.dp)
            .clip(RoundedCornerShape(6.dp))
    ) {
        if (team1Percent > 0) {
            Box(
                modifier = Modifier
                    .weight(team1Percent.coerceAtLeast(0.05f))
                    .fillMaxHeight()
                    .background(teamAColorValue)
            )
        }
        if (drawPercent > 0) {
            Box(
                modifier = Modifier
                    .weight(drawPercent.coerceAtLeast(0.05f))
                    .fillMaxHeight()
                    .background(MaterialTheme.colorScheme.surfaceVariant)
            )
        }
        if (team2Percent > 0) {
            Box(
                modifier = Modifier
                    .weight(team2Percent.coerceAtLeast(0.05f))
                    .fillMaxHeight()
                    .background(teamBColorValue)
            )
        }
    }

    Spacer(Modifier.height(8.dp))

    // Texto resumido
    Text(
        text = headToHead.getFormattedHistory(),
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth()
    )
}

/**
 * Caixa de estatistica individual.
 */
@Composable
private fun StatBox(
    value: Int,
    label: String,
    color: Color,
    isHighlighted: Boolean
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Surface(
            shape = CircleShape,
            color = if (isHighlighted) color else color.copy(alpha = 0.3f),
            modifier = Modifier.size(56.dp)
        ) {
            Box(contentAlignment = Alignment.Center) {
                Text(
                    text = value.toString(),
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = if (isHighlighted) {
                        Color.White
                    } else {
                        MaterialTheme.colorScheme.onSurface
                    }
                )
            }
        }

        Spacer(Modifier.height(4.dp))

        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold
        )
    }
}

/**
 * Chip mostrando resultado de uma partida.
 */
@Composable
private fun MatchResultChip(
    match: HeadToHeadMatch,
    teamAColor: TeamColor,
    teamBColor: TeamColor
) {
    val backgroundColor = when (match.winner) {
        0 -> Color(teamAColor.hexValue).copy(alpha = 0.2f)
        1 -> Color(teamBColor.hexValue).copy(alpha = 0.2f)
        else -> MaterialTheme.colorScheme.surfaceVariant
    }

    val borderColor = when (match.winner) {
        0 -> Color(teamAColor.hexValue)
        1 -> Color(teamBColor.hexValue)
        else -> MaterialTheme.colorScheme.outline
    }

    Surface(
        shape = RoundedCornerShape(8.dp),
        color = backgroundColor,
        border = androidx.compose.foundation.BorderStroke(1.dp, borderColor)
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "${match.team1Score} x ${match.team2Score}",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )

            Text(
                text = match.date,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * Card para quando nao ha historico.
 */
@Composable
private fun NoHistoryCard(modifier: Modifier = Modifier) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = Icons.Default.History,
                contentDescription = null,
                modifier = Modifier.size(32.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
            )

            Spacer(Modifier.height(8.dp))

            Text(
                text = stringResource(R.string.head_to_head_no_history),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Text(
                text = "O primeiro confronto entre estes times!",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                textAlign = TextAlign.Center
            )
        }
    }
}

/**
 * Historico de vitorias em sequencia.
 */
@Composable
fun WinStreakIndicator(
    streak: Int,
    teamName: String,
    teamColor: TeamColor,
    modifier: Modifier = Modifier
) {
    if (streak < 2) return

    val colorValue = Color(teamColor.hexValue)

    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(8.dp),
        color = colorValue.copy(alpha = 0.15f)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.LocalFireDepartment,
                contentDescription = null,
                modifier = Modifier.size(20.dp),
                tint = colorValue
            )

            Spacer(Modifier.width(8.dp))

            Text(
                text = "$teamName: $streak vitorias seguidas!",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
        }
    }
}

/**
 * Card de destaque para rivalidade.
 */
@Composable
fun RivalryCard(
    headToHead: HeadToHeadHistory,
    teamAName: String,
    teamBName: String,
    teamAColor: TeamColor,
    teamBColor: TeamColor,
    modifier: Modifier = Modifier
) {
    val isBalanced = kotlin.math.abs(headToHead.team1Wins - headToHead.team2Wins) <= 1
    val dominantTeam = when {
        headToHead.team1Wins > headToHead.team2Wins -> teamAName
        headToHead.team2Wins > headToHead.team1Wins -> teamBName
        else -> null
    }

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.3f)
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.EmojiEvents,
                contentDescription = null,
                modifier = Modifier.size(32.dp),
                tint = MaterialTheme.colorScheme.tertiary
            )

            Spacer(Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = if (isBalanced) {
                        "Rivalidade Equilibrada!"
                    } else {
                        "$dominantTeam lidera o confronto"
                    },
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )

                Text(
                    text = "${headToHead.totalMatches} jogos disputados",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}
