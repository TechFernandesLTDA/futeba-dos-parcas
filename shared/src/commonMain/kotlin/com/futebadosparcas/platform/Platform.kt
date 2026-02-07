package com.futebadosparcas.platform

/**
 * Abstracoes de plataforma para identificar o ambiente de execucao.
 *
 * Implementacoes:
 * - Android: androidMain/Platform.kt
 * - iOS: iosMain/Platform.kt
 *
 * Uso:
 * ```kotlin
 * val platform = Platform()
 * if (platform.isAndroid) {
 *     // Logica especifica Android
 * }
 * ```
 */
expect class Platform() {
    /** Nome da plataforma (ex: "Android 14", "iOS 17.0") */
    val name: String

    /** Verdadeiro se estiver rodando no Android */
    val isAndroid: Boolean

    /** Verdadeiro se estiver rodando no iOS */
    val isIOS: Boolean
}
