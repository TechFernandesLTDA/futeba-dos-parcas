package com.futebadosparcas.platform

import android.annotation.SuppressLint
import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

/**
 * Implementação Android de HapticFeedback usando Vibrator/VibratorManager
 */
class AndroidHapticFeedback(private val context: Context) : HapticFeedback {

    private val vibrator: Vibrator by lazy {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vibratorManager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
        }
    }

    @SuppressLint("MissingPermission") // VIBRATE permission declared in AndroidManifest
    override fun vibrate(durationMs: Long) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(durationMs, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(durationMs)
        }
    }

    @SuppressLint("MissingPermission") // VIBRATE permission declared in AndroidManifest
    override fun vibratePattern(pattern: LongArray) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1))
        } else {
            @Suppress("DEPRECATION")
            vibrator.vibrate(pattern, -1)
        }
    }

    @SuppressLint("MissingPermission") // VIBRATE permission declared in AndroidManifest
    override fun light() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK))
        } else {
            vibrate(10L)
        }
    }

    @SuppressLint("MissingPermission") // VIBRATE permission declared in AndroidManifest
    override fun medium() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK))
        } else {
            vibrate(25L)
        }
    }

    @SuppressLint("MissingPermission") // VIBRATE permission declared in AndroidManifest
    override fun heavy() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_HEAVY_CLICK))
        } else {
            vibrate(50L)
        }
    }

    override fun success() {
        vibratePattern(longArrayOf(0, 50, 50, 50))
    }

    override fun error() {
        vibratePattern(longArrayOf(0, 100, 50, 100, 50, 100))
    }

    override fun warning() {
        vibratePattern(longArrayOf(0, 75, 50, 75))
    }
}

/**
 * Factory Android - requer Context
 */
actual object HapticFeedbackFactory {
    private var contextProvider: (() -> Context)? = null

    /**
     * Inicializar com um Context provider (deve ser chamado no Application.onCreate())
     */
    fun initialize(provider: () -> Context) {
        contextProvider = provider
    }

    actual fun create(): HapticFeedback {
        val context = contextProvider?.invoke()
            ?: throw IllegalStateException("HapticFeedbackFactory não foi inicializado. Chame initialize() no Application.onCreate()")
        return AndroidHapticFeedback(context)
    }
}
