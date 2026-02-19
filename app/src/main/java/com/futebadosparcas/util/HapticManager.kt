package com.futebadosparcas.util

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

/**
 * Gerenciador de feedback háptico com suporte para APIs modernas (Android 13+).
 *
 * Usa VibratorManager para API 31+ e VibrationEffect para API 26+.
 * Mantém compatibilidade com API 24+ (minSdk do projeto).
 */
class HapticManager constructor(
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

    // ========== Novos Padrões Contextuais ==========

    /**
     * Feedback para gol marcado - celebração intensa.
     */
    fun goal() {
        val vibrator = this.vibrator ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Padrão de celebração: crescente + explosão
            val timings = longArrayOf(0, 50, 30, 80, 30, 150)
            val amplitudes = intArrayOf(0, 100, 0, 180, 0, 255)
            vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
        } else {
            vibratorGoalPreO(vibrator)
        }
    }

    /**
     * Feedback para assistência - mais suave que gol.
     */
    fun assist() {
        val vibrator = this.vibrator ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val timings = longArrayOf(0, 30, 40, 60)
            val amplitudes = intArrayOf(0, 120, 0, 180)
            vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
        } else {
            vibratorAssistPreO(vibrator)
        }
    }

    /**
     * Feedback para defesa do goleiro.
     */
    fun save() {
        val vibrator = this.vibrator ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Impacto forte + eco
            val timings = longArrayOf(0, 80, 50, 30)
            val amplitudes = intArrayOf(0, 255, 0, 100)
            vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
        } else {
            vibratorSavePreO(vibrator)
        }
    }

    /**
     * Feedback para cartão amarelo - alerta.
     */
    fun yellowCard() {
        val vibrator = this.vibrator ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val timings = longArrayOf(0, 100, 80, 100)
            val amplitudes = intArrayOf(0, 180, 0, 180)
            vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
        } else {
            vibratorCardPreO(vibrator)
        }
    }

    /**
     * Feedback para cartão vermelho - intenso.
     */
    fun redCard() {
        val vibrator = this.vibrator ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val timings = longArrayOf(0, 150, 50, 150, 50, 200)
            val amplitudes = intArrayOf(0, 255, 0, 255, 0, 255)
            vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
        } else {
            vibratorRedCardPreO(vibrator)
        }
    }

    /**
     * Feedback para conquista de badge.
     */
    fun badge() {
        val vibrator = this.vibrator ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Fanfarra: crescendo
            val timings = longArrayOf(0, 30, 30, 50, 30, 80, 30, 120)
            val amplitudes = intArrayOf(0, 80, 0, 120, 0, 180, 0, 255)
            vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
        } else {
            vibratorBadgePreO(vibrator)
        }
    }

    /**
     * Feedback para MVP recebido - especial.
     */
    fun mvp() {
        val vibrator = this.vibrator ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Tripla pulsação de celebração
            val timings = longArrayOf(0, 100, 80, 100, 80, 100, 80, 200)
            val amplitudes = intArrayOf(0, 200, 0, 220, 0, 240, 0, 255)
            vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
        } else {
            vibratorMvpPreO(vibrator)
        }
    }

    /**
     * Feedback para confirmação de presença.
     */
    fun confirm() {
        val vibrator = this.vibrator ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Confirmação suave dupla
            val timings = longArrayOf(0, 20, 60, 40)
            val amplitudes = intArrayOf(0, 150, 0, 200)
            vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
        } else {
            vibratorConfirmPreO(vibrator)
        }
    }

    /**
     * Feedback para cancelamento.
     */
    fun cancel() {
        val vibrator = this.vibrator ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(80, 150))
        } else {
            vibratorCancelPreO(vibrator)
        }
    }

    /**
     * Feedback para notificação importante.
     */
    fun notification() {
        val vibrator = this.vibrator ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val timings = longArrayOf(0, 50, 100, 50)
            val amplitudes = intArrayOf(0, 180, 0, 180)
            vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
        } else {
            vibratorNotificationPreO(vibrator)
        }
    }

    /**
     * Feedback para drag start (arrastar jogador).
     */
    fun dragStart() {
        val vibrator = this.vibrator ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(15, 120))
        } else {
            vibratorTickPreO(vibrator)
        }
    }

    /**
     * Feedback para drop (soltar jogador no time).
     */
    fun drop() {
        val vibrator = this.vibrator ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(30, 180))
        } else {
            vibratorDropPreO(vibrator)
        }
    }

    /**
     * Feedback para shuffle de times (sorteio).
     */
    fun shuffle() {
        val vibrator = this.vibrator ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Sequência rápida simulando embaralhamento
            val timings = longArrayOf(0, 15, 30, 15, 30, 15, 30, 15, 50, 80)
            val amplitudes = intArrayOf(0, 80, 0, 100, 0, 120, 0, 140, 0, 200)
            vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
        } else {
            vibratorShufflePreO(vibrator)
        }
    }

    /**
     * Feedback para countdown/timer.
     */
    fun countdown() {
        val vibrator = this.vibrator ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(25, 100))
        } else {
            vibratorTickPreO(vibrator)
        }
    }

    /**
     * Feedback para início de jogo.
     */
    fun gameStart() {
        val vibrator = this.vibrator ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Apito de início
            val timings = longArrayOf(0, 300)
            val amplitudes = intArrayOf(0, 200)
            vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
        } else {
            vibratorGameStartPreO(vibrator)
        }
    }

    /**
     * Feedback para fim de jogo.
     */
    fun gameEnd() {
        val vibrator = this.vibrator ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            // Triplo apito final
            val timings = longArrayOf(0, 200, 100, 200, 100, 400)
            val amplitudes = intArrayOf(0, 200, 0, 200, 0, 255)
            vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
        } else {
            vibratorGameEndPreO(vibrator)
        }
    }

    /**
     * Feedback leve para swipe/scroll.
     */
    fun lightTick() {
        val vibrator = this.vibrator ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(VibrationEffect.createOneShot(5, 50))
        } else {
            // Muito leve para APIs antigas
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

    @Suppress("DEPRECATION")
    private fun vibratorGoalPreO(vibrator: Vibrator) {
        vibrator.vibrate(longArrayOf(0, 50, 30, 80, 30, 150), -1)
    }

    @Suppress("DEPRECATION")
    private fun vibratorAssistPreO(vibrator: Vibrator) {
        vibrator.vibrate(longArrayOf(0, 30, 40, 60), -1)
    }

    @Suppress("DEPRECATION")
    private fun vibratorSavePreO(vibrator: Vibrator) {
        vibrator.vibrate(longArrayOf(0, 80, 50, 30), -1)
    }

    @Suppress("DEPRECATION")
    private fun vibratorCardPreO(vibrator: Vibrator) {
        vibrator.vibrate(longArrayOf(0, 100, 80, 100), -1)
    }

    @Suppress("DEPRECATION")
    private fun vibratorRedCardPreO(vibrator: Vibrator) {
        vibrator.vibrate(longArrayOf(0, 150, 50, 150, 50, 200), -1)
    }

    @Suppress("DEPRECATION")
    private fun vibratorBadgePreO(vibrator: Vibrator) {
        vibrator.vibrate(longArrayOf(0, 30, 30, 50, 30, 80, 30, 120), -1)
    }

    @Suppress("DEPRECATION")
    private fun vibratorMvpPreO(vibrator: Vibrator) {
        vibrator.vibrate(longArrayOf(0, 100, 80, 100, 80, 100, 80, 200), -1)
    }

    @Suppress("DEPRECATION")
    private fun vibratorConfirmPreO(vibrator: Vibrator) {
        vibrator.vibrate(longArrayOf(0, 20, 60, 40), -1)
    }

    @Suppress("DEPRECATION")
    private fun vibratorCancelPreO(vibrator: Vibrator) {
        vibrator.vibrate(80)
    }

    @Suppress("DEPRECATION")
    private fun vibratorNotificationPreO(vibrator: Vibrator) {
        vibrator.vibrate(longArrayOf(0, 50, 100, 50), -1)
    }

    @Suppress("DEPRECATION")
    private fun vibratorDropPreO(vibrator: Vibrator) {
        vibrator.vibrate(30)
    }

    @Suppress("DEPRECATION")
    private fun vibratorShufflePreO(vibrator: Vibrator) {
        vibrator.vibrate(longArrayOf(0, 15, 30, 15, 30, 15, 30, 15, 50, 80), -1)
    }

    @Suppress("DEPRECATION")
    private fun vibratorGameStartPreO(vibrator: Vibrator) {
        vibrator.vibrate(300)
    }

    @Suppress("DEPRECATION")
    private fun vibratorGameEndPreO(vibrator: Vibrator) {
        vibrator.vibrate(longArrayOf(0, 200, 100, 200, 100, 400), -1)
    }
}
