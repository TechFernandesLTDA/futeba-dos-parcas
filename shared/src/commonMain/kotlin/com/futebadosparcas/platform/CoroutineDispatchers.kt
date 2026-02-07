package com.futebadosparcas.platform

import kotlinx.coroutines.CoroutineDispatcher

/**
 * Abstracoes multiplataforma para CoroutineDispatchers.
 *
 * No Kotlin/Native (iOS), Dispatchers.IO nao esta disponivel.
 * Este expect/actual resolve isso fornecendo um dispatcher adequado
 * para operacoes de I/O em cada plataforma.
 *
 * Implementacoes:
 * - Android: Dispatchers.IO (thread pool otimizado para I/O)
 * - iOS: Dispatchers.Default (thread pool geral, ja que iOS nao tem Dispatchers.IO)
 *
 * Uso:
 * ```kotlin
 * withContext(AppDispatchers.io) {
 *     // Operacao de I/O (rede, arquivo, banco de dados)
 * }
 * ```
 */
expect object AppDispatchers {
    /** Dispatcher para operacoes de I/O (rede, arquivo, banco de dados) */
    val io: CoroutineDispatcher

    /** Dispatcher principal (UI thread) */
    val main: CoroutineDispatcher

    /** Dispatcher para computacao intensiva */
    val default: CoroutineDispatcher
}
