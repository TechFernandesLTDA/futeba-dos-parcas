package com.futebadosparcas.ui.util

import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import java.text.SimpleDateFormat
import java.util.*

/**
 * Utilitários de otimização para Jetpack Compose.
 *
 * Técnicas aplicadas:
 * - `remember` para cálculos caros
 * - `derivedStateOf` para estados computados
 * - Formatações de data em cache
 * - Prevenir recomposições desnecessárias
 *
 * Ref: https://developer.android.com/jetpack/compose/performance
 */

/**
 * Cache de SimpleDateFormat para evitar criações repetidas.
 * SimpleDateFormat não é thread-safe, então cada thread tem sua instância.
 */
private val dateFormatCache = ThreadLocal<MutableMap<String, SimpleDateFormat>>()

/**
 * Obtém SimpleDateFormat em cache ou cria novo.
 *
 * @param pattern Padrão de formatação (ex: "dd/MM/yyyy")
 * @param locale Locale (padrão: Locale.getDefault())
 */
fun getCachedDateFormat(pattern: String, locale: Locale = Locale.getDefault()): SimpleDateFormat {
    var cache = dateFormatCache.get()
    if (cache == null) {
        cache = mutableMapOf()
        dateFormatCache.set(cache)
    }

    val key = "$pattern-$locale"
    return cache.getOrPut(key) { SimpleDateFormat(pattern, locale) }
}

/**
 * Formata data com cache de SimpleDateFormat.
 *
 * Uso:
 * ```kotlin
 * val dateStr = remember(game.date) {
 *     formatDateCached(game.date, "dd/MM/yyyy")
 * }
 * ```
 */
fun formatDateCached(date: Date?, pattern: String = "dd/MM/yyyy"): String {
    if (date == null) return ""
    val formatter = getCachedDateFormat(pattern)
    return formatter.format(date)
}

/**
 * Formata timestamp com cache.
 */
fun formatTimestampCached(timestamp: Long, pattern: String = "dd/MM/yyyy HH:mm"): String {
    val date = Date(timestamp)
    return formatDateCached(date, pattern)
}

/**
 * Composable para formatar datas com remember automático.
 *
 * Evita recriar string em cada recomposição.
 */
@Composable
fun rememberFormattedDate(
    date: Date?,
    pattern: String = "dd/MM/yyyy",
    locale: Locale = Locale.getDefault()
): String {
    return remember(date, pattern, locale) {
        if (date == null) return@remember ""
        val formatter = SimpleDateFormat(pattern, locale)
        formatter.format(date)
    }
}

/**
 * Composable para calcular tempo relativo ("há 2 horas").
 *
 * Atualiza automaticamente a cada minuto.
 */
@Composable
fun rememberRelativeTime(timestamp: Long): String {
    var currentTime by remember { mutableLongStateOf(System.currentTimeMillis()) }

    // Atualizar a cada minuto
    LaunchedEffect(Unit) {
        while (true) {
            kotlinx.coroutines.delay(60_000) // 1 minuto
            currentTime = System.currentTimeMillis()
        }
    }

    return remember(timestamp, currentTime) {
        val diff = currentTime - timestamp
        when {
            diff < 60_000 -> "Agora"
            diff < 3600_000 -> "${diff / 60_000} min"
            diff < 86400_000 -> "${diff / 3600_000}h"
            diff < 604800_000 -> "${diff / 86400_000}d"
            else -> formatTimestampCached(timestamp, "dd/MM")
        }
    }
}

/**
 * derivedStateOf para estados computados - só recomputa quando dependências mudam.
 *
 * Exemplo:
 * ```kotlin
 * val filteredGames = rememberDerivedState(games, filter) {
 *     games.filter { it.status == filter }
 * }
 * ```
 */
@Composable
fun <T, R> rememberDerivedState(
    vararg keys: Any?,
    computation: () -> R
): State<R> {
    return remember(*keys) {
        derivedStateOf(computation)
    }
}

/**
 * Calcula porcentagem com cache.
 */
@Composable
fun rememberPercentage(current: Long, total: Long): Int {
    return remember(current, total) {
        if (total == 0L) 0
        else ((current * 100L) / total).toInt().coerceIn(0, 100)
    }
}

/**
 * Formata números grandes com sufixos (1.2K, 3.5M).
 */
@Composable
fun rememberFormattedNumber(number: Long): String {
    return remember(number) {
        when {
            number >= 1_000_000 -> String.format("%.1fM", number / 1_000_000.0)
            number >= 1_000 -> String.format("%.1fK", number / 1_000.0)
            else -> number.toString()
        }
    }
}

/**
 * Estado persistente que sobrevive a mudanças de configuração.
 *
 * Wrapper sobre rememberSaveable com melhor API.
 */
@Composable
inline fun <reified T : Any> rememberPersistentState(
    key: String? = null,
    initialValue: T
): MutableState<T> {
    return rememberSaveable(key = key) {
        mutableStateOf(initialValue)
    }
}

/**
 * Debounce para buscas - evita pesquisar a cada tecla digitada.
 *
 * Exemplo:
 * ```kotlin
 * val debouncedQuery = rememberDebouncedValue(searchQuery, 500)
 *
 * LaunchedEffect(debouncedQuery) {
 *     viewModel.search(debouncedQuery)
 * }
 * ```
 */
@Composable
fun <T> rememberDebouncedValue(value: T, delayMillis: Long = 300): T {
    var debouncedValue by remember { mutableStateOf(value) }

    LaunchedEffect(value) {
        kotlinx.coroutines.delay(delayMillis)
        debouncedValue = value
    }

    return debouncedValue
}

/**
 * Throttle para eventos frequentes - emite primeiro valor e ignora subsequentes.
 *
 * Útil para scroll, gestures, etc.
 */
@Composable
fun <T> rememberThrottledValue(value: T, windowMillis: Long = 300): T {
    var throttledValue by remember { mutableStateOf(value) }
    var lastEmitTime by remember { mutableLongStateOf(0L) }

    LaunchedEffect(value) {
        val currentTime = System.currentTimeMillis()
        if (currentTime - lastEmitTime >= windowMillis) {
            throttledValue = value
            lastEmitTime = currentTime
        }
    }

    return throttledValue
}

/**
 * Estabiliza lambda para evitar recomposições.
 *
 * Exemplo:
 * ```kotlin
 * val onClick = rememberStableCallback { gameId ->
 *     viewModel.loadGame(gameId)
 * }
 * ```
 */
@Composable
fun <T> rememberStableCallback(callback: (T) -> Unit): (T) -> Unit {
    return remember {
        { value: T -> callback(value) }
    }
}

/**
 * Estabiliza lista para evitar recomposições quando conteúdo não muda.
 *
 * Compara por identidade (referência) dos itens.
 */
@Composable
fun <T> rememberStableList(list: List<T>): List<T> {
    return remember(list.size, list.hashCode()) { list }
}

/**
 * Calcula se lista mudou baseado em keys específicas.
 *
 * Útil para LazyColumn.items() com objetos mutáveis.
 */
@Composable
fun <T> rememberListChanged(
    list: List<T>,
    keySelector: (T) -> Any
): Boolean {
    val keys = remember(list) { list.map { keySelector(it) } }
    var previousKeys by remember { mutableStateOf(keys) }

    val changed = keys != previousKeys
    if (changed) {
        previousKeys = keys
    }

    return changed
}
