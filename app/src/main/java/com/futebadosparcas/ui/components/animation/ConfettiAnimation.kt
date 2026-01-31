package com.futebadosparcas.ui.components.animation

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

/**
 * Animação de confete para celebrações.
 * Usado ao subir de nível, ganhar MVP, conquistar badge, etc.
 */

/**
 * Configuração de partícula de confete.
 */
private data class ConfettiParticle(
    val x: Float,
    val y: Float,
    val velocityX: Float,
    val velocityY: Float,
    val rotation: Float,
    val rotationSpeed: Float,
    val color: Color,
    val size: Float,
    val shape: ConfettiShape
)

/**
 * Formas de confete disponíveis.
 */
enum class ConfettiShape {
    RECTANGLE,
    CIRCLE,
    TRIANGLE,
    STAR
}

/**
 * Tipos de animação de confete.
 */
enum class ConfettiType {
    /**
     * Confete caindo do topo da tela
     */
    FALLING,

    /**
     * Explosão do centro
     */
    EXPLOSION,

    /**
     * Canhão de confete dos lados
     */
    CANNON,

    /**
     * Confete subindo (para celebrações)
     */
    RISING
}

/**
 * Cores padrão para confete.
 */
object ConfettiColors {
    val DEFAULT = listOf(
        Color(0xFFFFD700), // Gold
        Color(0xFFFF6B6B), // Coral
        Color(0xFF4ECDC4), // Teal
        Color(0xFFFFE66D), // Yellow
        Color(0xFF95E1D3), // Mint
        Color(0xFFF38181), // Salmon
        Color(0xFFAA96DA), // Lavender
        Color(0xFFFCBAD3)  // Pink
    )

    val GOLD = listOf(
        Color(0xFFFFD700),
        Color(0xFFFFC107),
        Color(0xFFFFB300),
        Color(0xFFFF8F00),
        Color(0xFFFFE082)
    )

    val SUCCESS = listOf(
        Color(0xFF4CAF50),
        Color(0xFF8BC34A),
        Color(0xFFCDDC39),
        Color(0xFF00BCD4),
        Color(0xFF03A9F4)
    )

    val MVP = listOf(
        Color(0xFFFFD700), // Gold
        Color(0xFFE0E0E0), // Silver
        Color(0xFFFF9800), // Orange
        Color(0xFFFFC107), // Amber
        Color(0xFFFFEB3B)  // Yellow
    )
}

/**
 * Componente de confete com animação.
 *
 * @param visible Se a animação está visível
 * @param type Tipo de animação de confete
 * @param colors Cores das partículas
 * @param particleCount Número de partículas
 * @param durationMillis Duração da animação
 * @param onAnimationEnd Callback quando a animação termina
 */
@Composable
fun ConfettiAnimation(
    visible: Boolean,
    modifier: Modifier = Modifier,
    type: ConfettiType = ConfettiType.EXPLOSION,
    colors: List<Color> = ConfettiColors.DEFAULT,
    particleCount: Int = 100,
    durationMillis: Int = 3000,
    onAnimationEnd: () -> Unit = {}
) {
    if (!visible) return

    val density = LocalDensity.current
    val progress = remember { Animatable(0f) }

    // Gera partículas baseadas no tipo
    val particles = remember(type, particleCount) {
        generateParticles(type, particleCount, colors)
    }

    LaunchedEffect(visible) {
        if (visible) {
            progress.snapTo(0f)
            progress.animateTo(
                targetValue = 1f,
                animationSpec = tween(durationMillis, easing = LinearEasing)
            )
            delay(200)
            onAnimationEnd()
        }
    }

    Box(modifier = modifier.fillMaxSize()) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val canvasWidth = size.width
            val canvasHeight = size.height

            particles.forEach { particle ->
                // Calcula posição baseada no progresso
                val (x, y) = calculatePosition(
                    particle = particle,
                    progress = progress.value,
                    type = type,
                    canvasWidth = canvasWidth,
                    canvasHeight = canvasHeight
                )

                // Calcula opacidade (fade out no final)
                val alpha = if (progress.value > 0.7f) {
                    1f - ((progress.value - 0.7f) / 0.3f)
                } else 1f

                // Calcula rotação
                val rotation = particle.rotation + (particle.rotationSpeed * progress.value * 360f)

                // Desenha partícula
                rotate(rotation, pivot = Offset(x, y)) {
                    when (particle.shape) {
                        ConfettiShape.RECTANGLE -> {
                            drawRect(
                                color = particle.color.copy(alpha = alpha),
                                topLeft = Offset(x - particle.size / 2, y - particle.size / 4),
                                size = Size(particle.size, particle.size / 2)
                            )
                        }
                        ConfettiShape.CIRCLE -> {
                            drawCircle(
                                color = particle.color.copy(alpha = alpha),
                                radius = particle.size / 2,
                                center = Offset(x, y)
                            )
                        }
                        ConfettiShape.TRIANGLE -> {
                            val path = androidx.compose.ui.graphics.Path().apply {
                                moveTo(x, y - particle.size / 2)
                                lineTo(x + particle.size / 2, y + particle.size / 2)
                                lineTo(x - particle.size / 2, y + particle.size / 2)
                                close()
                            }
                            drawPath(
                                path = path,
                                color = particle.color.copy(alpha = alpha)
                            )
                        }
                        ConfettiShape.STAR -> {
                            // Estrela simplificada (losango)
                            val path = androidx.compose.ui.graphics.Path().apply {
                                moveTo(x, y - particle.size / 2)
                                lineTo(x + particle.size / 4, y)
                                lineTo(x, y + particle.size / 2)
                                lineTo(x - particle.size / 4, y)
                                close()
                            }
                            drawPath(
                                path = path,
                                color = particle.color.copy(alpha = alpha)
                            )
                        }
                    }
                }
            }
        }
    }
}

/**
 * Gera partículas baseadas no tipo de animação.
 */
private fun generateParticles(
    type: ConfettiType,
    count: Int,
    colors: List<Color>
): List<ConfettiParticle> {
    return List(count) {
        val shape = ConfettiShape.entries.random()
        val color = colors.random()
        val size = Random.nextFloat() * 12f + 6f // 6-18

        when (type) {
            ConfettiType.FALLING -> ConfettiParticle(
                x = Random.nextFloat(),
                y = -Random.nextFloat() * 0.3f, // Começa acima da tela
                velocityX = (Random.nextFloat() - 0.5f) * 0.3f,
                velocityY = Random.nextFloat() * 0.5f + 0.5f,
                rotation = Random.nextFloat() * 360f,
                rotationSpeed = (Random.nextFloat() - 0.5f) * 4f,
                color = color,
                size = size,
                shape = shape
            )

            ConfettiType.EXPLOSION -> {
                val angle = Random.nextFloat() * 360f
                val speed = Random.nextFloat() * 0.8f + 0.2f
                ConfettiParticle(
                    x = 0.5f, // Centro
                    y = 0.5f,
                    velocityX = cos(Math.toRadians(angle.toDouble())).toFloat() * speed,
                    velocityY = sin(Math.toRadians(angle.toDouble())).toFloat() * speed,
                    rotation = Random.nextFloat() * 360f,
                    rotationSpeed = (Random.nextFloat() - 0.5f) * 6f,
                    color = color,
                    size = size,
                    shape = shape
                )
            }

            ConfettiType.CANNON -> {
                val fromLeft = Random.nextBoolean()
                val angle = if (fromLeft) {
                    Random.nextFloat() * 60f - 30f // -30 a 30 graus
                } else {
                    Random.nextFloat() * 60f + 150f // 150 a 210 graus
                }
                val speed = Random.nextFloat() * 0.6f + 0.4f
                ConfettiParticle(
                    x = if (fromLeft) 0f else 1f,
                    y = 0.8f,
                    velocityX = cos(Math.toRadians(angle.toDouble())).toFloat() * speed,
                    velocityY = sin(Math.toRadians(angle.toDouble())).toFloat() * speed - 0.3f,
                    rotation = Random.nextFloat() * 360f,
                    rotationSpeed = (Random.nextFloat() - 0.5f) * 5f,
                    color = color,
                    size = size,
                    shape = shape
                )
            }

            ConfettiType.RISING -> ConfettiParticle(
                x = Random.nextFloat(),
                y = 1f + Random.nextFloat() * 0.2f, // Começa abaixo da tela
                velocityX = (Random.nextFloat() - 0.5f) * 0.2f,
                velocityY = -(Random.nextFloat() * 0.4f + 0.4f), // Sobe
                rotation = Random.nextFloat() * 360f,
                rotationSpeed = (Random.nextFloat() - 0.5f) * 3f,
                color = color,
                size = size,
                shape = shape
            )
        }
    }
}

/**
 * Calcula a posição da partícula baseada no progresso.
 */
private fun calculatePosition(
    particle: ConfettiParticle,
    progress: Float,
    type: ConfettiType,
    canvasWidth: Float,
    canvasHeight: Float
): Pair<Float, Float> {
    // Gravidade simulada
    val gravity = when (type) {
        ConfettiType.FALLING -> 0.5f
        ConfettiType.EXPLOSION -> 0.3f
        ConfettiType.CANNON -> 0.4f
        ConfettiType.RISING -> -0.1f
    }

    val x = (particle.x + particle.velocityX * progress) * canvasWidth
    val y = (particle.y + particle.velocityY * progress + gravity * progress * progress) * canvasHeight

    return x to y
}

/**
 * Confete pré-configurado para MVP.
 */
@Composable
fun MvpConfetti(
    visible: Boolean,
    modifier: Modifier = Modifier,
    onAnimationEnd: () -> Unit = {}
) {
    ConfettiAnimation(
        visible = visible,
        modifier = modifier,
        type = ConfettiType.EXPLOSION,
        colors = ConfettiColors.MVP,
        particleCount = 150,
        durationMillis = 3500,
        onAnimationEnd = onAnimationEnd
    )
}

/**
 * Confete pré-configurado para Level Up.
 */
@Composable
fun LevelUpConfetti(
    visible: Boolean,
    modifier: Modifier = Modifier,
    onAnimationEnd: () -> Unit = {}
) {
    ConfettiAnimation(
        visible = visible,
        modifier = modifier,
        type = ConfettiType.RISING,
        colors = ConfettiColors.SUCCESS,
        particleCount = 80,
        durationMillis = 2500,
        onAnimationEnd = onAnimationEnd
    )
}

/**
 * Confete pré-configurado para conquista de badge.
 */
@Composable
fun BadgeConfetti(
    visible: Boolean,
    modifier: Modifier = Modifier,
    onAnimationEnd: () -> Unit = {}
) {
    ConfettiAnimation(
        visible = visible,
        modifier = modifier,
        type = ConfettiType.CANNON,
        colors = ConfettiColors.GOLD,
        particleCount = 60,
        durationMillis = 2000,
        onAnimationEnd = onAnimationEnd
    )
}

/**
 * Confete pré-configurado para vitória.
 */
@Composable
fun VictoryConfetti(
    visible: Boolean,
    modifier: Modifier = Modifier,
    onAnimationEnd: () -> Unit = {}
) {
    ConfettiAnimation(
        visible = visible,
        modifier = modifier,
        type = ConfettiType.FALLING,
        colors = ConfettiColors.DEFAULT,
        particleCount = 120,
        durationMillis = 4000,
        onAnimationEnd = onAnimationEnd
    )
}
