package com.futebadosparcas.ui.components
import org.jetbrains.compose.resources.stringResource
import com.futebadosparcas.compose.resources.Res

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.SignalCellular4Bar
import androidx.compose.material.icons.filled.SignalCellularAlt
import androidx.compose.material.icons.filled.SignalCellularConnectedNoInternet0Bar
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.Icon
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.unit.dp
/**
 * Indicador visual de qualidade de conexão.
 * Mostra estado da rede e qualidade do sinal em tempo real.
 */

// ==================== Models ====================

/**
 * Qualidade da conexão.
 */
enum class ConnectionQuality {
    EXCELLENT,      // Excelente (Wi-Fi forte ou 5G)
    GOOD,           // Boa (Wi-Fi médio ou 4G)
    FAIR,           // Razoável (Wi-Fi fraco ou 3G)
    POOR,           // Ruim (conexão instável)
    OFFLINE         // Sem conexão
}

/**
 * Tipo de conexão.
 */
enum class ConnectionType {
    WIFI,
    MOBILE,
    ETHERNET,
    UNKNOWN,
    NONE
}

/**
 * Estado completo da conexão.
 */
data class ConnectionState(
    val quality: ConnectionQuality = ConnectionQuality.OFFLINE,
    val type: ConnectionType = ConnectionType.NONE,
    val isMetered: Boolean = true,
    val downloadSpeedMbps: Float? = null,
    val uploadSpeedMbps: Float? = null,
    val latencyMs: Int? = null
)

// ==================== Main Composables ====================

/**
 * Indicador compacto de qualidade de conexão (badge).
 */
@Composable
fun ConnectionQualityBadge(
    modifier: Modifier = Modifier,
    showLabel: Boolean = false
) {
    val context = LocalContext.current
    val connectionState = rememberConnectionState(context)

    val backgroundColor by animateColorAsState(
        targetValue = getQualityColor(connectionState.quality),
        animationSpec = tween(300),
        label = "bg_color"
    )

    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        color = backgroundColor.copy(alpha = 0.2f)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = getConnectionIcon(connectionState),
                contentDescription = null,
                modifier = Modifier.size(16.dp),
                tint = backgroundColor
            )

            if (showLabel) {
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = getQualityLabel(connectionState.quality),
                    style = MaterialTheme.typography.labelSmall,
                    color = backgroundColor
                )
            }
        }
    }
}

/**
 * Indicador com barras de sinal.
 */
@Composable
fun ConnectionSignalBars(
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val connectionState = rememberConnectionState(context)

    val barCount = when (connectionState.quality) {
        ConnectionQuality.EXCELLENT -> 4
        ConnectionQuality.GOOD -> 3
        ConnectionQuality.FAIR -> 2
        ConnectionQuality.POOR -> 1
        ConnectionQuality.OFFLINE -> 0
    }

    val color = getQualityColor(connectionState.quality)

    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(2.dp),
        verticalAlignment = Alignment.Bottom
    ) {
        repeat(4) { index ->
            val isActive = index < barCount
            val height = 8.dp + (index * 4).dp

            val animatedAlpha by animateFloatAsState(
                targetValue = if (isActive) 1f else 0.3f,
                animationSpec = tween(300),
                label = "bar_alpha"
            )

            Box(
                modifier = Modifier
                    .width(4.dp)
                    .height(height)
                    .clip(RoundedCornerShape(2.dp))
                    .background(color.copy(alpha = animatedAlpha))
            )
        }
    }
}

/**
 * Indicador expandido com detalhes.
 */
@Composable
fun ConnectionQualityCard(
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val connectionState = rememberConnectionState(context)

    val qualityColor = getQualityColor(connectionState.quality)

    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceContainerHigh
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Ícone com indicador de cor
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(qualityColor.copy(alpha = 0.2f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = getConnectionIcon(connectionState),
                    contentDescription = null,
                    tint = qualityColor,
                    modifier = Modifier.size(24.dp)
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = getConnectionTypeLabel(connectionState.type),
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = getQualityLabel(connectionState.quality),
                    style = MaterialTheme.typography.bodySmall,
                    color = qualityColor
                )
            }

            // Barras de sinal
            ConnectionSignalBars()
        }
    }
}

/**
 * Banner de offline.
 */
@Composable
fun OfflineBanner(
    modifier: Modifier = Modifier,
    onRetryClick: (() -> Unit)? = null
) {
    val context = LocalContext.current
    val connectionState = rememberConnectionState(context)

    if (connectionState.quality == ConnectionQuality.OFFLINE) {
        Surface(
            modifier = modifier,
            color = MaterialTheme.colorScheme.errorContainer
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.WifiOff,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onErrorContainer,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = stringResource(Res.string.offline_message),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onErrorContainer,
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

// ==================== State Management ====================

/**
 * Remember do estado de conexão com listener de rede.
 */
@Composable
fun rememberConnectionState(context: Context): ConnectionState {
    var connectionState by remember { mutableStateOf(ConnectionState()) }

    DisposableEffect(context) {
        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

        // Verifica estado inicial
        connectionState = getConnectionState(connectivityManager)

        // Callback para mudanças
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                connectionState = getConnectionState(connectivityManager)
            }

            override fun onLost(network: Network) {
                connectionState = ConnectionState(
                    quality = ConnectionQuality.OFFLINE,
                    type = ConnectionType.NONE
                )
            }

            override fun onCapabilitiesChanged(
                network: Network,
                capabilities: NetworkCapabilities
            ) {
                connectionState = getConnectionState(connectivityManager)
            }
        }

        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()

        connectivityManager.registerNetworkCallback(request, callback)

        onDispose {
            connectivityManager.unregisterNetworkCallback(callback)
        }
    }

    return connectionState
}

// ==================== Helpers ====================

private fun getConnectionState(connectivityManager: ConnectivityManager): ConnectionState {
    val network = connectivityManager.activeNetwork
        ?: return ConnectionState(ConnectionQuality.OFFLINE, ConnectionType.NONE)

    val capabilities = connectivityManager.getNetworkCapabilities(network)
        ?: return ConnectionState(ConnectionQuality.OFFLINE, ConnectionType.NONE)

    val type = when {
        capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> ConnectionType.WIFI
        capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> ConnectionType.MOBILE
        capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> ConnectionType.ETHERNET
        else -> ConnectionType.UNKNOWN
    }

    val isMetered = !capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)

    // Estima qualidade baseada no tipo e velocidade
    val quality = estimateQuality(capabilities, type)

    return ConnectionState(
        quality = quality,
        type = type,
        isMetered = isMetered
    )
}

private fun estimateQuality(
    capabilities: NetworkCapabilities,
    type: ConnectionType
): ConnectionQuality {
    val downstreamBandwidth = capabilities.linkDownstreamBandwidthKbps

    return when {
        downstreamBandwidth >= 50000 -> ConnectionQuality.EXCELLENT  // 50+ Mbps
        downstreamBandwidth >= 10000 -> ConnectionQuality.GOOD       // 10+ Mbps
        downstreamBandwidth >= 2000 -> ConnectionQuality.FAIR        // 2+ Mbps
        downstreamBandwidth > 0 -> ConnectionQuality.POOR
        type == ConnectionType.WIFI -> ConnectionQuality.GOOD        // Wi-Fi sem info assume bom
        type == ConnectionType.MOBILE -> ConnectionQuality.FAIR      // Mobile sem info assume razoável
        else -> ConnectionQuality.POOR
    }
}

@Composable
private fun getQualityColor(quality: ConnectionQuality): Color {
    return when (quality) {
        ConnectionQuality.EXCELLENT -> Color(0xFF4CAF50)  // Verde
        ConnectionQuality.GOOD -> Color(0xFF8BC34A)       // Verde claro
        ConnectionQuality.FAIR -> Color(0xFFFFC107)       // Amarelo
        ConnectionQuality.POOR -> Color(0xFFFF9800)       // Laranja
        ConnectionQuality.OFFLINE -> MaterialTheme.colorScheme.error
    }
}

@Composable
private fun getQualityLabel(quality: ConnectionQuality): String {
    return when (quality) {
        ConnectionQuality.EXCELLENT -> stringResource(Res.string.connection_excellent)
        ConnectionQuality.GOOD -> stringResource(Res.string.connection_good)
        ConnectionQuality.FAIR -> stringResource(Res.string.connection_fair)
        ConnectionQuality.POOR -> stringResource(Res.string.connection_poor)
        ConnectionQuality.OFFLINE -> stringResource(Res.string.connection_offline)
    }
}

@Composable
private fun getConnectionTypeLabel(type: ConnectionType): String {
    return when (type) {
        ConnectionType.WIFI -> "Wi-Fi"
        ConnectionType.MOBILE -> stringResource(Res.string.mobile_data)
        ConnectionType.ETHERNET -> "Ethernet"
        ConnectionType.UNKNOWN -> stringResource(Res.string.unknown_connection)
        ConnectionType.NONE -> stringResource(Res.string.no_connection)
    }
}

private fun getConnectionIcon(state: ConnectionState) = when {
    state.quality == ConnectionQuality.OFFLINE -> Icons.Default.WifiOff
    state.type == ConnectionType.WIFI -> Icons.Default.Wifi
    state.type == ConnectionType.MOBILE -> Icons.Default.SignalCellular4Bar
    else -> Icons.Default.SignalCellularAlt
}
