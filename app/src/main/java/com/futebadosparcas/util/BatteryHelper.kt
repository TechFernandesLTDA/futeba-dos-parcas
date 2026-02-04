package com.futebadosparcas.util

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Battery Helper
 *
 * Provides utilities for checking battery status and power information.
 *
 * Usage:
 * ```kotlin
 * @Inject lateinit var batteryHelper: BatteryHelper
 *
 * // Check battery level
 * val level = batteryHelper.getBatteryLevel()
 * if (level < 20) {
 *     // Show low battery warning
 * }
 *
 * // Check if charging
 * if (batteryHelper.isCharging()) {
 *     // Enable background sync
 * }
 *
 * // Get battery status
 * val status = batteryHelper.getBatteryStatus()
 * ```
 */
@Singleton
class BatteryHelper @Inject constructor(
    @ApplicationContext private val context: Context
) {

    private val batteryManager: BatteryManager? by lazy {
        context.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
    }

    /**
     * Get current battery level (0-100)
     */
    fun getBatteryLevel(): Int {
        val batteryIntent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))

        val level = batteryIntent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = batteryIntent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1

        return if (level >= 0 && scale > 0) {
            (level * 100 / scale)
        } else {
            -1
        }
    }

    /**
     * Check if device is charging
     */
    fun isCharging(): Boolean {
        val batteryIntent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))

        val status = batteryIntent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1

        return status == BatteryManager.BATTERY_STATUS_CHARGING ||
                status == BatteryManager.BATTERY_STATUS_FULL
    }

    /**
     * Check if device is plugged into AC power
     */
    fun isPluggedAC(): Boolean {
        val batteryIntent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))

        val plugged = batteryIntent?.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1) ?: -1

        return plugged == BatteryManager.BATTERY_PLUGGED_AC
    }

    /**
     * Check if device is plugged into USB
     */
    fun isPluggedUSB(): Boolean {
        val batteryIntent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))

        val plugged = batteryIntent?.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1) ?: -1

        return plugged == BatteryManager.BATTERY_PLUGGED_USB
    }

    /**
     * Check if device is charging wirelessly
     */
    fun isPluggedWireless(): Boolean {
        val batteryIntent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))

        val plugged = batteryIntent?.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1) ?: -1

        return plugged == BatteryManager.BATTERY_PLUGGED_WIRELESS
    }

    /**
     * Get battery temperature in Celsius
     */
    fun getBatteryTemperature(): Float {
        val batteryIntent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))

        val temperature = batteryIntent?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, -1) ?: -1

        return if (temperature >= 0) {
            temperature / 10f
        } else {
            -1f
        }
    }

    /**
     * Get battery voltage in volts
     */
    fun getBatteryVoltage(): Float {
        val batteryIntent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))

        val voltage = batteryIntent?.getIntExtra(BatteryManager.EXTRA_VOLTAGE, -1) ?: -1

        return if (voltage >= 0) {
            voltage / 1000f
        } else {
            -1f
        }
    }

    /**
     * Get battery health status
     */
    fun getBatteryHealth(): BatteryHealth {
        val batteryIntent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))

        val health = batteryIntent?.getIntExtra(BatteryManager.EXTRA_HEALTH, -1) ?: -1

        return when (health) {
            BatteryManager.BATTERY_HEALTH_GOOD -> BatteryHealth.GOOD
            BatteryManager.BATTERY_HEALTH_OVERHEAT -> BatteryHealth.OVERHEAT
            BatteryManager.BATTERY_HEALTH_DEAD -> BatteryHealth.DEAD
            BatteryManager.BATTERY_HEALTH_OVER_VOLTAGE -> BatteryHealth.OVER_VOLTAGE
            BatteryManager.BATTERY_HEALTH_UNSPECIFIED_FAILURE -> BatteryHealth.UNSPECIFIED_FAILURE
            BatteryManager.BATTERY_HEALTH_COLD -> BatteryHealth.COLD
            else -> BatteryHealth.UNKNOWN
        }
    }

    /**
     * Get battery technology (e.g., "Li-ion")
     */
    fun getBatteryTechnology(): String? {
        val batteryIntent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))

        return batteryIntent?.getStringExtra(BatteryManager.EXTRA_TECHNOLOGY)
    }

    /**
     * Check if battery is low
     */
    fun isBatteryLow(threshold: Int = 20): Boolean {
        val level = getBatteryLevel()
        return level in 0..threshold
    }

    /**
     * Get battery status
     */
    fun getBatteryStatus(): BatteryStatus {
        val level = getBatteryLevel()
        val isCharging = isCharging()
        val health = getBatteryHealth()
        val temperature = getBatteryTemperature()
        val voltage = getBatteryVoltage()

        return BatteryStatus(
            level = level,
            isCharging = isCharging,
            isPluggedAC = isPluggedAC(),
            isPluggedUSB = isPluggedUSB(),
            isPluggedWireless = isPluggedWireless(),
            health = health,
            temperature = temperature,
            voltage = voltage,
            technology = getBatteryTechnology()
        )
    }

    /**
     * Get remaining battery capacity (Android 5.0+)
     */
    fun getRemainingCapacity(): Long {
        return batteryManager?.getLongProperty(BatteryManager.BATTERY_PROPERTY_CHARGE_COUNTER) ?: -1L
    }

    /**
     * Get average battery current (Android 5.0+)
     */
    fun getAverageCurrent(): Int {
        return batteryManager?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_AVERAGE) ?: -1
    }
}

/**
 * Battery health enum
 */
enum class BatteryHealth {
    GOOD,
    OVERHEAT,
    DEAD,
    OVER_VOLTAGE,
    UNSPECIFIED_FAILURE,
    COLD,
    UNKNOWN
}

/**
 * Battery status data class
 */
data class BatteryStatus(
    val level: Int,
    val isCharging: Boolean,
    val isPluggedAC: Boolean,
    val isPluggedUSB: Boolean,
    val isPluggedWireless: Boolean,
    val health: BatteryHealth,
    val temperature: Float,
    val voltage: Float,
    val technology: String?
) {
    val isLow: Boolean get() = level in 0..20
    val isCritical: Boolean get() = level in 0..10
    val isHealthy: Boolean get() = health == BatteryHealth.GOOD
}
