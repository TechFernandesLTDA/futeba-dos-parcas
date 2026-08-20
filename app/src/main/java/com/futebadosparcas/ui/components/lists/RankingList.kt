package com.futebadosparcas.ui.components.lists

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.futebadosparcas.domain.model.LeagueDivision
import com.futebadosparcas.ui.league.RankingItem
import com.futebadosparcas.ui.components.CachedProfileImage
import com.futebadosparcas.ui.theme.ExpressiveShapeTokens
import com.futebadosparcas.ui.theme.GamificationColors
import com.futebadosparcas.ui.theme.divisionColor
import com.futebadosparcas.ui.theme.divisionTextColor
import com.futebadosparcas.util.ContrastHelper
import com.futebadosparcas.ui.components.animation.pressScale
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource

/**
 * Lista moderna de ranking com sticky headers por divisão e animações.
 *
 * Features:
 * - LazyColumn com sticky headers por divisão
 * - Animações de entrada e posição
 * - Shimmer loading states
 * - Empty states personalizados
 * - Pull-to-refresh integrado
 * - Destaque visual para top 3
 * - Cores e badges por divisão
 *
 * @param entries Lista de entradas do ranking agrupadas por divisão
 * @param onPlayerClick Callback quando um jogador é clicado
 * @param modifier Modificador opcional
 * @param state Estado do LazyList para controle externo
 * @param isLoading Estado de carregamento inicial
 * @param isRefreshing Estado de refresh
 * @param onRefresh Callback para pull-to-refresh
 * @param emptyMessage Mensagem exibida quando não há dados
 * @param contentPadding Padding do conteúdo
 * @param showDivisions Se deve mostrar headers de divisão
 */
@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
fun RankingList(
    entries: Map<LeagueDivision, List<RankingItem>>,
    onPlayerClick: (RankingItem) -> Unit,
    modifier: Modifier = Modifier,
    state: LazyListState = rememberLazyListState(),
    isLoading: Boolean = false,
    isRefreshing: Boolean = false,
    onRefresh: (() -> Unit)? = null,
    emptyMessage: String = stringResource(R.string.ranking_list_empty),
    contentPadding: PaddingValues = PaddingValues(vertical = 8.dp),
    showDivisions: Boolean = true
) {
    // Ordena divisões do maior para o menor (memorizado para evitar recomputação)
    val sortedDivisions = remember(entries) {
        entries.keys.sortedByDescending { it.ordinal }
    }

    when {
        // Estado de loading inicial
        isLoading -> {
            RankingListShimmer(
                modifier = modifier,
                itemCount = 10
            )
        }

        // Empty state
        entries.isEmpty() && !isLoading && !isRefreshing -> {
            EmptyState(
                modifier = modifier,
                message = emptyMessage,
                icon = {
                    Icon(
                        imageVector = Icons.Default.EmojiEvents,
                        contentDescription = null,
                        modifier = Modifier.size(64.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                    )
                }
            )
        }

        // Lista com dados
        else -> {
            PaginatedLazyColumn(
                modifier = modifier,
                state = state,
                isRefreshing = isRefreshing,
                onRefresh = onRefresh,
                contentPadding = contentPadding,
                hasMoreItems = false // Ranking geralmente não usa paginação
            ) {
                sortedDivisions.forEach { division ->
                    val divisionEntries = entries[division] ?: emptyList()

                    if (divisionEntries.isNotEmpty()) {
                        // Sticky header de divisão
                        if (showDivisions) {
                            stickyHeader(key = "header_${division.name}") {
                                DivisionHeader(division = division)
                            }
                        }

                        // Items da divisão
                        itemsIndexed(
                            items = divisionEntries,
                            key = { _, entry -> entry.user.id }
                        ) { index, entry ->
                            RankingItem(
                                entry = entry,
                                rank = index + 1,
                                division = division,
                                onClick = { onPlayerClick(entry) },
                                isTopThree = index < 3,
                                modifier = Modifier
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Header sticky de divisão com cores e ícones apropriados.
 */
@Composable
fun DivisionHeader(
    division: LeagueDivision,
    modifier: Modifier = Modifier
) {
    val icon = when (division) {
        LeagueDivision.DIAMANTE -> "💎"
        LeagueDivision.OURO -> "🥇"
        LeagueDivision.PRATA -> "🥈"
        LeagueDivision.BRONZE -> "🥉"
    }
    val backgroundColor = divisionColor(division).copy(alpha = 0.1f)
    val textColor = divisionTextColor(division)

    Surface(
        modifier = modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        color = backgroundColor
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = icon,
                    style = MaterialTheme.typography.titleLarge
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = stringResource(R.string.ranking_division, division.displayName),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = textColor
                )
            }

            Icon(
                imageVector = Icons.Default.EmojiEvents,
                contentDescription = null,
                tint = textColor,
                modifier = Modifier.size(24.dp)
            )
        }
    }
}

/**
 * Item de ranking com animações e design premium.
 */
@Composable
fun RankingItem(
    entry: RankingItem,
    rank: Int,
    division: LeagueDivision,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    isTopThree: Boolean = false
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp)
            .pressScale()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(
            defaultElevation = if (isTopThree) 4.dp else 1.dp
        ),
        colors = CardDefaults.cardColors(
            containerColor = if (isTopThree) {
                divisionColor(division).copy(alpha = 0.1f)
            } else {
                MaterialTheme.colorScheme.surface
            }
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Posição com badge especial para top 3
            RankBadge(
                rank = rank,
                isTopThree = isTopThree,
                division = division
            )

            Spacer(modifier = Modifier.width(12.dp))

            // Avatar
            CachedProfileImage(
                photoUrl = entry.user.photoUrl,
                userName = entry.user.name,
                size = 48.dp
            )

            Spacer(modifier = Modifier.width(12.dp))

            // Informações do jogador
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = entry.user.nickname?.takeIf { it.isNotBlank() } ?: entry.user.name,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = if (isTopThree) FontWeight.Bold else FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(2.dp))

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.SportsScore,
                        contentDescription = null,
                        modifier = Modifier.size(12.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "${entry.participation.gamesPlayed} jogos",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    val avgGoals = if (entry.participation.gamesPlayed > 0) {
                        entry.participation.goals.toDouble() / entry.participation.gamesPlayed
                    } else 0.0
                    if (avgGoals > 0) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "• Média: %.1f".format(avgGoals),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            // Valor (pontos)
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = divisionColor(division).copy(alpha = 0.2f)
            ) {
                Text(
                    text = entry.participation.points.toString(),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = divisionTextColor(division),
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                )
            }
        }
    }
}

/**
 * Badge de posição no ranking com design especial para top 3.
 */
@Composable
private fun RankBadge(
    rank: Int,
    isTopThree: Boolean,
    division: LeagueDivision,
    modifier: Modifier = Modifier
) {
    if (isTopThree) {
        // Badge com gradiente para top 3
        val gradient = when (rank) {
            1 -> Brush.linearGradient(
                colors = listOf(GamificationColors.Gold, GamificationColors.GoldLight)
            )
            2 -> Brush.linearGradient(
                colors = listOf(GamificationColors.Silver, MaterialTheme.colorScheme.surface)
            )
            3 -> Brush.linearGradient(
                colors = listOf(GamificationColors.Bronze, GamificationColors.BronzeLight)
            )
            else -> Brush.linearGradient(
                colors = listOf(
                    MaterialTheme.colorScheme.primary,
                    MaterialTheme.colorScheme.primaryContainer
                )
            )
        }

        val medalColor = when (rank) {
            1 -> GamificationColors.Gold
            2 -> GamificationColors.Silver
            3 -> GamificationColors.Bronze
            else -> MaterialTheme.colorScheme.primary
        }

        Box(
            modifier = modifier
                .size(40.dp)
                .clip(ExpressiveShapeTokens.MedalContainer)
                .background(gradient),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = rank.toString(),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.ExtraBold,
                color = ContrastHelper.getContrastingTextColor(medalColor)
            )
        }
    } else {
        // Badge simples para outras posições
        Surface(
            modifier = modifier.size(40.dp),
            shape = ExpressiveShapeTokens.MedalContainer,
            color = MaterialTheme.colorScheme.surfaceVariant
        ) {
            Box(contentAlignment = Alignment.Center) {
                Text(
                    text = rank.toString(),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

/**
 * Estado de loading com shimmer para a lista de ranking.
 */
@Composable
fun RankingListShimmer(
    modifier: Modifier = Modifier,
    itemCount: Int = 10
) {
    Column(modifier = modifier.fillMaxSize()) {
        repeat(itemCount) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 6.dp),
                shape = RoundedCornerShape(12.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
            ) {
                RankingItemShimmer()
            }
        }
    }
}

/**
 * Versão simplificada sem divisões para rankings gerais.
 */
@Composable
fun SimpleRankingList(
    entries: List<RankingItem>,
    onPlayerClick: (RankingItem) -> Unit,
    modifier: Modifier = Modifier,
    state: LazyListState = rememberLazyListState(),
    isLoading: Boolean = false,
    isRefreshing: Boolean = false,
    onRefresh: (() -> Unit)? = null,
    emptyMessage: String = stringResource(R.string.ranking_list_empty),
    contentPadding: PaddingValues = PaddingValues(vertical = 8.dp)
) {
    // Agrupa todos em divisão Bronze para simplificar
    val entriesMap = mapOf(LeagueDivision.BRONZE to entries)

    RankingList(
        entries = entriesMap,
        onPlayerClick = onPlayerClick,
        modifier = modifier,
        state = state,
        isLoading = isLoading,
        isRefreshing = isRefreshing,
        onRefresh = onRefresh,
        emptyMessage = emptyMessage,
        contentPadding = contentPadding,
        showDivisions = false
    )
}
