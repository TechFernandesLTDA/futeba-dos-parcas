package com.futebadosparcas.util

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.result.ActivityResultLauncher
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/**
 * Permission Helper
 *
 * Provides utilities for requesting and checking runtime permissions.
 *
 * Usage:
 * ```kotlin
 * lateinit var permissionHelper: PermissionHelper
 *
 * // Check if permission is granted
 * if (permissionHelper.hasPermission(Manifest.permission.CAMERA)) {
 *     // Use camera
 * }
 *
 * // Check multiple permissions
 * val permissions = arrayOf(
 *     Manifest.permission.CAMERA,
 *     Manifest.permission.WRITE_EXTERNAL_STORAGE
 * )
 * if (permissionHelper.hasPermissions(*permissions)) {
 *     // All permissions granted
 * }
 *
 * // Check if should show rationale
 * if (permissionHelper.shouldShowRationale(activity, Manifest.permission.CAMERA)) {
 *     // Show explanation dialog
 * }
 * ```
 */
class PermissionHelper constructor(
    private val context: Context
) {

    /**
     * Check if a single permission is granted
     */
    fun hasPermission(permission: String): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            permission
        ) == PackageManager.PERMISSION_GRANTED
    }

    /**
     * Check if all permissions are granted
     */
    fun hasPermissions(vararg permissions: String): Boolean {
        return permissions.all { hasPermission(it) }
    }

    /**
     * Check if any permission is denied
     */
    fun hasAnyDenied(vararg permissions: String): Boolean {
        return permissions.any { !hasPermission(it) }
    }

    /**
     * Get list of denied permissions
     */
    fun getDeniedPermissions(vararg permissions: String): List<String> {
        return permissions.filter { !hasPermission(it) }
    }

    /**
     * Check if should show permission rationale
     */
    fun shouldShowRationale(activity: Activity, permission: String): Boolean {
        return ActivityCompat.shouldShowRequestPermissionRationale(activity, permission)
    }

    /**
     * Open app settings page
     */
    fun openAppSettings(activity: Activity) {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.fromParts("package", context.packageName, null)
        }
        activity.startActivity(intent)
    }

    /**
     * Check if location permission is granted
     */
    fun hasLocationPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            hasPermissions(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            )
        } else {
            hasPermissions(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            )
        }
    }

    /**
     * Check if camera permission is granted
     */
    fun hasCameraPermission(): Boolean {
        return hasPermission(Manifest.permission.CAMERA)
    }

    /**
     * Check if storage permission is granted
     */
    fun hasStoragePermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            hasPermissions(
                Manifest.permission.READ_MEDIA_IMAGES,
                Manifest.permission.READ_MEDIA_VIDEO
            )
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            hasPermission(Manifest.permission.READ_EXTERNAL_STORAGE)
        } else {
            hasPermissions(
                Manifest.permission.READ_EXTERNAL_STORAGE,
                Manifest.permission.WRITE_EXTERNAL_STORAGE
            )
        }
    }

    /**
     * Check if notification permission is granted (Android 13+)
     */
    fun hasNotificationPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            hasPermission(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            true // Not required before Android 13
        }
    }

    /**
     * Check if microphone permission is granted (Voice Messages)
     */
    fun hasMicrophonePermission(): Boolean {
        return hasPermission(Manifest.permission.RECORD_AUDIO)
    }

    /**
     * Check if exact alarm permission is granted (Android 12+)
     * Used for Smart Reminders feature
     */
    fun hasExactAlarmPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
            alarmManager.canScheduleExactAlarms()
        } else {
            true // Not required before Android 12
        }
    }

    /**
     * Get required location permissions based on Android version.
     *
     * Nota: ACCESS_BACKGROUND_LOCATION removida em v1.7.0.
     * Check-in atual é manual (foreground). Feature de check-in
     * automático via geofence planejada para versão futura.
     * Ver: specs/ROADMAP_BACKGROUND_LOCATION.md
     */
    fun getLocationPermissions(): Array<String> {
        return arrayOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
    }

    /**
     * Get required storage permissions based on Android version
     */
    fun getStoragePermissions(): Array<String> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            arrayOf(
                Manifest.permission.READ_MEDIA_IMAGES,
                Manifest.permission.READ_MEDIA_VIDEO
            )
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)
        } else {
            arrayOf(
                Manifest.permission.READ_EXTERNAL_STORAGE,
                Manifest.permission.WRITE_EXTERNAL_STORAGE
            )
        }
    }

    /**
     * Get required notification permissions (Android 13+)
     */
    fun getNotificationPermissions(): Array<String> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            arrayOf(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            emptyArray()
        }
    }

    /**
     * Get required microphone permissions (Voice Messages)
     */
    fun getMicrophonePermissions(): Array<String> {
        return arrayOf(Manifest.permission.RECORD_AUDIO)
    }

    /**
     * Get required audio permissions based on Android version
     */
    fun getAudioPermissions(): Array<String> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            arrayOf(Manifest.permission.READ_MEDIA_AUDIO)
        } else {
            emptyArray() // Covered by storage permissions on older versions
        }
    }

    /**
     * Get all permissions required for Sprint 1 & 2 features
     * Includes: notifications, location, camera, storage, microphone
     */
    fun getAllRequiredPermissions(): Array<String> {
        val permissions = mutableListOf<String>()

        // Notifications (Android 13+)
        permissions.addAll(getNotificationPermissions())

        // Location
        permissions.add(Manifest.permission.ACCESS_FINE_LOCATION)
        permissions.add(Manifest.permission.ACCESS_COARSE_LOCATION)

        // Camera
        permissions.add(Manifest.permission.CAMERA)

        // Storage (based on Android version)
        permissions.addAll(getStoragePermissions())

        // Audio (Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.READ_MEDIA_AUDIO)
        }

        // Microphone (Voice Messages)
        permissions.add(Manifest.permission.RECORD_AUDIO)

        return permissions.toTypedArray()
    }

    /**
     * Open exact alarm settings (Android 12+)
     * Required for Smart Reminders feature
     */
    fun openExactAlarmSettings(activity: Activity) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                data = Uri.fromParts("package", context.packageName, null)
            }
            activity.startActivity(intent)
        }
    }

    companion object {
        /**
         * Common permission request codes
         */
        const val REQUEST_CODE_LOCATION = 100
        const val REQUEST_CODE_CAMERA = 101
        const val REQUEST_CODE_STORAGE = 102
        const val REQUEST_CODE_NOTIFICATION = 103
        const val REQUEST_CODE_MICROPHONE = 104
        const val REQUEST_CODE_ALL = 999
    }
}

/**
 * Permission result data class
 */
data class PermissionResult(
    val permission: String,
    val isGranted: Boolean
)

/**
 * Extension function to request permissions
 */
fun Activity.requestPermissions(
    permissions: Array<String>,
    requestCode: Int
) {
    ActivityCompat.requestPermissions(this, permissions, requestCode)
}

/**
 * Extension function to check permission result
 */
fun IntArray.allGranted(): Boolean {
    return this.isNotEmpty() && this.all { it == PackageManager.PERMISSION_GRANTED }
}

/**
 * Extension function to get permission results
 */
fun getPermissionResults(
    permissions: Array<String>,
    grantResults: IntArray
): List<PermissionResult> {
    return permissions.mapIndexed { index, permission ->
        PermissionResult(
            permission = permission,
            isGranted = grantResults.getOrNull(index) == PackageManager.PERMISSION_GRANTED
        )
    }
}
