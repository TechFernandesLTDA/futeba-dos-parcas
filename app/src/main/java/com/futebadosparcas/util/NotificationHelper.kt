package com.futebadosparcas.util

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.futebadosparcas.R
import com.futebadosparcas.ui.main.MainActivityCompose
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Notification Helper
 *
 * Centralized notification creation and channel management.
 * Provides type-safe notification builders for different scenarios.
 *
 * Usage:
 * ```kotlin
 * @Inject lateinit var notificationHelper: NotificationHelper
 *
 * notificationHelper.showGameNotification(
 *     title = "Novo jogo criado!",
 *     message = "Quinta-feira às 20h",
 *     gameId = gameId
 * )
 * ```
 */
@Singleton
class NotificationHelper @Inject constructor(
    @ApplicationContext private val context: Context
) {

    private val notificationManager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    companion object {
        const val CHANNEL_GAMES = "games_channel"
        const val CHANNEL_SOCIAL = "social_channel"
        const val CHANNEL_ACHIEVEMENTS = "achievements_channel"
        const val CHANNEL_REMINDERS = "reminders_channel"

        const val NOTIFICATION_ID_GAME = 1000
        const val NOTIFICATION_ID_SOCIAL = 2000
        const val NOTIFICATION_ID_ACHIEVEMENT = 3000
        const val NOTIFICATION_ID_REMINDER = 4000
    }

    init {
        createNotificationChannels()
    }

    /**
     * Create all notification channels (Android 8.0+)
     */
    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channels = listOf(
                NotificationChannel(
                    CHANNEL_GAMES,
                    "Jogos",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Notificações sobre jogos e confirmações"
                },
                NotificationChannel(
                    CHANNEL_SOCIAL,
                    "Social",
                    NotificationManager.IMPORTANCE_DEFAULT
                ).apply {
                    description = "Convites de grupo e interações sociais"
                },
                NotificationChannel(
                    CHANNEL_ACHIEVEMENTS,
                    "Conquistas",
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "Badges desbloqueadas e progressão"
                },
                NotificationChannel(
                    CHANNEL_REMINDERS,
                    "Lembretes",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Lembretes de jogos próximos"
                }
            )

            notificationManager.createNotificationChannels(channels)
        }
    }

    /**
     * Show game-related notification
     */
    fun showGameNotification(
        title: String,
        message: String,
        gameId: String? = null
    ) {
        val intent = Intent(context, MainActivityCompose::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            gameId?.let { putExtra("gameId", it) }
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            NOTIFICATION_ID_GAME,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_GAMES)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        notificationManager.notify(NOTIFICATION_ID_GAME, notification)
    }

    /**
     * Show social notification (invites, group joins, etc.)
     */
    fun showSocialNotification(
        title: String,
        message: String
    ) {
        val intent = Intent(context, MainActivityCompose::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            NOTIFICATION_ID_SOCIAL,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_SOCIAL)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        notificationManager.notify(NOTIFICATION_ID_SOCIAL, notification)
    }

    /**
     * Show achievement notification
     */
    fun showAchievementNotification(
        title: String,
        message: String
    ) {
        val intent = Intent(context, MainActivityCompose::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            putExtra("openBadges", true)
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            NOTIFICATION_ID_ACHIEVEMENT,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ACHIEVEMENTS)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .build()

        notificationManager.notify(NOTIFICATION_ID_ACHIEVEMENT, notification)
    }

    /**
     * Show reminder notification
     */
    fun showReminderNotification(
        title: String,
        message: String,
        gameId: String? = null
    ) {
        val intent = Intent(context, MainActivityCompose::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            gameId?.let { putExtra("gameId", it) }
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            NOTIFICATION_ID_REMINDER,
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_REMINDERS)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(message)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .build()

        notificationManager.notify(NOTIFICATION_ID_REMINDER, notification)
    }

    /**
     * Cancel all notifications
     */
    fun cancelAllNotifications() {
        notificationManager.cancelAll()
    }

    /**
     * Cancel specific notification
     */
    fun cancelNotification(notificationId: Int) {
        notificationManager.cancel(notificationId)
    }
}
