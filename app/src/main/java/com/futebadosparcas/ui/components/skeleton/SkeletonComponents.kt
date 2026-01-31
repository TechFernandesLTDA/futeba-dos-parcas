package com.futebadosparcas.ui.components.skeleton

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
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
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Componentes de skeleton loading unificados para o app.
 * Segue padrões do Material Design 3 com shimmer animation.
 */

// ==================== Configurações ====================

/**
 * Configuração para skeleton de lista.
 */
data class SkeletonListConfig(
    val itemCount: Int = 5,
    val hasAvatar: Boolean = true,
    val avatarSize: Dp = 48.dp,
    val hasSubtitle: Boolean = true,
    val hasTrailingElement: Boolean = false,
    val spacing: Dp = 12.dp
)

/**
 * Configuração para skeleton de card.
 */
data class SkeletonCardConfig(
    val hasImage: Boolean = false,
    val imageHeight: Dp = 120.dp,
    val titleLines: Int = 1,
    val subtitleLines: Int = 2,
    val hasFooter: Boolean = true
)

/**
 * Configuração para skeleton de perfil.
 */
data class SkeletonProfileConfig(
    val avatarSize: Dp = 80.dp,
    val hasStats: Boolean = true,
    val statCount: Int = 3,
    val hasBio: Boolean = true
)

// ==================== Shimmer Effect ====================

/**
 * Cria brush com efeito shimmer animado.
 */
@Composable
fun shimmerBrush(
    baseColor: Color = MaterialTheme.colorScheme.surfaceVariant,
    highlightColor: Color = MaterialTheme.colorScheme.surface
): Brush {
    val transition = rememberInfiniteTransition(label = "shimmer")
    val translateAnimation by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1000f,
        animationSpec = infiniteRepeatable(
            animation = tween(
                durationMillis = 1200,
                easing = FastOutSlowInEasing
            ),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmerTranslate"
    )

    return Brush.linearGradient(
        colors = listOf(
            baseColor,
            highlightColor,
            baseColor
        ),
        start = Offset(translateAnimation - 200f, translateAnimation - 200f),
        end = Offset(translateAnimation, translateAnimation)
    )
}

// ==================== Elementos Base ====================

/**
 * Box base com shimmer.
 */
@Composable
fun ShimmerBox(
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(4.dp)
) {
    Box(
        modifier = modifier
            .clip(shape)
            .background(shimmerBrush())
    )
}

/**
 * Linha de texto skeleton.
 */
@Composable
fun SkeletonLine(
    modifier: Modifier = Modifier,
    width: Dp = Dp.Unspecified,
    height: Dp = 14.dp,
    widthFraction: Float = 1f
) {
    ShimmerBox(
        modifier = modifier
            .then(
                if (width != Dp.Unspecified) Modifier.width(width)
                else Modifier.fillMaxWidth(widthFraction)
            )
            .height(height),
        shape = RoundedCornerShape(4.dp)
    )
}

/**
 * Avatar circular skeleton.
 */
@Composable
fun SkeletonAvatar(
    modifier: Modifier = Modifier,
    size: Dp = 48.dp
) {
    ShimmerBox(
        modifier = modifier.size(size),
        shape = CircleShape
    )
}

/**
 * Botão skeleton.
 */
@Composable
fun SkeletonButton(
    modifier: Modifier = Modifier,
    width: Dp = 100.dp,
    height: Dp = 40.dp
) {
    ShimmerBox(
        modifier = modifier
            .width(width)
            .height(height),
        shape = RoundedCornerShape(20.dp)
    )
}

// ==================== Componentes Compostos ====================

/**
 * Item de lista skeleton (Avatar + Texto).
 */
@Composable
fun SkeletonListItem(
    modifier: Modifier = Modifier,
    config: SkeletonListConfig = SkeletonListConfig()
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = config.spacing / 2),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (config.hasAvatar) {
            SkeletonAvatar(size = config.avatarSize)
            Spacer(modifier = Modifier.width(16.dp))
        }

        Column(modifier = Modifier.weight(1f)) {
            SkeletonLine(widthFraction = 0.7f, height = 16.dp)

            if (config.hasSubtitle) {
                Spacer(modifier = Modifier.height(8.dp))
                SkeletonLine(widthFraction = 0.5f, height = 12.dp)
            }
        }

        if (config.hasTrailingElement) {
            Spacer(modifier = Modifier.width(12.dp))
            ShimmerBox(
                modifier = Modifier.size(24.dp),
                shape = CircleShape
            )
        }
    }
}

/**
 * Lista de items skeleton.
 */
@Composable
fun SkeletonList(
    modifier: Modifier = Modifier,
    config: SkeletonListConfig = SkeletonListConfig()
) {
    LazyColumn(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(config.spacing)
    ) {
        items(config.itemCount) {
            SkeletonListItem(config = config)
        }
    }
}

/**
 * Card skeleton (para jogos, grupos, etc.).
 */
@Composable
fun SkeletonCard(
    modifier: Modifier = Modifier,
    config: SkeletonCardConfig = SkeletonCardConfig()
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
        )
    ) {
        Column {
            if (config.hasImage) {
                ShimmerBox(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(config.imageHeight),
                    shape = RoundedCornerShape(0.dp)
                )
            }

            Column(modifier = Modifier.padding(16.dp)) {
                // Título
                repeat(config.titleLines) { index ->
                    SkeletonLine(
                        widthFraction = if (index == 0) 0.8f else 0.6f,
                        height = 18.dp
                    )
                    if (index < config.titleLines - 1) {
                        Spacer(modifier = Modifier.height(4.dp))
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Subtítulo/Descrição
                repeat(config.subtitleLines) { index ->
                    SkeletonLine(
                        widthFraction = if (index == config.subtitleLines - 1) 0.4f else 0.9f,
                        height = 14.dp
                    )
                    if (index < config.subtitleLines - 1) {
                        Spacer(modifier = Modifier.height(6.dp))
                    }
                }

                if (config.hasFooter) {
                    Spacer(modifier = Modifier.height(16.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        SkeletonLine(width = 80.dp, height = 12.dp)
                        SkeletonButton(width = 80.dp, height = 32.dp)
                    }
                }
            }
        }
    }
}

/**
 * Skeleton para card de jogo.
 */
@Composable
fun SkeletonGameCard(
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header: Data + Status
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                SkeletonLine(width = 100.dp, height = 12.dp)
                ShimmerBox(
                    modifier = Modifier
                        .width(60.dp)
                        .height(24.dp),
                    shape = RoundedCornerShape(12.dp)
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Nome do jogo
            SkeletonLine(widthFraction = 0.7f, height = 20.dp)

            Spacer(modifier = Modifier.height(8.dp))

            // Local
            Row(verticalAlignment = Alignment.CenterVertically) {
                ShimmerBox(
                    modifier = Modifier.size(16.dp),
                    shape = CircleShape
                )
                Spacer(modifier = Modifier.width(8.dp))
                SkeletonLine(widthFraction = 0.5f, height = 14.dp)
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Confirmados
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy((-8).dp)
            ) {
                repeat(5) {
                    SkeletonAvatar(size = 32.dp)
                }
                Spacer(modifier = Modifier.weight(1f))
                SkeletonLine(width = 50.dp, height = 14.dp)
            }
        }
    }
}

/**
 * Skeleton para perfil de usuário.
 */
@Composable
fun SkeletonProfile(
    modifier: Modifier = Modifier,
    config: SkeletonProfileConfig = SkeletonProfileConfig()
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Avatar
        SkeletonAvatar(size = config.avatarSize)

        Spacer(modifier = Modifier.height(16.dp))

        // Nome
        SkeletonLine(width = 150.dp, height = 24.dp)

        Spacer(modifier = Modifier.height(8.dp))

        // Nível/Divisão
        SkeletonLine(width = 100.dp, height = 16.dp)

        if (config.hasStats) {
            Spacer(modifier = Modifier.height(24.dp))

            // Stats
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                repeat(config.statCount) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        SkeletonLine(width = 40.dp, height = 24.dp)
                        Spacer(modifier = Modifier.height(4.dp))
                        SkeletonLine(width = 50.dp, height = 12.dp)
                    }
                }
            }
        }

        if (config.hasBio) {
            Spacer(modifier = Modifier.height(24.dp))

            // Bio
            Column(modifier = Modifier.fillMaxWidth()) {
                SkeletonLine(widthFraction = 1f, height = 14.dp)
                Spacer(modifier = Modifier.height(6.dp))
                SkeletonLine(widthFraction = 0.8f, height = 14.dp)
            }
        }
    }
}

/**
 * Skeleton para lista de jogadores.
 */
@Composable
fun SkeletonPlayerList(
    modifier: Modifier = Modifier,
    playerCount: Int = 10
) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        repeat(playerCount) {
            SkeletonListItem(
                config = SkeletonListConfig(
                    hasAvatar = true,
                    avatarSize = 40.dp,
                    hasSubtitle = true,
                    hasTrailingElement = true
                )
            )
        }
    }
}

/**
 * Skeleton para estatísticas.
 */
@Composable
fun SkeletonStats(
    modifier: Modifier = Modifier,
    rows: Int = 4
) {
    Column(
        modifier = modifier.padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        repeat(rows) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                SkeletonLine(widthFraction = 0.4f, height = 16.dp)
                SkeletonLine(width = 60.dp, height = 16.dp)
            }
        }
    }
}

/**
 * Skeleton para header de seção.
 */
@Composable
fun SkeletonSectionHeader(
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        SkeletonLine(width = 120.dp, height = 20.dp)
        SkeletonLine(width = 60.dp, height = 14.dp)
    }
}

/**
 * Skeleton para chips/tags.
 */
@Composable
fun SkeletonChips(
    modifier: Modifier = Modifier,
    count: Int = 4
) {
    Row(
        modifier = modifier.padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        repeat(count) { index ->
            ShimmerBox(
                modifier = Modifier
                    .width((60 + index * 10).dp)
                    .height(32.dp),
                shape = RoundedCornerShape(16.dp)
            )
        }
    }
}
