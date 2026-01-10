package com.futebadosparcas.util

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.util.concurrent.ConcurrentHashMap
import kotlin.system.measureTimeMillis

/**
 * PerformanceTracker - Rastreia métricas de performance da aplicação
 *
 * Propósito:
 * - Medir tempo de carregamento de telas
 * - Rastrear cache hit/miss rates
 * - Monitorar performance de operações críticas
 * - Gerar relatórios de performance
 *
 * Padrão de Uso:
 * ```kotlin
 * // Medir tempo de operação
 * val data = performanceTracker.measureTime("HomeScreen") {
 *     loadHomeData()
 * }
 *
 * // Rastrear cache hit
 * performanceTracker.trackCacheHit("UserCache")
 *
 * // Rastrear cache miss
 * performanceTracker.trackCacheMiss("UserCache")
 *
 * // Obter taxa de acerto
 * val hitRate = performanceTracker.getCacheHitRate("UserCache")
 * ```
 */
class PerformanceTracker {
    // Métricas de tempo de carregamento de tela
    private val screenLoadTimes = ConcurrentHashMap<String, MutableList<Long>>()

    // Contadores de cache hit/miss
    private val cacheHits = ConcurrentHashMap<String, Long>()
    private val cacheMisses = ConcurrentHashMap<String, Long>()

    // Mutex para operações sincronizadas
    private val mutex = Mutex()

    /**
     * Mede o tempo de execução de uma operação suspend
     *
     * @param screenName Nome da tela ou operação sendo medida
     * @param block Função suspend a ser executada
     * @return Resultado da operação
     */
    suspend inline fun <T> measureTime(
        screenName: String,
        crossinline block: suspend () -> T
    ): T {
        var result: T? = null
        val duration = measureTimeMillis {
            result = block()
        }

        trackScreenLoad(screenName, duration)
        return result as T
    }

    /**
     * Rastreia tempo de carregamento de tela
     *
     * @param screenName Nome da tela
     * @param durationMs Tempo em milissegundos
     */
    suspend fun trackScreenLoad(screenName: String, durationMs: Long) {
        mutex.withLock {
            screenLoadTimes
                .getOrPut(screenName) { mutableListOf() }
                .add(durationMs)

            // Log em DEBUG
            AppLogger.d(TAG) {
                "Screen Load: $screenName = ${durationMs}ms"
            }
        }
    }

    /**
     * Rastreia cache hit
     *
     * @param cacheName Nome do cache
     */
    suspend fun trackCacheHit(cacheName: String) {
        mutex.withLock {
            cacheHits[cacheName] = (cacheHits[cacheName] ?: 0L) + 1L
        }
    }

    /**
     * Rastreia cache miss
     *
     * @param cacheName Nome do cache
     */
    suspend fun trackCacheMiss(cacheName: String) {
        mutex.withLock {
            cacheMisses[cacheName] = (cacheMisses[cacheName] ?: 0L) + 1L
        }
    }

    /**
     * Obtém taxa de acerto do cache (%)
     *
     * @param cacheName Nome do cache
     * @return Taxa de acerto (0-100) ou 0 se sem dados
     */
    suspend fun getCacheHitRate(cacheName: String): Int {
        return mutex.withLock {
            val hits = cacheHits[cacheName] ?: 0L
            val misses = cacheMisses[cacheName] ?: 0L
            val total = hits + misses

            if (total == 0L) 0 else ((hits * 100) / total).toInt()
        }
    }

    /**
     * Obtém tempo médio de carregamento de tela
     *
     * @param screenName Nome da tela
     * @return Tempo médio em milissegundos
     */
    suspend fun getAverageLoadTime(screenName: String): Long {
        return mutex.withLock {
            screenLoadTimes[screenName]?.let { times ->
                if (times.isEmpty()) 0L else times.average().toLong()
            } ?: 0L
        }
    }

    /**
     * Gera relatório de performance
     *
     * @return String formatada com todas as métricas
     */
    suspend fun generateReport(): String {
        return mutex.withLock {
            val report = StringBuilder()
            report.appendLine("=== PERFORMANCE REPORT ===")

            // Screen Load Times
            report.appendLine("\n📱 Screen Load Times:")
            screenLoadTimes.forEach { (screen, times) ->
                val avg = times.average().toLong()
                val min = times.minOrNull() ?: 0L
                val max = times.maxOrNull() ?: 0L
                val count = times.size

                report.appendLine("  $screen: avg=${avg}ms (min=${min}ms, max=${max}ms, samples=$count)")
            }

            // Cache Hit Rates
            report.appendLine("\n💾 Cache Hit Rates:")
            cacheHits.keys.union(cacheMisses.keys).forEach { cache ->
                val hits = cacheHits[cache] ?: 0L
                val misses = cacheMisses[cache] ?: 0L
                val total = hits + misses

                if (total > 0L) {
                    val rate = (hits * 100) / total
                    report.appendLine("  $cache: $rate% ($hits hits, $misses misses)")
                }
            }

            report.toString()
        }
    }

    /**
     * Limpa todas as métricas coletadas
     */
    suspend fun reset() {
        mutex.withLock {
            screenLoadTimes.clear()
            cacheHits.clear()
            cacheMisses.clear()
        }
    }

    companion object {
        private const val TAG = "PerformanceTracker"
    }
}
