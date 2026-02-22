package com.futebadosparcas.platform

/**
 * Implementação Web de HapticFeedback - stub para Kotlin/Wasm
 *
 * Nota: A Vibration API requer acesso a objetos JS nativos que não são
 * facilmente representáveis em Kotlin/Wasm sem bibliotecas adicionais.
 * Esta implementação é um placeholder que não vibra, mas compila.
 *
 * Para implementação completa, considerar:
 * - kotlinx-browser library
 * - Wrapper customizado com @JsModule
 */
class WebHapticFeedback : HapticFeedback {

    override fun vibrate(durationMs: Long) {
        // Stub: navegadores modernos suportam navigator.vibrate()
        // mas requer JS interop mais complexo em Kotlin/Wasm
    }

    override fun vibratePattern(pattern: LongArray) {
        // Stub: requer conversão de LongArray para JS Array
    }

    override fun light() {
        // Stub: vibração leve (10ms)
    }

    override fun medium() {
        // Stub: vibração média (25ms)
    }

    override fun heavy() {
        // Stub: vibração forte (50ms)
    }

    override fun success() {
        // Stub: padrão de sucesso
    }

    override fun error() {
        // Stub: padrão de erro
    }

    override fun warning() {
        // Stub: padrão de aviso
    }
}

/**
 * Factory Web - sem dependências
 */
actual object HapticFeedbackFactory {
    actual fun create(): HapticFeedback = WebHapticFeedback()
}
