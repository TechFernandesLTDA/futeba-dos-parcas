package com.futebadosparcas.ui.components
import org.jetbrains.compose.resources.stringResource
import com.futebadosparcas.compose.resources.Res

import androidx.compose.animation.core.animateFloatAsState
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.futebadosparcas.util.LocationRateLimiter
import kotlinx.coroutines.delay

/**
 * Composable que exibe mensagem de erro de rate limit com countdown.
 *
 * Mostra ao usuario que o limite de criacao de locais foi atingido,
 * exibindo um contador regressivo ate que a quota seja liberada.
 *
 * @param remainingTimeMs Tempo restante em milissegundos ate liberacao da quota
 * @param onDismiss Callback para fechar a mensagem
 * @param modifier Modifier opcional para customizacao
 */
@Composable
fun RateLimitErrorMessage(
    remainingTimeMs: Long,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    var currentRemainingMs by remember { mutableLongStateOf(remainingTimeMs) }

    // Countdown automatico
    LaunchedEffect(remainingTimeMs) {
        currentRemainingMs = remainingTimeMs
        while (currentRemainingMs > 0) {
            delay(1000L)
            currentRemainingMs = (currentRemainingMs - 1000).coerceAtLeast(0)
        }
    }

    val progress = (currentRemainingMs.toFloat() / LocationRateLimiter.RATE_LIMIT_WINDOW_MS.toFloat())
        .coerceIn(0f, 1f)

    val animatedProgress by animateFloatAsState(
        targetValue = progress,
        animationSpec = tween(durationMillis = 500),
        label = "progress"
    )

    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.errorContainer
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Header com icone e botao de fechar
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.error),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Timer,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onError,
                            modifier = Modifier.size(24.dp)
                        )
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(
                        text = stringResource(Res.string.location_rate_limit_title),
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onErrorContainer,
                        fontWeight = FontWeight.Bold
                    )
                }

                IconButton(onClick = onDismiss) {
                    Icon(
                        imageVector = Icons.Default.Close,
                        contentDescription = stringResource(Res.string.close),
                        tint = MaterialTheme.colorScheme.onErrorContainer
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Mensagem principal
            Text(
                text = stringResource(
                    Res.string.location_rate_limit_message,
                    LocationRateLimiter.MAX_LOCATIONS_PER_HOUR
                ),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onErrorContainer,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Countdown visual
            CountdownDisplay(
                remainingMs = currentRemainingMs,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Barra de progresso
            LinearProgressIndicator(
                progress = { 1f - animatedProgress },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .clip(MaterialTheme.shapes.small),
                color = MaterialTheme.colorScheme.error,
                trackColor = MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.5f),
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Botao de entendido
            TextButton(
                onClick = onDismiss
            ) {
                Text(
                    text = stringResource(Res.string.understood),
                    color = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}

/**
 * Exibe o countdown de forma visual com minutos e segundos.
 */
@Composable
private fun CountdownDisplay(
    remainingMs: Long,
    modifier: Modifier = Modifier
) {
    val totalSeconds = remainingMs / 1000
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60

    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Minutos
        TimeUnit(
            value = minutes.toInt(),
            label = stringResource(Res.string.minutes_short)
        )

        Text(
            text = ":",
            style = MaterialTheme.typography.headlineLarge,
            color = MaterialTheme.colorScheme.onErrorContainer,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 8.dp)
        )

        // Segundos
        TimeUnit(
            value = seconds.toInt(),
            label = stringResource(Res.string.seconds_short)
        )
    }
}

/**
 * Exibe uma unidade de tempo (minutos ou segundos) com label.
 */
@Composable
private fun TimeUnit(
    value: Int,
    label: String,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .size(64.dp)
                .clip(MaterialTheme.shapes.medium)
                .background(MaterialTheme.colorScheme.error.copy(alpha = 0.1f)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "%02d".format(value),
                style = MaterialTheme.typography.headlineLarge,
                color = MaterialTheme.colorScheme.onErrorContainer,
                fontWeight = FontWeight.Bold
            )
        }
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onErrorContainer.copy(alpha = 0.7f)
        )
    }
}

/**
 * Versao compacta da mensagem de rate limit para snackbars ou banners.
 */
@Composable
fun RateLimitBanner(
    remainingTimeMs: Long,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    var currentRemainingMs by remember { mutableLongStateOf(remainingTimeMs) }

    LaunchedEffect(remainingTimeMs) {
        currentRemainingMs = remainingTimeMs
        while (currentRemainingMs > 0) {
            delay(1000L)
            currentRemainingMs = (currentRemainingMs - 1000).coerceAtLeast(0)
        }
    }

    val totalSeconds = currentRemainingMs / 1000
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    val timeText = "%d:%02d".format(minutes, seconds)

    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.errorContainer)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.weight(1f)
        ) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                strokeWidth = 2.dp,
                color = MaterialTheme.colorScheme.error
            )
            Spacer(modifier = Modifier.width(12.dp))
            Text(
                text = stringResource(Res.string.location_rate_limit_banner, timeText),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onErrorContainer
            )
        }

        IconButton(
            onClick = onDismiss,
            modifier = Modifier.size(48.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Close,
                contentDescription = stringResource(Res.string.close),
                tint = MaterialTheme.colorScheme.onErrorContainer,
                modifier = Modifier.size(16.dp)
            )
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun RateLimitErrorMessagePreview() {
    MaterialTheme {
        RateLimitErrorMessage(
            remainingTimeMs = 1800000L, // 30 minutos
            onDismiss = {}
        )
    }
}

@Preview(showBackground = true)
@Composable
private fun RateLimitBannerPreview() {
    MaterialTheme {
        RateLimitBanner(
            remainingTimeMs = 300000L, // 5 minutos
            onDismiss = {}
        )
    }
}
