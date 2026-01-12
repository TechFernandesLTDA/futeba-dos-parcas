package com.futebadosparcas.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.core.graphics.drawable.toBitmap
import com.futebadosparcas.R
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.ui.main.MainActivityCompose
import com.futebadosparcas.util.AppLogger
import com.futebadosparcas.util.LevelBadgeHelper
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class FcmService : FirebaseMessagingService() {

    @Inject
    lateinit var userRepository: UserRepository

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    companion object {
        private const val TAG = "FcmService"
        private const val CHANNEL_ID = "futeba_notifications"
        private const val CHANNEL_NAME = "Futeba dos Parcas"
        private const val CHANNEL_DESCRIPTION = "Notificacoes de jogos e confirmacoes"
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        AppLogger.d(TAG) { "Novo FCM token recebido" }
        serviceScope.launch {
            try {
                userRepository.updateFcmToken(token)
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro ao atualizar FCM token", e)
            }
        }
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        createNotificationChannel()

        val title = remoteMessage.notification?.title
            ?: remoteMessage.data["title"]
            ?: "Futeba dos Parcas"

        val body = remoteMessage.notification?.body
            ?: remoteMessage.data["body"]
            ?: ""

        val type = remoteMessage.data["type"] ?: "general"
        val gameId = remoteMessage.data["gameId"]
        val level = remoteMessage.data["level"]?.toIntOrNull()

        showNotification(title, body, type, gameId, level)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = CHANNEL_DESCRIPTION
                enableLights(true)
                enableVibration(true)
            }

            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun showNotification(title: String, body: String, type: String, gameId: String?, level: Int? = null) {
        val intent = Intent(this, MainActivityCompose::class.java)
        intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        gameId?.let { intent.putExtra("gameId", it) }
        intent.putExtra("notificationType", type)

        val pendingIntent = PendingIntent.getActivity(
            this,
            System.currentTimeMillis().toInt(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notificationBuilder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))

        if (type == "level_up" && level != null) {
            try {
                val badgeDrawable = ContextCompat.getDrawable(this, LevelBadgeHelper.getBadgeForLevel(level))
                val largeBitmap = badgeDrawable?.toBitmap()
                largeBitmap?.let {
                    notificationBuilder.setLargeIcon(it)
                    // NOTA: NAO reciclar bitmap quando usado em NotificationCompat
                    // O NotificationManager gerencia o lifecycle do bitmap
                    // Reciclar pode causar crash: "Canvas: trying to use a recycled bitmap"
                }
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro ao adicionar brasao na notificacao", e)
            }
        }

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.notify(System.currentTimeMillis().toInt(), notificationBuilder.build())
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
    }
}
