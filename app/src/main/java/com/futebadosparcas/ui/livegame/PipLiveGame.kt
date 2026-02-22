package com.futebadosparcas.ui.livegame

import android.app.Activity
import android.app.PictureInPictureParams
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Rect
import android.os.Build
import android.util.Rational
import androidx.annotation.RequiresApi
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource

/**
 * Dados do placar ao vivo para exibição em Picture-in-Picture
 */
data class PipScoreData(
    val team1Name: String,
    val team1Score: Int,
    val team2Name: String,
    val team2Score: Int,
    val gameTime: String,
    val isLive: Boolean = true
)

/**
 * Helper para gerenciar o modo Picture-in-Picture
 * Usado principalmente na tela de jogo ao vivo
 */
object PipHelper {

    /**
     * Verifica se o dispositivo suporta Picture-in-Picture
     */
    fun isPipSupported(context: Context): Boolean {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            context.packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)
    }

    /**
     * Verifica se a atividade está atualmente em modo PiP
     */
    fun isInPipMode(activity: Activity): Boolean {
        return activity.isInPictureInPictureMode
    }

    /**
     * Entra no modo Picture-in-Picture
     * @param activity Activity que entrará em PiP
     * @param sourceRectHint Retângulo de origem para animação suave (opcional)
     * @return true se entrou em PiP com sucesso
     */
    @RequiresApi(Build.VERSION_CODES.O)
    fun enterPipMode(
        activity: Activity,
        sourceRectHint: Rect? = null
    ): Boolean {
        if (!isPipSupported(activity)) return false

        val params = buildPipParams(sourceRectHint)
        return activity.enterPictureInPictureMode(params)
    }

    /**
     * Atualiza os parâmetros do PiP enquanto em modo PiP
     * Útil para atualizar o placar sem sair do modo
     */
    @RequiresApi(Build.VERSION_CODES.O)
    fun updatePipParams(
        activity: Activity,
        sourceRectHint: Rect? = null
    ) {
        if (!isPipSupported(activity)) return
        if (!isInPipMode(activity)) return

        val params = buildPipParams(sourceRectHint)
        activity.setPictureInPictureParams(params)
    }

    /**
     * Configura a activity para entrar automaticamente em PiP ao ir para background
     * Ideal para jogos ao vivo onde o usuário quer continuar vendo o placar
     */
    @RequiresApi(Build.VERSION_CODES.S)
    fun setAutoEnterPip(
        activity: Activity,
        enabled: Boolean,
        sourceRectHint: Rect? = null
    ) {
        if (!isPipSupported(activity)) return

        val params = PictureInPictureParams.Builder()
            .setAspectRatio(Rational(16, 9))
            .setAutoEnterEnabled(enabled)
            .apply {
                sourceRectHint?.let { setSourceRectHint(it) }
            }
            .build()

        activity.setPictureInPictureParams(params)
    }

    /**
     * Constrói os parâmetros padrão para PiP
     */
    @RequiresApi(Build.VERSION_CODES.O)
    private fun buildPipParams(sourceRectHint: Rect? = null): PictureInPictureParams {
        return PictureInPictureParams.Builder()
            .setAspectRatio(Rational(16, 9)) // Aspect ratio 16:9 para placares
            .apply {
                sourceRectHint?.let { setSourceRectHint(it) }

                // Seamless resize em Android 12+
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    setSeamlessResizeEnabled(true)
                }
            }
            .build()
    }
}

/**
 * Composable que monitora mudanças no estado PiP da Activity
 */
@Composable
fun PipModeEffect(
    onPipModeChanged: (Boolean) -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_PAUSE,
                Lifecycle.Event.ON_RESUME -> {
                    val activity = context as? Activity
                    if (activity != null) {
                        val isInPip = PipHelper.isInPipMode(activity)
                        onPipModeChanged(isInPip)
                    }
                }
                else -> {}
            }
        }

        lifecycleOwner.lifecycle.addObserver(observer)

        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }
}

/**
 * Layout compacto do placar para exibição em Picture-in-Picture
 * Otimizado para ser legível em tamanhos pequenos
 */
@Composable
fun PipScoreLayout(
    scoreData: PipScoreData,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.surface
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Indicador de ao vivo
            if (scoreData.isLive) {
                LiveIndicator()
                Spacer(modifier = Modifier.height(4.dp))
            }

            // Tempo do jogo
            Text(
                text = scoreData.gameTime,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(8.dp))

            // Placar principal
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Time 1
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = scoreData.team1Name.take(3).uppercase(),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 1
                    )
                    Text(
                        text = scoreData.team1Score.toString(),
                        fontSize = 32.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                }

                // VS
                Text(
                    text = "×",
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.outline,
                    modifier = Modifier.padding(horizontal = 8.dp)
                )

                // Time 2
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.weight(1f)
                ) {
                    Text(
                        text = scoreData.team2Name.take(3).uppercase(),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurface,
                        maxLines = 1
                    )
                    Text(
                        text = scoreData.team2Score.toString(),
                        fontSize = 32.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.secondary
                    )
                }
            }
        }
    }
}

/**
 * Indicador de "AO VIVO" pulsante
 */
@Composable
fun LiveIndicator(
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(4.dp))
            .background(MaterialTheme.colorScheme.error)
            .padding(horizontal = 6.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(6.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.onError)
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = stringResource(R.string.pip_live_indicator),
            color = MaterialTheme.colorScheme.onError,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold
        )
    }
}

/**
 * Container que adapta o conteúdo baseado no modo PiP
 * Mostra layout compacto quando em PiP, conteúdo completo caso contrário
 */
@Composable
fun PipAwareContainer(
    scoreData: PipScoreData,
    modifier: Modifier = Modifier,
    fullContent: @Composable () -> Unit
) {
    var isInPipMode by remember { mutableStateOf(false) }

    PipModeEffect { inPip ->
        isInPipMode = inPip
    }

    if (isInPipMode) {
        PipScoreLayout(
            scoreData = scoreData,
            modifier = modifier
        )
    } else {
        fullContent()
    }
}

/**
 * Layout de placar expandido para tela cheia
 * Usado quando não está em modo PiP
 */
@Composable
fun ExpandedScoreLayout(
    scoreData: PipScoreData,
    onEnterPip: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surfaceContainerHigh,
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Header com indicador ao vivo
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                if (scoreData.isLive) {
                    LiveIndicator()
                } else {
                    Spacer(modifier = Modifier.width(1.dp))
                }

                Text(
                    text = scoreData.gameTime,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface
                )

                // Espaço para balanceamento
                Spacer(modifier = Modifier.width(48.dp))
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Placar grande
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Time 1
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = scoreData.team1Name,
                        style = MaterialTheme.typography.titleLarge,
                        color = MaterialTheme.colorScheme.onSurface,
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = scoreData.team1Score.toString(),
                        fontSize = 72.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                }

                // VS
                Text(
                    text = "×",
                    fontSize = 48.sp,
                    color = MaterialTheme.colorScheme.outline
                )

                // Time 2
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = scoreData.team2Name,
                        style = MaterialTheme.typography.titleLarge,
                        color = MaterialTheme.colorScheme.onSurface,
                        textAlign = TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = scoreData.team2Score.toString(),
                        fontSize = 72.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.secondary
                    )
                }
            }
        }
    }
}
