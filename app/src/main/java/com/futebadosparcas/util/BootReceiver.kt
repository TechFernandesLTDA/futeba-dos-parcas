package com.futebadosparcas.util

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * BroadcastReceiver acionado quando o dispositivo é reiniciado.
 *
 * FIX #4142: não re-agenda mais os alarmes legados (STREAK_CHECK diário e
 * WEEKLY_RECAP dominical com números hardcoded). Faz a migração inversa:
 * cancela os alarmes que sobreviveram do app anterior para que o resumo
 * semanal falso ("0 jogos e 0 XP") não reapareça após reiniciar.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == "android.intent.action.QUICKBOOT_POWERON"
        ) {
            AppLogger.d("BootReceiver") {
                "Dispositivo reiniciado — cancelando alarmes legados do SmartReminder"
            }
            LegacySmartReminderCleaner.cancelStaleAlarms(context)
        }
    }
}