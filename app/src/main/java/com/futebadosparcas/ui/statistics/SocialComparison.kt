package com.futebadosparcas.ui.statistics

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R
import com.futebadosparcas.ui.components.CachedAsyncImage
import java.util.Locale

/**
 * Componentes para comparação social de estatísticas entre jogadores.
 * Permite comparar performance com amigos e outros jogadores do grupo.
 */

// ==================== Models ====================

/**
 * Dados de um jogador para comparação.
 */
data class PlayerComparisonData(
    val id: String,
    val name: String,
    val photoUrl: String?,
    val level: Int,
    val stats: PlayerStats
)

/**
 * Estatísticas comparáveis do jogador.
 */
data class PlayerStats(
    val gamesPlayed: Int = 0,
    val wins: Int = 0,
    val goals: Int = 0,
    val assists: Int = 0,
    val saves: Int = 0,
    val mvpCount: Int = 0,
    val currentStreak: Int = 0,
    val winRate: Float = 0f,
    val goalsPerGame: Float = 0f,
    val assistsPerGame: Float = 0f
)

/**
 * Categoria de estatística para comparação.
 */
enum class ComparisonCategory(
    val displayName: String,
    val shortName: String,
    val iconRes: Int,
    val getValue: (PlayerStats) -> Number,
    val formatValue: (Number) -> String = { it.toString() }
) {
    GAMES(
        "Jogos",
        "Jogos",
        R.drawable.ic_sports_soccer,
        { it.gamesPlayed }
    ),
    WINS(
        "Vitórias",
        "Vit.",
        R.drawable.ic_star,
        { it.wins }
    ),
    WIN_RATE(
        "Taxa de Vitória",
        "Win%",
        R.drawable.ic_bar_chart,
        { it.winRate },
        { "${(it.toFloat() * 100).toInt()}%" }
    ),
    GOALS(
        "Gols",
        "Gols",
        R.drawable.ic_football,
        { it.goals }
    ),
    GOALS_PER_GAME(
        "Gols/Jogo",
        "G/J",
        R.drawable.ic_football,
        { it.goalsPerGame },
        { String.format(Locale.getDefault(), "%.1f", it.toFloat()) }
    ),
    ASSISTS(
        "Assistências",
        "Assist.",
        R.drawable.ic_assist,
        { it.assists }
    ),
    ASSISTS_PER_GAME(
        "Assist./Jogo",
        "A/J",
        R.drawable.ic_assist,
        { it.assistsPerGame },
        { String.format(Locale.getDefault(), "%.1f", it.toFloat()) }
    ),
    SAVES(
        "Defesas",
        "Def.",
        R.drawable.ic_save_action,
        { it.saves }
    ),
    MVP(
        "MVPs",
        "MVP",
        R.drawable.ic_star,
        { it.mvpCount }
    ),
    STREAK(
        "Sequência",
        "Streak",
        R.drawable.ic_calendar,
        { it.currentStreak }
    )
}

/**
 * Resultado da comparação.
 */
enum class ComparisonResult {
    WINNING,    // Usuário está ganhando
    LOSING,     // Usuário está perdendo
    TIED        // Empate
}

// ==================== Componentes ====================

/**
 * Card de comparação 1v1 entre dois jogadores.
 */
@Composable
fun PlayerVsPlayerCard(
    player1: PlayerComparisonData,
    player2: PlayerComparisonData,
    selectedCategory: ComparisonCategory,
    modifier: Modifier = Modifier,
    onCategoryChange: (ComparisonCategory) -> Unit = {}
) {
    val value1 = selectedCategory.getValue(player1.stats).toFloat()
    val value2 = selectedCategory.getValue(player2.stats).toFloat()
    val maxValue = maxOf(value1, value2, 0.01f)

    val progress1 by animateFloatAsState(
        targetValue = value1 / maxValue,
        animationSpec = tween(500),
        label = "progress1"
    )
    val progress2 by animateFloatAsState(
        targetValue = value2 / maxValue,
        animationSpec = tween(500),
        label = "progress2"
    )

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            // Header com avatares
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Jogador 1
                PlayerAvatar(
                    name = player1.name,
                    photoUrl = player1.photoUrl,
                    level = player1.level
                )

                Text(
                    text = "VS",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )

                // Jogador 2
                PlayerAvatar(
                    name = player2.name,
                    photoUrl = player2.photoUrl,
                    level = player2.level
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Categoria selecionada
            Text(
                text = selectedCategory.displayName,
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Barras de comparação
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Valor do jogador 1
                Text(
                    text = selectedCategory.formatValue(selectedCategory.getValue(player1.stats)),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = if (value1 > value2) PositiveColor else MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.width(50.dp),
                    textAlign = TextAlign.Center
                )

                // Barra do jogador 1 (direita para esquerda)
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(8.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(progress1)
                            .height(8.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(
                                if (value1 > value2) PositiveColor
                                else MaterialTheme.colorScheme.primary
                            )
                            .align(Alignment.CenterEnd)
                    )
                }

                Spacer(modifier = Modifier.width(8.dp))

                // Barra do jogador 2 (esquerda para direita)
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(8.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(progress2)
                            .height(8.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(
                                if (value2 > value1) PositiveColor
                                else MaterialTheme.colorScheme.secondary
                            )
                            .align(Alignment.CenterStart)
                    )
                }

                // Valor do jogador 2
                Text(
                    text = selectedCategory.formatValue(selectedCategory.getValue(player2.stats)),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = if (value2 > value1) PositiveColor else MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.width(50.dp),
                    textAlign = TextAlign.Center
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Seletor de categoria
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(ComparisonCategory.entries, key = { it.name }) { category ->
                    FilterChip(
                        selected = category == selectedCategory,
                        onClick = { onCategoryChange(category) },
                        label = { Text(category.shortName) }
                    )
                }
            }
        }
    }
}

/**
 * Avatar do jogador com nome e nível.
 */
@Composable
private fun PlayerAvatar(
    name: String,
    photoUrl: String?,
    level: Int,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box {
            if (photoUrl != null) {
                CachedAsyncImage(
                    imageUrl = photoUrl,
                    contentDescription = name,
                    modifier = Modifier
                        .size(56.dp)
                        .clip(CircleShape)
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(56.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primaryContainer),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = name.take(2).uppercase(),
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            }

            // Badge de nível
            Box(
                modifier = Modifier
                    .size(20.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primary)
                    .align(Alignment.BottomEnd),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "$level",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onPrimary
                )
            }
        }

        Spacer(modifier = Modifier.height(4.dp))

        Text(
            text = name,
            style = MaterialTheme.typography.labelMedium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

/**
 * Lista de comparação com múltiplos jogadores.
 */
@Composable
fun ComparisonLeaderboard(
    players: List<PlayerComparisonData>,
    currentUserId: String,
    selectedCategory: ComparisonCategory,
    modifier: Modifier = Modifier,
    onCategoryChange: (ComparisonCategory) -> Unit = {}
) {
    val sortedPlayers = remember(players, selectedCategory) {
        players.sortedByDescending { selectedCategory.getValue(it.stats).toFloat() }
    }

    Column(modifier = modifier) {
        // Seletor de categoria
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.padding(bottom = 12.dp)
        ) {
            items(ComparisonCategory.entries) { category ->
                FilterChip(
                    selected = category == selectedCategory,
                    onClick = { onCategoryChange(category) },
                    label = { Text(category.shortName) }
                )
            }
        }

        // Lista de jogadores
        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            itemsIndexed(sortedPlayers, key = { _, player -> player.id }) { index, player ->
                LeaderboardItem(
                    position = index + 1,
                    player = player,
                    category = selectedCategory,
                    isCurrentUser = player.id == currentUserId
                )
            }
        }
    }
}

/**
 * Item da lista de leaderboard.
 */
@Composable
private fun LeaderboardItem(
    position: Int,
    player: PlayerComparisonData,
    category: ComparisonCategory,
    isCurrentUser: Boolean,
    modifier: Modifier = Modifier
) {
    val backgroundColor = when {
        isCurrentUser -> MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
        position == 1 -> GoldColor.copy(alpha = 0.1f)
        position == 2 -> SilverColor.copy(alpha = 0.1f)
        position == 3 -> BronzeColor.copy(alpha = 0.1f)
        else -> MaterialTheme.colorScheme.surface
    }

    val positionColor = when (position) {
        1 -> GoldColor
        2 -> SilverColor
        3 -> BronzeColor
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(backgroundColor)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Posição
        Text(
            text = "#$position",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = positionColor,
            modifier = Modifier.width(40.dp)
        )

        // Avatar
        if (player.photoUrl != null) {
            CachedAsyncImage(
                imageUrl = player.photoUrl,
                contentDescription = player.name,
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
            )
        } else {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = player.name.take(2).uppercase(),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
        }

        Spacer(modifier = Modifier.width(12.dp))

        // Nome e nível
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = player.name,
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = if (isCurrentUser) FontWeight.Bold else FontWeight.Normal,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = stringResource(R.string.social_level, player.level),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        // Valor da categoria
        Text(
            text = category.formatValue(category.getValue(player.stats)),
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = if (isCurrentUser) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface
        )
    }
}

/**
 * Resumo de comparação rápida.
 */
@Composable
fun QuickComparisonSummary(
    currentUser: PlayerComparisonData,
    compareTo: PlayerComparisonData,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }

    val categories = ComparisonCategory.entries
    val winsCount = categories.count { category ->
        category.getValue(currentUser.stats).toFloat() > category.getValue(compareTo.stats).toFloat()
    }
    val lossesCount = categories.count { category ->
        category.getValue(currentUser.stats).toFloat() < category.getValue(compareTo.stats).toFloat()
    }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable { expanded = !expanded },
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (compareTo.photoUrl != null) {
                        CachedAsyncImage(
                            imageUrl = compareTo.photoUrl,
                            contentDescription = compareTo.name,
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                        )
                    } else {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.primaryContainer),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = compareTo.name.take(1).uppercase(),
                                style = MaterialTheme.typography.labelMedium
                            )
                        }
                    }

                    Spacer(modifier = Modifier.width(8.dp))

                    Text(
                        text = "vs ${compareTo.name}",
                        style = MaterialTheme.typography.bodyLarge
                    )
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    // Placar resumido
                    Text(
                        text = "$winsCount",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = PositiveColor
                    )
                    Text(
                        text = " - ",
                        style = MaterialTheme.typography.titleMedium
                    )
                    Text(
                        text = "$lossesCount",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = NegativeColor
                    )

                    Spacer(modifier = Modifier.width(8.dp))

                    Icon(
                        imageVector = if (expanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            AnimatedVisibility(
                visible = expanded,
                enter = fadeIn() + expandVertically(),
                exit = fadeOut() + shrinkVertically()
            ) {
                Column(
                    modifier = Modifier.padding(top = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    categories.forEach { category ->
                        val userValue = category.getValue(currentUser.stats).toFloat()
                        val otherValue = category.getValue(compareTo.stats).toFloat()
                        val result = when {
                            userValue > otherValue -> ComparisonResult.WINNING
                            userValue < otherValue -> ComparisonResult.LOSING
                            else -> ComparisonResult.TIED
                        }

                        ComparisonRow(
                            category = category,
                            userValue = category.formatValue(category.getValue(currentUser.stats)),
                            otherValue = category.formatValue(category.getValue(compareTo.stats)),
                            result = result
                        )
                    }
                }
            }
        }
    }
}

/**
 * Linha de comparação individual.
 */
@Composable
private fun ComparisonRow(
    category: ComparisonCategory,
    userValue: String,
    otherValue: String,
    result: ComparisonResult,
    modifier: Modifier = Modifier
) {
    val (userColor, otherColor) = when (result) {
        ComparisonResult.WINNING -> PositiveColor to MaterialTheme.colorScheme.onSurfaceVariant
        ComparisonResult.LOSING -> MaterialTheme.colorScheme.onSurfaceVariant to NegativeColor
        ComparisonResult.TIED -> MaterialTheme.colorScheme.onSurface to MaterialTheme.colorScheme.onSurface
    }

    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = userValue,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Bold,
            color = userColor,
            modifier = Modifier.width(50.dp),
            textAlign = TextAlign.Center
        )

        Row(
            modifier = Modifier.weight(1f),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                painter = painterResource(id = category.iconRes),
                contentDescription = null,
                modifier = Modifier.size(16.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = category.shortName,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Text(
            text = otherValue,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Bold,
            color = otherColor,
            modifier = Modifier.width(50.dp),
            textAlign = TextAlign.Center
        )
    }
}

// ==================== Cores ====================

private val PositiveColor = Color(0xFF4CAF50)
private val NegativeColor = Color(0xFFE53935)
private val GoldColor = Color(0xFFFFD700)
private val SilverColor = Color(0xFFC0C0C0)
private val BronzeColor = Color(0xFFCD7F32)
