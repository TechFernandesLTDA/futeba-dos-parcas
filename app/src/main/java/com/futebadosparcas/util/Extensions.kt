package com.futebadosparcas.util

import android.view.View
import android.widget.ImageView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import coil.load
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Extensão para carregar imagens com Coil
 */
fun ImageView.loadUrl(url: String?, placeholder: Int? = null) {
    this.load(url) {
        placeholder?.let { placeholder(it) }
        crossfade(true)
    }
}

fun ImageView.loadProfileImage(url: String?) {
    this.load(url) {
        crossfade(true)
        placeholder(com.futebadosparcas.R.drawable.ic_player_placeholder)
        error(com.futebadosparcas.R.drawable.ic_player_placeholder)
        transformations(coil.transform.CircleCropTransformation())
    }
}

/**
 * Extensão para debounce de cliques em Views.
 * Previne cliques múltiplos acidentais.
 */
fun View.setDebouncedClickListener(
    debounceTimeMs: Long = 500L,
    onClick: (View) -> Unit
) {
    var lastClickTime = 0L
    setOnClickListener { view ->
        val currentTime = System.currentTimeMillis()
        if (currentTime - lastClickTime >= debounceTimeMs) {
            lastClickTime = currentTime
            onClick(view)
        }
    }
}

/**
 * Extensão para debounce do SwipeRefreshLayout.
 * Previne refresh excessivos que consomem bateria e dados.
 *
 * @param scope CoroutineScope para gerenciar o debounce
 * @param debounceTimeMs Tempo mínimo entre refreshes (padrão: 2 segundos)
 * @param onRefresh Callback executado quando o refresh é permitido
 */
fun SwipeRefreshLayout.setDebouncedRefreshListener(
    scope: CoroutineScope,
    debounceTimeMs: Long = 2000L,
    onRefresh: () -> Unit
) {
    var lastRefreshTime = 0L
    var debounceJob: Job? = null

    setOnRefreshListener {
        val currentTime = System.currentTimeMillis()
        val timeSinceLastRefresh = currentTime - lastRefreshTime

        if (timeSinceLastRefresh >= debounceTimeMs) {
            // Tempo suficiente passou, executar refresh imediatamente
            lastRefreshTime = currentTime
            onRefresh()
        } else {
            // Muito cedo para outro refresh
            debounceJob?.cancel()
            debounceJob = scope.launch {
                // Aguardar o tempo restante
                delay(debounceTimeMs - timeSinceLastRefresh)
                lastRefreshTime = System.currentTimeMillis()
                onRefresh()
            }
        }
    }
}

/**
 * Extensão para throttle de ações.
 * Executa a primeira chamada imediatamente e ignora chamadas subsequentes dentro do período.
 */
class Throttler(private val intervalMs: Long = 1000L) {
    private var lastExecutionTime = 0L

    fun throttle(action: () -> Unit) {
        val currentTime = System.currentTimeMillis()
        if (currentTime - lastExecutionTime >= intervalMs) {
            lastExecutionTime = currentTime
            action()
        }
    }
}
