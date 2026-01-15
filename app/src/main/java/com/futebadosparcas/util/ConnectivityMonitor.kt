package com.futebadosparcas.util

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.debounce
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ConnectivityMonitor @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val connectivityManager =
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    @OptIn(kotlinx.coroutines.FlowPreview::class)
    val isConnected: Flow<Boolean> = callbackFlow {
        val networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                // Verificar se a rede tem capacidade de internet E está validada
                val capabilities = connectivityManager.getNetworkCapabilities(network)
                val hasInternet = capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
                val isValidated = capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) == true

                // Só reportar como online se tiver internet E a rede estiver validada
                if (hasInternet && isValidated) {
                    trySend(true)
                }
            }

            override fun onLost(network: Network) {
                // Verificar se ainda há outras redes ativas antes de reportar offline
                trySend(isCurrentlyConnected())
            }

            override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) {
                // Atualizar quando as capacidades mudarem (ex: validação completa)
                val hasInternet = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                val isValidated = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
                trySend(hasInternet && isValidated)
            }
        }

        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .addCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
            .build()

        connectivityManager.registerNetworkCallback(request, networkCallback)

        // Initial state
        trySend(isCurrentlyConnected())

        awaitClose {
            connectivityManager.unregisterNetworkCallback(networkCallback)
        }
    }
    .distinctUntilChanged()
    .debounce(500) // Debounce de 500ms para evitar flickering da mensagem

    private fun isCurrentlyConnected(): Boolean {
        val activeNetwork = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(activeNetwork) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
               capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }
}
