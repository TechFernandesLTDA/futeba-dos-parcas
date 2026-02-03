package com.futebadosparcas.util

import android.app.ActivityManager
import android.content.Context
import android.os.Debug
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.math.roundToInt

/**
 * Memory Helper
 *
 * Provides memory monitoring and leak detection utilities.
 * Helps identify memory issues before they crash the app.
 *
 * Usage:
 * ```kotlin
 * @Inject lateinit var memoryHelper: MemoryHelper
 *
 * // Check memory status
 * when (val status = memoryHelper.getMemoryStatus()) {
 *     is MemoryStatus.Critical -> {
 *         // Clear caches, release resources
 *         memoryHelper.requestGarbageCollection()
 *     }
 *     is MemoryStatus.Warning -> {
 *         // Reduce memory usage
 *     }
 *     is MemoryStatus.Normal -> {
 *         // All good
 *     }
 * }
 * ```
 */
@Singleton
class MemoryHelper @Inject constructor(
    @ApplicationContext private val context: Context
) {

    private val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager

    /**
     * Get current memory status
     */
    fun getMemoryStatus(): MemoryStatus {
        val memInfo = ActivityManager.MemoryInfo()
        activityManager.getMemoryInfo(memInfo)

        val availablePercent = (memInfo.availMem.toFloat() / memInfo.totalMem * 100).roundToInt()

        return when {
            availablePercent < 10 || memInfo.lowMemory -> MemoryStatus.Critical(availablePercent)
            availablePercent < 20 -> MemoryStatus.Warning(availablePercent)
            else -> MemoryStatus.Normal(availablePercent)
        }
    }

    /**
     * Get memory usage info
     */
    fun getMemoryInfo(): MemoryInfo {
        val runtime = Runtime.getRuntime()
        val memInfo = ActivityManager.MemoryInfo()
        activityManager.getMemoryInfo(memInfo)

        val debugMemInfo = Debug.MemoryInfo()
        Debug.getMemoryInfo(debugMemInfo)

        return MemoryInfo(
            // App memory
            usedMemoryMB = (runtime.totalMemory() - runtime.freeMemory()) / 1024 / 1024,
            maxMemoryMB = runtime.maxMemory() / 1024 / 1024,

            // System memory
            availableSystemMemoryMB = memInfo.availMem / 1024 / 1024,
            totalSystemMemoryMB = memInfo.totalMem / 1024 / 1024,
            isLowMemory = memInfo.lowMemory,

            // Detailed breakdown
            nativeHeapSizeMB = debugMemInfo.nativePss / 1024,
            dalvikHeapSizeMB = debugMemInfo.dalvikPss / 1024,
            otherMemoryMB = debugMemInfo.otherPss / 1024
        )
    }

    /**
     * Request garbage collection (use sparingly!)
     */
    fun requestGarbageCollection() {
        System.gc()
        Runtime.getRuntime().gc()
    }

    /**
     * Check if app is low on memory
     */
    fun isLowMemory(): Boolean {
        val memInfo = ActivityManager.MemoryInfo()
        activityManager.getMemoryInfo(memInfo)
        return memInfo.lowMemory
    }

    /**
     * Get memory threshold (warning level in bytes)
     */
    fun getMemoryThreshold(): Long {
        val memInfo = ActivityManager.MemoryInfo()
        activityManager.getMemoryInfo(memInfo)
        return memInfo.threshold
    }

    /**
     * Log memory stats to console
     */
    fun logMemoryStats(tag: String = "MemoryHelper") {
        val info = getMemoryInfo()
        AppLogger.d(tag) {
            """
            Memory Stats:
            - App: ${info.usedMemoryMB}MB / ${info.maxMemoryMB}MB (${info.usagePercent}%)
            - System: ${info.availableSystemMemoryMB}MB free / ${info.totalSystemMemoryMB}MB total
            - Native Heap: ${info.nativeHeapSizeMB}MB
            - Dalvik Heap: ${info.dalvikHeapSizeMB}MB
            - Other: ${info.otherMemoryMB}MB
            - Low Memory: ${info.isLowMemory}
            """.trimIndent()
        }
    }
}

/**
 * Memory status
 */
sealed class MemoryStatus {
    data class Normal(val availablePercent: Int) : MemoryStatus()
    data class Warning(val availablePercent: Int) : MemoryStatus()
    data class Critical(val availablePercent: Int) : MemoryStatus()

    val isCritical: Boolean get() = this is Critical
    val isWarning: Boolean get() = this is Warning
}

/**
 * Memory information
 */
data class MemoryInfo(
    val usedMemoryMB: Long,
    val maxMemoryMB: Long,
    val availableSystemMemoryMB: Long,
    val totalSystemMemoryMB: Long,
    val isLowMemory: Boolean,
    val nativeHeapSizeMB: Int,
    val dalvikHeapSizeMB: Int,
    val otherMemoryMB: Int
) {
    val usagePercent: Int
        get() = ((usedMemoryMB.toFloat() / maxMemoryMB) * 100).roundToInt()

    val systemUsagePercent: Int
        get() = (((totalSystemMemoryMB - availableSystemMemoryMB).toFloat() / totalSystemMemoryMB) * 100).roundToInt()
}
