package com.futebadosparcas.platform.logging

/**
 * Implementação iOS do PlatformLogger usando println (NSLog).
 *
 * TODO (QUANDO TIVER MAC DISPONÍVEL):
 * Opcionalmente usar platform.Foundation.NSLog para logs mais detalhados:
 * ```
 * import platform.Foundation.NSLog
 *
 * actual object PlatformLogger {
 *     actual fun d(tag: String, message: String) {
 *         NSLog("[$tag] DEBUG: $message")
 *     }
 * }
 * ```
 */
actual object PlatformLogger {
    actual fun d(tag: String, message: String) {
        println("[$tag] DEBUG: $message")
    }

    actual fun i(tag: String, message: String) {
        println("[$tag] INFO: $message")
    }

    actual fun w(tag: String, message: String) {
        println("[$tag] WARNING: $message")
    }

    actual fun e(tag: String, message: String, throwable: Throwable?) {
        if (throwable != null) {
            println("[$tag] ERROR: $message")
            println("[$tag] Exception: ${throwable.message}")
            println("[$tag] Stacktrace: ${throwable.stackTraceToString()}")
        } else {
            println("[$tag] ERROR: $message")
        }
    }
}
