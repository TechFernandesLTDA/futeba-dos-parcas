package com.futebadosparcas.util

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.edit
import com.futebadosparcas.R
import java.time.DayOfWeek
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import java.util.Calendar

/**
 * Sistema de lembretes inteligentes que aprende com o comportamento do usuário.
 * Envia notificações personalizadas baseadas em padrões de uso e preferências.
 */
class SmartReminderHelper constructor(
    private val context: Context
) {
    companion object {
        private const val TAG = "SmartReminderHelper"

        // Channel IDs
        const val CHANNEL_GAME_REMINDERS = "game_reminders"
        const val CHANNEL_STREAK_ALERTS = "streak_alerts"
        const val CHANNEL_SOCIAL_NUDGES = "social_nudges"
        const val CHANNEL_ACHIEVEMENTS = "achievements"

        // Notification IDs
        private const val NOTIFICATION_GAME_REMINDER = 1001
        private const val NOTIFICATION_STREAK_WARNING = 1002
        private const val NOTIFICATION_WEEKLY_RECAP = 1003
        private const val NOTIFICATION_FRIEND_PLAYING = 1004
        private const val NOTIFICATION_ACHIEVEMENT = 1005

        // SharedPreferences keys
        private const val PREFS_NAME = "smart_reminders"
        private const val KEY_PREFERRED_DAYS = "preferred_days"
        private const val KEY_PREFERRED_TIMES = "preferred_times"
        private const val KEY_LAST_GAME_DATE = "last_game_date"
        private const val KEY_CURRENT_STREAK = "current_streak"
        private const val KEY_GAME_HISTORY = "game_history"
    }

    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    private val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    init {
        createNotificationChannels()
    }

    // ==================== Notification Channels ====================

    /**
     * Cria os canais de notificação necessários.
     */
    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channels = listOf(
                NotificationChannel(
                    CHANNEL_GAME_REMINDERS,
                    "Lembretes de Jogos",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Notificações sobre jogos agendados"
                },
                NotificationChannel(
                    CHANNEL_STREAK_ALERTS,
                    "Alertas de Sequência",
                    NotificationManager.IMPORTANCE_DEFAULT
                ).apply {
                    description = "Alertas quando sua sequência está em risco"
                },
                NotificationChannel(
                    CHANNEL_SOCIAL_NUDGES,
                    "Sugestões Sociais",
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "Notificações quando amigos estão jogando"
                },
                NotificationChannel(
                    CHANNEL_ACHIEVEMENTS,
                    "Conquistas",
                    NotificationManager.IMPORTANCE_DEFAULT
                ).apply {
                    description = "Notificações de conquistas e milestones"
                }
            )

            channels.forEach { notificationManager.createNotificationChannel(it) }
        }
    }

    // ==================== Learning User Patterns ====================

    /**
     * Dados de comportamento do usuário.
     */
    data class UserBehavior(
        val preferredDays: List<DayOfWeek>,
        val preferredTimeSlots: List<TimeSlot>,
        val averageGamesPerWeek: Float,
        val currentStreak: Int,
        val lastGameDate: LocalDateTime?,
        val topPartners: List<String>
    )

    /**
     * Slot de tempo preferido.
     */
    data class TimeSlot(
        val start: LocalTime,
        val end: LocalTime,
        val frequency: Int // Quantidade de jogos nesse horário
    )

    /**
     * Registra que o usuário jogou em determinada data/hora.
     */
    fun recordGamePlayed(gameDateTime: LocalDateTime) {
        // Atualiza dia preferido
        val dayOfWeek = gameDateTime.dayOfWeek
        val currentDays = getPreferredDays().toMutableList()
        if (!currentDays.contains(dayOfWeek)) {
            currentDays.add(dayOfWeek)
            savePreferredDays(currentDays)
        }

        // Atualiza horário preferido
        val hour = gameDateTime.hour
        val currentTimes = getPreferredTimeSlots().toMutableMap()
        currentTimes[hour] = (currentTimes[hour] ?: 0) + 1
        savePreferredTimes(currentTimes)

        // Atualiza última data de jogo
        saveLastGameDate(gameDateTime)

        // Atualiza streak
        updateStreak(gameDateTime)

        AppLogger.d(TAG) { "Jogo registrado: $gameDateTime" }
    }

    /**
     * Atualiza a sequência de jogos.
     */
    private fun updateStreak(gameDateTime: LocalDateTime) {
        val lastGame = getLastGameDate()
        val currentStreak = getCurrentStreak()

        if (lastGame == null) {
            saveCurrentStreak(1)
            return
        }

        val daysBetween = ChronoUnit.DAYS.between(lastGame.toLocalDate(), gameDateTime.toLocalDate())

        when {
            daysBetween <= 7 -> saveCurrentStreak(currentStreak + 1)
            else -> saveCurrentStreak(1) // Reset streak
        }
    }

    /**
     * Obtém o comportamento aprendido do usuário.
     */
    fun getUserBehavior(): UserBehavior {
        return UserBehavior(
            preferredDays = getPreferredDays(),
            preferredTimeSlots = getTopTimeSlots(),
            averageGamesPerWeek = calculateAverageGamesPerWeek(),
            currentStreak = getCurrentStreak(),
            lastGameDate = getLastGameDate(),
            topPartners = emptyList() // TODO: Implementar busca de parceiros
        )
    }

    // ==================== Smart Reminders ====================

    /**
     * Tipos de lembretes inteligentes.
     */
    sealed class SmartReminder {
        data class GameToday(
            val gameId: String,
            val gameName: String,
            val time: String,
            val location: String
        ) : SmartReminder()

        data class StreakAtRisk(
            val currentStreak: Int,
            val daysUntilLoss: Int
        ) : SmartReminder()

        data class WeeklyRecap(
            val gamesPlayed: Int,
            val xpEarned: Int,
            val weekNumber: Int
        ) : SmartReminder()

        data class FriendPlaying(
            val friendName: String,
            val gameId: String,
            val gameName: String
        ) : SmartReminder()

        data class MilestoneClose(
            val milestoneName: String,
            val currentValue: Int,
            val targetValue: Int
        ) : SmartReminder()

        data class SuggestGame(
            val dayOfWeek: DayOfWeek,
            val timeSlot: TimeSlot,
            val reason: String
        ) : SmartReminder()
    }

    /**
     * Gera lembretes inteligentes baseados no contexto.
     */
    fun generateSmartReminders(): List<SmartReminder> {
        val reminders = mutableListOf<SmartReminder>()
        val behavior = getUserBehavior()
        val now = LocalDateTime.now()

        // 1. Verifica se streak está em risco
        behavior.lastGameDate?.let { lastGame ->
            val daysSinceLastGame = ChronoUnit.DAYS.between(lastGame.toLocalDate(), now.toLocalDate()).toInt()
            if (daysSinceLastGame >= 5 && behavior.currentStreak > 3) {
                reminders.add(
                    SmartReminder.StreakAtRisk(
                        currentStreak = behavior.currentStreak,
                        daysUntilLoss = 7 - daysSinceLastGame
                    )
                )
            }
        }

        // 2. Sugere dia para jogar baseado no histórico
        val today = now.dayOfWeek
        if (behavior.preferredDays.contains(today)) {
            val topTimeSlot = behavior.preferredTimeSlots.maxByOrNull { it.frequency }
            topTimeSlot?.let {
                reminders.add(
                    SmartReminder.SuggestGame(
                        dayOfWeek = today,
                        timeSlot = it,
                        reason = "Você costuma jogar ${today.getDisplayName()} às ${it.start}"
                    )
                )
            }
        }

        return reminders
    }

    // ==================== Notifications ====================

    /**
     * Envia notificação de lembrete de jogo.
     */
    fun sendGameReminderNotification(
        gameId: String,
        gameName: String,
        time: String,
        location: String,
        minutesBefore: Int = 60
    ) {
        val notification = NotificationCompat.Builder(context, CHANNEL_GAME_REMINDERS)
            .setSmallIcon(R.drawable.ic_football)
            .setContentTitle("⚽ Jogo em $minutesBefore minutos!")
            .setContentText("$gameName às $time em $location")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .build()

        notificationManager.notify(NOTIFICATION_GAME_REMINDER, notification)
    }

    /**
     * Envia notificação de streak em risco.
     */
    fun sendStreakWarningNotification(currentStreak: Int, daysRemaining: Int) {
        val notification = NotificationCompat.Builder(context, CHANNEL_STREAK_ALERTS)
            .setSmallIcon(R.drawable.ic_fire)
            .setContentTitle("🔥 Sua sequência está em risco!")
            .setContentText("Você tem $daysRemaining dias para manter sua sequência de $currentStreak jogos")
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build()

        notificationManager.notify(NOTIFICATION_STREAK_WARNING, notification)
    }

    /**
     * Envia notificação de resumo semanal.
     */
    fun sendWeeklyRecapNotification(gamesPlayed: Int, xpEarned: Int) {
        val notification = NotificationCompat.Builder(context, CHANNEL_ACHIEVEMENTS)
            .setSmallIcon(R.drawable.ic_trophy)
            .setContentTitle("📊 Seu resumo semanal está pronto!")
            .setContentText("Você jogou $gamesPlayed jogos e ganhou $xpEarned XP")
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build()

        notificationManager.notify(NOTIFICATION_WEEKLY_RECAP, notification)
    }

    /**
     * Envia notificação quando amigo está jogando.
     */
    fun sendFriendPlayingNotification(friendName: String, gameName: String) {
        val notification = NotificationCompat.Builder(context, CHANNEL_SOCIAL_NUDGES)
            .setSmallIcon(R.drawable.ic_person)
            .setContentTitle("👥 $friendName está jogando!")
            .setContentText("$friendName confirmou presença em $gameName")
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setAutoCancel(true)
            .build()

        notificationManager.notify(NOTIFICATION_FRIEND_PLAYING, notification)
    }

    /**
     * Envia notificação de conquista próxima.
     */
    fun sendMilestoneCloseNotification(milestoneName: String, current: Int, target: Int) {
        val remaining = target - current
        val notification = NotificationCompat.Builder(context, CHANNEL_ACHIEVEMENTS)
            .setSmallIcon(R.drawable.ic_trophy)
            .setContentTitle("🏆 Quase lá!")
            .setContentText("Faltam apenas $remaining para conquistar \"$milestoneName\"")
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build()

        notificationManager.notify(NOTIFICATION_ACHIEVEMENT, notification)
    }

    // ==================== Scheduled Reminders ====================

    /**
     * Agenda lembrete para jogo futuro.
     */
    fun scheduleGameReminder(
        gameId: String,
        gameDateTime: LocalDateTime,
        gameName: String,
        location: String,
        minutesBefore: Int = 60
    ) {
        val reminderTime = gameDateTime.minusMinutes(minutesBefore.toLong())

        if (reminderTime.isBefore(LocalDateTime.now())) {
            return // Jogo já passou ou muito próximo
        }

        val intent = Intent().apply {
            setClass(context, ReminderBroadcastReceiver::class.java)
            setPackage(context.packageName)
            action = "GAME_REMINDER"
            putExtra("game_id", gameId)
            putExtra("game_name", gameName)
            putExtra("game_time", gameDateTime.toString())
            putExtra("location", location)
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context,
            gameId.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val triggerTime = reminderTime
            .atZone(ZoneId.systemDefault())
            .toInstant()
            .toEpochMilli()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (alarmManager.canScheduleExactAlarms()) {
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    triggerTime,
                    pendingIntent
                )
            } else {
                alarmManager.setAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    triggerTime,
                    pendingIntent
                )
            }
        } else {
            alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                triggerTime,
                pendingIntent
            )
        }

        AppLogger.d(TAG) { "Lembrete agendado para $gameName em $reminderTime" }
    }

    /**
     * Cancela lembrete de jogo.
     */
    fun cancelGameReminder(gameId: String) {
        val intent = Intent().apply {
            setClass(context, ReminderBroadcastReceiver::class.java)
            setPackage(context.packageName)
            action = "GAME_REMINDER"
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            gameId.hashCode(),
            intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )
        pendingIntent?.let { alarmManager.cancel(it); it.cancel() }
        AppLogger.d(TAG) { "Lembrete cancelado para jogo $gameId" }
    }

    /**
     * Agenda verificação diária de streak.
     */
    fun scheduleDailyStreakCheck() {
        val calendar = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 20) // 8 PM
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)

            if (timeInMillis < System.currentTimeMillis()) {
                add(Calendar.DAY_OF_YEAR, 1)
            }
        }

        val intent = Intent().apply {
            setClass(context, ReminderBroadcastReceiver::class.java)
            setPackage(context.packageName)
            action = "STREAK_CHECK"
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context,
            NOTIFICATION_STREAK_WARNING,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        alarmManager.setRepeating(
            AlarmManager.RTC_WAKEUP,
            calendar.timeInMillis,
            AlarmManager.INTERVAL_DAY,
            pendingIntent
        )

        AppLogger.d(TAG) { "Verificação diária de streak agendada para 20:00" }
    }

    /**
     * Agenda resumo semanal (domingo às 20h).
     */
    fun scheduleWeeklyRecap() {
        val calendar = Calendar.getInstance().apply {
            set(Calendar.DAY_OF_WEEK, Calendar.SUNDAY)
            set(Calendar.HOUR_OF_DAY, 20)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)

            if (timeInMillis < System.currentTimeMillis()) {
                add(Calendar.WEEK_OF_YEAR, 1)
            }
        }

        val intent = Intent().apply {
            setClass(context, ReminderBroadcastReceiver::class.java)
            setPackage(context.packageName)
            action = "WEEKLY_RECAP"
        }

        val pendingIntent = PendingIntent.getBroadcast(
            context,
            NOTIFICATION_WEEKLY_RECAP,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        alarmManager.setRepeating(
            AlarmManager.RTC_WAKEUP,
            calendar.timeInMillis,
            AlarmManager.INTERVAL_DAY * 7,
            pendingIntent
        )

        AppLogger.d(TAG) { "Resumo semanal agendado para domingo às 20:00" }
    }

    // ==================== Preferences ====================

    private fun getPreferredDays(): List<DayOfWeek> {
        val daysString = prefs.getString(KEY_PREFERRED_DAYS, "") ?: ""
        return if (daysString.isEmpty()) {
            emptyList()
        } else {
            daysString.split(",").mapNotNull { runCatching { DayOfWeek.valueOf(it) }.getOrNull() }
        }
    }

    private fun savePreferredDays(days: List<DayOfWeek>) {
        prefs.edit { putString(KEY_PREFERRED_DAYS, days.joinToString(",") { it.name }) }
    }

    private fun getPreferredTimeSlots(): Map<Int, Int> {
        val timesString = prefs.getString(KEY_PREFERRED_TIMES, "") ?: ""
        return if (timesString.isEmpty()) {
            emptyMap()
        } else {
            timesString.split(",")
                .mapNotNull { entry ->
                    val parts = entry.split(":")
                    if (parts.size == 2) {
                        parts[0].toIntOrNull()?.let { hour ->
                            parts[1].toIntOrNull()?.let { count ->
                                hour to count
                            }
                        }
                    } else null
                }
                .toMap()
        }
    }

    private fun savePreferredTimes(times: Map<Int, Int>) {
        val timesString = times.entries.joinToString(",") { "${it.key}:${it.value}" }
        prefs.edit { putString(KEY_PREFERRED_TIMES, timesString) }
    }

    private fun getTopTimeSlots(): List<TimeSlot> {
        return getPreferredTimeSlots()
            .toList()
            .sortedByDescending { it.second }
            .take(3)
            .map { (hour, count) ->
                TimeSlot(
                    start = LocalTime.of(hour, 0),
                    end = LocalTime.of(hour, 59),
                    frequency = count
                )
            }
    }

    private fun getLastGameDate(): LocalDateTime? {
        val dateString = prefs.getString(KEY_LAST_GAME_DATE, null) ?: return null
        return runCatching { LocalDateTime.parse(dateString) }.getOrNull()
    }

    private fun saveLastGameDate(date: LocalDateTime) {
        prefs.edit { putString(KEY_LAST_GAME_DATE, date.toString()) }
    }

    private fun getCurrentStreak(): Int {
        return prefs.getInt(KEY_CURRENT_STREAK, 0)
    }

    private fun saveCurrentStreak(streak: Int) {
        prefs.edit { putInt(KEY_CURRENT_STREAK, streak) }
    }

    private fun calculateAverageGamesPerWeek(): Float {
        // TODO: Implementar cálculo baseado no histórico
        return 2.5f
    }

    // ==================== Extension Functions ====================

    private fun DayOfWeek.getDisplayName(): String {
        return when (this) {
            DayOfWeek.MONDAY -> "segunda"
            DayOfWeek.TUESDAY -> "terça"
            DayOfWeek.WEDNESDAY -> "quarta"
            DayOfWeek.THURSDAY -> "quinta"
            DayOfWeek.FRIDAY -> "sexta"
            DayOfWeek.SATURDAY -> "sábado"
            DayOfWeek.SUNDAY -> "domingo"
        }
    }
}

/**
 * BroadcastReceiver para processar lembretes agendados.
 */
class ReminderBroadcastReceiver : android.content.BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        // TODO: Injetar SmartReminderHelper via Hilt
        // Por enquanto, criar instância direta
        val reminderHelper = SmartReminderHelper(context)

        when (intent.action) {
            "GAME_REMINDER" -> {
                val gameName = intent.getStringExtra("game_name") ?: "Jogo"
                val gameTime = intent.getStringExtra("game_time") ?: ""
                val location = intent.getStringExtra("location") ?: ""

                reminderHelper.sendGameReminderNotification(
                    gameId = intent.getStringExtra("game_id") ?: "",
                    gameName = gameName,
                    time = gameTime,
                    location = location
                )
            }
            "STREAK_CHECK" -> {
                val behavior = reminderHelper.getUserBehavior()
                val lastGame = behavior.lastGameDate

                if (lastGame != null) {
                    val daysSinceLastGame = java.time.temporal.ChronoUnit.DAYS.between(
                        lastGame.toLocalDate(),
                        java.time.LocalDateTime.now().toLocalDate()
                    ).toInt()

                    if (daysSinceLastGame >= 5 && behavior.currentStreak > 3) {
                        reminderHelper.sendStreakWarningNotification(
                            currentStreak = behavior.currentStreak,
                            daysRemaining = 7 - daysSinceLastGame
                        )
                    }
                }
            }
            "WEEKLY_RECAP" -> {
                reminderHelper.sendWeeklyRecapNotification(
                    gamesPlayed = 0, // TODO: Buscar dados reais
                    xpEarned = 0
                )
            }
        }
    }
}
