package com.futebadosparcas.util

import com.google.firebase.analytics.FirebaseAnalytics
import com.google.firebase.analytics.ktx.analytics
import com.google.firebase.ktx.Firebase

/**
 * ✅ OTIMIZAÇÃO #6: Query Performance Monitoring
 *
 * Monitora e registra performance de queries no Firestore:
 *
 * OBJETIVO:
 * - Identificar queries lentas em tempo real
 * - Alertar quando queries excedem threshold de performance
 * - Coletar dados para otimização contínua
 * - Base de dados para decisões de cache
 *
 * THRESHOLDS:
 * - ⚡ Fast: < 100ms
 * - ⚠️ Slow: 100-500ms
 * - 🔴 Very Slow: > 500ms
 */
object QueryPerformanceMonitor {

    private const val TAG = "QueryPerformanceMonitor"
    private const val SLOW_QUERY_THRESHOLD_MS = 500

    /**
     * Mede a performance de uma query e registra em Firebase Analytics
     */
    inline fun <T> measureQuery(
        operationName: String,
        block: () -> T
    ): T {
        val startTime = System.currentTimeMillis()
        return try {
            val result = block()
            val duration = System.currentTimeMillis() - startTime
            logQueryPerformanceInternal(operationName, duration, success = true)
            result
        } catch (e: Exception) {
            val duration = System.currentTimeMillis() - startTime
            logQueryPerformanceInternal(operationName, duration, success = false, error = e.message)
            throw e
        }
    }

    /**
     * Versão suspensão para coroutines
     */
    suspend inline fun <T> measureQuerySuspend(
        operationName: String,
        crossinline block: suspend () -> T
    ): T {
        val startTime = System.currentTimeMillis()
        return try {
            val result = block()
            val duration = System.currentTimeMillis() - startTime
            logQueryPerformanceInternal(operationName, duration, success = true)
            result
        } catch (e: Exception) {
            val duration = System.currentTimeMillis() - startTime
            logQueryPerformanceInternal(operationName, duration, success = false, error = e.message)
            throw e
        }
    }

    /**
     * Registra a performance em logs e Firebase Analytics
     */
    @PublishedApi
    internal fun logQueryPerformanceInternal(
        operationName: String,
        durationMs: Long,
        success: Boolean,
        error: String? = null
    ) {
        // ✅ Log em console
        val status = if (success) "✅" else "❌"
        val category = when {
            durationMs < 100 -> "⚡ FAST"
            durationMs < 500 -> "⚠️  SLOW"
            else -> "🔴 VERY_SLOW"
        }

        AppLogger.d(TAG) { "$status $category | $operationName: ${durationMs}ms ${error?.let { "($it)" } ?: ""}" }

        // ✅ Enviar para Firebase Analytics se query foi lenta
        if (durationMs > SLOW_QUERY_THRESHOLD_MS) {
            try {
                val bundle = android.os.Bundle().apply {
                    putString(FirebaseAnalytics.Param.ITEM_NAME, operationName)
                    putFloat("duration_ms", durationMs.toFloat())
                    putBoolean("success", success)
                    if (error != null) {
                        putString("error", error)
                    }
                }
                Firebase.analytics.logEvent("slow_query", bundle)
                AppLogger.i(TAG) { "📊 Slow query reportado ao Firebase: $operationName (${durationMs}ms)" }
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro ao enviar slow query event", e)
            }
        }
    }

    /**
     * Reporta estatísticas agregadas de query performance
     */
    fun reportQueryStats(
        operationName: String,
        totalQueries: Int,
        averageDurationMs: Long,
        maxDurationMs: Long,
        cacheHitRate: Float
    ) {
        AppLogger.i(TAG) {
            "📈 Query Stats: $operationName | Total: $totalQueries | Avg: ${averageDurationMs}ms | Max: ${maxDurationMs}ms | Cache Hit Rate: ${(cacheHitRate * 100).toInt()}%"
        }

        try {
            val bundle = android.os.Bundle().apply {
                putString(FirebaseAnalytics.Param.ITEM_NAME, operationName)
                putFloat("total_queries", totalQueries.toFloat())
                putFloat("average_duration_ms", averageDurationMs.toFloat())
                putFloat("max_duration_ms", maxDurationMs.toFloat())
                putFloat("cache_hit_rate", cacheHitRate)
            }
            Firebase.analytics.logEvent("query_stats", bundle)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao enviar query stats", e)
        }
    }
}
