package com.futebadosparcas.util

/**
 * Excecao lancada quando o limite de taxa de criacao de locais e excedido.
 *
 * Esta excecao contem informacoes uteis para exibir feedback ao usuario:
 * - Tempo restante ate o reset
 * - Limite configurado
 *
 * Uso:
 * ```kotlin
 * throw RateLimitExceededException(
 *     remainingTimeMs = rateLimiter.getResetTimeMs(),
 *     limit = LocationRateLimiter.MAX_LOCATIONS_PER_HOUR
 * )
 * ```
 *
 * @param remainingTimeMs Tempo em milissegundos ate liberacao de quota
 * @param limit Numero maximo de criacoes permitidas no periodo
 */
class RateLimitExceededException(
    val remainingTimeMs: Long,
    val limit: Int
) : Exception(
    buildMessage(remainingTimeMs, limit)
) {
    companion object {
        /**
         * Constroi a mensagem de erro padrao.
         */
        private fun buildMessage(remainingTimeMs: Long, limit: Int): String {
            val remainingSeconds = remainingTimeMs / 1000
            val minutes = remainingSeconds / 60
            val seconds = remainingSeconds % 60

            return when {
                minutes > 0 -> "Limite de $limit locais por hora atingido. Tente novamente em ${minutes}min ${seconds}s"
                else -> "Limite de $limit locais por hora atingido. Tente novamente em ${seconds}s"
            }
        }
    }

    /**
     * Retorna o tempo restante formatado para exibicao.
     *
     * @return String formatada (ex: "5:30" para 5 minutos e 30 segundos)
     */
    fun getFormattedRemainingTime(): String {
        val totalSeconds = remainingTimeMs / 1000
        val minutes = totalSeconds / 60
        val seconds = totalSeconds % 60
        return "%d:%02d".format(minutes, seconds)
    }

    /**
     * Retorna o tempo restante em segundos.
     */
    fun getRemainingSeconds(): Long = remainingTimeMs / 1000
}
