package com.futebadosparcas.util

import com.google.firebase.perf.FirebasePerformance
import com.google.firebase.perf.metrics.Trace
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Performance Monitoring Helper
 *
 * Wraps Firebase Performance Monitoring for easier usage.
 * Tracks app performance metrics like screen load times, network requests, etc.
 *
 * Benefits:
 * - Identify slow screens
 * - Track custom operations
 * - Monitor app startup time
 * - Network performance tracking
 *
 * Usage:
 * ```kotlin
 * @Inject lateinit var perfMonitor: PerformanceMonitor
 *
 * val trace = perfMonitor.startTrace("load_games")
 * try {
 *     val games = repository.getGames()
 *     trace.incrementMetric("games_count", games.size.toLong())
 * } finally {
 *     trace.stop()
 * }
 * ```
 */
@Singleton
class PerformanceMonitor @Inject constructor() {

    // Make performance public to allow inline functions
    val performance: FirebasePerformance = FirebasePerformance.getInstance()

    /**
     * Start a custom trace
     */
    fun startTrace(traceName: String): Trace {
        return performance.newTrace(traceName).apply { start() }
    }

    /**
     * Measure block execution time
     */
    inline fun <T> measureTrace(traceName: String, block: (Trace) -> T): T {
        val trace = performance.newTrace(traceName)
        trace.start()
        return try {
            block(trace)
        } finally {
            trace.stop()
        }
    }

    /**
     * Measure suspend function execution time
     */
    suspend inline fun <T> measureSuspendTrace(traceName: String, crossinline block: suspend (Trace) -> T): T {
        val trace = performance.newTrace(traceName)
        trace.start()
        return try {
            block(trace)
        } finally {
            trace.stop()
        }
    }

    /**
     * Predefined traces for common operations
     */
    object Traces {
        const val APP_STARTUP = "app_startup"
        const val LOGIN = "login_flow"
        const val LOAD_GAMES = "load_games"
        const val LOAD_PLAYERS = "load_players"
        const val LOAD_RANKINGS = "load_rankings"
        const val CREATE_GAME = "create_game"
        const val CONFIRM_PRESENCE = "confirm_presence"
        const val PROFILE_LOAD = "profile_load"
        const val IMAGE_UPLOAD = "image_upload"
    }

    /**
     * Common metrics
     */
    object Metrics {
        const val ITEMS_COUNT = "items_count"
        const val RETRY_COUNT = "retry_count"
        const val CACHE_HIT = "cache_hit"
        const val NETWORK_LATENCY = "network_latency_ms"
    }

    /**
     * Enable/disable performance monitoring (for testing)
     */
    fun setPerformanceCollectionEnabled(enabled: Boolean) {
        performance.isPerformanceCollectionEnabled = enabled
    }
}

/**
 * Extension function to easily add metrics to a Trace
 */
fun Trace.putMetrics(vararg metrics: Pair<String, Long>) {
    metrics.forEach { (key, value) ->
        putMetric(key, value)
    }
}

/**
 * Extension function to easily add attributes to a Trace
 */
fun Trace.putAttributes(vararg attributes: Pair<String, String>) {
    attributes.forEach { (key, value) ->
        putAttribute(key, value)
    }
}
