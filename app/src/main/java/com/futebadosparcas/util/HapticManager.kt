package com.futebadosparcas.util

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Gerenciador de feedback háptico com suporte para APIs modernas (Android 13+).
 *
 * Usa VibratorManager para API 31+ e VibrationEffect para API 26+.
 * Mantém compatibilidade com API 24+ (minSdk do projeto).
 */
@Singleton
class HapticManager @Inject constructor(
    private val context: Context
) {
    private val vibrator: Vibrator? by lazy {
        getVibrator(context)
    }

    /**
     * Obtém instância do Vibrator de acordo com a versão da API.
     * API 31+ usa VibratorManager, versões anteriores usam serviço direto.
     */
    private fun getVibrator(context: Context): Vibrator? {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
            vibratorManager?.defaultVibrator
        } else {
            context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }

    /**
     * Feedback tátil suave para cliques simples ou seleções.
     */
    fun tick() {
        val vibrator = this.vibrator ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(10, VibrationEffect.DEFAULT_AMPLITUDE))
        } else {
            vibratorTickPreO(vibrator)
        }
    }

    /**
     * Feedback para ganho de XP (estilo pulsação rítmica).
     */
    fun xpGain() {
        val vibrator = this.vibrator ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val timings = longArrayOf(0, 10, 50, 10)
            val amplitudes = intArrayOf(0, 100, 0, 150)
            vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
        } else {
            vibratorXpGainPreO(vibrator)
        }
    }

    /**
     * Feedback intenso para momentos de celebração como Subir de Nível.
     */
    fun levelUp() {
        val vibrator = this.vibrator ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val timings = longArrayOf(0, 100, 100, 100, 100, 200)
            val amplitudes = intArrayOf(0, 255, 0, 255, 0, 255)
            vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
        } else {
            vibratorLevelUpPreO(vibrator)
        }
    }

    /**
     * Feedback de erro ou ação falha.
     */
    fun error() {
        val vibrator = this.vibrator ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val timings = longArrayOf(0, 50, 50, 50)
            val amplitudes = intArrayOf(0, 200, 0, 200)
            vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
        } else {
            vibratorErrorPreO(vibrator)
        }
    }

    // ========== Métodos legados para API < 26 (Android O) ==========

    @Suppress("DEPRECATION")
    private fun vibratorTickPreO(vibrator: Vibrator) {
        vibrator.vibrate(10)
    }

    @Suppress("DEPRECATION")
    private fun vibratorXpGainPreO(vibrator: Vibrator) {
        vibrator.vibrate(50)
    }

    @Suppress("DEPRECATION")
    private fun vibratorLevelUpPreO(vibrator: Vibrator) {
        vibrator.vibrate(longArrayOf(0, 100, 100, 100), -1)
    }

    @Suppress("DEPRECATION")
    private fun vibratorErrorPreO(vibrator: Vibrator) {
        vibrator.vibrate(longArrayOf(0, 50, 50, 50), -1)
    }
}
