package com.futebadosparcas.util

import com.futebadosparcas.util.AppLogger
import com.google.firebase.crashlytics.FirebaseCrashlytics
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Error Tracker
 *
 * Centralized error tracking and crash reporting using Firebase Crashlytics.
 *
 * Usage:
 * ```kotlin
 * @Inject lateinit var errorTracker: ErrorTracker
 *
 * // Log error
 * errorTracker.logError(exception, "Failed to load games")
 *
 * // Log non-fatal exception
 * errorTracker.recordException(exception)
 *
 * // Set user identifier
 * errorTracker.setUserId(userId)
 *
 * // Add custom key
 * errorTracker.setCustomKey("game_id", gameId)
 * ```
 */
@Singleton
class ErrorTracker @Inject constructor(
    private val buildConfigHelper: BuildConfigHelper
) {

    private val crashlytics: FirebaseCrashlytics by lazy {
        FirebaseCrashlytics.getInstance()
    }

    private val isEnabled: Boolean
        get() = buildConfigHelper.isFeatureEnabled("enable_crashlytics")

    /**
     * Log error message
     */
    fun logError(exception: Throwable, message: String? = null) {
        val fullMessage = message?.let { "$it: ${exception.message}" } ?: exception.message ?: "Unknown error"

        AppLogger.e(TAG, fullMessage)

        if (isEnabled) {
            crashlytics.log(fullMessage)
            crashlytics.recordException(exception)
        }
    }

    /**
     * Record non-fatal exception
     */
    fun recordException(exception: Throwable) {
        AppLogger.e(TAG, "Exception: ${exception.message}")

        if (isEnabled) {
            crashlytics.recordException(exception)
        }
    }

    /**
     * Log message
     */
    fun log(message: String) {
        AppLogger.d(TAG) { message }

        if (isEnabled) {
            crashlytics.log(message)
        }
    }

    /**
     * Set user identifier
     */
    fun setUserId(userId: String) {
        if (isEnabled) {
            crashlytics.setUserId(userId)
        }
    }

    /**
     * Set custom key-value pair
     */
    fun setCustomKey(key: String, value: String) {
        if (isEnabled) {
            crashlytics.setCustomKey(key, value)
        }
    }

    /**
     * Set custom key-value pair (boolean)
     */
    fun setCustomKey(key: String, value: Boolean) {
        if (isEnabled) {
            crashlytics.setCustomKey(key, value)
        }
    }

    /**
     * Set custom key-value pair (int)
     */
    fun setCustomKey(key: String, value: Int) {
        if (isEnabled) {
            crashlytics.setCustomKey(key, value)
        }
    }

    /**
     * Set custom key-value pair (long)
     */
    fun setCustomKey(key: String, value: Long) {
        if (isEnabled) {
            crashlytics.setCustomKey(key, value)
        }
    }

    /**
     * Set custom key-value pair (float)
     */
    fun setCustomKey(key: String, value: Float) {
        if (isEnabled) {
            crashlytics.setCustomKey(key, value)
        }
    }

    /**
     * Set custom key-value pair (double)
     */
    fun setCustomKey(key: String, value: Double) {
        if (isEnabled) {
            crashlytics.setCustomKey(key, value)
        }
    }

    /**
     * Add breadcrumb (log trail)
     */
    fun addBreadcrumb(message: String) {
        log("Breadcrumb: $message")
    }

    /**
     * Check if error tracking is enabled
     */
    fun isErrorTrackingEnabled(): Boolean {
        return isEnabled
    }

    /**
     * Enable error tracking
     */
    fun enable() {
        crashlytics.setCrashlyticsCollectionEnabled(true)
    }

    /**
     * Disable error tracking
     */
    fun disable() {
        crashlytics.setCrashlyticsCollectionEnabled(false)
    }

    /**
     * Log repository error
     */
    fun logRepositoryError(repositoryName: String, operation: String, exception: Throwable) {
        setCustomKey("repository", repositoryName)
        setCustomKey("operation", operation)
        logError(exception, "Repository error in $repositoryName.$operation")
    }

    /**
     * Log ViewModel error
     */
    fun logViewModelError(viewModelName: String, action: String, exception: Throwable) {
        setCustomKey("viewmodel", viewModelName)
        setCustomKey("action", action)
        logError(exception, "ViewModel error in $viewModelName.$action")
    }

    /**
     * Log use case error
     */
    fun logUseCaseError(useCaseName: String, exception: Throwable) {
        setCustomKey("use_case", useCaseName)
        logError(exception, "Use case error in $useCaseName")
    }

    /**
     * Log network error
     */
    fun logNetworkError(endpoint: String, exception: Throwable) {
        setCustomKey("endpoint", endpoint)
        setCustomKey("error_type", "network")
        logError(exception, "Network error at $endpoint")
    }

    /**
     * Log UI error
     */
    fun logUIError(screenName: String, exception: Throwable) {
        setCustomKey("screen", screenName)
        setCustomKey("error_type", "ui")
        logError(exception, "UI error in $screenName")
    }

    companion object {
        private const val TAG = "ErrorTracker"
    }
}
