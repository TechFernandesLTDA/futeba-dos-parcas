package com.futebadosparcas.ui.livegame

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.ui.res.stringResource
import com.futebadosparcas.data.model.LivePlayerStats
import com.futebadosparcas.R
import com.futebadosparcas.ui.components.ShimmerBox
import com.futebadosparcas.util.ContrastHelper

/**
 * LiveStatsScreen - Exibe estatísticas ao vivo dos jogadores
 *
 * Mostra:
 * - Lista de jogadores com suas estatísticas
 * - Gols, assistências, defesas (goleiro)
 * - Cartões amarelos e vermelhos
 * - Status: jogando ou substituído
 * - Posição do jogador
 *
 * Features:
 * - Auto-atualização via Firestore
 * - Ordenação por gols (automática no ViewModel)
 * - Loading state com shimmer
 * - Empty state quando sem jogadores
 * - Cores por time
 */
@Composable
fun LiveStatsScreen(
    viewModel: LiveStatsViewModel,
    onPlayerClick: (playerId: String) -> Unit = {},
    gameId: String = ""
) {
    val stats by viewModel.stats.collectAsStateWithLifecycle()

    LaunchedEffect(gameId) {
        if (gameId.isNotEmpty()) {
            viewModel.observeStats(gameId)
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        if (stats.isEmpty()) {
            LiveStatsEmptyState()
        } else {
            LiveStatsContent(
                stats = stats,
                onPlayerClick = onPlayerClick
            )
        }
    }
}

/**
 * Conteúdo quando temos estatísticas
 */
@Composable
private fun LiveStatsContent(
    stats: List<LivePlayerStats>,
    onPlayerClick: (playerId: String) -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .systemBarsPadding(),
        contentPadding = PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(stats, key = { it.id }) { playerStats ->
            PlayerStatsCard(
                stats = playerStats,
                onClick = { onPlayerClick(playerStats.playerId) },
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

/**
 * Card de estatísticas do jogador
 */
@Composable
private fun PlayerStatsCard(
    stats: LivePlayerStats,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 100.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // Avatar do jogador
            Surface(
                modifier = Modifier
                    .size(50.dp)
                    .clip(CircleShape),
                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.2f),
                shape = CircleShape
            ) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = stats.playerName.firstOrNull()?.uppercase() ?: "?",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }

            // Informações do jogador
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight(),
                verticalArrangement = Arrangement.Center
            ) {
                // Nome e posição
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = stats.playerName,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.weight(1f)
                    )

                    // Badge de posição
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.2f)
                    ) {
                        Text(
                            text = stats.position.uppercase(),
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }

                    // Badge de status
                    if (!stats.isPlaying) {
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = MaterialTheme.colorScheme.errorContainer
                        ) {
                            Text(
                                text = stringResource(R.string.live_game_substituted_out),
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onErrorContainer,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                }

                // Estatísticas em grid
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Gols
                    StatBadge(
                        label = "⚽",
                        value = stats.goals.toString(),
                        modifier = Modifier.weight(1f),
                        isPrimary = true
                    )

                    // Assistências
                    StatBadge(
                        label = "🎯",
                        value = stats.assists.toString(),
                        modifier = Modifier.weight(1f)
                    )

                    // Defesas (só para goleiros)
                    if (stats.position.lowercase() == "goleiro" || stats.position.lowercase() == "goalkeeper") {
                        StatBadge(
                            label = "🧤",
                            value = stats.saves.toString(),
                            modifier = Modifier.weight(1f)
                        )
                    }

                    // Cartões
                    if (stats.yellowCards > 0 || stats.redCards > 0) {
                        Row(
                            modifier = Modifier.weight(1f),
                            horizontalArrangement = Arrangement.spacedBy(2.dp)
                        ) {
                            if (stats.yellowCards > 0) {
                                Surface(
                                    shape = RoundedCornerShape(2.dp),
                                    color = com.futebadosparcas.ui.theme.MatchEventColors.YellowCard
                                ) {
                                    Text(
                                        text = "×${stats.yellowCards}",
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = ContrastHelper.getContrastingTextColor(com.futebadosparcas.ui.theme.MatchEventColors.YellowCard),
                                        modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
                                        fontSize = MaterialTheme.typography.labelSmall.fontSize * 0.8f
                                    )
                                }
                            }

                            if (stats.redCards > 0) {
                                Surface(
                                    shape = RoundedCornerShape(2.dp),
                                    color = com.futebadosparcas.ui.theme.MatchEventColors.RedCard
                                ) {
                                    Text(
                                        text = "×${stats.redCards}",
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = ContrastHelper.getContrastingTextColor(com.futebadosparcas.ui.theme.MatchEventColors.RedCard),
                                        modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp),
                                        fontSize = MaterialTheme.typography.labelSmall.fontSize * 0.8f
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * Badge para mostrar uma estatística
 */
@Composable
private fun StatBadge(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    isPrimary: Boolean = false
) {
    Surface(
        shape = RoundedCornerShape(6.dp),
        color = if (isPrimary) {
            MaterialTheme.colorScheme.primary.copy(alpha = 0.2f)
        } else {
            MaterialTheme.colorScheme.secondary.copy(alpha = 0.1f)
        },
        modifier = modifier
    ) {
        Column(
            modifier = Modifier.padding(6.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                fontSize = MaterialTheme.typography.labelSmall.fontSize * 1.2f
            )

            Text(
                text = value,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = if (isPrimary) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.onSurfaceVariant
                }
            )
        }
    }
}

/**
 * Estado vazio quando não há estatísticas
 */
@Composable
private fun LiveStatsEmptyState() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .systemBarsPadding()
            .padding(16.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.Default.BarChart,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.5f)
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = stringResource(R.string.live_game_no_stats),
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onBackground
        )

        Text(
            text = stringResource(R.string.live_game_no_stats_description),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(top = 8.dp)
        )
    }
}
