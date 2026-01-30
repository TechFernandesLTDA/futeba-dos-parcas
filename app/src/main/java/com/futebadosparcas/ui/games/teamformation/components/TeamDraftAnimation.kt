package com.futebadosparcas.ui.games.teamformation.components

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.futebadosparcas.R
import com.futebadosparcas.data.model.DraftRevealAnimation
import com.futebadosparcas.data.model.TeamColor
import com.futebadosparcas.ui.components.CachedProfileImage
import com.futebadosparcas.util.ContrastHelper
import kotlinx.coroutines.delay

/**
 * Animacao de revelacao do draft com efeitos de suspense.
 * Mostra cada jogador sendo atribuido ao time com animacao de flip de carta.
 */
@Composable
fun TeamDraftRevealCard(
    reveal: DraftRevealAnimation,
    onRevealComplete: () -> Unit = {}
) {
    // Estados de animacao
    var isFlipped by remember { mutableStateOf(false) }
    var showCelebration by remember { mutableStateOf(false) }

    // Rotacao do flip
    val flipRotation by animateFloatAsState(
        targetValue = if (isFlipped) 180f else 0f,
        animationSpec = tween(
            durationMillis = 600,
            easing = FastOutSlowInEasing
        ),
        label = "flip"
    )

    // Escala com bounce
    val scale by animateFloatAsState(
        targetValue = if (isFlipped) 1f else 0.8f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessLow
        ),
        label = "scale"
    )

    // Iniciar animacao
    LaunchedEffect(reveal.playerId) {
        delay(200)
        isFlipped = true
        delay(800)
        showCelebration = true
        delay(500)
        onRevealComplete()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.8f)),
        contentAlignment = Alignment.Center
    ) {
        // Card com flip
        Box(
            modifier = Modifier
                .scale(scale)
                .graphicsLayer {
                    rotationY = flipRotation
                    cameraDistance = 12f * density
                }
        ) {
            if (flipRotation <= 90f) {
                // Frente da carta (verso antes do flip)
                CardBack()
            } else {
                // Verso da carta (frente apos o flip)
                CardFront(
                    reveal = reveal,
                    modifier = Modifier.graphicsLayer { rotationY = 180f }
                )
            }
        }

        // Efeito de celebracao
        AnimatedVisibility(
            visible = showCelebration,
            enter = fadeIn() + scaleIn(),
            exit = fadeOut()
        ) {
            CelebrationEffect()
        }
    }
}

/**
 * Verso da carta (antes do flip).
 */
@Composable
private fun CardBack() {
    Card(
        modifier = Modifier.size(200.dp, 280.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primary
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 12.dp)
    ) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            // Padrao de fundo
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Icon(
                    imageVector = Icons.Default.EmojiEvents,
                    contentDescription = null,
                    modifier = Modifier.size(64.dp),
                    tint = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.5f)
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    text = "?",
                    style = MaterialTheme.typography.displayLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimary
                )
            }
        }
    }
}

/**
 * Frente da carta (jogador revelado).
 */
@Composable
private fun CardFront(
    reveal: DraftRevealAnimation,
    modifier: Modifier = Modifier
) {
    val teamColor = Color(reveal.teamColor.hexValue)
    val textColor = ContrastHelper.getContrastingTextColor(teamColor)

    Card(
        modifier = modifier.size(200.dp, 280.dp),
        colors = CardDefaults.cardColors(containerColor = teamColor),
        elevation = CardDefaults.cardElevation(defaultElevation = 12.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Foto do jogador
            Box(
                modifier = Modifier
                    .size(100.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.2f))
            ) {
                CachedProfileImage(
                    photoUrl = reveal.playerPhoto,
                    userName = reveal.playerName,
                    size = 100.dp
                )
            }

            Spacer(Modifier.height(16.dp))

            // Nome do jogador
            Text(
                text = reveal.playerName,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = textColor,
                textAlign = TextAlign.Center,
                maxLines = 2
            )

            Spacer(Modifier.height(8.dp))

            // Nome do time
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = Color.White.copy(alpha = 0.2f)
            ) {
                Text(
                    text = reveal.teamName,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    style = MaterialTheme.typography.labelLarge,
                    color = textColor
                )
            }
        }
    }
}

/**
 * Efeito de celebracao com estrelas.
 */
@Composable
private fun CelebrationEffect() {
    val infiniteTransition = rememberInfiniteTransition(label = "celebration")

    // Rotacao das estrelas
    val rotation by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(3000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "starRotation"
    )

    // Escala pulsante
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 0.8f,
        targetValue = 1.2f,
        animationSpec = infiniteRepeatable(
            animation = tween(500),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulse"
    )

    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        // Estrelas orbitando
        repeat(6) { index ->
            val angle = (360f / 6 * index) + rotation
            val radius = 150.dp

            Icon(
                imageVector = Icons.Default.Star,
                contentDescription = null,
                modifier = Modifier
                    .size(24.dp)
                    .scale(pulseScale)
                    .graphicsLayer {
                        translationX = radius.toPx() * kotlin.math.cos(Math.toRadians(angle.toDouble())).toFloat()
                        translationY = radius.toPx() * kotlin.math.sin(Math.toRadians(angle.toDouble())).toFloat()
                    },
                tint = MaterialTheme.colorScheme.tertiary
            )
        }
    }
}

/**
 * Overlay completo de revelacao do draft.
 * Exibe cada jogador sendo atribuido com animacao.
 */
@Composable
fun DraftRevealOverlay(
    reveals: List<DraftRevealAnimation>,
    currentIndex: Int,
    onComplete: () -> Unit
) {
    var currentRevealIndex by remember { mutableIntStateOf(currentIndex) }

    if (currentRevealIndex < reveals.size) {
        val currentReveal = reveals[currentRevealIndex]

        TeamDraftRevealCard(
            reveal = currentReveal,
            onRevealComplete = {
                if (currentRevealIndex < reveals.size - 1) {
                    currentRevealIndex++
                } else {
                    onComplete()
                }
            }
        )
    }
}

/**
 * Componente de contagem regressiva antes do draft.
 */
@Composable
fun DraftCountdown(
    seconds: Int,
    onComplete: () -> Unit
) {
    var countdown by remember { mutableIntStateOf(seconds) }

    // Animacao de escala
    val scale by animateFloatAsState(
        targetValue = 1f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessLow
        ),
        label = "countdownScale"
    )

    LaunchedEffect(Unit) {
        while (countdown > 0) {
            delay(1000)
            countdown--
        }
        onComplete()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.9f)),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = stringResource(R.string.start_draft),
                style = MaterialTheme.typography.headlineMedium,
                color = Color.White
            )

            Spacer(Modifier.height(32.dp))

            // Numero da contagem
            Text(
                text = if (countdown > 0) countdown.toString() else "GO!",
                modifier = Modifier.scale(scale),
                style = MaterialTheme.typography.displayLarge.copy(fontSize = 96.sp),
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
        }
    }
}

/**
 * Indicador de progresso do draft.
 */
@Composable
fun DraftProgressIndicator(
    current: Int,
    total: Int,
    teamACount: Int,
    teamBCount: Int,
    teamAColor: TeamColor,
    teamBColor: TeamColor,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Barra de progresso
        LinearProgressIndicator(
            progress = { current.toFloat() / total },
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .clip(RoundedCornerShape(4.dp)),
            color = MaterialTheme.colorScheme.primary,
            trackColor = MaterialTheme.colorScheme.surfaceVariant
        )

        Spacer(Modifier.height(8.dp))

        // Contagem por time
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            TeamCountChip(
                count = teamACount,
                color = Color(teamAColor.hexValue),
                label = stringResource(R.string.team_a)
            )

            Text(
                text = "$current / $total",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            TeamCountChip(
                count = teamBCount,
                color = Color(teamBColor.hexValue),
                label = stringResource(R.string.team_b)
            )
        }
    }
}

@Composable
private fun TeamCountChip(
    count: Int,
    color: Color,
    label: String
) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = color.copy(alpha = 0.2f)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(12.dp)
                    .background(color, CircleShape)
            )
            Spacer(Modifier.width(8.dp))
            Text(
                text = "$label: $count",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Medium
            )
        }
    }
}
