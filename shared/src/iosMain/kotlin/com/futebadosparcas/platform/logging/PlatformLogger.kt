package com.futebadosparcas.platform.logging

/**
 * Implementacao iOS do PlatformLogger.
 *
 * Usa `println` (vai para o console do Xcode e do Simulador). O `NSLog("...%@", kotlinString)`
 * anterior derrubava o app: no Kotlin/Native o `String` do Kotlin passado como argumento
 * variádico de C não é um objeto Objective-C, e o `%@` lia um ponteiro inválido (SIGSEGV
 * em `objc_opt_respondsToSelector`, visto ao abrir a tela Locais no build 28).
 *
 * Formato: [TAG] NIVEL: mensagem
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
            println(
                "[$tag] ERROR: $message | Exception: ${throwable.message ?: "null"} | " +
                    "Stacktrace: ${throwable.stackTraceToString()}"
            )
        } else {
            println("[$tag] ERROR: $message")
        }
    }
}
