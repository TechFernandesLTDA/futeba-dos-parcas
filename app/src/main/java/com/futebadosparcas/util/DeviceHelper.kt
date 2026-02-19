package com.futebadosparcas.util

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import java.util.Locale

/**
 * Device Helper
 *
 * Provides device information and capabilities.
 *
 * Usage:
 * ```kotlin
 * lateinit var deviceHelper: DeviceHelper
 *
 * val deviceInfo = deviceHelper.getDeviceInfo()
 * Log.d("Device", "Model: ${deviceInfo.model}, Android: ${deviceInfo.androidVersion}")
 * ```
 */
class DeviceHelper constructor(
    private val context: Context
) {

    /**
     * Get device information
     */
    fun getDeviceInfo(): DeviceInfo {
        return DeviceInfo(
            manufacturer = Build.MANUFACTURER,
            model = Build.MODEL,
            device = Build.DEVICE,
            androidVersion = Build.VERSION.RELEASE,
            sdkVersion = Build.VERSION.SDK_INT,
            deviceId = getDeviceId(),
            locale = Locale.getDefault().toString(),
            screenDensity = context.resources.displayMetrics.densityDpi,
            screenWidth = context.resources.displayMetrics.widthPixels,
            screenHeight = context.resources.displayMetrics.heightPixels
        )
    }

    /**
     * Get device ID (Android ID)
     */
    fun getDeviceId(): String {
        return Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ANDROID_ID
        ) ?: "unknown"
    }

    /**
     * Check if device has specific feature
     */
    fun hasFeature(feature: String): Boolean {
        return context.packageManager.hasSystemFeature(feature)
    }

    /**
     * Check if device has camera
     */
    fun hasCamera(): Boolean {
        return hasFeature(PackageManager.FEATURE_CAMERA_ANY)
    }

    /**
     * Check if device has fingerprint scanner
     */
    fun hasFingerprint(): Boolean {
        return hasFeature(PackageManager.FEATURE_FINGERPRINT)
    }

    /**
     * Check if device has GPS
     */
    fun hasGps(): Boolean {
        return hasFeature(PackageManager.FEATURE_LOCATION_GPS)
    }

    /**
     * Check if device is tablet
     */
    fun isTablet(): Boolean {
        val screenLayout = context.resources.configuration.screenLayout
        val size = screenLayout and android.content.res.Configuration.SCREENLAYOUT_SIZE_MASK
        return size >= android.content.res.Configuration.SCREENLAYOUT_SIZE_LARGE
    }

    /**
     * Check if running on emulator
     */
    fun isEmulator(): Boolean {
        return (Build.FINGERPRINT.startsWith("generic") ||
                Build.FINGERPRINT.startsWith("unknown") ||
                Build.MODEL.contains("google_sdk") ||
                Build.MODEL.contains("Emulator") ||
                Build.MODEL.contains("Android SDK built for x86") ||
                Build.MANUFACTURER.contains("Genymotion") ||
                Build.BRAND.startsWith("generic") && Build.DEVICE.startsWith("generic") ||
                "google_sdk" == Build.PRODUCT)
    }

    /**
     * Get Android version name
     */
    fun getAndroidVersionName(): String {
        return when (Build.VERSION.SDK_INT) {
            Build.VERSION_CODES.R -> "Android 11"
            Build.VERSION_CODES.S, Build.VERSION_CODES.S_V2 -> "Android 12"
            Build.VERSION_CODES.TIRAMISU -> "Android 13"
            Build.VERSION_CODES.UPSIDE_DOWN_CAKE -> "Android 14"
            else -> "Android ${Build.VERSION.RELEASE}"
        }
    }
}

/**
 * Device information data class
 */
data class DeviceInfo(
    val manufacturer: String,
    val model: String,
    val device: String,
    val androidVersion: String,
    val sdkVersion: Int,
    val deviceId: String,
    val locale: String,
    val screenDensity: Int,
    val screenWidth: Int,
    val screenHeight: Int
) {
    val deviceName: String
        get() = "$manufacturer $model"

    override fun toString(): String {
        return """
            Device: $deviceName
            Android: $androidVersion (SDK $sdkVersion)
            Screen: ${screenWidth}x${screenHeight} (${screenDensity}dpi)
            Locale: $locale
            ID: $deviceId
        """.trimIndent()
    }
}
