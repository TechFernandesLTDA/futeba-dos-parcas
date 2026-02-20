package com.futebadosparcas.util

import android.view.View
import android.widget.ImageView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import coil3.asImage
import coil3.load
import coil3.request.crossfade
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Extensão para carregar imagens com Coil 3
 * Note: Coil 3 mudou a API - placeholder/error agora precisam de .asImage()
 */
fun ImageView.loadUrl(url: String?, placeholderRes: Int? = null) {
    this.load(url) {
        // Coil 3: Convert drawable to Image using asImage()
        if (placeholderRes != null) {
            placeholder(context.getDrawable(placeholderRes)?.asImage())
        }
        crossfade(true)
    }
}

fun ImageView.loadProfileImage(url: String?) {
    this.load(url) {
        // Coil 3: Convert drawable to Image using asImage()
        val placeholderDrawable = context.getDrawable(com.futebadosparcas.R.drawable.ic_player_placeholder)
        placeholder(placeholderDrawable?.asImage())
        error(placeholderDrawable?.asImage())
        crossfade(true)
        // NOTE: CircleCropTransformation removed - use Modifier.clip(CircleShape) in Compose instead
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
 * @param debounceTimeMs Tempo mínimo entre refreshes (padrão: 500ms)
 * @param hapticManager Opcional: adiciona feedback háptico ao pull-to-refresh
 * @param onRefresh Callback executado quando o refresh é permitido
 */
fun SwipeRefreshLayout.setDebouncedRefreshListener(
    scope: CoroutineScope,
    debounceTimeMs: Long = 500L,
    hapticManager: HapticManager? = null,
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
            hapticManager?.tick() // Feedback háptico suave
            onRefresh()
        } else {
            // Muito cedo para outro refresh
            debounceJob?.cancel()
            debounceJob = scope.launch {
                // Aguardar o tempo restante
                delay(debounceTimeMs - timeSinceLastRefresh)
                lastRefreshTime = System.currentTimeMillis()
                hapticManager?.tick() // Feedback háptico suave
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

/**
 * Interface para objetos que possuem um ID unico.
 * Usado pela extensao deduplicateById para remover duplicatas de forma eficiente.
 */
interface Identifiable {
    val id: String
}

/**
 * Extension function para deduplicar listas por ID.
 *
 * Remove duplicatas de uma lista baseando-se no ID do objeto, mantendo apenas
 * a primeira ocorrencia de cada ID. Mais eficiente que distinctBy { it.id }
 * para listas grandes, pois usa HashSet internamente.
 *
 * Exemplo de uso:
 * ```kotlin
 * val games = listOf(game1, game2, game1) // game1 duplicado
 * val uniqueGames = games.deduplicateById() // [game1, game2]
 * ```
 *
 * @return Lista sem duplicatas, preservando a ordem original
 */
fun <T : Identifiable> List<T>.deduplicateById(): List<T> {
    val seen = HashSet<String>(this.size)
    return filter { item ->
        if (item.id.isEmpty()) {
            // Se ID vazio, sempre incluir (pode ser objeto temporario)
            true
        } else {
            // Adiciona ao set e retorna true se nao existia (primeira ocorrencia)
            seen.add(item.id)
        }
    }
}

/**
 * Extension function genérica para deduplicar listas por qualquer propriedade.
 *
 * Mais eficiente que distinctBy para listas grandes (>100 elementos).
 *
 * Exemplo de uso:
 * ```kotlin
 * val users = listOf(user1, user2, user1)
 * val uniqueUsers = users.deduplicateBy { it.email }
 * ```
 *
 * @param selector Funcao que extrai a propriedade unica
 * @return Lista sem duplicatas, preservando a ordem original
 */
inline fun <T, K> List<T>.deduplicateBy(crossinline selector: (T) -> K): List<T> {
    val seen = HashSet<K>(this.size)
    return filter { item ->
        seen.add(selector(item))
    }
}
