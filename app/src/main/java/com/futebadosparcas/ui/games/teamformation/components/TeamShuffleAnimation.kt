package com.futebadosparcas.ui.games.teamformation.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Casino
import androidx.compose.material.icons.filled.Shuffle
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.futebadosparcas.domain.model.DraftPlayer
import com.futebadosparcas.domain.model.TeamColor
import com.futebadosparcas.ui.components.CachedProfileImage
import com.futebadosparcas.util.ContrastHelper
import kotlinx.coroutines.delay
import kotlin.random.Random
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource

/**
 * Estado da animacao de shuffle.
 */
sealed class ShuffleAnimationState {
    object Idle : ShuffleAnimationState()
    object Shuffling : ShuffleAnimationState()
    object Revealing : ShuffleAnimationState()
    object Complete : ShuffleAnimationState()
}

/**
 * Overlay de animacao de shuffle de times.
 * Mostra cartas embaralhando como um baralho.
 */
@Composable
fun TeamShuffleOverlay(
    players: List<DraftPlayer>,
    teamAColor: TeamColor,
    teamBColor: TeamColor,
    onComplete: () -> Unit
) {
    var animationState: ShuffleAnimationState by remember { mutableStateOf(ShuffleAnimationState.Idle) }
    val haptic = LocalHapticFeedback.current

    // Iniciar animacao
    LaunchedEffect(Unit) {
        animationState = ShuffleAnimationState.Shuffling
        haptic.performHapticFeedback(HapticFeedbackType.LongPress)

        // Duracao do shuffle
        delay(2500)

        animationState = ShuffleAnimationState.Revealing
        delay(1500)

        animationState = ShuffleAnimationState.Complete
        delay(500)

        onComplete()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.9f)),
        contentAlignment = Alignment.Center
    ) {
        when (animationState) {
            ShuffleAnimationState.Shuffling -> {
                ShufflingCards(
                    playerCount = players.size,
                    teamAColor = teamAColor,
                    teamBColor = teamBColor
                )
            }
            ShuffleAnimationState.Revealing -> {
                RevealingTeams(
                    teamAColor = teamAColor,
                    teamBColor = teamBColor
                )
            }
            ShuffleAnimationState.Complete -> {
                ShuffleCompleteMessage()
            }
            ShuffleAnimationState.Idle -> {
                // Nada a mostrar
            }
        }
    }
}

/**
 * Animacao de cartas embaralhando.
 */
@Composable
private fun ShufflingCards(
    playerCount: Int,
    teamAColor: TeamColor,
    teamBColor: TeamColor
) {
    val infiniteTransition = rememberInfiniteTransition(label = "shuffle")

    Column(
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Titulo
        Text(
            text = stringResource(R.string.team_shuffle_shuffling),
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )

        Spacer(Modifier.height(32.dp))

        // Cartas embaralhando
        Box(
            modifier = Modifier.size(200.dp),
            contentAlignment = Alignment.Center
        ) {
            repeat(minOf(playerCount, 10)) { index ->
                val delay = index * 50

                val rotation by infiniteTransition.animateFloat(
                    initialValue = -15f,
                    targetValue = 15f,
                    animationSpec = infiniteRepeatable(
                        animation = tween(
                            durationMillis = 200 + Random.nextInt(100),
                            delayMillis = delay,
                            easing = FastOutSlowInEasing
                        ),
                        repeatMode = RepeatMode.Reverse
                    ),
                    label = "cardRotation$index"
                )

                val offsetX by infiniteTransition.animateFloat(
                    initialValue = -30f,
                    targetValue = 30f,
                    animationSpec = infiniteRepeatable(
                        animation = tween(
                            durationMillis = 150 + Random.nextInt(100),
                            delayMillis = delay,
                            easing = LinearEasing
                        ),
                        repeatMode = RepeatMode.Reverse
                    ),
                    label = "cardOffsetX$index"
                )

                val offsetY by infiniteTransition.animateFloat(
                    initialValue = -20f,
                    targetValue = 20f,
                    animationSpec = infiniteRepeatable(
                        animation = tween(
                            durationMillis = 180 + Random.nextInt(100),
                            delayMillis = delay,
                            easing = LinearEasing
                        ),
                        repeatMode = RepeatMode.Reverse
                    ),
                    label = "cardOffsetY$index"
                )

                val color = if (index % 2 == 0) teamAColor else teamBColor

                ShuffleCard(
                    color = Color(color.hexValue),
                    modifier = Modifier
                        .graphicsLayer {
                            translationX = offsetX
                            translationY = offsetY
                            rotationZ = rotation
                        }
                )
            }
        }

        Spacer(Modifier.height(24.dp))

        // Indicador de progresso
        LinearProgressIndicator(
            modifier = Modifier
                .width(200.dp)
                .height(4.dp),
            color = MaterialTheme.colorScheme.primary,
            trackColor = Color.White.copy(alpha = 0.2f)
        )
    }
}

/**
 * Uma carta individual do shuffle.
 */
@Composable
private fun ShuffleCard(
    color: Color,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.size(60.dp, 80.dp),
        colors = CardDefaults.cardColors(containerColor = color),
        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
    ) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.Casino,
                contentDescription = null,
                modifier = Modifier.size(24.dp),
                tint = ContrastHelper.getContrastingTextColor(color).copy(alpha = 0.5f)
            )
        }
    }
}

/**
 * Animacao de revelacao dos times.
 */
@Composable
private fun RevealingTeams(
    teamAColor: TeamColor,
    teamBColor: TeamColor
) {
    val scale by animateFloatAsState(
        targetValue = 1f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessLow
        ),
        label = "revealScale"
    )

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(32.dp),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        // Time A
        RevealTeamCard(
            teamName = "Time A",
            color = teamAColor,
            modifier = Modifier.scale(scale)
        )

        // VS
        Text(
            text = "VS",
            style = MaterialTheme.typography.displaySmall,
            fontWeight = FontWeight.Bold,
            color = Color.White,
            modifier = Modifier.align(Alignment.CenterVertically)
        )

        // Time B
        RevealTeamCard(
            teamName = "Time B",
            color = teamBColor,
            modifier = Modifier.scale(scale)
        )
    }
}

@Composable
private fun RevealTeamCard(
    teamName: String,
    color: TeamColor,
    modifier: Modifier = Modifier
) {
    val colorValue = Color(color.hexValue)
    val textColor = ContrastHelper.getContrastingTextColor(colorValue)

    Card(
        modifier = modifier.size(120.dp, 160.dp),
        colors = CardDefaults.cardColors(containerColor = colorValue),
        elevation = CardDefaults.cardElevation(defaultElevation = 12.dp)
    ) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .background(textColor.copy(alpha = 0.2f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Shuffle,
                        contentDescription = null,
                        modifier = Modifier.size(32.dp),
                        tint = textColor
                    )
                }

                Spacer(Modifier.height(12.dp))

                Text(
                    text = teamName,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = textColor
                )

                Text(
                    text = color.displayName,
                    style = MaterialTheme.typography.labelSmall,
                    color = textColor.copy(alpha = 0.8f)
                )
            }
        }
    }
}

/**
 * Mensagem de shuffle completo.
 */
@Composable
private fun ShuffleCompleteMessage() {
    val scale by animateFloatAsState(
        targetValue = 1f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioLowBouncy,
            stiffness = Spring.StiffnessLow
        ),
        label = "completeScale"
    )

    Column(
        modifier = Modifier.scale(scale),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.Default.Casino,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.primary
        )

        Spacer(Modifier.height(16.dp))

        Text(
            text = stringResource(R.string.team_shuffle_done),
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )
    }
}

/**
 * Botao de shuffle com animacao.
 */
@Composable
fun ShuffleButton(
    onClick: () -> Unit,
    isShuffling: Boolean,
    modifier: Modifier = Modifier
) {
    val haptic = LocalHapticFeedback.current

    val infiniteTransition = rememberInfiniteTransition(label = "shuffleBtn")
    val rotation by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = if (isShuffling) 360f else 0f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "btnRotation"
    )

    Button(
        onClick = {
            haptic.performHapticFeedback(HapticFeedbackType.LongPress)
            onClick()
        },
        modifier = modifier,
        enabled = !isShuffling,
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.secondary
        )
    ) {
        Icon(
            imageVector = Icons.Default.Shuffle,
            contentDescription = null,
            modifier = Modifier
                .size(20.dp)
                .rotate(if (isShuffling) rotation else 0f)
        )
        Spacer(Modifier.width(8.dp))
        Text(
            text = if (isShuffling) "Embaralhando..." else "Embaralhar"
        )
    }
}

/**
 * Animacao de entrada de jogadores nos times.
 * Mostra jogadores entrando um a um.
 */
@Composable
fun PlayerEntryAnimation(
    players: List<DraftPlayer>,
    teamColor: TeamColor,
    delayPerPlayer: Long = 300L,
    onComplete: () -> Unit
) {
    var visibleCount by remember { mutableIntStateOf(0) }

    LaunchedEffect(players) {
        for (i in players.indices) {
            delay(delayPerPlayer)
            visibleCount = i + 1
        }
        delay(500)
        onComplete()
    }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        players.take(visibleCount).forEachIndexed { index, player ->
            val slideIn by animateFloatAsState(
                targetValue = 0f,
                animationSpec = spring(
                    dampingRatio = Spring.DampingRatioMediumBouncy,
                    stiffness = Spring.StiffnessLow
                ),
                label = "playerSlide$index"
            )

            val alpha by animateFloatAsState(
                targetValue = 1f,
                animationSpec = tween(300),
                label = "playerAlpha$index"
            )

            PlayerEntryCard(
                player = player,
                teamColor = teamColor,
                modifier = Modifier
                    .graphicsLayer { translationX = slideIn }
                    .alpha(alpha)
            )
        }
    }
}

@Composable
private fun PlayerEntryCard(
    player: DraftPlayer,
    teamColor: TeamColor,
    modifier: Modifier = Modifier
) {
    val colorValue = Color(teamColor.hexValue)

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = colorValue.copy(alpha = 0.1f)
        ),
        border = androidx.compose.foundation.BorderStroke(1.dp, colorValue.copy(alpha = 0.3f))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            CachedProfileImage(
                photoUrl = player.photoUrl,
                userName = player.name,
                size = 40.dp
            )

            Spacer(Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = player.name,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )
                Text(
                    text = if (player.position == com.futebadosparcas.data.model.PlayerPosition.GOALKEEPER) {
                        "Goleiro"
                    } else {
                        "Linha"
                    },
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Text(
                text = "%.1f".format(player.overallRating),
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
        }
    }
}
