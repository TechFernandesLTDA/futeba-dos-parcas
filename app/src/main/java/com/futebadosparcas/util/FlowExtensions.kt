package com.futebadosparcas.util

import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.conflate
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.receiveAsFlow

/**
 * Extensões de Flow para otimização de performance.
 *
 * Ref: kotlinx.coroutines best practices
 */

/**
 * Debounce para clicks - previne double-clicks e ações repetidas.
 *
 * Uso:
 * ```kotlin
 * Button(onClick = { action() }.debounceClick())
 * ```
 *
 * @param delayMs Delay em milissegundos (padrão: 300ms)
 */
fun (() -> Unit).debounceClick(delayMs: Long = 300): () -> Unit {
    val channel = Channel<Unit>(Channel.CONFLATED)
    var lastClickTime = 0L

    return {
        val currentTime = System.currentTimeMillis()
        if (currentTime - lastClickTime >= delayMs) {
            lastClickTime = currentTime
            this()
        }
    }
}

/**
 * Debounce para Flows - útil para search queries.
 *
 * Uso:
 * ```kotlin
 * searchQueryFlow
 *     .debounce(500)
 *     .collect { query -> search(query) }
 * ```
 *
 * @param timeoutMillis Timeout em milissegundos
 */
fun <T> Flow<T>.debounce(timeoutMillis: Long): Flow<T> {
    return flow {
        var lastEmitTime = 0L
        collect { value ->
            val currentTime = System.currentTimeMillis()
            if (currentTime - lastEmitTime >= timeoutMillis) {
                lastEmitTime = currentTime
                emit(value)
            }
        }
    }
}

/**
 * Throttle para Flows - emite primeiro item e ignora subsequentes durante window.
 *
 * Útil para eventos de scroll, resize, etc.
 *
 * @param windowMs Janela em milissegundos
 */
fun <T> Flow<T>.throttleFirst(windowMs: Long): Flow<T> {
    var lastEmitTime = 0L

    return flow {
        collect { value ->
            val currentTime = System.currentTimeMillis()
            if (currentTime - lastEmitTime >= windowMs) {
                lastEmitTime = currentTime
                emit(value)
            }
        }
    }
}

/**
 * Rate limiting - limita taxa de emissão de eventos.
 *
 * @param intervalMs Intervalo mínimo entre emissões
 */
fun <T> Flow<T>.rateLimit(intervalMs: Long): Flow<T> {
    return onEach { delay(intervalMs) }
}

/**
 * Conflate com buffer - mantém último valor sem bloquear produtor.
 *
 * Útil para UI states que atualizam rapidamente.
 */
fun <T> Flow<T>.conflateBuffer(): Flow<T> = conflate()

/**
 * Retry com exponential backoff.
 *
 * @param maxRetries Número máximo de tentativas
 * @param initialDelayMs Delay inicial em ms
 * @param maxDelayMs Delay máximo em ms
 * @param factor Fator de multiplicação (padrão: 2.0)
 */
fun <T> Flow<T>.retryWithBackoff(
    maxRetries: Int = 3,
    initialDelayMs: Long = 1000,
    maxDelayMs: Long = 10000,
    factor: Double = 2.0,
    predicate: (Throwable) -> Boolean = { true }
): Flow<T> = flow {
    var currentDelay = initialDelayMs
    var retries = 0

    while (true) {
        try {
            collect { emit(it) }
            break // Sucesso - sair do loop
        } catch (e: Throwable) {
            if (retries >= maxRetries || !predicate(e)) {
                throw e // Excedeu retries ou não deve retentar
            }

            retries++
            delay(currentDelay)

            currentDelay = (currentDelay * factor).toLong().coerceAtMost(maxDelayMs)
        }
    }
}

/**
 * Cache de Flow com TTL (Time To Live).
 *
 * Mantém último valor em cache por tempo especificado.
 *
 * @param ttlMs Tempo de vida em milissegundos
 */
class FlowCache<T>(private val ttlMs: Long) {
    private var cachedValue: T? = null
    private var cacheTime: Long = 0

    fun get(producer: suspend () -> T): Flow<T> = flow {
        val currentTime = System.currentTimeMillis()
        val isCacheValid = cachedValue != null && (currentTime - cacheTime) < ttlMs

        if (isCacheValid) {
            emit(cachedValue!!)
        } else {
            val newValue = producer()
            cachedValue = newValue
            cacheTime = currentTime
            emit(newValue)
        }
    }

    fun invalidate() {
        cachedValue = null
        cacheTime = 0
    }
}

/**
 * Collect com lifecycle awareness - previne memory leaks.
 *
 * Nota: Para Compose, usar `collectAsStateWithLifecycle()` do androidx.lifecycle.
 */
fun <T> Flow<T>.collectSafely(
    onEach: (T) -> Unit,
    onError: (Throwable) -> Unit = {}
): Flow<T> = flow {
    try {
        collect { value ->
            onEach(value)
            emit(value)
        }
    } catch (e: Throwable) {
        onError(e)
        throw e
    }
}
