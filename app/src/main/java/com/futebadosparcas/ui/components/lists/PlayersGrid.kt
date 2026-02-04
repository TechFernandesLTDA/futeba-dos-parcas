package com.futebadosparcas.ui.components.lists

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.futebadosparcas.data.model.User
import com.futebadosparcas.ui.theme.GamificationColors
import com.futebadosparcas.ui.components.CachedProfileImage

/**
 * Grid moderna de jogadores com LazyVerticalGrid adaptativo.
 *
 * Features:
 * - LazyVerticalGrid com colunas adaptativas baseadas no tamanho da tela
 * - Shimmer loading states
 * - Empty states personalizados
 * - Pull-to-refresh integrado
 * - Cards premium com avatar, nível, XP e stats
 * - Suporte a paginação
 *
 * @param players Lista de jogadores a exibir
 * @param onPlayerClick Callback quando um jogador é clicado
 * @param modifier Modificador opcional
 * @param state Estado do grid para controle externo
 * @param isLoading Estado de carregamento inicial
 * @param isRefreshing Estado de refresh
 * @param onRefresh Callback para pull-to-refresh
 * @param hasMoreItems Indica se há mais itens para carregar
 * @param isLoadingMore Estado de paginação
 * @param onLoadMore Callback para carregar mais itens
 * @param emptyMessage Mensagem exibida quando não há jogadores
 * @param contentPadding Padding do conteúdo
 */
@Composable
fun PlayersGrid(
    players: List<User>,
    onPlayerClick: (User) -> Unit,
    modifier: Modifier = Modifier,
    state: LazyGridState = rememberLazyGridState(),
    isLoading: Boolean = false,
    isRefreshing: Boolean = false,
    onRefresh: (() -> Unit)? = null,
    hasMoreItems: Boolean = false,
    isLoadingMore: Boolean = false,
    onLoadMore: () -> Unit = {},
    emptyMessage: String = "Nenhum jogador encontrado",
    contentPadding: PaddingValues = PaddingValues(8.dp)
) {
    // Determina o número de colunas baseado no tamanho da tela
    val configuration = LocalConfiguration.current
    val columns = when {
        configuration.screenWidthDp >= 840 -> 4 // Tablets landscape
        configuration.screenWidthDp >= 600 -> 3 // Tablets portrait
        else -> 2 // Phones
    }

    when {
        // Estado de loading inicial
        isLoading -> {
            PlayersGridShimmer(
                modifier = modifier,
                columns = columns,
                itemCount = 8
            )
        }

        // Empty state
        players.isEmpty() && !isLoading && !isRefreshing -> {
            EmptyState(
                modifier = modifier,
                message = emptyMessage,
                icon = {
                    Icon(
                        imageVector = Icons.Default.Person,
                        contentDescription = null,
                        modifier = Modifier.size(64.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                    )
                }
            )
        }

        // Grid com dados
        else -> {
            PaginatedLazyVerticalGrid(
                modifier = modifier,
                state = state,
                columns = columns,
                isRefreshing = isRefreshing,
                onRefresh = onRefresh,
                hasMoreItems = hasMoreItems,
                isLoadingMore = isLoadingMore,
                onLoadMore = onLoadMore,
                contentPadding = contentPadding
            ) {
                items(
                    items = players,
                    key = { it.id }
                ) { player ->
                    PlayerCard(
                        player = player,
                        onClick = { onPlayerClick(player) },
                        modifier = Modifier.animateItem()
                    )
                }
            }
        }
    }
}

/**
 * Card de jogador com design premium e gamificado.
 */
@Composable
fun PlayerCard(
    player: User,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(8.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Avatar com borda de nível
            Box(contentAlignment = Alignment.Center) {
                // Borda gradiente baseada no nível
                Box(
                    modifier = Modifier
                        .size(74.dp)
                        .clip(CircleShape)
                        .background(getLevelGradient(player.level))
                        .padding(3.dp)
                )

                // Avatar
                CachedProfileImage(
                    photoUrl = player.photoUrl,
                    userName = player.getDisplayName(),
                    size = 68.dp
                )

                // Fallback rendering removed - handled by CachedProfileImage
                if (false) {
                    Box(
                        modifier = Modifier
                            .size(68.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.surfaceVariant),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Person,
                            contentDescription = null,
                            modifier = Modifier.size(36.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                // Badge de nível
                Surface(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .offset(x = 4.dp, y = 4.dp),
                    shape = CircleShape,
                    color = MaterialTheme.colorScheme.primary,
                    shadowElevation = 2.dp
                ) {
                    Text(
                        text = player.level.toString(),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Nome
            Text(
                text = player.getDisplayName(),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(4.dp))

            // XP
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Star,
                    contentDescription = null,
                    modifier = Modifier.size(12.dp),
                    tint = GamificationColors.Gold
                )
                Spacer(modifier = Modifier.width(2.dp))
                Text(
                    text = formatXP(player.experiencePoints),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Stats mini (ratings)
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                // Ataque
                StatChip(
                    label = "ATK",
                    value = player.strikerRating,
                    color = MaterialTheme.colorScheme.error
                )

                // Meio
                StatChip(
                    label = "MID",
                    value = player.midRating,
                    color = MaterialTheme.colorScheme.secondary
                )

                // Defesa
                StatChip(
                    label = "DEF",
                    value = player.defenderRating,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

/**
 * Chip de estatística compacto.
 */
@Composable
private fun StatChip(
    label: String,
    value: Double,
    color: Color,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            fontSize = MaterialTheme.typography.labelSmall.fontSize * 0.8
        )
        Text(
            text = "%.1f".format(value),
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            color = color
        )
    }
}

/**
 * Retorna o gradiente de borda baseado no nível do jogador.
 */
@Composable
private fun getLevelGradient(level: Int): Brush {
    return when {
        level >= 50 -> Brush.linearGradient(
            colors = listOf(
                GamificationColors.Gold,
                GamificationColors.LevelUpGold
            )
        )
        level >= 30 -> Brush.linearGradient(
            colors = listOf(
                GamificationColors.Silver,
                MaterialTheme.colorScheme.surface
            )
        )
        level >= 15 -> Brush.linearGradient(
            colors = listOf(
                GamificationColors.Bronze,
                GamificationColors.BronzeLight
            )
        )
        else -> Brush.linearGradient(
            colors = listOf(
                MaterialTheme.colorScheme.primary,
                MaterialTheme.colorScheme.primaryContainer
            )
        )
    }
}

/**
 * Formata XP para exibição compacta (ex: 1.2k, 45k, 1.5M).
 */
private fun formatXP(xp: Long): String {
    return when {
        xp >= 1_000_000 -> "%.1fM".format(xp / 1_000_000.0)
        xp >= 1_000 -> "%.1fk".format(xp / 1_000.0)
        else -> xp.toString()
    }
}

/**
 * Estado de loading com shimmer para o grid de jogadores.
 */
@Composable
fun PlayersGridShimmer(
    modifier: Modifier = Modifier,
    columns: Int = 2,
    itemCount: Int = 8
) {
    LazyVerticalGrid(
        modifier = modifier.fillMaxSize(),
        columns = GridCells.Fixed(columns),
        contentPadding = PaddingValues(8.dp)
    ) {
        items(itemCount, key = { "shimmer_$it" }) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(8.dp),
                shape = RoundedCornerShape(16.dp),
                elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
            ) {
                PlayerCardShimmer()
            }
        }
    }
}

/**
 * LazyVerticalGrid paginada com pull-to-refresh.
 */
@Composable
private fun PaginatedLazyVerticalGrid(
    modifier: Modifier = Modifier,
    state: LazyGridState = rememberLazyGridState(),
    columns: Int = 2,
    isRefreshing: Boolean = false,
    onRefresh: (() -> Unit)? = null,
    hasMoreItems: Boolean = false,
    isLoadingMore: Boolean = false,
    onLoadMore: () -> Unit = {},
    contentPadding: PaddingValues = PaddingValues(0.dp),
    content: LazyGridScope.() -> Unit
) {
    // Detecta quando o usuário chegou próximo ao final
    val shouldLoadMore by remember {
        derivedStateOf {
            val lastVisibleItem = state.layoutInfo.visibleItemsInfo.lastOrNull()
            val totalItems = state.layoutInfo.totalItemsCount

            lastVisibleItem != null &&
                lastVisibleItem.index >= totalItems - 3 &&
                hasMoreItems &&
                !isLoadingMore
        }
    }

    LaunchedEffect(shouldLoadMore) {
        if (shouldLoadMore) {
            onLoadMore()
        }
    }

    if (onRefresh != null) {
        PullRefreshContainer(
            isRefreshing = isRefreshing,
            onRefresh = onRefresh,
            modifier = modifier
        ) {
            LazyVerticalGrid(
                modifier = Modifier.fillMaxSize(),
                state = state,
                columns = GridCells.Fixed(columns),
                contentPadding = contentPadding
            ) {
                content()

                // Loading indicator
                if (isLoadingMore) {
                    item(
                        key = "loading_more_indicator",
                        span = { GridItemSpan(columns) }
                    ) {
                        LoadMoreIndicator(
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }
        }
    } else {
        LazyVerticalGrid(
            modifier = modifier.fillMaxSize(),
            state = state,
            columns = GridCells.Fixed(columns),
            contentPadding = contentPadding
        ) {
            content()

            if (isLoadingMore) {
                item(
                    key = "loading_more_indicator",
                    span = { GridItemSpan(columns) }
                ) {
                    LoadMoreIndicator(
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }
    }
}
