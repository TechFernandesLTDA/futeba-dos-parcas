package com.futebadosparcas.ui.components.lists

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

/**
 * Efeito shimmer para estados de loading.
 * Aplica uma animação de gradiente deslizante que simula o efeito de carregamento.
 */
fun Modifier.shimmerEffect(): Modifier = composed {
    val transition = rememberInfiniteTransition(label = "shimmer")
    val translateAnim = transition.animateFloat(
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

    val shimmerColorShades = listOf(
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f)
    )

    background(
        brush = Brush.linearGradient(
            colors = shimmerColorShades,
            start = Offset(translateAnim.value - 1000f, translateAnim.value - 1000f),
            end = Offset(translateAnim.value, translateAnim.value)
        )
    )
}

/**
 * Box com efeito shimmer para placeholders.
 */
@Composable
fun ShimmerBox(
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .shimmerEffect()
    )
}

/**
 * Box circular com efeito shimmer (útil para avatares).
 */
@Composable
fun ShimmerCircle(
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(CircleShape)
            .shimmerEffect()
    )
}

/**
 * Item de jogo em estado de loading com shimmer.
 */
@Composable
fun GameCardShimmer(
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            // Data
            ShimmerBox(
                modifier = Modifier
                    .width(80.dp)
                    .height(20.dp)
            )

            // Status badge
            ShimmerBox(
                modifier = Modifier
                    .width(100.dp)
                    .height(20.dp)
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Local
        ShimmerBox(
            modifier = Modifier
                .fillMaxWidth(0.7f)
                .height(24.dp)
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Endereço
        ShimmerBox(
            modifier = Modifier
                .fillMaxWidth(0.5f)
                .height(16.dp)
        )

        Spacer(modifier = Modifier.height(12.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            // Vagas
            ShimmerBox(
                modifier = Modifier
                    .width(100.dp)
                    .height(16.dp)
            )

            // Preço
            ShimmerBox(
                modifier = Modifier
                    .width(80.dp)
                    .height(16.dp)
            )
        }
    }
}

/**
 * Item de jogador em estado de loading com shimmer.
 */
@Composable
fun PlayerCardShimmer(
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(8.dp),
        horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally
    ) {
        // Avatar
        ShimmerCircle(
            modifier = Modifier.size(64.dp)
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Nome
        ShimmerBox(
            modifier = Modifier
                .width(80.dp)
                .height(16.dp)
        )

        Spacer(modifier = Modifier.height(4.dp))

        // Level/XP
        ShimmerBox(
            modifier = Modifier
                .width(50.dp)
                .height(12.dp)
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Stats
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            repeat(3) {
                ShimmerBox(
                    modifier = Modifier
                        .width(40.dp)
                        .height(12.dp)
                )
            }
        }
    }
}

/**
 * Item de ranking em estado de loading com shimmer.
 */
@Composable
fun RankingItemShimmer(
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically
    ) {
        // Posição
        ShimmerBox(
            modifier = Modifier
                .size(32.dp)
        )

        Spacer(modifier = Modifier.width(12.dp))

        // Avatar
        ShimmerCircle(
            modifier = Modifier.size(48.dp)
        )

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            // Nome
            ShimmerBox(
                modifier = Modifier
                    .fillMaxWidth(0.6f)
                    .height(18.dp)
            )

            Spacer(modifier = Modifier.height(4.dp))

            // Stats
            ShimmerBox(
                modifier = Modifier
                    .fillMaxWidth(0.4f)
                    .height(14.dp)
            )
        }

        // Valor
        ShimmerBox(
            modifier = Modifier
                .width(60.dp)
                .height(24.dp)
        )
    }
}
