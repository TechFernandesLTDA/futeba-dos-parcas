package com.futebadosparcas.ui.components.gamification

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.sin
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource

/**
 * Componentes visuais para exibir sequências (streaks) de jogos.
 * Inclui animação de chama que intensifica baseada no número de jogos consecutivos.
 */

// ==================== Cores do Fogo ====================

object FlameColors {
    val FireOrange = Color(0xFFFF6B35)
    val FireYellow = Color(0xFFFFD93D)
    val FireRed = Color(0xFFFF3131)
    val FireCore = Color(0xFFFFFFFF)

    // Cores por intensidade de streak
    val Level1 = listOf(Color(0xFFFF9500), Color(0xFFFF6B00)) // 1-3 jogos
    val Level2 = listOf(Color(0xFFFF6B35), Color(0xFFFF3D00)) // 4-6 jogos
    val Level3 = listOf(Color(0xFFFF3131), Color(0xFFCC0000)) // 7-9 jogos
    val Level4 = listOf(Color(0xFF9400D3), Color(0xFF4B0082)) // 10+ jogos (roxo épico)
    val Level5 = listOf(Color(0xFF00BFFF), Color(0xFF1E90FF)) // 20+ jogos (azul lendário)
}

/**
 * Nível da chama baseado no streak.
 */
enum class FlameLevel(
    val minStreak: Int,
    val displayName: String,
    val colors: List<Color>,
    val particleCount: Int,
    val intensity: Float
) {
    NONE(0, "Sem sequência", listOf(Color.Gray), 0, 0f),
    WARMING(1, "Esquentando", FlameColors.Level1, 3, 0.5f),
    HOT(4, "Em chamas", FlameColors.Level2, 5, 0.7f),
    BURNING(7, "Pegando fogo", FlameColors.Level3, 8, 0.85f),
    INFERNO(10, "Inferno", FlameColors.Level4, 12, 1.0f),
    LEGENDARY(20, "Lendário", FlameColors.Level5, 15, 1.2f);

    companion object {
        fun fromStreak(streak: Int): FlameLevel {
            return entries.reversed().firstOrNull { streak >= it.minStreak } ?: NONE
        }
    }
}

/**
 * Chama animada que representa a sequência de jogos.
 */
@Composable
fun StreakFlame(
    streak: Int,
    modifier: Modifier = Modifier,
    size: Dp = 48.dp,
    showLabel: Boolean = true
) {
    val level = FlameLevel.fromStreak(streak)

    if (level == FlameLevel.NONE) {
        // Sem streak - mostrar ícone apagado
        InactiveFlame(modifier = modifier, size = size)
        return
    }

    val infiniteTransition = rememberInfiniteTransition(label = "flame")

    // Animação de oscilação
    val flicker by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(300, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "flicker"
    )

    // Animação de escala do core
    val coreScale by infiniteTransition.animateFloat(
        initialValue = 0.8f,
        targetValue = 1.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(500, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "coreScale"
    )

    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier.size(size),
            contentAlignment = Alignment.Center
        ) {
            Canvas(modifier = Modifier.size(size)) {
                drawFlame(
                    level = level,
                    flicker = flicker,
                    coreScale = coreScale
                )
            }

            // Número do streak no centro
            Text(
                text = "$streak",
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }

        if (showLabel) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = level.displayName,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * Chama inativa (sem streak).
 */
@Composable
private fun InactiveFlame(
    modifier: Modifier = Modifier,
    size: Dp = 48.dp
) {
    Box(
        modifier = modifier.size(size),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.size(size)) {
            val centerX = size.toPx() / 2
            val centerY = size.toPx() / 2

            // Chama apagada (cinza)
            val path = createFlamePath(centerX, centerY, size.toPx() * 0.4f, 0f)
            drawPath(
                path = path,
                color = Color.Gray.copy(alpha = 0.3f)
            )
        }

        Text(
            text = "0",
            style = MaterialTheme.typography.labelMedium,
            color = Color.Gray
        )
    }
}

/**
 * Desenha a chama no canvas.
 */
private fun DrawScope.drawFlame(
    level: FlameLevel,
    flicker: Float,
    coreScale: Float
) {
    val centerX = size.width / 2
    val centerY = size.height / 2
    val baseRadius = size.minDimension * 0.35f

    // Camada externa (glow)
    val glowPath = createFlamePath(
        centerX = centerX,
        centerY = centerY,
        radius = baseRadius * (1.1f + flicker * 0.1f),
        flicker = flicker
    )

    val glowBrush = Brush.verticalGradient(
        colors = level.colors.map { it.copy(alpha = 0.3f) }
    )
    drawPath(path = glowPath, brush = glowBrush)

    // Camada principal
    val mainPath = createFlamePath(
        centerX = centerX,
        centerY = centerY,
        radius = baseRadius * (1f + flicker * 0.05f),
        flicker = flicker
    )

    val mainBrush = Brush.verticalGradient(
        colors = level.colors
    )
    drawPath(path = mainPath, brush = mainBrush)

    // Core brilhante
    val coreRadius = baseRadius * 0.4f * coreScale
    val coreCenter = Offset(centerX, centerY + baseRadius * 0.2f)

    drawCircle(
        brush = Brush.radialGradient(
            colors = listOf(
                FlameColors.FireCore.copy(alpha = 0.9f),
                FlameColors.FireYellow.copy(alpha = 0.5f),
                Color.Transparent
            ),
            center = coreCenter,
            radius = coreRadius
        ),
        radius = coreRadius,
        center = coreCenter
    )
}

/**
 * Cria o path da forma de chama.
 */
private fun createFlamePath(
    centerX: Float,
    centerY: Float,
    radius: Float,
    flicker: Float
): Path {
    return Path().apply {
        // Ponto inferior (base da chama)
        val bottomY = centerY + radius * 0.8f

        // Ponto superior (ponta da chama)
        val topY = centerY - radius * 1.2f

        // Oscilação lateral
        val lateralOffset = sin(flicker * Math.PI.toFloat()) * radius * 0.1f

        moveTo(centerX, bottomY)

        // Lado esquerdo
        cubicTo(
            centerX - radius * 0.6f, centerY + radius * 0.3f,
            centerX - radius * 0.8f + lateralOffset, centerY - radius * 0.2f,
            centerX - radius * 0.3f + lateralOffset, topY + radius * 0.3f
        )

        // Ponta
        cubicTo(
            centerX - radius * 0.1f + lateralOffset, topY,
            centerX + radius * 0.1f + lateralOffset, topY,
            centerX + radius * 0.3f + lateralOffset, topY + radius * 0.3f
        )

        // Lado direito
        cubicTo(
            centerX + radius * 0.8f + lateralOffset, centerY - radius * 0.2f,
            centerX + radius * 0.6f, centerY + radius * 0.3f,
            centerX, bottomY
        )

        close()
    }
}

// ==================== Componentes Compostos ====================

/**
 * Badge de streak com chama e informações.
 */
@Composable
fun StreakBadge(
    streak: Int,
    modifier: Modifier = Modifier,
    showDaysLabel: Boolean = true
) {
    val level = FlameLevel.fromStreak(streak)

    Row(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(
                brush = Brush.horizontalGradient(
                    colors = if (level != FlameLevel.NONE) {
                        level.colors.map { it.copy(alpha = 0.2f) }
                    } else {
                        listOf(Color.Gray.copy(alpha = 0.1f), Color.Gray.copy(alpha = 0.1f))
                    }
                )
            )
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        StreakFlame(
            streak = streak,
            size = 32.dp,
            showLabel = false
        )

        Column {
            Text(
                text = "$streak jogos",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )

            if (showDaysLabel) {
                Text(
                    text = level.displayName,
                    style = MaterialTheme.typography.labelSmall,
                    color = if (level != FlameLevel.NONE) {
                        level.colors.first()
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    }
                )
            }
        }
    }
}

/**
 * Indicador compacto de streak para listas.
 */
@Composable
fun CompactStreakIndicator(
    streak: Int,
    modifier: Modifier = Modifier
) {
    if (streak <= 0) return

    val level = FlameLevel.fromStreak(streak)

    Row(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(level.colors.first().copy(alpha = 0.15f))
            .padding(horizontal = 6.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        StreakFlame(
            streak = streak,
            size = 16.dp,
            showLabel = false
        )

        Text(
            text = "$streak",
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = level.colors.first()
        )
    }
}

/**
 * Card de streak com informações detalhadas.
 */
@Composable
fun StreakCard(
    currentStreak: Int,
    bestStreak: Int,
    modifier: Modifier = Modifier
) {
    val level = FlameLevel.fromStreak(currentStreak)

    Column(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        StreakFlame(
            streak = currentStreak,
            size = 64.dp,
            showLabel = true
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Barra de progresso para próximo nível
        val nextLevel = FlameLevel.entries.firstOrNull { it.minStreak > currentStreak }
        if (nextLevel != null) {
            val progress = (currentStreak - level.minStreak).toFloat() /
                          (nextLevel.minStreak - level.minStreak).toFloat()

            Column(
                modifier = Modifier.padding(horizontal = 16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = stringResource(R.string.streak_next_level, nextLevel.displayName),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(modifier = Modifier.height(4.dp))

                Box(
                    modifier = Modifier
                        .height(4.dp)
                        .width(120.dp)
                        .clip(RoundedCornerShape(2.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Box(
                        modifier = Modifier
                            .height(4.dp)
                            .width(120.dp * progress)
                            .clip(RoundedCornerShape(2.dp))
                            .background(
                                brush = Brush.horizontalGradient(level.colors)
                            )
                    )
                }

                Text(
                    text = "${nextLevel.minStreak - currentStreak} jogos restantes",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Melhor streak
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            Text(
                text = stringResource(R.string.streak_record),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = "$bestStreak jogos",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                color = if (currentStreak >= bestStreak && currentStreak > 0) {
                    FlameColors.FireOrange
                } else {
                    MaterialTheme.colorScheme.onSurface
                }
            )
        }
    }
}

/**
 * Animação de celebração quando atinge novo nível de streak.
 */
@Composable
fun StreakLevelUpAnimation(
    newLevel: FlameLevel,
    onAnimationComplete: () -> Unit,
    modifier: Modifier = Modifier
) {
    val scale = remember { Animatable(0f) }

    LaunchedEffect(newLevel) {
        scale.animateTo(
            targetValue = 1.2f,
            animationSpec = tween(300, easing = FastOutSlowInEasing)
        )
        scale.animateTo(
            targetValue = 1f,
            animationSpec = tween(200)
        )
        onAnimationComplete()
    }

    Box(
        modifier = modifier,
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            StreakFlame(
                streak = newLevel.minStreak,
                size = (80 * scale.value).dp,
                showLabel = false
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = newLevel.displayName,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = newLevel.colors.first()
            )

            Text(
                text = stringResource(R.string.streak_unlocked),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
