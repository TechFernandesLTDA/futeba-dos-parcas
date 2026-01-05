package com.futebadosparcas.domain.usecase.notification

import com.futebadosparcas.data.model.Notification
import com.futebadosparcas.data.repository.NotificationRepository
import com.futebadosparcas.util.AppLogger
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import javax.inject.Inject

/**
 * Use Case para gerenciar notificações.
 *
 * Responsabilidades:
 * - Buscar notificações do usuário
 * - Agrupar por tipo/data
 * - Marcar como lidas
 * - Fornecer contagem de não lidas
 */
class GetNotificationsUseCase @Inject constructor(
    private val notificationRepository: NotificationRepository
) {
    companion object {
        private const val TAG = "GetNotificationsUseCase"
    }

    /**
     * Notificações agrupadas por período.
     */
    data class GroupedNotifications(
        val today: List<Notification>,
        val yesterday: List<Notification>,
        val thisWeek: List<Notification>,
        val older: List<Notification>,
        val unreadCount: Int
    )

    /**
     * Busca notificações agrupadas por período.
     *
     * @param limit Número máximo de notificações
     * @return Result com notificações agrupadas
     */
    suspend fun getGroupedNotifications(limit: Int = 50): Result<GroupedNotifications> {
        AppLogger.d(TAG) { "Buscando notificações agrupadas (limit=$limit)" }

        return notificationRepository.getNotifications(limit).map { notifications ->
            val now = System.currentTimeMillis()
            val oneDayMs = 24 * 60 * 60 * 1000L
            val oneWeekMs = 7 * oneDayMs

            val today = mutableListOf<Notification>()
            val yesterday = mutableListOf<Notification>()
            val thisWeek = mutableListOf<Notification>()
            val older = mutableListOf<Notification>()

            notifications.forEach { notification ->
                val createdAt = notification.createdAt ?: 0L
                val age = now - createdAt

                when {
                    age < oneDayMs -> today.add(notification)
                    age < 2 * oneDayMs -> yesterday.add(notification)
                    age < oneWeekMs -> thisWeek.add(notification)
                    else -> older.add(notification)
                }
            }

            GroupedNotifications(
                today = today.sortedByDescending { it.createdAt },
                yesterday = yesterday.sortedByDescending { it.createdAt },
                thisWeek = thisWeek.sortedByDescending { it.createdAt },
                older = older.sortedByDescending { it.createdAt },
                unreadCount = notifications.count { !it.isRead }
            )
        }
    }

    /**
     * Flow de notificações em tempo real.
     *
     * @return Flow com lista de notificações
     */
    fun getNotificationsFlow(): Flow<List<Notification>> {
        return notificationRepository.getNotificationsFlow()
            .catch { e ->
                AppLogger.e(TAG, "Erro no flow de notificações", e)
                emit(emptyList())
            }
    }

    /**
     * Flow do contador de não lidas.
     *
     * @return Flow com contagem
     */
    fun getUnreadCountFlow(): Flow<Int> {
        return notificationRepository.getUnreadCountFlow()
            .catch { e ->
                AppLogger.e(TAG, "Erro no contador de não lidas", e)
                emit(0)
            }
    }

    /**
     * Marca notificação como lida.
     *
     * @param notificationId ID da notificação
     * @return Result indicando sucesso/falha
     */
    suspend fun markAsRead(notificationId: String): Result<Unit> {
        AppLogger.d(TAG) { "Marcando notificação como lida: $notificationId" }
        return notificationRepository.markAsRead(notificationId)
    }

    /**
     * Marca todas as notificações como lidas.
     *
     * @return Result indicando sucesso/falha
     */
    suspend fun markAllAsRead(): Result<Unit> {
        AppLogger.d(TAG) { "Marcando todas as notificações como lidas" }
        return notificationRepository.markAllAsRead()
    }

    /**
     * Deleta uma notificação.
     *
     * @param notificationId ID da notificação
     * @return Result indicando sucesso/falha
     */
    suspend fun deleteNotification(notificationId: String): Result<Unit> {
        AppLogger.d(TAG) { "Deletando notificação: $notificationId" }
        return notificationRepository.deleteNotification(notificationId)
    }
}
