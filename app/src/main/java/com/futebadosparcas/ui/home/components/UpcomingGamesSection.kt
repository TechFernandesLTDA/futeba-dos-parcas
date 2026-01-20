package com.futebadosparcas.ui.home.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.EventAvailable
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material.icons.filled.People
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R
import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.GameStatus
import com.futebadosparcas.ui.theme.GamificationColors
import com.futebadosparcas.ui.games.GameWithConfirmations
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Seção de próximos jogos na Home com status de confirmação (CMD-29)
 *
 * Exibe jogos organizados por status:
 * - "Para confirmar": jogos SCHEDULED onde usuário não confirmou
 * - "Confirmados": jogos CONFIRMED ou onde usuário já confirmou
 * - Cards claros com ações rápidas (confirmar/cancelar/ver detalhes)
 * - Estados: vazio, loading
 */
@Composable
fun UpcomingGamesSection(
    games: List<GameWithConfirmations>,
    onGameClick: (gameId: String) -> Unit,
    onConfirmClick: (gameId: String) -> Unit = {},
    modifier: Modifier = Modifier
) {
    if (games.isEmpty()) return

    // Separar jogos por status de confirmação
    val pendingGames = games.filter {
        val gameStatus = it.game.getStatusEnum()
        !it.isUserConfirmed && gameStatus == com.futebadosparcas.data.model.GameStatus.SCHEDULED
    }
    val confirmedGames = games.filter {
        val gameStatus = it.game.getStatusEnum()
        it.isUserConfirmed || gameStatus == com.futebadosparcas.data.model.GameStatus.CONFIRMED
    }

    Column(modifier = modifier) {
        // Seção "Para Confirmar" - Prioridade máxima
        if (pendingGames.isNotEmpty()) {
            GamesByStatusSection(
                title = stringResource(R.string.upcoming_games_pending),
                count = pendingGames.size,
                icon = Icons.Default.NotificationsActive,
                iconTint = MaterialTheme.colorScheme.error,
                games = pendingGames,
                onGameClick = onGameClick,
                onConfirmClick = onConfirmClick,
                isPending = true
            )
        }

        // Seção "Confirmados"
        if (confirmedGames.isNotEmpty()) {
            if (pendingGames.isNotEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
            }
            GamesByStatusSection(
                title = stringResource(R.string.upcoming_games_confirmed),
                count = confirmedGames.size,
                icon = Icons.Default.CheckCircle,
                iconTint = GamificationColors.XpGreen,
                games = confirmedGames,
                onGameClick = onGameClick,
                onConfirmClick = onConfirmClick,
                isPending = false
            )
        }
    }
}

/**
 * Seção de jogos agrupados por status
 */
@Composable
private fun GamesByStatusSection(
    title: String,
    count: Int,
    icon: ImageVector,
    iconTint: Color,
    games: List<GameWithConfirmations>,
    onGameClick: (gameId: String) -> Unit,
    onConfirmClick: (gameId: String) -> Unit,
    isPending: Boolean
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isPending) {
                MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.15f)
            } else {
                MaterialTheme.colorScheme.surfaceVariant
            }
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = if (isPending) 3.dp else 2.dp),
        border = if (isPending) {
            BorderStroke(
                width = 1.5.dp,
                color = MaterialTheme.colorScheme.error.copy(alpha = 0.4f)
            )
        } else null
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            // Header da seção
            SectionHeader(
                title = title,
                count = count,
                icon = icon,
                iconTint = iconTint
            )

            HorizontalDivider(
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.05f),
                modifier = Modifier.padding(horizontal = 16.dp)
            )

            // Lista de jogos
            Column(
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                games.forEach { gameWithConfirmations ->
                    GameConfirmationCard(
                        gameWithConfirmations = gameWithConfirmations,
                        onGameClick = { onGameClick(gameWithConfirmations.game.id) },
                        onConfirmClick = { onConfirmClick(gameWithConfirmations.game.id) },
                        isPending = isPending,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp)
                    )
                }
            }

            // Footer com ver todos
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { /* TODO: Navegar para lista completa */ }
                    .background(MaterialTheme.colorScheme.onSurface.copy(alpha = 0.03f))
                    .padding(12.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = stringResource(R.string.upcoming_games_see_all),
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

/**
 * Header da seção de jogos
 */
@Composable
private fun SectionHeader(
    title: String,
    count: Int,
    icon: ImageVector,
    iconTint: Color
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp, 12.dp, 16.dp, 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = iconTint,
                modifier = Modifier.size(20.dp)
            )
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
        }

        Surface(
            color = iconTint.copy(alpha = 0.15f),
            shape = RoundedCornerShape(12.dp)
        ) {
            Text(
                text = "$count",
                style = MaterialTheme.typography.labelMedium,
                color = iconTint,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
            )
        }
    }
}

/**
 * Card de jogo com status de confirmação (CMD-29)
 * Ações rápidas: confirmar, cancelar, ver detalhes
 */
@Composable
private fun GameConfirmationCard(
    gameWithConfirmations: GameWithConfirmations,
    onGameClick: () -> Unit,
    onConfirmClick: () -> Unit,
    isPending: Boolean = false,
    modifier: Modifier = Modifier
) {
    val game = gameWithConfirmations.game
    val isUserConfirmed = gameWithConfirmations.isUserConfirmed
    val gameStatus = game.getStatusEnum()

    // Definir cores baseadas no status
    val statusColor = when {
        isPending -> MaterialTheme.colorScheme.error
        gameStatus == GameStatus.CONFIRMED -> GamificationColors.XpGreen
        isUserConfirmed -> MaterialTheme.colorScheme.primary
        else -> MaterialTheme.colorScheme.secondary
    }

    val statusBackgroundColor = when {
        isPending -> MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.3f)
        gameStatus == GameStatus.CONFIRMED -> MaterialTheme.colorScheme.tertiaryContainer
        isUserConfirmed -> MaterialTheme.colorScheme.primaryContainer
        else -> MaterialTheme.colorScheme.secondaryContainer
    }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onGameClick),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isPending) {
                MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.1f)
            } else {
                MaterialTheme.colorScheme.surface
            }
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = if (isPending) 3.dp else 1.dp),
        border = if (isPending) {
            BorderStroke(1.dp, statusColor.copy(alpha = 0.3f))
        } else null
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Indicador visual de status (mais destacado para pendentes)
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(statusBackgroundColor),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = if (isPending) {
                        Icons.Default.NotificationsActive
                    } else if (isUserConfirmed || gameStatus == GameStatus.CONFIRMED) {
                        Icons.Default.CheckCircle
                    } else {
                        Icons.Default.NotificationsNone
                    },
                    contentDescription = null,
                    tint = statusColor,
                    modifier = Modifier.size(24.dp)
                )
            }

            // Informações do jogo
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                // Local
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.LocationOn,
                        contentDescription = null,
                        modifier = Modifier.size(14.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = game.locationName.takeIf { it.isNotEmpty() } ?: stringResource(R.string.public_games_location_unknown),
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = if (isPending) FontWeight.Bold else FontWeight.SemiBold,
                        color = if (isPending) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                // Data e hora
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.CalendarToday,
                        contentDescription = null,
                        modifier = Modifier.size(14.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = formatGameDateTime(game.dateTime),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                // Confirmados
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.People,
                        contentDescription = null,
                        modifier = Modifier.size(14.dp),
                        tint = statusColor
                    )
                    Text(
                        text = buildString {
                            append("${gameWithConfirmations.confirmedCount}/${game.maxPlayers}")
                            if (game.maxGoalkeepers > 0) {
                                append(" • ${game.goalkeepersCount}/${game.maxGoalkeepers} goleiros")
                            }
                        },
                        style = MaterialTheme.typography.labelSmall,
                        color = statusColor,
                        fontWeight = if (isPending) FontWeight.Bold else FontWeight.Medium
                    )
                }
            }

            // Status e botão de ação
            Column(
                horizontalAlignment = Alignment.End,
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                // Badge de status
                Surface(
                    color = statusBackgroundColor,
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = when {
                            gameStatus == GameStatus.CONFIRMED -> stringResource(R.string.upcoming_games_status_confirmed)
                            isUserConfirmed -> stringResource(R.string.upcoming_games_status_user_confirmed)
                            else -> stringResource(R.string.upcoming_games_status_pending)
                        },
                        style = MaterialTheme.typography.labelSmall,
                        color = statusColor,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        fontWeight = if (isPending) FontWeight.Bold else FontWeight.Medium
                    )
                }

                // Botão de ação rápida
                if (!isUserConfirmed && gameStatus == GameStatus.SCHEDULED) {
                    Button(
                        onClick = onConfirmClick,
                        modifier = Modifier.height(32.dp),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 0.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isPending) {
                                MaterialTheme.colorScheme.error
                            } else {
                                MaterialTheme.colorScheme.primary
                            }
                        ),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text(stringResource(R.string.confirm), style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
        }
    }
}

/**
 * Formata data/hora do jogo para exibição
 */
private fun formatGameDateTime(date: Date?): String {
    if (date == null) return "Data não definida"

    val now = Date()
    val diffMs = date.time - now.time
    val diffDays = (diffMs / (1000 * 60 * 60 * 24)).toInt()

    return when {
        diffDays == 0 -> {
            // Hoje - mostrar apenas hora
            val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
            "Hoje às ${timeFormat.format(date)}"
        }
        diffDays == 1 -> {
            // Amanhã
            val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
            "Amanhã às ${timeFormat.format(date)}"
        }
        diffDays < 7 -> {
            // Esta semana - mostrar dia da semana + hora
            val dayFormat = SimpleDateFormat("EEE", Locale.getDefault())
            val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
            "${dayFormat.format(date).capitalize(Locale.getDefault())} às ${timeFormat.format(date)}"
        }
        else -> {
            // Outra data - mostrar dd/MM HH:mm
            val format = SimpleDateFormat("dd/MM HH:mm", Locale.getDefault())
            format.format(date)
        }
    }
}

/**
 * Formata data/hora do jogo para exibição (versão simplificada)
 */
fun formatGameDateTimeSimple(date: Date?): String {
    if (date == null) return ""
    val format = SimpleDateFormat("dd/MM - HH:mm", Locale.getDefault())
    return format.format(date)
}
