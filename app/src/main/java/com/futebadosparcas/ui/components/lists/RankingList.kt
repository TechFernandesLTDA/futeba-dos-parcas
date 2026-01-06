package com.futebadosparcas.ui.components.lists

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
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
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.futebadosparcas.data.model.LeagueDivision
import com.futebadosparcas.data.model.RankingEntryV2
import com.futebadosparcas.ui.theme.FutebaColors

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
    entries: Map<LeagueDivision, List<RankingEntryV2>>,
    onPlayerClick: (RankingEntryV2) -> Unit,
    modifier: Modifier = Modifier,
    state: LazyListState = rememberLazyListState(),
    isLoading: Boolean = false,
    isRefreshing: Boolean = false,
    onRefresh: (() -> Unit)? = null,
    emptyMessage: String = "Nenhum dado de ranking disponível",
    contentPadding: PaddingValues = PaddingValues(vertical = 8.dp),
    showDivisions: Boolean = true
) {
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
                // Ordena divisões do maior para o menor
                val sortedDivisions = entries.keys.sortedByDescending { it.ordinal }

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
                            key = { _, entry -> entry.userId }
                        ) { index, entry ->
                            RankingItem(
                                entry = entry,
                                division = division,
                                onClick = { onPlayerClick(entry) },
                                isTopThree = index < 3,
                                modifier = Modifier.animateItem()
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
    val (backgroundColor, icon) = when (division) {
        LeagueDivision.DIAMANTE -> Color(FutebaColors.BackgroundDark).copy(alpha = 0.1f) to "💎"
        LeagueDivision.OURO -> Color(FutebaColors.Gold).copy(alpha = 0.1f) to "🥇"
        LeagueDivision.PRATA -> Color(FutebaColors.Silver).copy(alpha = 0.1f) to "🥈"
        LeagueDivision.BRONZE -> Color(FutebaColors.Bronze).copy(alpha = 0.1f) to "🥉"
    }

    val divisionColor = getDivisionColor(division)

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
                    text = "Divisão ${division.displayName}",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = divisionColor
                )
            }

            Icon(
                imageVector = Icons.Default.EmojiEvents,
                contentDescription = null,
                tint = divisionColor,
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
    entry: RankingEntryV2,
    division: LeagueDivision,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    isTopThree: Boolean = false
) {
    // Animação de entrada
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        visible = true
    }

    val alpha by animateFloatAsState(
        targetValue = if (visible) 1f else 0f,
        animationSpec = tween(durationMillis = 300),
        label = "rank_item_alpha"
    )

    val scale by animateFloatAsState(
        targetValue = if (visible) 1f else 0.8f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessLow
        ),
        label = "rank_item_scale"
    )

    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp)
            .graphicsLayer {
                this.alpha = alpha
                scaleX = scale
                scaleY = scale
            }
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(
            defaultElevation = if (isTopThree) 4.dp else 1.dp
        ),
        colors = CardDefaults.cardColors(
            containerColor = if (isTopThree) {
                getDivisionColor(division).copy(alpha = 0.1f)
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
                rank = entry.rank,
                isTopThree = isTopThree,
                division = division
            )

            Spacer(modifier = Modifier.width(12.dp))

            // Avatar
            if (!entry.userPhoto.isNullOrEmpty()) {
                AsyncImage(
                    model = entry.userPhoto,
                    contentDescription = "Foto de ${entry.userName}",
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.surfaceVariant),
                    contentScale = ContentScale.Crop
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.surfaceVariant),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Person,
                        contentDescription = null,
                        modifier = Modifier.size(24.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            // Informações do jogador
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = entry.nickname ?: entry.userName,
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
                        text = "${entry.gamesPlayed} jogos",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    if (entry.average > 0) {
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "• Média: %.1f".format(entry.average),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            // Valor (pontos, gols, etc)
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = getDivisionColor(division).copy(alpha = 0.2f)
            ) {
                Text(
                    text = entry.value.toString(),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = getDivisionColor(division),
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
                colors = listOf(Color(FutebaColors.Gold), Color(0xFFFFE082))
            )
            2 -> Brush.linearGradient(
                colors = listOf(Color(FutebaColors.Silver), Color.White)
            )
            3 -> Brush.linearGradient(
                colors = listOf(Color(FutebaColors.Bronze), Color(0xFFE6A370))
            )
            else -> Brush.linearGradient(
                colors = listOf(
                    MaterialTheme.colorScheme.primary,
                    MaterialTheme.colorScheme.primaryContainer
                )
            )
        }

        Box(
            modifier = modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(gradient),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = rank.toString(),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.ExtraBold,
                color = Color.White
            )
        }
    } else {
        // Badge simples para outras posições
        Surface(
            modifier = modifier.size(40.dp),
            shape = CircleShape,
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
 * Retorna a cor apropriada para cada divisão.
 */
@Composable
private fun getDivisionColor(division: LeagueDivision): Color {
    return when (division) {
        LeagueDivision.DIAMANTE -> Color(0xFF00BCD4) // Cyan
        LeagueDivision.OURO -> Color(FutebaColors.Gold)
        LeagueDivision.PRATA -> Color(0xFF9E9E9E) // Grey
        LeagueDivision.BRONZE -> Color(FutebaColors.Bronze)
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
    entries: List<RankingEntryV2>,
    onPlayerClick: (RankingEntryV2) -> Unit,
    modifier: Modifier = Modifier,
    state: LazyListState = rememberLazyListState(),
    isLoading: Boolean = false,
    isRefreshing: Boolean = false,
    onRefresh: (() -> Unit)? = null,
    emptyMessage: String = "Nenhum dado de ranking disponível",
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
