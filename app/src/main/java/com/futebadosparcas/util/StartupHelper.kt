package com.futebadosparcas.util

import android.content.Context
import android.os.SystemClock
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Startup Helper
 *
 * Tracks app startup time and provides optimization utilities.
 * Helps measure and improve app cold start performance.
 *
 * Usage:
 * ```kotlin
 * // In Application.onCreate()
 * startupHelper.markStartupComplete()
 *
 * // Get startup time
 * val startupTime = startupHelper.getStartupTime()
 * Log.d("Startup", "App started in ${startupTime}ms")
 * ```
 */
@Singleton
class StartupHelper @Inject constructor(
    @ApplicationContext private val context: Context
) {

    private var startupStartTime: Long = 0
    private var startupEndTime: Long = 0
    private val checkpoints = mutableMapOf<String, Long>()

    init {
        // Record process start time
        startupStartTime = SystemClock.elapsedRealtime()
    }

    /**
     * Mark startup as complete
     */
    fun markStartupComplete() {
        if (startupEndTime == 0L) {
            startupEndTime = SystemClock.elapsedRealtime()
            logStartupMetrics()
        }
    }

    /**
     * Mark a checkpoint during startup
     */
    fun markCheckpoint(name: String) {
        if (startupEndTime == 0L) {
            checkpoints[name] = SystemClock.elapsedRealtime() - startupStartTime
        }
    }

    /**
     * Get total startup time in milliseconds
     */
    fun getStartupTime(): Long {
        return if (startupEndTime > 0) {
            startupEndTime - startupStartTime
        } else {
            SystemClock.elapsedRealtime() - startupStartTime
        }
    }

    /**
     * Get startup metrics
     */
    fun getStartupMetrics(): StartupMetrics {
        return StartupMetrics(
            totalTimeMs = getStartupTime(),
            checkpoints = checkpoints.toMap(),
            isComplete = startupEndTime > 0
        )
    }

    /**
     * Log startup metrics to console
     */
    private fun logStartupMetrics() {
        val totalTime = getStartupTime()
        val log = StringBuilder()
        log.append("\n========== App Startup Metrics ==========\n")
        log.append("Total Startup Time: ${totalTime}ms\n")
        log.append("\nCheckpoints:\n")

        checkpoints.entries.sortedBy { it.value }.forEach { (name, time) ->
            log.append("  - $name: ${time}ms\n")
        }

        log.append("========================================\n")
        AppLogger.i("StartupHelper") { log.toString() }

        // Send to analytics/performance monitoring
        // performanceMonitor.startTrace("app_startup").apply {
        //     putMetric("startup_time_ms", totalTime)
        //     checkpoints.forEach { (name, time) ->
        //         putMetric("checkpoint_${name}_ms", time)
        //     }
        //     stop()
        // }
    }

    /**
     * Reset startup tracking (for testing)
     */
    fun reset() {
        startupStartTime = SystemClock.elapsedRealtime()
        startupEndTime = 0
        checkpoints.clear()
    }
}

/**
 * Startup metrics
 */
data class StartupMetrics(
    val totalTimeMs: Long,
    val checkpoints: Map<String, Long>,
    val isComplete: Boolean
) {
    /**
     * Get startup classification
     */
    fun getClassification(): StartupClassification {
        return when {
            totalTimeMs < 500 -> StartupClassification.Fast
            totalTimeMs < 1000 -> StartupClassification.Good
            totalTimeMs < 2000 -> StartupClassification.Slow
            else -> StartupClassification.VerySlow
        }
    }

    override fun toString(): String {
        val sb = StringBuilder()
        sb.append("Startup: ${totalTimeMs}ms (${getClassification()})\n")
        checkpoints.entries.sortedBy { it.value }.forEach { (name, time) ->
            sb.append("  - $name: ${time}ms\n")
        }
        return sb.toString()
    }
}

/**
 * Startup classification
 */
enum class StartupClassification {
    Fast,      // < 500ms - Excellent
    Good,      // < 1s - Good
    Slow,      // < 2s - Needs improvement
    VerySlow   // > 2s - Critical
}
