package com.futebadosparcas.platform

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers

/**
 * Implementacao iOS dos dispatchers de coroutine.
 *
 * Kotlin/Native (iOS) nao possui Dispatchers.IO.
 * Para operacoes de I/O, usamos Dispatchers.Default que eh um thread pool
 * geral adequado para operacoes assincronas no iOS.
 *
 * NOTA: No iOS, Ktor e outras bibliotecas de rede ja gerenciam seus proprios
 * thread pools, entao Dispatchers.Default eh suficiente para a maioria dos casos.
 */
actual object AppDispatchers {
    actual val io: CoroutineDispatcher = Dispatchers.Default
    actual val main: CoroutineDispatcher = Dispatchers.Main
    actual val default: CoroutineDispatcher = Dispatchers.Default
}
