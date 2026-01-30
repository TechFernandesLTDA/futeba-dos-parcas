package com.futebadosparcas.util

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Vibration Helper
 *
 * Provides utilities for haptic feedback and vibration patterns.
 *
 * Usage:
 * ```kotlin
 * @Inject lateinit var vibrationHelper: VibrationHelper
 *
 * // Short vibration for button press
 * vibrationHelper.vibrateClick()
 *
 * // Medium vibration for notifications
 * vibrationHelper.vibrateNotification()
 *
 * // Long vibration for errors
 * vibrationHelper.vibrateError()
 *
 * // Custom pattern
 * vibrationHelper.vibratePattern(longArrayOf(0, 100, 50, 100))
 * ```
 */
@Singleton
class VibrationHelper @Inject constructor(
    @ApplicationContext private val context: Context
) {

    private val vibrator: Vibrator by lazy {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vibratorManager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
    }

    /**
     * Check if device has vibrator
     */
    fun hasVibrator(): Boolean {
        return vibrator.hasVibrator()
    }

    /**
     * Short click vibration (10ms)
     */
    fun vibrateClick() {
        vibrate(10)
    }

    /**
     * Tick vibration (5ms) - for very light feedback
     */
    fun vibrateTick() {
        vibrate(5)
    }

    /**
     * Medium vibration for notifications (50ms)
     */
    fun vibrateNotification() {
        vibrate(50)
    }

    /**
     * Long vibration for errors or important events (200ms)
     */
    fun vibrateError() {
        vibrate(200)
    }

    /**
     * Success vibration pattern (double tap)
     */
    fun vibrateSuccess() {
        vibratePattern(longArrayOf(0, 50, 50, 50))
    }

    /**
     * Warning vibration pattern (triple short)
     */
    fun vibrateWarning() {
        vibratePattern(longArrayOf(0, 30, 30, 30, 30, 30))
    }

    /**
     * Game start vibration
     */
    fun vibrateGameStart() {
        vibratePattern(longArrayOf(0, 100, 100, 200))
    }

    /**
     * Goal scored vibration
     */
    fun vibrateGoalScored() {
        vibratePattern(longArrayOf(0, 50, 50, 100, 50, 150))
    }

    /**
     * Badge unlocked vibration
     */
    fun vibrateBadgeUnlocked() {
        vibratePattern(longArrayOf(0, 50, 50, 50, 50, 100))
    }

    /**
     * Level up vibration
     */
    fun vibrateLevelUp() {
        vibratePattern(longArrayOf(0, 100, 50, 100, 50, 200))
    }

    /**
     * Basic vibration for specified duration
     */
    fun vibrate(durationMs: Long) {
        if (!hasVibrator()) return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val effect = VibrationEffect.createOneShot(
                durationMs,
                VibrationEffect.DEFAULT_AMPLITUDE
            )
            vibrator.vibrate(effect)
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(durationMs)
        }
    }

    /**
     * Vibrate with custom pattern
     * Pattern format: [delay, vibrate, delay, vibrate, ...]
     */
    fun vibratePattern(pattern: LongArray, repeat: Int = -1) {
        if (!hasVibrator()) return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val effect = VibrationEffect.createWaveform(pattern, repeat)
            vibrator.vibrate(effect)
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(pattern, repeat)
        }
    }

    /**
     * Vibrate with custom amplitude (Android 8.0+)
     * Amplitude: 1-255, or VibrationEffect.DEFAULT_AMPLITUDE
     */
    fun vibrateWithAmplitude(durationMs: Long, amplitude: Int) {
        if (!hasVibrator()) return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val effect = VibrationEffect.createOneShot(durationMs, amplitude)
            vibrator.vibrate(effect)
        } else {
            vibrate(durationMs)
        }
    }

    /**
     * Predefined vibration effect (Android 10+)
     */
    fun vibrateEffect(effectId: Int) {
        if (!hasVibrator()) return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (vibrator.hasAmplitudeControl()) {
                val effect = VibrationEffect.createPredefined(effectId)
                vibrator.vibrate(effect)
            }
        }
    }

    /**
     * Heavy click effect (Android 10+)
     */
    fun vibrateHeavyClick() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            vibrateEffect(VibrationEffect.EFFECT_HEAVY_CLICK)
        } else {
            vibrate(20)
        }
    }

    /**
     * Double click effect (Android 10+)
     */
    fun vibrateDoubleClick() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            vibrateEffect(VibrationEffect.EFFECT_DOUBLE_CLICK)
        } else {
            vibratePattern(longArrayOf(0, 30, 30, 30))
        }
    }

    /**
     * Cancel all vibrations
     */
    fun cancel() {
        vibrator.cancel()
    }

    companion object {
        /**
         * Predefined effect IDs (Android 10+)
         */
        object Effects {
            const val CLICK = 0
            const val DOUBLE_CLICK = 1
            const val TICK = 2
            const val THUD = 3
            const val POP = 4
            const val HEAVY_CLICK = 5
        }

        /**
         * Common vibration durations
         */
        object Durations {
            const val TICK = 5L
            const val CLICK = 10L
            const val LIGHT = 20L
            const val MEDIUM = 50L
            const val LONG = 100L
            const val VERY_LONG = 200L
        }
    }
}
