package com.futebadosparcas.ui.components.states

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.futebadosparcas.ui.components.lists.ShimmerBox
import com.futebadosparcas.ui.components.lists.GameCardShimmer
import com.futebadosparcas.ui.components.lists.PlayerCardShimmer
import com.futebadosparcas.ui.components.lists.RankingItemShimmer

/**
 * Estado de loading padrão com shimmer
 *
 * Exibe placeholders com animação shimmer enquanto os dados estão carregando.
 * Use este componente para manter consistência visual em todas as telas.
 *
 * @param modifier Modificador para customização
 * @param shimmerCount Número de itens shimmer a exibir (padrão: 5)
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
        repeat(shimmerCount) {
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
            }
        }
    }
}

/**
 * Tipo de item de loading
 */
enum class LoadingItemType {
    /** Card genérico */
    CARD,
    /** Card de jogo */
    GAME_CARD,
    /** Card de jogador */
    PLAYER_CARD,
    /** Item de ranking */
    RANKING_ITEM,
    /** Item de lista simples */
    LIST_ITEM
}

/**
 * Loading state compacto para seções menores
 */
@Composable
fun LoadingStateCompact(
    modifier: Modifier = Modifier,
    message: String = "Carregando..."
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        CircularProgressIndicator(
            modifier = Modifier.size(48.dp),
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
    message: String = "Carregando..."
) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        LoadingStateCompact(message = message)
    }
}
