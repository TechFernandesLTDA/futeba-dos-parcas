package com.futebadosparcas.platform

/**
 * Implementação Web de HapticFeedback usando navigator.vibrate() (se disponível)
 */
class WebHapticFeedback : HapticFeedback {

    private fun vibrateIfSupported(duration: Long) {
        try {
            // Usar navigator.vibrate() se disponível
            js("if (navigator.vibrate) { navigator.vibrate(duration); }")
        } catch (e: Throwable) {
            // Vibração não suportada ou bloqueada - fail silently
        }
    }

    private fun vibratePatternIfSupported(pattern: LongArray) {
        try {
            // Converter para JS array
            val jsArray = pattern.map { it.toInt() }.toTypedArray()
            js("if (navigator.vibrate) { navigator.vibrate(jsArray); }")
        } catch (e: Throwable) {
            // Vibração não suportada ou bloqueada - fail silently
        }
    }

    override fun vibrate(durationMs: Long) {
        vibrateIfSupported(durationMs)
    }

    override fun vibratePattern(pattern: LongArray) {
        vibratePatternIfSupported(pattern)
    }

    override fun light() {
        vibrateIfSupported(10L)
    }

    override fun medium() {
        vibrateIfSupported(25L)
    }

    override fun heavy() {
        vibrateIfSupported(50L)
    }

    override fun success() {
        vibratePatternIfSupported(longArrayOf(0, 50, 50, 50))
    }

    override fun error() {
        vibratePatternIfSupported(longArrayOf(0, 100, 50, 100, 50, 100))
    }

    override fun warning() {
        vibratePatternIfSupported(longArrayOf(0, 75, 50, 75))
    }
}

/**
 * Factory Web - sem dependências
 */
actual object HapticFeedbackFactory {
    actual fun create(): HapticFeedback = WebHapticFeedback()
}
