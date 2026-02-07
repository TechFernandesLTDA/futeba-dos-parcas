package com.futebadosparcas.platform

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers

/**
 * Implementacao Android dos dispatchers de coroutine.
 *
 * Usa Dispatchers.IO nativo do Android para operacoes de I/O,
 * que possui um thread pool otimizado para bloqueio de I/O.
 */
actual object AppDispatchers {
    actual val io: CoroutineDispatcher = Dispatchers.IO
    actual val main: CoroutineDispatcher = Dispatchers.Main
    actual val default: CoroutineDispatcher = Dispatchers.Default
}
