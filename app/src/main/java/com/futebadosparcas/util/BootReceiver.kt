package com.futebadosparcas.util

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * BroadcastReceiver que é acionado quando o dispositivo é reiniciado.
 * Responsável por re-agendar os alarmes de lembretes inteligentes.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == "android.intent.action.QUICKBOOT_POWERON"
        ) {
            AppLogger.d("BootReceiver") { "Dispositivo reiniciado - re-agendando lembretes" }

            // Re-agenda lembretes periódicos
            val reminderHelper = SmartReminderHelper(context)
            reminderHelper.scheduleDailyStreakCheck()
            reminderHelper.scheduleWeeklyRecap()

            // TODO: Re-agendar lembretes de jogos futuros do usuário
            // Isso requer buscar jogos confirmados do Firestore
            // e re-agendar os alarmes para cada um
        }
    }
}
