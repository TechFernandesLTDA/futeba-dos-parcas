package com.futebadosparcas.util

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Network Helper
 *
 * Provides utilities for checking network connectivity and monitoring network changes.
 *
 * Usage:
 * ```kotlin
 * @Inject lateinit var networkHelper: NetworkHelper
 *
 * // Check if connected
 * if (networkHelper.isNetworkAvailable()) {
 *     // Perform network operation
 * }
 *
 * // Check connection type
 * when (networkHelper.getConnectionType()) {
 *     ConnectionType.WIFI -> { /* Use Wi-Fi specific logic */ }
 *     ConnectionType.CELLULAR -> { /* Warn about data usage */ }
 *     ConnectionType.NONE -> { /* Show offline UI */ }
 * }
 *
 * // Monitor network changes
 * networkHelper.observeNetworkStatus().collect { isConnected ->
 *     if (isConnected) {
 *         // Network restored
 *     } else {
 *         // Network lost
 *     }
 * }
 * ```
 */
@Singleton
class NetworkHelper @Inject constructor(
    @ApplicationContext private val context: Context
) {

    private val connectivityManager =
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    /**
     * Check if network is available
     */
    fun isNetworkAvailable(): Boolean {
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    /**
     * Check if connected to WiFi
     */
    fun isWifiConnected(): Boolean {
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
    }

    /**
     * Check if connected to cellular network
     */
    fun isCellularConnected(): Boolean {
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)
    }

    /**
     * Check if connected to ethernet
     */
    fun isEthernetConnected(): Boolean {
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
    }

    /**
     * Get current connection type
     */
    fun getConnectionType(): ConnectionType {
        return when {
            isWifiConnected() -> ConnectionType.WIFI
            isCellularConnected() -> ConnectionType.CELLULAR
            isEthernetConnected() -> ConnectionType.ETHERNET
            else -> ConnectionType.NONE
        }
    }

    /**
     * Check if connection is metered (has data limits)
     */
    fun isMeteredConnection(): Boolean {
        return connectivityManager.isActiveNetworkMetered
    }

    /**
     * Observe network status changes
     */
    fun observeNetworkStatus(): Flow<Boolean> = callbackFlow {
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                trySend(true)
            }

            override fun onLost(network: Network) {
                trySend(false)
            }

            override fun onUnavailable() {
                trySend(false)
            }
        }

        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()

        connectivityManager.registerNetworkCallback(request, callback)

        // Send initial state
        trySend(isNetworkAvailable())

        awaitClose {
            connectivityManager.unregisterNetworkCallback(callback)
        }
    }

    /**
     * Observe connection type changes
     */
    fun observeConnectionType(): Flow<ConnectionType> = callbackFlow {
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onCapabilitiesChanged(
                network: Network,
                capabilities: NetworkCapabilities
            ) {
                val type = when {
                    capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> ConnectionType.WIFI
                    capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> ConnectionType.CELLULAR
                    capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> ConnectionType.ETHERNET
                    else -> ConnectionType.NONE
                }
                trySend(type)
            }

            override fun onLost(network: Network) {
                trySend(ConnectionType.NONE)
            }
        }

        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()

        connectivityManager.registerNetworkCallback(request, callback)

        // Send initial state
        trySend(getConnectionType())

        awaitClose {
            connectivityManager.unregisterNetworkCallback(callback)
        }
    }

    /**
     * Get network speed (download/upload capabilities)
     */
    fun getNetworkSpeed(): NetworkSpeed {
        val network = connectivityManager.activeNetwork ?: return NetworkSpeed.UNKNOWN
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return NetworkSpeed.UNKNOWN

        val downKbps = capabilities.linkDownstreamBandwidthKbps
        val upKbps = capabilities.linkUpstreamBandwidthKbps

        return NetworkSpeed(
            downloadKbps = downKbps,
            uploadKbps = upKbps,
            quality = when {
                downKbps >= 10000 -> NetworkQuality.EXCELLENT // 10+ Mbps
                downKbps >= 5000 -> NetworkQuality.GOOD       // 5-10 Mbps
                downKbps >= 1000 -> NetworkQuality.FAIR       // 1-5 Mbps
                else -> NetworkQuality.POOR                   // < 1 Mbps
            }
        )
    }

    /**
     * Get detailed network info
     */
    fun getNetworkInfo(): NetworkInfo {
        return NetworkInfo(
            isConnected = isNetworkAvailable(),
            connectionType = getConnectionType(),
            isMetered = isMeteredConnection(),
            networkSpeed = getNetworkSpeed()
        )
    }
}

/**
 * Connection type enum
 */
enum class ConnectionType {
    WIFI,
    CELLULAR,
    ETHERNET,
    NONE
}

/**
 * Network quality enum
 */
enum class NetworkQuality {
    EXCELLENT,
    GOOD,
    FAIR,
    POOR,
    UNKNOWN
}

/**
 * Network speed data class
 */
data class NetworkSpeed(
    val downloadKbps: Int,
    val uploadKbps: Int,
    val quality: NetworkQuality
) {
    companion object {
        val UNKNOWN = NetworkSpeed(0, 0, NetworkQuality.UNKNOWN)
    }

    val downloadMbps: Float get() = downloadKbps / 1000f
    val uploadMbps: Float get() = uploadKbps / 1000f
}

/**
 * Network info data class
 */
data class NetworkInfo(
    val isConnected: Boolean,
    val connectionType: ConnectionType,
    val isMetered: Boolean,
    val networkSpeed: NetworkSpeed
)
