package com.futebadosparcas.util

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * FIX #4142: utilitário para limpar alarmes legados do "SmartReminder".
 *
 * Histórico: SmartReminderHelper agendava (via BootReceiver) um
 * `STREAK_CHECK` diário e um `WEEKLY_RECAP` dominical com números
 * hardcoded (0 jogos / 0 XP, sem contentIntent, fora de strings.xml).
 * Nenhum método tinha chamadores reais — o resumo semanal falso se
 * repetia toda semana após reiniciar o celular. O resumo real passa a
 * ser responsabilidade do servidor (padrão dos nudges de
 * gamification-nudges.ts), que tem xp_logs/games e notification_settings.
 */
object LegacySmartReminderCleaner {
    private const val ACTION_WEEKLY_RECAP = "WEEKLY_RECAP"
    private const val ACTION_STREAK_CHECK = "STREAK_CHECK"

    /**
     * Cancela os alarmes legados já agendados (idempotente). Roda no
     * BOOT_COMPLETED como migração de versão: quem tinha o alarme
     * dominical deixa de receber a notificação com números inventados.
     */
    fun cancelStaleAlarms(context: Context) {
        val alarmManager =
            context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        listOf(ACTION_WEEKLY_RECAP, ACTION_STREAK_CHECK).forEach { action ->
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                action.hashCode(),
                Intent(context, ReminderBroadcastReceiver::class.java)
                    .setAction(action),
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
            )
            if (pendingIntent != null) {
                alarmManager.cancel(pendingIntent)
                pendingIntent.cancel()
                AppLogger.d("LegacySmartReminderCleaner") {
                    "Alarme legado $action cancelado"
                }
            }
        }
    }
}

/**
 * Receiver mantido apenas como alvo do cancelamento dos alarmes legados
 * (o PendingIntent precisa apontar para o mesmo componente da época em
 * que o alarme foi criado). Não agenda nada novo.
 */
class ReminderBroadcastReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        // FIX #4142: nenhum alarme é re-agendado — apenas no-op.
        AppLogger.d("ReminderBroadcastReceiver") {
            "Alarme legado recebido (${intent.action}) — ignorado"
        }
    }
}