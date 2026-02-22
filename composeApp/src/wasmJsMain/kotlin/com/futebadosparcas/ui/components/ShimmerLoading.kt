package com.futebadosparcas.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.dp

/**
 * Modificador para aplicar efeito shimmer (skeleton loading)
 * Usa graphicsLayer para composicao do efeito
 */
@Composable
fun Modifier.shimmerEffect(
    shape: Shape = RoundedCornerShape(8.dp)
): Modifier {
    val transition = rememberInfiniteTransition(label = "shimmer")

    val translateAnim by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1000f,
        animationSpec = infiniteRepeatable(
            animation = tween(
                durationMillis = 1200,
                easing = FastOutSlowInEasing
            ),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmer_translate"
    )

    val shimmerColors = listOf(
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f)
    )

    val brush = Brush.linearGradient(
        colors = shimmerColors,
        start = Offset(translateAnim - 1000f, translateAnim - 1000f),
        end = Offset(translateAnim, translateAnim)
    )

    return this
        .clip(shape)
        .graphicsLayer {
            clip = true
            this.shape = androidx.compose.ui.graphics.RectangleShape
        }
        .background(brush = brush)
}

/**
 * Box com efeito shimmer para placeholders
 */
@Composable
fun ShimmerBox(
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(8.dp)
) {
    Box(
        modifier = modifier.shimmerEffect(shape)
    )
}

/**
 * Card com skeleton shimmer
 */
@Composable
fun ShimmerCard(
    modifier: Modifier = Modifier,
    height: Int = 120
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .height(height.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
        ),
        shape = MaterialTheme.shapes.medium
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            ShimmerCircle(
                modifier = Modifier.size(56.dp)
            )

            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                ShimmerText(
                    modifier = Modifier.fillMaxWidth(0.7f),
                    height = 20
                )
                ShimmerText(
                    modifier = Modifier.fillMaxWidth(0.5f),
                    height = 16
                )
                ShimmerText(
                    modifier = Modifier.fillMaxWidth(0.4f),
                    height = 14
                )
            }

            ShimmerBox(
                modifier = Modifier
                    .width(80.dp)
                    .height(32.dp),
                shape = MaterialTheme.shapes.small
            )
        }
    }
}

/**
 * Box circular com efeito shimmer (para avatares)
 */
@Composable
fun ShimmerCircle(
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier.shimmerEffect(CircleShape)
    )
}

/**
 * Text placeholder com efeito shimmer
 */
@Composable
fun ShimmerText(
    modifier: Modifier = Modifier,
    widthFraction: Float = 0.7f,
    height: Int = 16
) {
    Box(
        modifier = modifier
            .fillMaxWidth(widthFraction)
            .height(height.dp)
            .shimmerEffect()
    )
}

/**
 * Item de lista placeholder com shimmer
 */
@Composable
fun ShimmerListItem(
    modifier: Modifier = Modifier,
    showAvatar: Boolean = true,
    lines: Int = 2
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (showAvatar) {
            ShimmerCircle(
                modifier = Modifier.size(48.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
        }

        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            repeat(lines) { index ->
                val widthFraction = if (index == 0) 0.7f else 0.5f
                ShimmerText(
                    modifier = Modifier.fillMaxWidth(widthFraction),
                    height = if (index == 0) 18 else 14
                )
            }
        }

        ShimmerBox(
            modifier = Modifier
                .size(32.dp),
            shape = CircleShape
        )
    }
}

/**
 * Card de jogo com shimmer
 */
@Composable
fun ShimmerGameCard(
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .height(120.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
        ),
        shape = MaterialTheme.shapes.medium
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            ShimmerCircle(
                modifier = Modifier.size(56.dp)
            )

            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                ShimmerText(
                    modifier = Modifier.fillMaxWidth(0.7f),
                    height = 20
                )
                ShimmerText(
                    modifier = Modifier.fillMaxWidth(0.5f),
                    height = 16
                )
                ShimmerText(
                    modifier = Modifier.fillMaxWidth(0.4f),
                    height = 14
                )
            }

            ShimmerBox(
                modifier = Modifier
                    .width(80.dp)
                    .height(32.dp),
                shape = MaterialTheme.shapes.small
            )
        }
    }
}

/**
 * Card de jogador com shimmer
 */
@Composable
fun ShimmerPlayerCard(
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .height(80.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainer
        ),
        shape = MaterialTheme.shapes.medium
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            ShimmerCircle(
                modifier = Modifier.size(48.dp)
            )

            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                ShimmerText(
                    modifier = Modifier.fillMaxWidth(0.6f),
                    height = 18
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    repeat(3) {
                        ShimmerBox(
                            modifier = Modifier
                                .width(40.dp)
                                .height(14.dp)
                        )
                    }
                }
            }

            ShimmerCircle(
                modifier = Modifier.size(32.dp)
            )
        }
    }
}

/**
 * Item de ranking com shimmer
 */
@Composable
fun ShimmerRankingItem(
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        ShimmerBox(
            modifier = Modifier.size(32.dp)
        )

        Spacer(modifier = Modifier.width(12.dp))

        ShimmerCircle(
            modifier = Modifier.size(48.dp)
        )

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            ShimmerText(
                modifier = Modifier.fillMaxWidth(0.6f),
                height = 18
            )
            Spacer(modifier = Modifier.height(4.dp))
            ShimmerText(
                modifier = Modifier.fillMaxWidth(0.4f),
                height = 14
            )
        }

        ShimmerBox(
            modifier = Modifier
                .width(60.dp)
                .height(24.dp)
        )
    }
}

/**
 * Tipo de item de loading
 */
enum class LoadingItemType {
    CARD,
    GAME_CARD,
    PLAYER_CARD,
    RANKING_ITEM,
    LIST_ITEM
}

/**
 * Estado de loading padrao com shimmer
 *
 * @param shimmerCount Numero de itens shimmer a exibir
 * @param itemType Tipo de item shimmer
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
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        repeat(shimmerCount) {
            when (itemType) {
                LoadingItemType.CARD -> ShimmerCard()
                LoadingItemType.GAME_CARD -> ShimmerGameCard()
                LoadingItemType.PLAYER_CARD -> ShimmerPlayerCard()
                LoadingItemType.RANKING_ITEM -> ShimmerRankingItem()
                LoadingItemType.LIST_ITEM -> ShimmerListItem()
            }
        }
    }
}

/**
 * Lista de cards com shimmer
 */
@Composable
fun ShimmerGamesList(
    modifier: Modifier = Modifier,
    count: Int = 5
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        repeat(count) {
            ShimmerGameCard()
        }
    }
}

/**
 * Shimmer para botao
 */
@Composable
fun ShimmerButton(
    modifier: Modifier = Modifier,
    width: Int = 120,
    height: Int = 40
) {
    ShimmerBox(
        modifier = modifier
            .width(width.dp)
            .height(height.dp),
        shape = MaterialTheme.shapes.small
    )
}
