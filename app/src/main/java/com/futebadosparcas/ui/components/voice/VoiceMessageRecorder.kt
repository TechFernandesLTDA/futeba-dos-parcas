package com.futebadosparcas.ui.components.voice

import android.Manifest
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource
import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.os.Build
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.io.File
import java.util.Locale
import java.util.UUID
import kotlin.math.sin

/**
 * Sistema de gravação e reprodução de mensagens de voz.
 * Permite enviar mensagens de áudio no chat de grupos/jogos.
 */

// ==================== Models ====================

/**
 * Estado da gravação.
 */
enum class RecordingState {
    IDLE,           // Parado, pronto para gravar
    RECORDING,      // Gravando
    RECORDED,       // Gravação concluída
    PLAYING,        // Reproduzindo gravação
    PAUSED          // Reprodução pausada
}

/**
 * Dados da mensagem de voz.
 */
data class VoiceMessage(
    val id: String = UUID.randomUUID().toString(),
    val filePath: String,
    val durationMs: Int,
    val waveformData: List<Float> = emptyList(),
    val timestamp: Long = System.currentTimeMillis()
)

/**
 * Configuração do gravador.
 */
data class VoiceRecorderConfig(
    val maxDurationMs: Int = 60_000, // 60 segundos
    val sampleRate: Int = 44100,
    val bitRate: Int = 128000,
    val outputFormat: Int = MediaRecorder.OutputFormat.MPEG_4,
    val audioEncoder: Int = MediaRecorder.AudioEncoder.AAC
)

// ==================== Voice Recorder Helper ====================

/**
 * Helper para gravação de áudio.
 */
class VoiceRecorderHelper(
    private val context: Context,
    private val config: VoiceRecorderConfig = VoiceRecorderConfig()
) {
    private var mediaRecorder: MediaRecorder? = null
    private var mediaPlayer: MediaPlayer? = null
    private var currentFilePath: String? = null

    var isRecording = false
        private set

    var isPlaying = false
        private set

    /**
     * Inicia gravação.
     */
    fun startRecording(): Result<String> {
        return try {
            val fileName = "voice_${System.currentTimeMillis()}.m4a"
            val file = File(context.cacheDir, fileName)
            currentFilePath = file.absolutePath

            mediaRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(context)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(config.outputFormat)
                setAudioEncoder(config.audioEncoder)
                setAudioSamplingRate(config.sampleRate)
                setAudioEncodingBitRate(config.bitRate)
                setOutputFile(file.absolutePath)
                setMaxDuration(config.maxDurationMs)
                prepare()
                start()
            }

            isRecording = true
            Result.success(file.absolutePath)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Para gravação.
     */
    fun stopRecording(): Result<VoiceMessage> {
        return try {
            mediaRecorder?.apply {
                stop()
                release()
            }
            mediaRecorder = null
            isRecording = false

            val filePath = currentFilePath
                ?: return Result.failure(Exception("No recording in progress"))

            val file = File(filePath)
            if (!file.exists()) {
                return Result.failure(Exception("Recording file not found"))
            }

            // Obtém duração
            val duration = getAudioDuration(filePath)

            // Gera waveform simulado (em produção, usar extração real)
            val waveform = generateWaveformData(20)

            Result.success(
                VoiceMessage(
                    filePath = filePath,
                    durationMs = duration,
                    waveformData = waveform
                )
            )
        } catch (e: Exception) {
            mediaRecorder?.release()
            mediaRecorder = null
            isRecording = false
            Result.failure(e)
        }
    }

    /**
     * Cancela gravação.
     */
    fun cancelRecording() {
        try {
            mediaRecorder?.apply {
                stop()
                release()
            }
            currentFilePath?.let { File(it).delete() }
        } catch (e: Exception) {
            // Ignora erros no cancelamento
        } finally {
            mediaRecorder = null
            currentFilePath = null
            isRecording = false
        }
    }

    /**
     * Reproduz áudio.
     */
    fun playAudio(
        filePath: String,
        onCompletion: () -> Unit = {},
        onProgress: (Float) -> Unit = {}
    ): Result<Unit> {
        return try {
            stopPlaying()

            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .build()
                )
                setDataSource(filePath)
                prepare()
                setOnCompletionListener {
                    this@VoiceRecorderHelper.isPlaying = false
                    onCompletion()
                }
                start()
            }

            this.isPlaying = true
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Pausa reprodução.
     */
    fun pausePlaying() {
        mediaPlayer?.pause()
        isPlaying = false
    }

    /**
     * Retoma reprodução.
     */
    fun resumePlaying() {
        mediaPlayer?.start()
        isPlaying = true
    }

    /**
     * Para reprodução.
     */
    fun stopPlaying() {
        mediaPlayer?.apply {
            if (isPlaying) {
                stop()
            }
            release()
        }
        mediaPlayer = null
        isPlaying = false
    }

    /**
     * Busca posição no áudio.
     */
    fun seekTo(positionMs: Int) {
        mediaPlayer?.seekTo(positionMs)
    }

    /**
     * Obtém posição atual.
     */
    fun getCurrentPosition(): Int {
        return mediaPlayer?.currentPosition ?: 0
    }

    /**
     * Obtém amplitude atual (para waveform ao vivo).
     */
    fun getMaxAmplitude(): Int {
        return try {
            mediaRecorder?.maxAmplitude ?: 0
        } catch (e: Exception) {
            0
        }
    }

    /**
     * Obtém duração do áudio.
     */
    private fun getAudioDuration(filePath: String): Int {
        return try {
            val player = MediaPlayer().apply {
                setDataSource(filePath)
                prepare()
            }
            val duration = player.duration
            player.release()
            duration
        } catch (e: Exception) {
            0
        }
    }

    /**
     * Gera dados de waveform simulado.
     */
    private fun generateWaveformData(size: Int): List<Float> {
        return List(size) { (0.3f + Math.random().toFloat() * 0.7f) }
    }

    /**
     * Libera recursos.
     */
    fun release() {
        cancelRecording()
        stopPlaying()
    }
}

// ==================== Composables ====================

/**
 * Botão de gravação de voz (estilo WhatsApp).
 */
@Composable
fun VoiceRecordButton(
    onVoiceMessage: (VoiceMessage) -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val recorder = remember { VoiceRecorderHelper(context) }

    var recordingState by remember { mutableStateOf(RecordingState.IDLE) }
    var recordingDurationMs by remember { mutableIntStateOf(0) }
    var timerJob: Job? by remember { mutableStateOf(null) }

    DisposableEffect(Unit) {
        onDispose { recorder.release() }
    }

    val scale = remember { Animatable(1f) }

    // Animação de pulso durante gravação
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val pulseScale by infiniteTransition.animateFloat(
        initialValue = 1f,
        targetValue = 1.2f,
        animationSpec = infiniteRepeatable(
            animation = tween(500),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulseScale"
    )

    Box(
        modifier = modifier
            .scale(if (recordingState == RecordingState.RECORDING) pulseScale else scale.value)
            .size(56.dp)
            .clip(CircleShape)
            .background(
                when (recordingState) {
                    RecordingState.RECORDING -> Color.Red
                    else -> MaterialTheme.colorScheme.primary
                }
            )
            .pointerInput(enabled) {
                if (!enabled) return@pointerInput

                detectTapGestures(
                    onLongPress = {
                        // Inicia gravação
                        recorder
                            .startRecording()
                            .onSuccess {
                                recordingState = RecordingState.RECORDING
                                recordingDurationMs = 0

                                // Inicia timer
                                timerJob = scope.launch {
                                    while (isActive && recordingState == RecordingState.RECORDING) {
                                        delay(100)
                                        recordingDurationMs += 100

                                        // Limite de 60 segundos
                                        if (recordingDurationMs >= 60000) {
                                            stopRecordingAndSend(
                                                recorder,
                                                onVoiceMessage,
                                                { recordingState = it },
                                                { timerJob = null }
                                            )
                                        }
                                    }
                                }
                            }
                    },
                    onPress = {
                        // Espera soltar
                        tryAwaitRelease()

                        // Se estava gravando, para e envia
                        if (recordingState == RecordingState.RECORDING) {
                            stopRecordingAndSend(
                                recorder,
                                onVoiceMessage,
                                { recordingState = it },
                                { timerJob?.cancel(); timerJob = null }
                            )
                        }
                    }
                )
            },
        contentAlignment = Alignment.Center
    ) {
        when (recordingState) {
            RecordingState.RECORDING -> {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        imageVector = Icons.Default.Mic,
                        contentDescription = stringResource(R.string.cd_recording),
                        tint = Color.White,
                        modifier = Modifier.size(24.dp)
                    )
                    Text(
                        text = formatDuration(recordingDurationMs),
                        style = MaterialTheme.typography.labelSmall,
                        color = Color.White
                    )
                }
            }
            else -> {
                Icon(
                    imageVector = Icons.Default.Mic,
                    contentDescription = stringResource(R.string.cd_record_voice),
                    tint = Color.White,
                    modifier = Modifier.size(24.dp)
                )
            }
        }
    }
}

private fun stopRecordingAndSend(
    recorder: VoiceRecorderHelper,
    onVoiceMessage: (VoiceMessage) -> Unit,
    setRecordingState: (RecordingState) -> Unit,
    cancelTimer: () -> Unit
) {
    cancelTimer()
    recorder.stopRecording().onSuccess { voiceMessage ->
        onVoiceMessage(voiceMessage)
    }
    setRecordingState(RecordingState.IDLE)
}

/**
 * Player de mensagem de voz (estilo WhatsApp).
 */
@Composable
fun VoiceMessagePlayer(
    voiceMessage: VoiceMessage,
    modifier: Modifier = Modifier,
    isSent: Boolean = true, // true = mensagem enviada, false = recebida
    senderName: String? = null
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val player = remember { VoiceRecorderHelper(context) }

    var playbackState by remember { mutableStateOf(RecordingState.IDLE) }
    var progress by remember { mutableFloatStateOf(0f) }
    var progressJob: Job? by remember { mutableStateOf(null) }

    DisposableEffect(Unit) {
        onDispose {
            progressJob?.cancel()
            player.release()
        }
    }

    val backgroundColor = if (isSent) {
        MaterialTheme.colorScheme.primaryContainer
    } else {
        MaterialTheme.colorScheme.surfaceContainerHigh
    }

    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = backgroundColor),
        shape = RoundedCornerShape(16.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Botão play/pause
            IconButton(
                onClick = {
                    when (playbackState) {
                        RecordingState.IDLE, RecordingState.PAUSED -> {
                            player.playAudio(
                                voiceMessage.filePath,
                                onCompletion = {
                                    playbackState = RecordingState.IDLE
                                    progress = 0f
                                    progressJob?.cancel()
                                }
                            ).onSuccess {
                                playbackState = RecordingState.PLAYING

                                // Atualiza progresso
                                progressJob = scope.launch {
                                    while (isActive && playbackState == RecordingState.PLAYING) {
                                        val currentPos = player.getCurrentPosition()
                                        progress = currentPos.toFloat() / voiceMessage.durationMs
                                        delay(100)
                                    }
                                }
                            }
                        }
                        RecordingState.PLAYING -> {
                            player.pausePlaying()
                            playbackState = RecordingState.PAUSED
                            progressJob?.cancel()
                        }
                        else -> {}
                    }
                },
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primary)
            ) {
                Icon(
                    imageVector = if (playbackState == RecordingState.PLAYING) {
                        Icons.Default.Pause
                    } else {
                        Icons.Default.PlayArrow
                    },
                    contentDescription = if (playbackState == RecordingState.PLAYING) stringResource(R.string.cd_pause) else stringResource(R.string.cd_play),
                    tint = Color.White
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                // Nome do remetente (se recebida)
                if (!isSent && senderName != null) {
                    Text(
                        text = senderName,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                }

                // Waveform
                VoiceWaveform(
                    waveformData = voiceMessage.waveformData,
                    progress = progress,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(32.dp)
                )

                Spacer(modifier = Modifier.height(4.dp))

                // Duração
                Text(
                    text = formatDuration(voiceMessage.durationMs),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

/**
 * Visualização de waveform.
 */
@Composable
fun VoiceWaveform(
    waveformData: List<Float>,
    modifier: Modifier = Modifier,
    progress: Float = 0f,
    activeColor: Color = MaterialTheme.colorScheme.primary,
    inactiveColor: Color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.3f)
) {
    Canvas(modifier = modifier) {
        val barWidth = size.width / (waveformData.size * 2f)
        val spacing = barWidth
        val maxHeight = size.height * 0.8f

        waveformData.forEachIndexed { index, amplitude ->
            val x = index * (barWidth + spacing) + barWidth / 2
            val barHeight = amplitude * maxHeight
            val yCenter = size.height / 2

            val isActive = index.toFloat() / waveformData.size <= progress

            drawLine(
                color = if (isActive) activeColor else inactiveColor,
                start = Offset(x, yCenter - barHeight / 2),
                end = Offset(x, yCenter + barHeight / 2),
                strokeWidth = barWidth,
                cap = StrokeCap.Round
            )
        }
    }
}

/**
 * Waveform animado durante gravação.
 */
@Composable
fun RecordingWaveform(
    isRecording: Boolean,
    modifier: Modifier = Modifier,
    color: Color = Color.Red
) {
    val infiniteTransition = rememberInfiniteTransition(label = "waveform")

    val phase by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "phase"
    )

    AnimatedVisibility(
        visible = isRecording,
        enter = fadeIn() + scaleIn(),
        exit = fadeOut() + scaleOut()
    ) {
        Canvas(modifier = modifier) {
            val barCount = 20
            val barWidth = size.width / (barCount * 2f)
            val spacing = barWidth
            val maxHeight = size.height * 0.8f

            repeat(barCount) { index ->
                val x = index * (barWidth + spacing) + barWidth / 2

                // Animação sinusoidal
                val normalizedPhase = (phase + index * 18) % 360
                val amplitude = (sin(Math.toRadians(normalizedPhase.toDouble())).toFloat() + 1) / 2
                val barHeight = amplitude * maxHeight * 0.5f + maxHeight * 0.2f

                val yCenter = size.height / 2

                drawLine(
                    color = color,
                    start = Offset(x, yCenter - barHeight / 2),
                    end = Offset(x, yCenter + barHeight / 2),
                    strokeWidth = barWidth,
                    cap = StrokeCap.Round
                )
            }
        }
    }
}

/**
 * Card completo de gravação (com controles).
 */
@Composable
fun VoiceRecorderCard(
    onSend: (VoiceMessage) -> Unit,
    onCancel: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val recorder = remember { VoiceRecorderHelper(context) }

    var state by remember { mutableStateOf(RecordingState.IDLE) }
    var durationMs by remember { mutableIntStateOf(0) }
    var recordedMessage by remember { mutableStateOf<VoiceMessage?>(null) }
    var timerJob: Job? by remember { mutableStateOf(null) }

    DisposableEffect(Unit) {
        onDispose { recorder.release() }
    }

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
        ),
        shape = RoundedCornerShape(20.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            when (state) {
                RecordingState.IDLE -> {
                    Text(
                        text = "Toque para gravar",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    // Botão de gravar
                    Box(
                        modifier = Modifier
                            .size(64.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.primary)
                            .clickable {
                                recorder
                                    .startRecording()
                                    .onSuccess {
                                        state = RecordingState.RECORDING
                                        durationMs = 0

                                        timerJob = scope.launch {
                                            while (isActive) {
                                                delay(100)
                                                durationMs += 100
                                            }
                                        }
                                    }
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Mic,
                            contentDescription = stringResource(R.string.cd_record),
                            tint = Color.White,
                            modifier = Modifier.size(32.dp)
                        )
                    }
                }

                RecordingState.RECORDING -> {
                    // Timer
                    Text(
                        text = formatDuration(durationMs),
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                        color = Color.Red
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    // Waveform animado
                    RecordingWaveform(
                        isRecording = true,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    // Controles
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(24.dp)
                    ) {
                        // Cancelar
                        IconButton(
                            onClick = {
                                timerJob?.cancel()
                                recorder.cancelRecording()
                                state = RecordingState.IDLE
                                durationMs = 0
                                onCancel()
                            },
                            modifier = Modifier
                                .size(48.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.errorContainer)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Delete,
                                contentDescription = stringResource(R.string.cd_cancel),
                                tint = MaterialTheme.colorScheme.onErrorContainer
                            )
                        }

                        // Parar e revisar
                        IconButton(
                            onClick = {
                                timerJob?.cancel()
                                recorder.stopRecording().onSuccess { message ->
                                    recordedMessage = message
                                    state = RecordingState.RECORDED
                                }
                            },
                            modifier = Modifier
                                .size(64.dp)
                                .clip(CircleShape)
                                .background(Color.Red)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(24.dp)
                                    .background(Color.White, RoundedCornerShape(4.dp))
                            )
                        }
                    }
                }

                RecordingState.RECORDED -> {
                    recordedMessage?.let { message ->
                        // Player de preview
                        VoiceMessagePlayer(
                            voiceMessage = message,
                            isSent = true,
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        // Controles
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            // Descartar
                            IconButton(
                                onClick = {
                                    File(message.filePath).delete()
                                    recordedMessage = null
                                    state = RecordingState.IDLE
                                    durationMs = 0
                                },
                                modifier = Modifier
                                    .size(48.dp)
                                    .clip(CircleShape)
                                    .background(MaterialTheme.colorScheme.errorContainer)
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Delete,
                                    contentDescription = stringResource(R.string.cd_discard),
                                    tint = MaterialTheme.colorScheme.onErrorContainer
                                )
                            }

                            // Enviar
                            IconButton(
                                onClick = {
                                    onSend(message)
                                    recordedMessage = null
                                    state = RecordingState.IDLE
                                    durationMs = 0
                                },
                                modifier = Modifier
                                    .size(48.dp)
                                    .clip(CircleShape)
                                    .background(MaterialTheme.colorScheme.primary)
                            ) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.Send,
                                    contentDescription = stringResource(R.string.cd_send),
                                    tint = Color.White
                                )
                            }
                        }
                    }
                }

                else -> {}
            }
        }
    }
}

// ==================== Utilities ====================

/**
 * Formata duração em minutos:segundos.
 */
private fun formatDuration(durationMs: Int): String {
    val seconds = (durationMs / 1000) % 60
    val minutes = (durationMs / 1000) / 60
    return String.format(Locale.getDefault(), "%d:%02d", minutes, seconds)
}

/**
 * Permissões necessárias para gravação de voz.
 */
object VoiceRecorderPermissions {
    val REQUIRED = arrayOf(
        Manifest.permission.RECORD_AUDIO
    )
}
