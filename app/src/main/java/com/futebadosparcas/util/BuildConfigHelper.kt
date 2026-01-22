package com.futebadosparcas.util

import com.futebadosparcas.BuildConfig

/**
 * Build Config Helper
 *
 * Provides type-safe access to build configuration.
 * Centralizes build variant checks.
 *
 * Usage:
 * ```kotlin
 * if (BuildConfigHelper.isDebug()) {
 *     // Enable debug features
 * }
 *
 * Log.d("App", "Version: ${BuildConfigHelper.getVersionInfo()}")
 * ```
 */
object BuildConfigHelper {

    /**
     * Check if running in debug mode
     */
    fun isDebug(): Boolean = BuildConfig.DEBUG

    /**
     * Check if running in release mode
     */
    fun isRelease(): Boolean = !BuildConfig.DEBUG

    /**
     * Get version name
     */
    fun getVersionName(): String = BuildConfig.VERSION_NAME

    /**
     * Get version code
     */
    fun getVersionCode(): Int = BuildConfig.VERSION_CODE

    /**
     * Get application ID
     */
    fun getApplicationId(): String = BuildConfig.APPLICATION_ID

    /**
     * Get build type
     */
    fun getBuildType(): String = BuildConfig.BUILD_TYPE

    /**
     * Get full version info
     */
    fun getVersionInfo(): String {
        return "${getVersionName()} (${getVersionCode()})"
    }

    /**
     * Get build info for logging
     */
    fun getBuildInfo(): String {
        return """
            App: ${getApplicationId()}
            Version: ${getVersionInfo()}
            Build Type: ${getBuildType()}
            Debug: ${isDebug()}
        """.trimIndent()
    }

    /**
     * Check if feature flags are enabled (for A/B testing)
     */
    fun isFeatureEnabled(featureName: String): Boolean {
        // In production, this would check Firebase Remote Config
        // For now, return based on debug mode
        return when (featureName) {
            "enable_analytics" -> isRelease()
            "enable_crashlytics" -> isRelease()
            "enable_performance_monitoring" -> isRelease()
            "enable_debug_menu" -> isDebug()
            "enable_test_data" -> isDebug()
            else -> false
        }
    }

    /**
     * Should show debug info in UI
     */
    fun shouldShowDebugInfo(): Boolean = isDebug()

    /**
     * Should enable strict mode
     */
    fun shouldEnableStrictMode(): Boolean = isDebug()

    /**
     * Should log verbose
     */
    fun shouldLogVerbose(): Boolean = isDebug()
}
