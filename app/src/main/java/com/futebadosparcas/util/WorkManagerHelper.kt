package com.futebadosparcas.util

import android.content.Context
import androidx.work.*
import java.util.concurrent.TimeUnit

/**
 * WorkManager Helper
 *
 * Provides utilities for scheduling and managing background tasks.
 *
 * Usage:
 * ```kotlin
 * lateinit var workManagerHelper: WorkManagerHelper
 *
 * // Schedule one-time task
 * workManagerHelper.scheduleOneTimeWork(
 *     workerClass = SyncWorker::class.java,
 *     tag = "sync",
 *     initialDelay = 5.minutes
 * )
 *
 * // Schedule periodic task
 * workManagerHelper.schedulePeriodicWork(
 *     workerClass = CleanupWorker::class.java,
 *     tag = "cleanup",
 *     repeatInterval = 1.days
 * )
 * ```
 */
class WorkManagerHelper constructor(
    private val context: Context
) {

    private val workManager = WorkManager.getInstance(context)

    /**
     * Schedule one-time work with optional constraints
     */
    fun <W : ListenableWorker> scheduleOneTimeWork(
        workerClass: Class<W>,
        tag: String,
        initialDelay: Long = 0,
        delayUnit: TimeUnit = TimeUnit.MILLISECONDS,
        constraints: Constraints? = null,
        inputData: Data? = null,
        backoffPolicy: BackoffPolicy = BackoffPolicy.EXPONENTIAL,
        backoffDelay: Long = WorkRequest.MIN_BACKOFF_MILLIS
    ): String {
        val workRequest = OneTimeWorkRequest.Builder(workerClass)
            .setInitialDelay(initialDelay, delayUnit)
            .apply {
                if (constraints != null) setConstraints(constraints)
                if (inputData != null) setInputData(inputData)
            }
            .setBackoffCriteria(backoffPolicy, backoffDelay, TimeUnit.MILLISECONDS)
            .addTag(tag)
            .build()

        workManager.enqueueUniqueWork(
            tag,
            ExistingWorkPolicy.REPLACE,
            workRequest
        )

        return workRequest.id.toString()
    }

    /**
     * Schedule periodic work (minimum 15 minutes interval)
     */
    fun <W : ListenableWorker> schedulePeriodicWork(
        workerClass: Class<W>,
        tag: String,
        repeatInterval: Long,
        repeatIntervalUnit: TimeUnit = TimeUnit.MILLISECONDS,
        constraints: Constraints? = null,
        inputData: Data? = null,
        flexInterval: Long? = null,
        flexIntervalUnit: TimeUnit = TimeUnit.MILLISECONDS
    ): String {
        val workRequest = PeriodicWorkRequest.Builder(
            workerClass,
            repeatInterval,
            repeatIntervalUnit,
            flexInterval ?: (repeatInterval / 5).coerceAtLeast(PeriodicWorkRequest.MIN_PERIODIC_FLEX_MILLIS),
            flexIntervalUnit
        )
            .apply {
                if (constraints != null) setConstraints(constraints)
                if (inputData != null) setInputData(inputData)
            }
            .addTag(tag)
            .build()

        workManager.enqueueUniquePeriodicWork(
            tag,
            ExistingPeriodicWorkPolicy.KEEP,
            workRequest
        )

        return workRequest.id.toString()
    }

    /**
     * Cancel work by tag
     */
    fun cancelWorkByTag(tag: String) {
        workManager.cancelAllWorkByTag(tag)
    }

    /**
     * Cancel work by ID
     */
    fun cancelWorkById(workId: String) {
        workManager.cancelWorkById(java.util.UUID.fromString(workId))
    }

    /**
     * Cancel all work
     */
    fun cancelAllWork() {
        workManager.cancelAllWork()
    }

    /**
     * Get work info by tag
     */
    fun getWorkInfoByTag(tag: String) = workManager.getWorkInfosByTag(tag)

    /**
     * Get work info by ID
     */
    fun getWorkInfoById(workId: String) =
        workManager.getWorkInfoById(java.util.UUID.fromString(workId))

    /**
     * Build network constraints (requires network connection)
     */
    fun buildNetworkConstraints(
        requiresCharging: Boolean = false,
        requiresBatteryNotLow: Boolean = false,
        requiresStorageNotLow: Boolean = false
    ): Constraints {
        return Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .setRequiresCharging(requiresCharging)
            .setRequiresBatteryNotLow(requiresBatteryNotLow)
            .setRequiresStorageNotLow(requiresStorageNotLow)
            .build()
    }

    /**
     * Build WiFi-only constraints
     */
    fun buildWifiConstraints(
        requiresCharging: Boolean = false,
        requiresBatteryNotLow: Boolean = true
    ): Constraints {
        return Constraints.Builder()
            .setRequiredNetworkType(NetworkType.UNMETERED)
            .setRequiresCharging(requiresCharging)
            .setRequiresBatteryNotLow(requiresBatteryNotLow)
            .build()
    }

    /**
     * Build charging-only constraints
     */
    fun buildChargingConstraints(): Constraints {
        return Constraints.Builder()
            .setRequiresCharging(true)
            .build()
    }

    /**
     * Build idle device constraints (Doze mode)
     */
    fun buildIdleConstraints(): Constraints {
        return Constraints.Builder()
            .setRequiresDeviceIdle(true)
            .setRequiresBatteryNotLow(true)
            .build()
    }
}

/**
 * Extension functions for Duration support
 */
val Long.minutes: Long get() = TimeUnit.MINUTES.toMillis(this)
val Long.hours: Long get() = TimeUnit.HOURS.toMillis(this)
val Long.days: Long get() = TimeUnit.DAYS.toMillis(this)
