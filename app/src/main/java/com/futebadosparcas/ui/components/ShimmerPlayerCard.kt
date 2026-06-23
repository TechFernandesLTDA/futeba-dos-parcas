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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.unit.dp
import com.futebadosparcas.ui.theme.MotionDuration
import com.futebadosparcas.ui.theme.MotionEasing
import com.futebadosparcas.ui.theme.rememberReduceMotion

/**
 * Componente de loading com efeito shimmer para cards de jogadores
 * Usado durante carregamento de dados da lista de jogadores
 */
@Composable
fun ShimmerPlayerCard(
    modifier: Modifier = Modifier
) {
    val reduceMotion = rememberReduceMotion()
    val shimmerColors = listOf(
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f)
    )

    val translate = if (reduceMotion) {
        500f
    } else {
        val transition = rememberInfiniteTransition(label = "shimmer")
        transition.animateFloat(
            initialValue = 0f,
            targetValue = 1000f,
            animationSpec = infiniteRepeatable(
                animation = tween(
                    durationMillis = MotionDuration.Long,
                    easing = MotionEasing.Standard
                ),
                repeatMode = RepeatMode.Restart
            ),
            label = "shimmer_translate"
        ).value
    }

    val brush = Brush.linearGradient(
        colors = shimmerColors,
        start = Offset(translate - 1000f, translate - 1000f),
        end = Offset(translate, translate)
    )

    Card(
        modifier = modifier
            .fillMaxWidth()
            .height(100.dp),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Avatar
            Box(
                modifier = Modifier
                    .size(64.dp)
                    .clip(CircleShape)
                    .background(brush)
            )

            Spacer(modifier = Modifier.width(16.dp))

            // Conteúdo
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Nome
                Box(
                    modifier = Modifier
                        .width(140.dp)
                        .height(20.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(brush)
                )

                // Estatísticas
                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .width(60.dp)
                            .height(16.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(brush)
                    )
                    Box(
                        modifier = Modifier
                            .width(60.dp)
                            .height(16.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(brush)
                    )
                }
            }

            // Nível/Badge
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(brush)
            )
        }
    }
}

/**
 * Preview de múltiplos cards de shimmer para simular lista
 */
@Composable
fun ShimmerPlayerCardList(
    modifier: Modifier = Modifier,
    count: Int = 5
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        repeat(count) {
            ShimmerPlayerCard()
        }
    }
}
