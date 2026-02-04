package com.futebadosparcas.ui.components.empty

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.cos
import kotlin.math.sin

/**
 * Empty states ilustrados para diferentes contextos do app.
 * Usa Canvas para desenhos vetoriais leves (sem dependência de assets).
 */

/**
 * Tipo de empty state.
 */
enum class EmptyStateType {
    NO_GAMES,
    NO_GROUPS,
    NO_PLAYERS,
    NO_NOTIFICATIONS,
    NO_CONNECTION,
    NO_RESULTS,
    ERROR,
    COMING_SOON
}

/**
 * Configuração de empty state.
 */
data class EmptyStateConfig(
    val type: EmptyStateType,
    val title: String,
    val message: String,
    val primaryAction: EmptyStateAction? = null,
    val secondaryAction: EmptyStateAction? = null
)

/**
 * Ação de empty state.
 */
data class EmptyStateAction(
    val label: String,
    val onClick: () -> Unit
)

/**
 * Componente de empty state ilustrado.
 */
@Composable
fun IllustratedEmptyState(
    config: EmptyStateConfig,
    modifier: Modifier = Modifier,
    illustrationSize: Dp = 160.dp
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Ilustração animada
        EmptyStateIllustration(
            type = config.type,
            modifier = Modifier.size(illustrationSize)
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Título
        Text(
            text = config.title,
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Mensagem
        Text(
            text = config.message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        // Ações
        if (config.primaryAction != null || config.secondaryAction != null) {
            Spacer(modifier = Modifier.height(24.dp))

            config.primaryAction?.let { action ->
                Button(
                    onClick = action.onClick,
                    modifier = Modifier.fillMaxWidth(0.7f)
                ) {
                    Text(action.label)
                }
            }

            config.secondaryAction?.let { action ->
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedButton(
                    onClick = action.onClick,
                    modifier = Modifier.fillMaxWidth(0.7f)
                ) {
                    Text(action.label)
                }
            }
        }
    }
}

/**
 * Ilustração animada baseada no tipo.
 */
@Composable
fun EmptyStateIllustration(
    type: EmptyStateType,
    modifier: Modifier = Modifier
) {
    val primaryColor = MaterialTheme.colorScheme.primary
    val secondaryColor = MaterialTheme.colorScheme.secondary
    val surfaceColor = MaterialTheme.colorScheme.surfaceVariant
    val outlineColor = MaterialTheme.colorScheme.outline

    when (type) {
        EmptyStateType.NO_GAMES -> SoccerBallIllustration(
            modifier = modifier,
            ballColor = primaryColor,
            lineColor = outlineColor
        )
        EmptyStateType.NO_GROUPS -> GroupIllustration(
            modifier = modifier,
            primaryColor = primaryColor,
            secondaryColor = surfaceColor
        )
        EmptyStateType.NO_PLAYERS -> PlayerIllustration(
            modifier = modifier,
            primaryColor = primaryColor,
            secondaryColor = surfaceColor
        )
        EmptyStateType.NO_NOTIFICATIONS -> BellIllustration(
            modifier = modifier,
            bellColor = surfaceColor,
            accentColor = primaryColor
        )
        EmptyStateType.NO_CONNECTION -> CloudOfflineIllustration(
            modifier = modifier,
            cloudColor = surfaceColor,
            crossColor = outlineColor
        )
        EmptyStateType.NO_RESULTS -> SearchIllustration(
            modifier = modifier,
            glassColor = surfaceColor,
            handleColor = outlineColor
        )
        EmptyStateType.ERROR -> ErrorIllustration(
            modifier = modifier,
            circleColor = MaterialTheme.colorScheme.errorContainer,
            iconColor = MaterialTheme.colorScheme.error
        )
        EmptyStateType.COMING_SOON -> RocketIllustration(
            modifier = modifier,
            rocketColor = primaryColor,
            flameColor = secondaryColor
        )
    }
}

// ==================== Ilustrações Individuais ====================

/**
 * Bola de futebol com animação de rolamento.
 */
@Composable
private fun SoccerBallIllustration(
    modifier: Modifier = Modifier,
    ballColor: Color,
    lineColor: Color
) {
    val infiniteTransition = rememberInfiniteTransition(label = "soccer")
    val rotation by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(4000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "ballRotation"
    )

    Canvas(modifier = modifier) {
        val centerX = size.width / 2
        val centerY = size.height / 2
        val radius = size.minDimension / 2.5f

        rotate(rotation, pivot = Offset(centerX, centerY)) {
            // Bola
            drawCircle(
                color = ballColor.copy(alpha = 0.2f),
                radius = radius,
                center = Offset(centerX, centerY)
            )
            drawCircle(
                color = lineColor,
                radius = radius,
                center = Offset(centerX, centerY),
                style = Stroke(width = 3f)
            )

            // Padrão de pentágonos (simplificado)
            val pentagonRadius = radius * 0.35f
            drawCircle(
                color = lineColor.copy(alpha = 0.3f),
                radius = pentagonRadius,
                center = Offset(centerX, centerY)
            )

            // Linhas para pentágonos externos
            for (i in 0 until 5) {
                val angle = Math.toRadians((i * 72.0) - 90)
                val endX = centerX + (radius * 0.7f * cos(angle)).toFloat()
                val endY = centerY + (radius * 0.7f * sin(angle)).toFloat()
                drawLine(
                    color = lineColor.copy(alpha = 0.3f),
                    start = Offset(centerX, centerY),
                    end = Offset(endX, endY),
                    strokeWidth = 2f
                )
            }
        }
    }
}

/**
 * Grupo de pessoas.
 */
@Composable
private fun GroupIllustration(
    modifier: Modifier = Modifier,
    primaryColor: Color,
    secondaryColor: Color
) {
    val infiniteTransition = rememberInfiniteTransition(label = "group")
    val bounce by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 8f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "groupBounce"
    )

    Canvas(modifier = modifier) {
        val centerX = size.width / 2
        val centerY = size.height / 2

        // Pessoa central (maior)
        val headRadius = size.minDimension / 8
        drawCircle(
            color = primaryColor,
            radius = headRadius,
            center = Offset(centerX, centerY - 20 - bounce)
        )
        drawOval(
            color = primaryColor,
            topLeft = Offset(centerX - headRadius * 1.2f, centerY + headRadius - 10 - bounce),
            size = androidx.compose.ui.geometry.Size(headRadius * 2.4f, headRadius * 2f)
        )

        // Pessoa esquerda
        drawCircle(
            color = secondaryColor,
            radius = headRadius * 0.8f,
            center = Offset(centerX - 50, centerY - 10)
        )
        drawOval(
            color = secondaryColor,
            topLeft = Offset(centerX - 50 - headRadius * 0.9f, centerY + headRadius * 0.7f - 10),
            size = androidx.compose.ui.geometry.Size(headRadius * 1.8f, headRadius * 1.6f)
        )

        // Pessoa direita
        drawCircle(
            color = secondaryColor,
            radius = headRadius * 0.8f,
            center = Offset(centerX + 50, centerY - 10)
        )
        drawOval(
            color = secondaryColor,
            topLeft = Offset(centerX + 50 - headRadius * 0.9f, centerY + headRadius * 0.7f - 10),
            size = androidx.compose.ui.geometry.Size(headRadius * 1.8f, headRadius * 1.6f)
        )
    }
}

/**
 * Jogador solitário.
 */
@Composable
private fun PlayerIllustration(
    modifier: Modifier = Modifier,
    primaryColor: Color,
    secondaryColor: Color
) {
    Canvas(modifier = modifier) {
        val centerX = size.width / 2
        val centerY = size.height / 2
        val headRadius = size.minDimension / 6

        // Cabeça
        drawCircle(
            color = primaryColor,
            radius = headRadius,
            center = Offset(centerX, centerY - 30)
        )

        // Corpo
        drawOval(
            color = primaryColor,
            topLeft = Offset(centerX - headRadius * 1.3f, centerY + headRadius - 20),
            size = androidx.compose.ui.geometry.Size(headRadius * 2.6f, headRadius * 2.5f)
        )

        // Ponto de interrogação (outline tracejado ao redor)
        drawCircle(
            color = secondaryColor,
            radius = size.minDimension / 2.5f,
            center = Offset(centerX, centerY),
            style = Stroke(width = 3f, pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(10f, 10f)))
        )
    }
}

/**
 * Sino de notificação.
 */
@Composable
private fun BellIllustration(
    modifier: Modifier = Modifier,
    bellColor: Color,
    accentColor: Color
) {
    val infiniteTransition = rememberInfiniteTransition(label = "bell")
    val swing by infiniteTransition.animateFloat(
        initialValue = -5f,
        targetValue = 5f,
        animationSpec = infiniteRepeatable(
            animation = tween(500, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "bellSwing"
    )

    Canvas(modifier = modifier) {
        val centerX = size.width / 2
        val centerY = size.height / 2

        rotate(swing, pivot = Offset(centerX, centerY - 50)) {
            // Corpo do sino
            val bellPath = Path().apply {
                moveTo(centerX - 40, centerY + 20)
                quadraticBezierTo(centerX - 50, centerY - 30, centerX - 20, centerY - 50)
                lineTo(centerX + 20, centerY - 50)
                quadraticBezierTo(centerX + 50, centerY - 30, centerX + 40, centerY + 20)
                close()
            }
            drawPath(bellPath, bellColor)

            // Topo do sino
            drawCircle(
                color = bellColor,
                radius = 8f,
                center = Offset(centerX, centerY - 55)
            )

            // Badalo
            drawCircle(
                color = accentColor,
                radius = 10f,
                center = Offset(centerX, centerY + 25)
            )
        }

        // "Zzz" para indicar silêncio
        drawCircle(
            color = accentColor.copy(alpha = 0.5f),
            radius = 5f,
            center = Offset(centerX + 45, centerY - 40)
        )
        drawCircle(
            color = accentColor.copy(alpha = 0.3f),
            radius = 4f,
            center = Offset(centerX + 55, centerY - 50)
        )
    }
}

/**
 * Nuvem offline.
 */
@Composable
private fun CloudOfflineIllustration(
    modifier: Modifier = Modifier,
    cloudColor: Color,
    crossColor: Color
) {
    Canvas(modifier = modifier) {
        val centerX = size.width / 2
        val centerY = size.height / 2

        // Nuvem
        drawCircle(cloudColor, 35f, Offset(centerX - 30, centerY))
        drawCircle(cloudColor, 45f, Offset(centerX, centerY - 15))
        drawCircle(cloudColor, 35f, Offset(centerX + 30, centerY))
        drawOval(
            cloudColor,
            Offset(centerX - 50, centerY - 10),
            androidx.compose.ui.geometry.Size(100f, 50f)
        )

        // X de offline
        val crossSize = 25f
        drawLine(
            crossColor,
            Offset(centerX - crossSize, centerY - crossSize),
            Offset(centerX + crossSize, centerY + crossSize),
            strokeWidth = 6f
        )
        drawLine(
            crossColor,
            Offset(centerX + crossSize, centerY - crossSize),
            Offset(centerX - crossSize, centerY + crossSize),
            strokeWidth = 6f
        )
    }
}

/**
 * Lupa de busca.
 */
@Composable
private fun SearchIllustration(
    modifier: Modifier = Modifier,
    glassColor: Color,
    handleColor: Color
) {
    Canvas(modifier = modifier) {
        val centerX = size.width / 2 - 15
        val centerY = size.height / 2 - 15
        val glassRadius = 40f

        // Círculo da lupa
        drawCircle(
            color = glassColor,
            radius = glassRadius,
            center = Offset(centerX, centerY),
            style = Stroke(width = 8f)
        )

        // Cabo da lupa
        drawLine(
            color = handleColor,
            start = Offset(centerX + glassRadius * 0.7f, centerY + glassRadius * 0.7f),
            end = Offset(centerX + glassRadius * 1.5f, centerY + glassRadius * 1.5f),
            strokeWidth = 10f
        )

        // Ponto de interrogação dentro
        drawCircle(
            color = handleColor.copy(alpha = 0.3f),
            radius = 5f,
            center = Offset(centerX, centerY - 10)
        )
        drawCircle(
            color = handleColor.copy(alpha = 0.3f),
            radius = 3f,
            center = Offset(centerX, centerY + 10)
        )
    }
}

/**
 * Erro/Warning.
 */
@Composable
private fun ErrorIllustration(
    modifier: Modifier = Modifier,
    circleColor: Color,
    iconColor: Color
) {
    Canvas(modifier = modifier) {
        val centerX = size.width / 2
        val centerY = size.height / 2
        val radius = size.minDimension / 3

        // Círculo de fundo
        drawCircle(
            color = circleColor,
            radius = radius,
            center = Offset(centerX, centerY)
        )

        // Exclamação
        drawLine(
            color = iconColor,
            start = Offset(centerX, centerY - radius * 0.5f),
            end = Offset(centerX, centerY + radius * 0.1f),
            strokeWidth = 8f
        )
        drawCircle(
            color = iconColor,
            radius = 5f,
            center = Offset(centerX, centerY + radius * 0.35f)
        )
    }
}

/**
 * Foguete (coming soon).
 */
@Composable
private fun RocketIllustration(
    modifier: Modifier = Modifier,
    rocketColor: Color,
    flameColor: Color
) {
    val infiniteTransition = rememberInfiniteTransition(label = "rocket")
    val flameScale by infiniteTransition.animateFloat(
        initialValue = 0.8f,
        targetValue = 1.2f,
        animationSpec = infiniteRepeatable(
            animation = tween(200),
            repeatMode = RepeatMode.Reverse
        ),
        label = "flameScale"
    )

    Canvas(modifier = modifier) {
        val centerX = size.width / 2
        val centerY = size.height / 2

        // Corpo do foguete
        val rocketPath = Path().apply {
            moveTo(centerX, centerY - 60)
            lineTo(centerX + 25, centerY + 20)
            lineTo(centerX + 15, centerY + 20)
            lineTo(centerX + 15, centerY + 40)
            lineTo(centerX - 15, centerY + 40)
            lineTo(centerX - 15, centerY + 20)
            lineTo(centerX - 25, centerY + 20)
            close()
        }
        drawPath(rocketPath, rocketColor)

        // Janela
        drawCircle(
            color = Color.White.copy(alpha = 0.5f),
            radius = 10f,
            center = Offset(centerX, centerY - 20)
        )

        // Chamas
        val flameHeight = 30f * flameScale
        val flamePath = Path().apply {
            moveTo(centerX - 10, centerY + 40)
            lineTo(centerX, centerY + 40 + flameHeight)
            lineTo(centerX + 10, centerY + 40)
            close()
        }
        drawPath(flamePath, flameColor)
    }
}

// ==================== Presets Comuns ====================

/**
 * Empty state para lista de jogos vazia.
 */
@Composable
fun NoGamesEmptyState(
    onCreateGame: () -> Unit,
    modifier: Modifier = Modifier
) {
    IllustratedEmptyState(
        config = EmptyStateConfig(
            type = EmptyStateType.NO_GAMES,
            title = "Nenhum jogo encontrado",
            message = "Que tal organizar uma pelada com os parças?",
            primaryAction = EmptyStateAction("Criar Jogo", onCreateGame)
        ),
        modifier = modifier
    )
}

/**
 * Empty state para lista de grupos vazia.
 */
@Composable
fun NoGroupsEmptyState(
    onCreateGroup: () -> Unit,
    onJoinGroup: () -> Unit,
    modifier: Modifier = Modifier
) {
    IllustratedEmptyState(
        config = EmptyStateConfig(
            type = EmptyStateType.NO_GROUPS,
            title = "Você não está em nenhum grupo",
            message = "Entre em um grupo existente ou crie o seu próprio!",
            primaryAction = EmptyStateAction("Criar Grupo", onCreateGroup),
            secondaryAction = EmptyStateAction("Entrar em Grupo", onJoinGroup)
        ),
        modifier = modifier
    )
}

/**
 * Empty state para sem conexão.
 */
@Composable
fun NoConnectionEmptyState(
    onRetry: () -> Unit,
    modifier: Modifier = Modifier
) {
    IllustratedEmptyState(
        config = EmptyStateConfig(
            type = EmptyStateType.NO_CONNECTION,
            title = "Sem conexão",
            message = "Verifique sua internet e tente novamente",
            primaryAction = EmptyStateAction("Tentar Novamente", onRetry)
        ),
        modifier = modifier
    )
}

/**
 * Empty state para busca sem resultados.
 */
@Composable
fun NoResultsEmptyState(
    searchQuery: String,
    onClearSearch: () -> Unit,
    modifier: Modifier = Modifier
) {
    IllustratedEmptyState(
        config = EmptyStateConfig(
            type = EmptyStateType.NO_RESULTS,
            title = "Nenhum resultado",
            message = "Não encontramos nada para \"$searchQuery\"",
            primaryAction = EmptyStateAction("Limpar Busca", onClearSearch)
        ),
        modifier = modifier
    )
}

/**
 * Empty state para erro genérico.
 */
@Composable
fun ErrorEmptyState(
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    message: String = "Algo deu errado"
) {
    IllustratedEmptyState(
        config = EmptyStateConfig(
            type = EmptyStateType.ERROR,
            title = "Ops!",
            message = message,
            primaryAction = EmptyStateAction("Tentar Novamente", onRetry)
        ),
        modifier = modifier
    )
}
