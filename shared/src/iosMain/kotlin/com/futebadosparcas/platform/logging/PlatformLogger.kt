package com.futebadosparcas.platform.logging

import platform.Foundation.NSLog

/**
 * Implementacao iOS do PlatformLogger usando NSLog.
 *
 * NSLog eh o mecanismo padrao do iOS para logging,
 * integrado com o Console.app e Xcode debug console.
 *
 * Formato: [TAG] NIVEL: mensagem
 */
actual object PlatformLogger {
    actual fun d(tag: String, message: String) {
        NSLog("[$tag] DEBUG: %@", message)
    }

    actual fun i(tag: String, message: String) {
        NSLog("[$tag] INFO: %@", message)
    }

    actual fun w(tag: String, message: String) {
        NSLog("[$tag] WARNING: %@", message)
    }

    actual fun e(tag: String, message: String, throwable: Throwable?) {
        if (throwable != null) {
            NSLog("[$tag] ERROR: %@ | Exception: %@ | Stacktrace: %@",
                message, throwable.message ?: "null", throwable.stackTraceToString())
        } else {
            NSLog("[$tag] ERROR: %@", message)
        }
    }
}
