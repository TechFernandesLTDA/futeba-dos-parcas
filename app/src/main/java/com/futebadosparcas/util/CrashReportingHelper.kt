package com.futebadosparcas.util

import com.google.firebase.crashlytics.FirebaseCrashlytics

/**
 * Crash Reporting Helper
 *
 * Centralized crash and error reporting with Firebase Crashlytics.
 * Provides rich context for debugging production crashes.
 *
 * Benefits:
 * - Structured error reporting
 * - Custom keys for debugging
 * - Non-fatal error tracking
 * - User identification
 *
 * Usage:
 * ```kotlin
 * lateinit var crashReporting: CrashReportingHelper
 *
 * try {
 *     // Risky operation
 * } catch (e: Exception) {
 *     crashReporting.recordNonFatalException(e, mapOf(
 *         "operation" to "loadGame",
 *         "gameId" to gameId
 *     ))
 * }
 * ```
 */
class CrashReportingHelper constructor() {

    private val crashlytics: FirebaseCrashlytics = FirebaseCrashlytics.getInstance()

    /**
     * Set user identifier for crash reports
     */
    fun setUserId(userId: String) {
        crashlytics.setUserId(userId)
    }

    /**
     * Add custom key-value for debugging
     */
    fun setCustomKey(key: String, value: String) {
        crashlytics.setCustomKey(key, value)
    }

    fun setCustomKey(key: String, value: Boolean) {
        crashlytics.setCustomKey(key, value)
    }

    fun setCustomKey(key: String, value: Int) {
        crashlytics.setCustomKey(key, value)
    }

    fun setCustomKey(key: String, value: Long) {
        crashlytics.setCustomKey(key, value)
    }

    /**
     * Record non-fatal exception with context
     */
    fun recordNonFatalException(
        exception: Throwable,
        customKeys: Map<String, String> = emptyMap()
    ) {
        // Add custom keys
        customKeys.forEach { (key, value) ->
            crashlytics.setCustomKey(key, value)
        }

        // Log exception
        crashlytics.recordException(exception)
    }

    /**
     * Log message to crash report
     */
    fun log(message: String) {
        crashlytics.log(message)
    }

    /**
     * Record specific error scenarios
     */
    fun recordFirestoreError(operation: String, exception: Throwable, docPath: String? = null) {
        crashlytics.setCustomKey("error_type", "firestore")
        crashlytics.setCustomKey("operation", operation)
        docPath?.let { crashlytics.setCustomKey("doc_path", it) }
        crashlytics.recordException(exception)
    }

    fun recordNetworkError(endpoint: String, statusCode: Int?, exception: Throwable) {
        crashlytics.setCustomKey("error_type", "network")
        crashlytics.setCustomKey("endpoint", endpoint)
        statusCode?.let { crashlytics.setCustomKey("status_code", it) }
        crashlytics.recordException(exception)
    }

    fun recordAuthError(operation: String, exception: Throwable) {
        crashlytics.setCustomKey("error_type", "auth")
        crashlytics.setCustomKey("operation", operation)
        crashlytics.recordException(exception)
    }

    /**
     * Enable/disable crash reporting (for testing)
     */
    fun setCrashlyticsCollectionEnabled(enabled: Boolean) {
        crashlytics.setCrashlyticsCollectionEnabled(enabled)
    }

    /**
     * Force send pending crash reports
     */
    fun sendUnsentReports() {
        crashlytics.sendUnsentReports()
    }
}
