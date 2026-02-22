package com.futebadosparcas.platform

/**
 * Abstração multiplataforma para feedback tátil (vibração)
 */
interface HapticFeedback {
    /**
     * Vibra por uma duração específica em milissegundos
     * @param durationMs Duração em milissegundos
     */
    fun vibrate(durationMs: Long = 50L)

    /**
     * Vibra com um padrão específico
     * @param pattern Array de durações (pausa, vibração, pausa, vibração, ...)
     * Exemplo: [0, 100, 50, 100] = vibra 100ms, pausa 50ms, vibra 100ms
     */
    fun vibratePattern(pattern: LongArray)

    /**
     * Feedback tátil leve (para interações sutis como cliques)
     */
    fun light()

    /**
     * Feedback tátil médio (para seleções)
     */
    fun medium()

    /**
     * Feedback tátil forte (para ações importantes)
     */
    fun heavy()

    /**
     * Feedback de sucesso
     */
    fun success()

    /**
     * Feedback de erro
     */
    fun error()

    /**
     * Feedback de aviso
     */
    fun warning()
}

/**
 * Factory para criar instância de HapticFeedback específica da plataforma
 */
expect object HapticFeedbackFactory {
    fun create(): HapticFeedback
}
