package com.futebadosparcas.ui.components.states
import org.jetbrains.compose.resources.stringResource
import com.futebadosparcas.compose.resources.Res

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.unit.dp
import com.futebadosparcas.ui.components.lists.ShimmerBox
import com.futebadosparcas.ui.components.lists.ShimmerCircle
import com.futebadosparcas.ui.components.lists.GameCardShimmer
import com.futebadosparcas.ui.components.lists.PlayerCardShimmer
import com.futebadosparcas.ui.components.lists.RankingItemShimmer
import com.futebadosparcas.ui.components.LocationCardSkeleton

/**
 * Estado de loading padrao com shimmer
 *
 * Exibe placeholders com animacao shimmer enquanto os dados estao carregando.
 * Use este componente para manter consistencia visual em todas as telas.
 *
 * @param modifier Modificador para customizacao
 * @param shimmerCount Numero de itens shimmer a exibir (padrao: 5)
 * @param itemType Tipo de item shimmer (card, list, grid)
 *
 * Exemplo de uso:
 * ```kotlin
 * when (uiState) {
 *     is UiState.Loading -> LoadingState(shimmerCount = 8)
 *     is UiState.Success -> ContentScreen(data = uiState.data)
 *     is UiState.Error -> ErrorState(message = uiState.message)
 * }
 * ```
 */
@Composable
fun LoadingState(
    modifier: Modifier = Modifier,
    shimmerCount: Int = 5,
    itemType: LoadingItemType = LoadingItemType.CARD
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .systemBarsPadding()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        repeat(shimmerCount) { index ->
            @Suppress("REDUNDANT_ELSE_IN_WHEN")
            when (itemType) {
                LoadingItemType.CARD -> ShimmerBox(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(120.dp)
                )
                LoadingItemType.GAME_CARD -> GameCardShimmer()
                LoadingItemType.PLAYER_CARD -> PlayerCardShimmer()
                LoadingItemType.RANKING_ITEM -> RankingItemShimmer()
                LoadingItemType.LIST_ITEM -> ShimmerBox(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(72.dp)
                )
                LoadingItemType.LOCATION_CARD -> LocationCardSkeleton(
                    animationDelay = index * 100,
                    showFieldRows = true
                )
                LoadingItemType.STATISTIC_CARD -> StatisticCardShimmer()
                LoadingItemType.BADGE_CARD -> BadgeCardShimmer()
                LoadingItemType.CASHBOX_ITEM -> CashboxItemShimmer()
                LoadingItemType.NOTIFICATION_ITEM -> NotificationItemShimmer()
                else -> ShimmerBox(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(120.dp)
                )
            }
        }
    }
}

/**
 * Tipo de item de loading
 */
enum class LoadingItemType {
    /** Card generico */
    CARD,
    /** Card de jogo */
    GAME_CARD,
    /** Card de jogador */
    PLAYER_CARD,
    /** Item de ranking */
    RANKING_ITEM,
    /** Item de lista simples */
    LIST_ITEM,
    /** Card de local/campo com efeito wave staggered */
    LOCATION_CARD,
    /** Card de estatistica (gols, assistencias, etc.) */
    STATISTIC_CARD,
    /** Card de badge/conquista */
    BADGE_CARD,
    /** Item de transacao financeira (caixa do grupo) */
    CASHBOX_ITEM,
    /** Item de notificacao */
    NOTIFICATION_ITEM
}

/**
 * Shimmer para card de estatistica
 */
@Composable
private fun StatisticCardShimmer(
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        ShimmerBox(
            modifier = Modifier.size(40.dp)
        )

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            ShimmerBox(
                modifier = Modifier
                    .fillMaxWidth(0.5f)
                    .height(16.dp)
            )
            Spacer(modifier = Modifier.height(6.dp))
            ShimmerBox(
                modifier = Modifier
                    .fillMaxWidth(0.8f)
                    .height(8.dp)
            )
        }

        Spacer(modifier = Modifier.width(12.dp))

        ShimmerBox(
            modifier = Modifier
                .width(48.dp)
                .height(24.dp)
        )
    }
}

/**
 * Shimmer para card de badge/conquista
 */
@Composable
private fun BadgeCardShimmer(
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .width(100.dp)
            .padding(8.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        ShimmerCircle(
            modifier = Modifier.size(56.dp)
        )
        Spacer(modifier = Modifier.height(8.dp))
        ShimmerBox(
            modifier = Modifier
                .width(80.dp)
                .height(14.dp)
        )
        Spacer(modifier = Modifier.height(4.dp))
        ShimmerBox(
            modifier = Modifier
                .width(60.dp)
                .height(10.dp)
        )
    }
}

/**
 * Shimmer para item de transacao financeira (cashbox)
 */
@Composable
private fun CashboxItemShimmer(
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        ShimmerCircle(
            modifier = Modifier.size(40.dp)
        )
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            ShimmerBox(
                modifier = Modifier
                    .fillMaxWidth(0.6f)
                    .height(16.dp)
            )
            Spacer(modifier = Modifier.height(4.dp))
            ShimmerBox(
                modifier = Modifier
                    .fillMaxWidth(0.35f)
                    .height(12.dp)
            )
        }
        ShimmerBox(
            modifier = Modifier
                .width(72.dp)
                .height(20.dp)
        )
    }
}

/**
 * Shimmer para item de notificacao
 */
@Composable
private fun NotificationItemShimmer(
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.Top
    ) {
        ShimmerCircle(
            modifier = Modifier.size(44.dp)
        )
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            ShimmerBox(
                modifier = Modifier
                    .fillMaxWidth(0.7f)
                    .height(16.dp)
            )
            Spacer(modifier = Modifier.height(6.dp))
            ShimmerBox(
                modifier = Modifier
                    .fillMaxWidth(0.9f)
                    .height(14.dp)
            )
            Spacer(modifier = Modifier.height(4.dp))
            ShimmerBox(
                modifier = Modifier
                    .width(80.dp)
                    .height(10.dp)
            )
        }
        ShimmerCircle(
            modifier = Modifier.size(8.dp)
        )
    }
}

/**
 * Loading state compacto para secoes menores
 */
@Composable
fun LoadingStateCompact(
    modifier: Modifier = Modifier,
    message: String = stringResource(Res.string.state_loading)
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        CircularProgressIndicator(
            modifier = Modifier.size(40.dp),
            color = MaterialTheme.colorScheme.primary
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

/**
 * Loading state de tela inteira com mensagem
 */
@Composable
fun FullScreenLoadingState(
    modifier: Modifier = Modifier,
    message: String = stringResource(Res.string.state_loading)
) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        LoadingStateCompact(message = message)
    }
}
