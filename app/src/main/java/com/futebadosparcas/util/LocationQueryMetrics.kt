package com.futebadosparcas.util

import android.os.Bundle
import com.futebadosparcas.BuildConfig
import com.google.firebase.analytics.FirebaseAnalytics
import com.google.firebase.analytics.ktx.analytics
import com.google.firebase.crashlytics.FirebaseCrashlytics
import com.google.firebase.ktx.Firebase
import java.util.concurrent.ConcurrentHashMap
import kotlin.math.ceil

/**
 * Constantes para nomes de queries de Location.
 * Usadas para identificar e categorizar métricas de performance.
 */
object LocationQueries {
    const val GET_BY_ID = "location_get_by_id"
    const val GET_BY_OWNER = "location_get_by_owner"
    const val GET_ALL = "location_get_all"
    const val GET_WITH_PAGINATION = "location_get_with_pagination"
    const val GET_PAGINATED = "location_get_paginated"
    const val GET_SERVER_VERSION = "location_get_server_version"
    const val SEARCH = "location_search"
    const val GET_FIELDS = "location_get_fields"
    const val GET_WITH_FIELDS = "location_get_with_fields"
    const val UPDATE = "location_update"
    const val CREATE = "location_create"
    const val DELETE = "location_delete"
    const val GET_OR_CREATE_FROM_PLACE = "location_get_or_create_from_place"
    const val ADD_REVIEW = "location_add_review"
    const val GET_REVIEWS = "location_get_reviews"
    const val SEED_APOLLO = "location_seed_apollo"
    const val MIGRATE = "location_migrate"
    const val DEDUPLICATE = "location_deduplicate"
    const val FIELD_GET_BY_ID = "field_get_by_id"
    const val FIELD_GET_BY_LOCATION = "field_get_by_location"
    const val FIELD_CREATE = "field_create"
    const val FIELD_UPDATE = "field_update"
    const val FIELD_DELETE = "field_delete"
    const val FIELD_UPLOAD_PHOTO = "field_upload_photo"
}

/**
 * Estatísticas de uma query específica.
 *
 * @property count Número total de execuções
 * @property avgMs Tempo médio em milissegundos
 * @property p95Ms Percentil 95 em milissegundos
 * @property maxMs Tempo máximo em milissegundos
 * @property minMs Tempo mínimo em milissegundos
 * @property totalMs Tempo total acumulado em milissegundos
 * @property errorCount Número de queries que falharam
 */
data class QueryStats(
    val count: Int,
    val avgMs: Long,
    val p95Ms: Long,
    val maxMs: Long,
    val minMs: Long = 0L,
    val totalMs: Long = 0L,
    val errorCount: Int = 0
)

/**
 * Sistema de métricas de performance para operações de Location.
 *
 * Funcionalidades:
 * - Medição de tempo de execução de queries
 * - Cálculo de latência média e percentil 95
 * - Detecção e log de queries lentas
 * - Alertas para performance degradada (p95 > 5 segundos)
 * - Integração com Firebase Crashlytics para queries lentas
 * - Dump de métricas em builds de debug
 *
 * Uso:
 * ```kotlin
 * val result = LocationQueryMetrics.measureQuery(LocationQueries.GET_BY_ID) {
 *     firebaseDataSource.getLocationById(locationId)
 * }
 * ```
 *
 * Thresholds:
 * - SLOW_QUERY_THRESHOLD_MS (2000ms): Loga query lenta no Crashlytics
 * - CRITICAL_P95_THRESHOLD_MS (5000ms): Dispara alerta de performance degradada
 */
object LocationQueryMetrics {

    private const val TAG = "LocationQueryMetrics"

    /**
     * Threshold para considerar uma query como lenta (2 segundos).
     * Queries acima deste valor são logadas no Crashlytics como non-fatal.
     */
    const val SLOW_QUERY_THRESHOLD_MS = 2000L

    /**
     * Threshold crítico para p95 (5 segundos).
     * Se o p95 de uma query exceder este valor, um alerta é disparado.
     */
    const val CRITICAL_P95_THRESHOLD_MS = 5000L

    /**
     * Número máximo de amostras armazenadas por query.
     * Limita uso de memória e mantém métricas relevantes.
     */
    private const val MAX_SAMPLES_PER_QUERY = 1000

    /**
     * Armazenamento thread-safe das métricas de cada query.
     * Key: Nome da query (de LocationQueries)
     * Value: Lista de durações em milissegundos
     */
    private val metrics = ConcurrentHashMap<String, MutableList<Long>>()

    /**
     * Contador de erros por query.
     */
    private val errorCounts = ConcurrentHashMap<String, Int>()

    /**
     * Mede o tempo de execução de uma query síncrona.
     *
     * @param queryName Nome da query (usar constantes de LocationQueries)
     * @param block Bloco de código a ser medido
     * @return Resultado da execução do bloco
     * @throws Exception Re-lança qualquer exceção do bloco após registrar métricas
     */
    inline fun <T> measureQuery(queryName: String, block: () -> T): T {
        val start = System.currentTimeMillis()
        return try {
            val result = block()
            val duration = System.currentTimeMillis() - start
            recordMetric(queryName, duration)
            if (duration > SLOW_QUERY_THRESHOLD_MS) {
                logSlowQuery(queryName, duration)
            }
            checkP95Alert(queryName)
            result
        } catch (e: Exception) {
            val duration = System.currentTimeMillis() - start
            recordError(queryName, duration, e)
            throw e
        }
    }

    /**
     * Mede o tempo de execução de uma query suspensa (coroutine).
     *
     * @param queryName Nome da query (usar constantes de LocationQueries)
     * @param block Bloco suspendido a ser medido
     * @return Resultado da execução do bloco
     * @throws Exception Re-lança qualquer exceção do bloco após registrar métricas
     */
    suspend inline fun <T> measureQuerySuspend(
        queryName: String,
        crossinline block: suspend () -> T
    ): T {
        val start = System.currentTimeMillis()
        return try {
            val result = block()
            val duration = System.currentTimeMillis() - start
            recordMetric(queryName, duration)
            if (duration > SLOW_QUERY_THRESHOLD_MS) {
                logSlowQuery(queryName, duration)
            }
            checkP95Alert(queryName)
            result
        } catch (e: Exception) {
            val duration = System.currentTimeMillis() - start
            recordError(queryName, duration, e)
            throw e
        }
    }

    /**
     * Registra uma métrica de duração para uma query.
     *
     * @param queryName Nome da query
     * @param durationMs Duração em milissegundos
     */
    @PublishedApi
    internal fun recordMetric(queryName: String, durationMs: Long) {
        val samples = metrics.getOrPut(queryName) { mutableListOf() }

        synchronized(samples) {
            samples.add(durationMs)

            // Limita o número de amostras para evitar memory leak
            if (samples.size > MAX_SAMPLES_PER_QUERY) {
                // Remove as amostras mais antigas (primeira metade)
                val toRemove = samples.size - MAX_SAMPLES_PER_QUERY
                repeat(toRemove) { samples.removeAt(0) }
            }
        }

        // Log em debug builds
        if (BuildConfig.DEBUG) {
            val category = when {
                durationMs < 100 -> "FAST"
                durationMs < 500 -> "NORMAL"
                durationMs < SLOW_QUERY_THRESHOLD_MS -> "SLOW"
                else -> "VERY_SLOW"
            }
            AppLogger.d(TAG) { "[$category] $queryName: ${durationMs}ms" }
        }
    }

    /**
     * Registra um erro durante a execução de uma query.
     *
     * @param queryName Nome da query
     * @param durationMs Duração até o erro em milissegundos
     * @param error Exceção ocorrida
     */
    @PublishedApi
    internal fun recordError(queryName: String, durationMs: Long, error: Exception) {
        // Registra a duração mesmo em caso de erro
        recordMetric(queryName, durationMs)

        // Incrementa contador de erros
        errorCounts.compute(queryName) { _, count -> (count ?: 0) + 1 }

        // Log detalhado
        AppLogger.e(TAG, "Query error: $queryName after ${durationMs}ms", error)

        // Reporta ao Crashlytics
        try {
            val crashlytics = FirebaseCrashlytics.getInstance()
            crashlytics.setCustomKey("query_name", queryName)
            crashlytics.setCustomKey("query_duration_ms", durationMs)
            crashlytics.setCustomKey("error_type", "query_error")
            crashlytics.log("Query error: $queryName after ${durationMs}ms")
            crashlytics.recordException(error)
        } catch (e: Exception) {
            // Ignora erros do Crashlytics
            AppLogger.e(TAG, "Erro ao reportar query error ao Crashlytics", e)
        }
    }

    /**
     * Loga uma query lenta no Firebase Crashlytics como non-fatal.
     *
     * @param queryName Nome da query
     * @param durationMs Duração em milissegundos
     */
    @PublishedApi
    internal fun logSlowQuery(queryName: String, durationMs: Long) {
        val message = "Slow query detected: $queryName took ${durationMs}ms (threshold: ${SLOW_QUERY_THRESHOLD_MS}ms)"

        AppLogger.w(TAG) { message }

        // Reporta ao Crashlytics como non-fatal
        try {
            val crashlytics = FirebaseCrashlytics.getInstance()
            crashlytics.setCustomKey("query_name", queryName)
            crashlytics.setCustomKey("query_duration_ms", durationMs)
            crashlytics.setCustomKey("slow_query_threshold_ms", SLOW_QUERY_THRESHOLD_MS)
            crashlytics.setCustomKey("error_type", "slow_query")
            crashlytics.log(message)

            // Cria uma exceção não-fatal para rastreamento
            val slowQueryException = SlowQueryException(
                queryName = queryName,
                durationMs = durationMs,
                thresholdMs = SLOW_QUERY_THRESHOLD_MS
            )
            crashlytics.recordException(slowQueryException)
        } catch (e: Exception) {
            // Ignora erros do Crashlytics
            AppLogger.e(TAG, "Erro ao reportar slow query ao Crashlytics", e)
        }

        // Também envia para Firebase Analytics
        try {
            val bundle = Bundle().apply {
                putString(FirebaseAnalytics.Param.ITEM_NAME, queryName)
                putLong("duration_ms", durationMs)
                putLong("threshold_ms", SLOW_QUERY_THRESHOLD_MS)
            }
            Firebase.analytics.logEvent("location_slow_query", bundle)
        } catch (e: Exception) {
            // Ignora erros do Analytics
        }
    }

    /**
     * Verifica se o p95 de uma query está acima do threshold crítico e dispara alerta.
     *
     * @param queryName Nome da query
     */
    @PublishedApi
    internal fun checkP95Alert(queryName: String) {
        val p95 = getP95Latency(queryName)
        if (p95 > CRITICAL_P95_THRESHOLD_MS) {
            triggerPerformanceAlert(queryName, p95)
        }
    }

    /**
     * Dispara um alerta de performance degradada.
     *
     * @param queryName Nome da query
     * @param p95Ms P95 atual em milissegundos
     */
    private fun triggerPerformanceAlert(queryName: String, p95Ms: Long) {
        val message = "PERFORMANCE ALERT: $queryName p95 = ${p95Ms}ms (threshold: ${CRITICAL_P95_THRESHOLD_MS}ms)"

        AppLogger.e(TAG, message)

        // Reporta ao Crashlytics
        try {
            val crashlytics = FirebaseCrashlytics.getInstance()
            crashlytics.setCustomKey("alert_type", "performance_degradation")
            crashlytics.setCustomKey("query_name", queryName)
            crashlytics.setCustomKey("p95_ms", p95Ms)
            crashlytics.setCustomKey("critical_threshold_ms", CRITICAL_P95_THRESHOLD_MS)
            crashlytics.log(message)

            val alertException = PerformanceAlertException(
                queryName = queryName,
                p95Ms = p95Ms,
                thresholdMs = CRITICAL_P95_THRESHOLD_MS
            )
            crashlytics.recordException(alertException)
        } catch (e: Exception) {
            // Ignora erros do Crashlytics
        }

        // Envia evento ao Analytics
        try {
            val bundle = Bundle().apply {
                putString(FirebaseAnalytics.Param.ITEM_NAME, queryName)
                putLong("p95_ms", p95Ms)
                putLong("threshold_ms", CRITICAL_P95_THRESHOLD_MS)
            }
            Firebase.analytics.logEvent("location_performance_alert", bundle)
        } catch (e: Exception) {
            // Ignora erros do Analytics
        }
    }

    /**
     * Retorna a latência média de uma query específica.
     *
     * @param queryName Nome da query
     * @return Latência média em milissegundos, ou 0 se não houver dados
     */
    fun getAverageLatency(queryName: String): Long {
        val samples = metrics[queryName] ?: return 0L

        synchronized(samples) {
            if (samples.isEmpty()) return 0L
            return samples.sum() / samples.size
        }
    }

    /**
     * Retorna o percentil 95 de latência de uma query específica.
     *
     * @param queryName Nome da query
     * @return P95 em milissegundos, ou 0 se não houver dados
     */
    fun getP95Latency(queryName: String): Long {
        val samples = metrics[queryName] ?: return 0L

        synchronized(samples) {
            if (samples.isEmpty()) return 0L

            val sorted = samples.sorted()
            val index = ceil(sorted.size * 0.95).toInt().coerceAtMost(sorted.size) - 1
            return sorted[index.coerceAtLeast(0)]
        }
    }

    /**
     * Retorna o percentil 50 (mediana) de latência de uma query específica.
     *
     * @param queryName Nome da query
     * @return P50 em milissegundos, ou 0 se não houver dados
     */
    fun getP50Latency(queryName: String): Long {
        val samples = metrics[queryName] ?: return 0L

        synchronized(samples) {
            if (samples.isEmpty()) return 0L

            val sorted = samples.sorted()
            val index = sorted.size / 2
            return sorted[index]
        }
    }

    /**
     * Retorna o tempo máximo de execução de uma query específica.
     *
     * @param queryName Nome da query
     * @return Tempo máximo em milissegundos, ou 0 se não houver dados
     */
    fun getMaxLatency(queryName: String): Long {
        val samples = metrics[queryName] ?: return 0L

        synchronized(samples) {
            return samples.maxOrNull() ?: 0L
        }
    }

    /**
     * Retorna o tempo mínimo de execução de uma query específica.
     *
     * @param queryName Nome da query
     * @return Tempo mínimo em milissegundos, ou 0 se não houver dados
     */
    fun getMinLatency(queryName: String): Long {
        val samples = metrics[queryName] ?: return 0L

        synchronized(samples) {
            return samples.minOrNull() ?: 0L
        }
    }

    /**
     * Retorna o número de execuções de uma query específica.
     *
     * @param queryName Nome da query
     * @return Número de execuções
     */
    fun getQueryCount(queryName: String): Int {
        val samples = metrics[queryName] ?: return 0

        synchronized(samples) {
            return samples.size
        }
    }

    /**
     * Retorna o número de erros de uma query específica.
     *
     * @param queryName Nome da query
     * @return Número de erros
     */
    fun getErrorCount(queryName: String): Int {
        return errorCounts[queryName] ?: 0
    }

    /**
     * Retorna um sumário de métricas para todas as queries.
     *
     * @return Map de nome da query para suas estatísticas
     */
    fun getMetricsSummary(): Map<String, QueryStats> {
        return metrics.keys.associateWith { queryName ->
            val samples = metrics[queryName] ?: emptyList<Long>()

            synchronized(samples) {
                if (samples.isEmpty()) {
                    QueryStats(
                        count = 0,
                        avgMs = 0L,
                        p95Ms = 0L,
                        maxMs = 0L,
                        minMs = 0L,
                        totalMs = 0L,
                        errorCount = errorCounts[queryName] ?: 0
                    )
                } else {
                    val sorted = samples.sorted()
                    val p95Index = ceil(sorted.size * 0.95).toInt().coerceAtMost(sorted.size) - 1

                    QueryStats(
                        count = samples.size,
                        avgMs = samples.sum() / samples.size,
                        p95Ms = sorted[p95Index.coerceAtLeast(0)],
                        maxMs = sorted.last(),
                        minMs = sorted.first(),
                        totalMs = samples.sum(),
                        errorCount = errorCounts[queryName] ?: 0
                    )
                }
            }
        }
    }

    /**
     * Retorna estatísticas de uma query específica.
     *
     * @param queryName Nome da query
     * @return Estatísticas ou null se não houver dados
     */
    fun getQueryStats(queryName: String): QueryStats? {
        val samples = metrics[queryName] ?: return null

        synchronized(samples) {
            if (samples.isEmpty()) return null

            val sorted = samples.sorted()
            val p95Index = ceil(sorted.size * 0.95).toInt().coerceAtMost(sorted.size) - 1

            return QueryStats(
                count = samples.size,
                avgMs = samples.sum() / samples.size,
                p95Ms = sorted[p95Index.coerceAtLeast(0)],
                maxMs = sorted.last(),
                minMs = sorted.first(),
                totalMs = samples.sum(),
                errorCount = errorCounts[queryName] ?: 0
            )
        }
    }

    /**
     * Gera um dump formatado das métricas para debug.
     * Apenas disponível em builds de debug.
     *
     * @return String formatada com todas as métricas, ou mensagem de indisponibilidade em release
     */
    fun dumpMetrics(): String {
        if (!BuildConfig.DEBUG) {
            return "Metrics dump only available in debug builds"
        }

        val summary = getMetricsSummary()

        if (summary.isEmpty()) {
            return "No metrics recorded yet"
        }

        val builder = StringBuilder()
        builder.appendLine("╔════════════════════════════════════════════════════════════════════╗")
        builder.appendLine("║             LOCATION QUERY METRICS SUMMARY                         ║")
        builder.appendLine("╠════════════════════════════════════════════════════════════════════╣")
        builder.appendLine("║ Query Name                  │ Count │  Avg  │  P95  │  Max  │ Err  ║")
        builder.appendLine("╠═════════════════════════════╪═══════╪═══════╪═══════╪═══════╪══════╣")

        summary.entries
            .sortedByDescending { it.value.count }
            .forEach { (name, stats) ->
                val shortName = name.take(27).padEnd(27)
                val count = stats.count.toString().padStart(5)
                val avg = "${stats.avgMs}ms".padStart(5)
                val p95 = "${stats.p95Ms}ms".padStart(5)
                val max = "${stats.maxMs}ms".padStart(5)
                val err = stats.errorCount.toString().padStart(4)

                // Marca queries com performance ruim
                val marker = when {
                    stats.p95Ms > CRITICAL_P95_THRESHOLD_MS -> "🔴"
                    stats.p95Ms > SLOW_QUERY_THRESHOLD_MS -> "🟡"
                    stats.p95Ms > 500 -> "🟠"
                    else -> "🟢"
                }

                builder.appendLine("║ $marker $shortName │ $count │ $avg │ $p95 │ $max │ $err ║")
            }

        builder.appendLine("╠════════════════════════════════════════════════════════════════════╣")
        builder.appendLine("║ Legend: 🟢 Good  🟠 Slow  🟡 Warning  🔴 Critical                   ║")
        builder.appendLine("║ Thresholds: Slow=${SLOW_QUERY_THRESHOLD_MS}ms, Critical P95=${CRITICAL_P95_THRESHOLD_MS}ms              ║")
        builder.appendLine("╚════════════════════════════════════════════════════════════════════╝")

        return builder.toString()
    }

    /**
     * Loga o dump de métricas no console (apenas em debug builds).
     */
    fun logMetricsDump() {
        if (BuildConfig.DEBUG) {
            AppLogger.i(TAG) { "\n${dumpMetrics()}" }
        }
    }

    /**
     * Limpa todas as métricas coletadas.
     * Útil para testes ou reset de sessão.
     */
    fun clearMetrics() {
        metrics.clear()
        errorCounts.clear()
        AppLogger.d(TAG) { "Metrics cleared" }
    }

    /**
     * Envia um resumo das métricas para o Firebase Analytics.
     * Útil para análise de performance em produção.
     */
    fun reportMetricsToAnalytics() {
        try {
            val summary = getMetricsSummary()

            summary.forEach { (queryName, stats) ->
                if (stats.count > 0) {
                    val bundle = Bundle().apply {
                        putString(FirebaseAnalytics.Param.ITEM_NAME, queryName)
                        putInt("query_count", stats.count)
                        putLong("avg_ms", stats.avgMs)
                        putLong("p95_ms", stats.p95Ms)
                        putLong("max_ms", stats.maxMs)
                        putInt("error_count", stats.errorCount)
                    }
                    Firebase.analytics.logEvent("location_query_metrics", bundle)
                }
            }

            AppLogger.d(TAG) { "Metrics reported to Analytics: ${summary.size} queries" }
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao reportar métricas ao Analytics", e)
        }
    }
}

/**
 * Exceção customizada para queries lentas.
 * Usada para rastreamento no Crashlytics sem stack trace pesado.
 */
class SlowQueryException(
    queryName: String,
    durationMs: Long,
    thresholdMs: Long
) : Exception("Slow query: $queryName took ${durationMs}ms (threshold: ${thresholdMs}ms)") {

    init {
        // Limpa o stack trace para reduzir ruído no Crashlytics
        stackTrace = arrayOf(
            StackTraceElement(
                "LocationQueryMetrics",
                "measureQuery",
                "LocationQueryMetrics.kt",
                0
            )
        )
    }
}

/**
 * Exceção customizada para alertas de performance.
 * Usada para rastreamento no Crashlytics quando p95 excede threshold crítico.
 */
class PerformanceAlertException(
    queryName: String,
    p95Ms: Long,
    thresholdMs: Long
) : Exception("Performance alert: $queryName p95=${p95Ms}ms (threshold: ${thresholdMs}ms)") {

    init {
        // Limpa o stack trace para reduzir ruído no Crashlytics
        stackTrace = arrayOf(
            StackTraceElement(
                "LocationQueryMetrics",
                "checkP95Alert",
                "LocationQueryMetrics.kt",
                0
            )
        )
    }
}
