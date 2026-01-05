package com.futebadosparcas.domain.util

import com.futebadosparcas.util.AppLogger
import kotlinx.coroutines.delay
import kotlin.math.pow

/**
 * Política de retry com exponential backoff.
 *
 * Usado para operações de rede/Firebase que podem falhar temporariamente
 * devido a problemas de conectividade ou throttling.
 */
data class RetryPolicy(
    val maxAttempts: Int = 3,
    val initialDelayMs: Long = 1000L,
    val maxDelayMs: Long = 10000L,
    val factor: Double = 2.0,
    val retryableExceptions: List<Class<out Exception>> = listOf(
        java.io.IOException::class.java,
        java.net.SocketTimeoutException::class.java,
        java.net.UnknownHostException::class.java
    )
) {
    companion object {
        private const val TAG = "RetryPolicy"

        /**
         * Política padrão para operações Firebase
         */
        val DEFAULT = RetryPolicy(
            maxAttempts = 3,
            initialDelayMs = 1000L,
            maxDelayMs = 10000L,
            factor = 2.0
        )

        /**
         * Política agressiva para operações críticas
         */
        val AGGRESSIVE = RetryPolicy(
            maxAttempts = 5,
            initialDelayMs = 500L,
            maxDelayMs = 15000L,
            factor = 2.5
        )

        /**
         * Política conservadora para operações não-críticas
         */
        val CONSERVATIVE = RetryPolicy(
            maxAttempts = 2,
            initialDelayMs = 2000L,
            maxDelayMs = 5000L,
            factor = 1.5
        )
    }

    /**
     * Calcula o delay para a tentativa especificada usando exponential backoff.
     *
     * Formula: min(initialDelay * (factor ^ attempt), maxDelay)
     */
    fun calculateDelay(attempt: Int): Long {
        val exponentialDelay = (initialDelayMs * factor.pow(attempt.toDouble())).toLong()
        return exponentialDelay.coerceAtMost(maxDelayMs)
    }

    /**
     * Verifica se a exceção é retryable.
     */
    fun isRetryable(exception: Exception): Boolean {
        // Verificar se a exceção é uma das classes retryable
        return retryableExceptions.any { retryableClass ->
            retryableClass.isInstance(exception)
        }
    }
}

/**
 * Extensão para executar uma operação suspensa com retry policy.
 *
 * @param policy Política de retry a ser usada
 * @param operation Operação suspensa a ser executada
 * @return Result da operação
 *
 * Exemplo de uso:
 * ```kotlin
 * val result = suspendWithRetry(RetryPolicy.DEFAULT) {
 *     firestore.collection("users").document(userId).get().await()
 * }
 * ```
 */
suspend fun <T> suspendWithRetry(
    policy: RetryPolicy = RetryPolicy.DEFAULT,
    operation: suspend () -> T
): T {
    var lastException: Exception? = null

    repeat(policy.maxAttempts) { attempt ->
        try {
            return operation()
        } catch (e: Exception) {
            lastException = e

            // Se não for retryable ou se for a última tentativa, lançar exceção
            if (!policy.isRetryable(e) || attempt == policy.maxAttempts - 1) {
                AppLogger.e("RetryPolicy") {
                    "Operação falhou após ${attempt + 1} tentativas: ${e.message}"
                }
                throw e
            }

            // Calcular delay e aguardar antes de retry
            val delayMs = policy.calculateDelay(attempt)
            AppLogger.w("RetryPolicy") {
                "Tentativa ${attempt + 1}/${policy.maxAttempts} falhou: ${e.message}. " +
                "Aguardando ${delayMs}ms antes de retry..."
            }
            delay(delayMs)
        }
    }

    // Isso nunca deve acontecer, mas para segurança do compilador
    throw lastException ?: Exception("Operação falhou sem exceção")
}

/**
 * Versão de suspendWithRetry que retorna Result<T> ao invés de lançar exceção.
 *
 * @param policy Política de retry a ser usada
 * @param operation Operação suspensa a ser executada
 * @return Result contendo o valor de sucesso ou a exceção
 *
 * Exemplo de uso:
 * ```kotlin
 * val result = suspendWithRetryResult(RetryPolicy.DEFAULT) {
 *     firestore.collection("users").document(userId).get().await()
 * }
 * result.onSuccess { document -> ... }
 *       .onFailure { error -> ... }
 * ```
 */
suspend fun <T> suspendWithRetryResult(
    policy: RetryPolicy = RetryPolicy.DEFAULT,
    operation: suspend () -> T
): Result<T> {
    return try {
        Result.success(suspendWithRetry(policy, operation))
    } catch (e: Exception) {
        Result.failure(e)
    }
}
