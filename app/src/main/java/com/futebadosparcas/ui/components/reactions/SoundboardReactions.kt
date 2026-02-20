package com.futebadosparcas.ui.components.reactions
import org.jetbrains.compose.resources.stringResource
import com.futebadosparcas.compose.resources.Res

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Componente de Soundboard para reações sonoras em tempo real.
 * Permite enviar reações como torcida, vaia, palmas, etc. durante jogos ao vivo.
 */

// ==================== Models ====================

/**
 * Tipos de reações disponíveis no soundboard.
 */
enum class ReactionType(
    val emoji: String,
    val label: String,
    val color: Color,
    val vibrationPattern: LongArray
) {
    // Reações positivas
    CHEER("🎉", "Torcida", Color(0xFF4CAF50), longArrayOf(0, 100, 50, 100)),
    CLAP("👏", "Palmas", Color(0xFF2196F3), longArrayOf(0, 50, 30, 50, 30, 50)),
    GOAL("⚽", "Gol!", Color(0xFFFF9800), longArrayOf(0, 200, 100, 200)),
    FIRE("🔥", "Jogada!", Color(0xFFFF5722), longArrayOf(0, 150)),
    STAR("⭐", "Craque!", Color(0xFFFFD700), longArrayOf(0, 100, 50, 150)),

    // Reações neutras/divertidas
    LAUGH("😂", "Kkkkk", Color(0xFFFFC107), longArrayOf(0, 50, 50, 50, 50, 50)),
    SHOCK("😱", "Eita!", Color(0xFF9C27B0), longArrayOf(0, 300)),
    THINKING("🤔", "Hmm", Color(0xFF607D8B), longArrayOf(0, 100)),

    // Reações negativas
    BOO("👎", "Vaia", Color(0xFFE91E63), longArrayOf(0, 200)),
    FACEPALM("🤦", "Puts", Color(0xFF795548), longArrayOf(0, 150)),

    // Reações especiais
    WHISTLE("📣", "Apito", Color(0xFF03A9F4), longArrayOf(0, 250)),
    HORN("📯", "Buzina", Color(0xFFCDDC39), longArrayOf(0, 500)),
}

/**
 * Evento de reação enviado.
 */
data class ReactionEvent(
    val type: ReactionType,
    val senderId: String,
    val senderName: String,
    val timestamp: Long = System.currentTimeMillis()
)

/**
 * Contagem de reações.
 */
data class ReactionCount(
    val type: ReactionType,
    val count: Int,
    val lastSenders: List<String> = emptyList()
)

// ==================== Soundboard Helper ====================

/**
 * Helper para gerenciar sons do soundboard.
 */
class SoundboardHelper constructor(
    private val context: Context
) {
    private val soundPool: SoundPool by lazy {
        val audioAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_GAME)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        SoundPool.Builder()
            .setMaxStreams(5)
            .setAudioAttributes(audioAttributes)
            .build()
    }

    private val vibrator: Vibrator by lazy {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vibratorManager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
    }

    private val loadedSounds = mutableMapOf<ReactionType, Int>()
    private var soundEnabled = true
    private var vibrationEnabled = true
    private var volume = 1.0f

    /**
     * Carrega som para uma reação.
     */
    private fun loadSound(type: ReactionType): Int? {
        if (loadedSounds.containsKey(type)) {
            return loadedSounds[type]
        }

        val resourceName = "reaction_${type.name.lowercase()}"
        val resourceId = context.resources.getIdentifier(
            resourceName,
            "raw",
            context.packageName
        )

        return if (resourceId != 0) {
            val soundId = soundPool.load(context, resourceId, 1)
            loadedSounds[type] = soundId
            soundId
        } else {
            null
        }
    }

    /**
     * Reproduz reação.
     */
    fun playReaction(type: ReactionType) {
        if (soundEnabled) {
            val soundId = loadSound(type)
            soundId?.let {
                soundPool.play(it, volume, volume, 1, 0, 1.0f)
            }
        }

        if (vibrationEnabled) {
            vibrate(type.vibrationPattern)
        }
    }

    /**
     * Vibra com o padrão especificado.
     */
    private fun vibrate(pattern: LongArray) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(
                    VibrationEffect.createWaveform(pattern, -1)
                )
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(pattern, -1)
            }
        } catch (e: Exception) {
            // Ignora erros de vibração
        }
    }

    fun setSoundEnabled(enabled: Boolean) {
        soundEnabled = enabled
    }

    fun setVibrationEnabled(enabled: Boolean) {
        vibrationEnabled = enabled
    }

    fun setVolume(newVolume: Float) {
        volume = newVolume.coerceIn(0f, 1f)
    }

    fun release() {
        soundPool.release()
        loadedSounds.clear()
    }
}

// ==================== Composables ====================

/**
 * Barra de reações rápidas (estilo Instagram/YouTube).
 */
@Composable
fun QuickReactionsBar(
    onReactionClick: (ReactionType) -> Unit,
    modifier: Modifier = Modifier,
    reactions: List<ReactionType> = listOf(
        ReactionType.CHEER,
        ReactionType.CLAP,
        ReactionType.FIRE,
        ReactionType.LAUGH,
        ReactionType.SHOCK
    )
) {
    val context = LocalContext.current
    val soundboard = remember { SoundboardHelper(context) }

    DisposableEffect(Unit) {
        onDispose { soundboard.release() }
    }

    LazyRow(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(reactions, key = { it.name }) { reaction ->
            QuickReactionButton(
                reaction = reaction,
                onClick = {
                    soundboard.playReaction(reaction)
                    onReactionClick(reaction)
                }
            )
        }
    }
}

/**
 * Botão de reação rápida.
 */
@Composable
private fun QuickReactionButton(
    reaction: ReactionType,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val scope = rememberCoroutineScope()
    val scale = remember { Animatable(1f) }
    var isPressed by remember { mutableStateOf(false) }

    val backgroundColor by animateColorAsState(
        targetValue = if (isPressed) reaction.color.copy(alpha = 0.3f) else Color.Transparent,
        label = "bgColor"
    )

    Box(
        modifier = modifier
            .scale(scale.value)
            .clip(CircleShape)
            .background(backgroundColor)
            .clickable {
                scope.launch {
                    isPressed = true
                    scale.animateTo(
                        1.3f,
                        animationSpec = spring(
                            dampingRatio = Spring.DampingRatioMediumBouncy,
                            stiffness = Spring.StiffnessHigh
                        )
                    )
                    onClick()
                    scale.animateTo(1f)
                    delay(100)
                    isPressed = false
                }
            }
            .padding(12.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = reaction.emoji,
            fontSize = 28.sp
        )
    }
}

/**
 * Soundboard completo com todas as reações.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SoundboardPanel(
    onReactionClick: (ReactionType) -> Unit,
    modifier: Modifier = Modifier,
    showLabels: Boolean = true
) {
    val context = LocalContext.current
    val soundboard = remember { SoundboardHelper(context) }

    DisposableEffect(Unit) {
        onDispose { soundboard.release() }
    }

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
        ),
        shape = RoundedCornerShape(20.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Text(
                text = stringResource(Res.string.reactions_title),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Categoria: Positivas
            Text(
                text = stringResource(Res.string.reactions_positive),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(8.dp))

            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                listOf(
                    ReactionType.CHEER,
                    ReactionType.CLAP,
                    ReactionType.GOAL,
                    ReactionType.FIRE,
                    ReactionType.STAR
                ).forEach { reaction ->
                    SoundboardButton(
                        reaction = reaction,
                        showLabel = showLabels,
                        onClick = {
                            soundboard.playReaction(reaction)
                            onReactionClick(reaction)
                        }
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Categoria: Divertidas
            Text(
                text = stringResource(Res.string.reactions_funny),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(8.dp))

            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                listOf(
                    ReactionType.LAUGH,
                    ReactionType.SHOCK,
                    ReactionType.THINKING,
                    ReactionType.FACEPALM,
                    ReactionType.BOO
                ).forEach { reaction ->
                    SoundboardButton(
                        reaction = reaction,
                        showLabel = showLabels,
                        onClick = {
                            soundboard.playReaction(reaction)
                            onReactionClick(reaction)
                        }
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Categoria: Especiais
            Text(
                text = stringResource(Res.string.reactions_special),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(8.dp))

            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                listOf(
                    ReactionType.WHISTLE,
                    ReactionType.HORN
                ).forEach { reaction ->
                    SoundboardButton(
                        reaction = reaction,
                        showLabel = showLabels,
                        onClick = {
                            soundboard.playReaction(reaction)
                            onReactionClick(reaction)
                        }
                    )
                }
            }
        }
    }
}

/**
 * Botão do soundboard.
 */
@Composable
private fun SoundboardButton(
    reaction: ReactionType,
    showLabel: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val scope = rememberCoroutineScope()
    val scale = remember { Animatable(1f) }

    Card(
        modifier = modifier
            .scale(scale.value)
            .clickable {
                scope.launch {
                    scale.animateTo(0.9f, animationSpec = spring(stiffness = Spring.StiffnessHigh))
                    onClick()
                    scale.animateTo(1.1f, animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy))
                    scale.animateTo(1f)
                }
            },
        colors = CardDefaults.cardColors(
            containerColor = reaction.color.copy(alpha = 0.15f)
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = reaction.emoji,
                fontSize = 32.sp
            )

            if (showLabel) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = reaction.label,
                    style = MaterialTheme.typography.labelSmall,
                    color = reaction.color,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}

/**
 * Exibição de reações recebidas (estilo floating reactions).
 */
@Composable
fun FloatingReactions(
    reactions: List<ReactionEvent>,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        reactions.takeLast(5).forEach { event ->
            FloatingReactionItem(event)
        }
    }
}

/**
 * Item de reação flutuante.
 */
@Composable
private fun FloatingReactionItem(event: ReactionEvent) {
    var visible by remember { mutableStateOf(false) }
    val scale = remember { Animatable(0f) }

    LaunchedEffect(event) {
        visible = true
        scale.animateTo(
            1f,
            animationSpec = spring(
                dampingRatio = Spring.DampingRatioMediumBouncy,
                stiffness = Spring.StiffnessLow
            )
        )
        delay(3000)
        scale.animateTo(0f)
        visible = false
    }

    if (visible) {
        Row(
            modifier = Modifier
                .scale(scale.value)
                .clip(RoundedCornerShape(16.dp))
                .background(event.type.color.copy(alpha = 0.2f))
                .padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = event.type.emoji,
                fontSize = 20.sp
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = event.senderName,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurface
            )
        }
    }
}

/**
 * Contador de reações (para mostrar quantas pessoas reagiram).
 */
@Composable
fun ReactionCounter(
    counts: List<ReactionCount>,
    modifier: Modifier = Modifier
) {
    val activeCounts = remember(counts) { counts.filter { it.count > 0 } }
    LazyRow(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(activeCounts, key = { it.type.name }) { count ->
            ReactionCountChip(count)
        }
    }
}

/**
 * Chip de contagem de reação.
 */
@Composable
private fun ReactionCountChip(count: ReactionCount) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(count.type.color.copy(alpha = 0.15f))
            .padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = count.type.emoji,
            fontSize = 16.sp
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = "${count.count}",
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            color = count.type.color
        )
    }
}

/**
 * Mini soundboard para exibir na tela de jogo ao vivo.
 */
@Composable
fun MiniSoundboard(
    onReactionClick: (ReactionType) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val soundboard = remember { SoundboardHelper(context) }

    DisposableEffect(Unit) {
        onDispose { soundboard.release() }
    }

    Row(
        modifier = modifier
            .clip(RoundedCornerShape(24.dp))
            .background(MaterialTheme.colorScheme.surfaceContainerHigh)
            .padding(8.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        listOf(
            ReactionType.CHEER,
            ReactionType.GOAL,
            ReactionType.LAUGH,
            ReactionType.SHOCK
        ).forEach { reaction ->
            MiniReactionButton(
                reaction = reaction,
                onClick = {
                    soundboard.playReaction(reaction)
                    onReactionClick(reaction)
                }
            )
        }
    }
}

/**
 * Botão mini de reação.
 */
@Composable
private fun MiniReactionButton(
    reaction: ReactionType,
    onClick: () -> Unit
) {
    val scope = rememberCoroutineScope()
    val scale = remember { Animatable(1f) }

    Box(
        modifier = Modifier
            .scale(scale.value)
            .size(40.dp)
            .clip(CircleShape)
            .background(reaction.color.copy(alpha = 0.15f))
            .clickable {
                scope.launch {
                    scale.animateTo(1.2f, animationSpec = spring(stiffness = Spring.StiffnessHigh))
                    onClick()
                    scale.animateTo(1f)
                }
            },
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = reaction.emoji,
            fontSize = 20.sp
        )
    }
}
