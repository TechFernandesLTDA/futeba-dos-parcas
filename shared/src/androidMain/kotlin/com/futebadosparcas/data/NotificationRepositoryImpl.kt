package com.futebadosparcas.data

import com.futebadosparcas.domain.model.AppNotification
import com.futebadosparcas.domain.model.NotificationType
import com.futebadosparcas.domain.repository.NotificationRepository
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import kotlinx.coroutines.flow.Flow

/**
 * Implementação Android do NotificationRepository.
 *
 * Utiliza FirebaseDataSource para acessar o Firestore.
 * A implementação é direta, sem cache adicional, pois notificações
 * geralmente exigem dados atualizados em tempo real.
 */
class NotificationRepositoryImpl(
    private val firebaseDataSource: FirebaseDataSource
) : NotificationRepository {

    override suspend fun getMyNotifications(limit: Int): Result<List<AppNotification>> {
        return firebaseDataSource.getMyNotifications(limit)
    }

    override fun getMyNotificationsFlow(limit: Int): Flow<List<AppNotification>> {
        return firebaseDataSource.getMyNotificationsFlow(limit)
    }

    override suspend fun getUnreadNotifications(): Result<List<AppNotification>> {
        return firebaseDataSource.getUnreadNotifications()
    }

    override fun getUnreadCountFlow(): Flow<Int> {
        return firebaseDataSource.getUnreadCountFlow()
    }

    override suspend fun getUnreadCount(): Result<Int> {
        return firebaseDataSource.getUnreadCount()
    }

    override suspend fun markAsRead(notificationId: String): Result<Unit> {
        return firebaseDataSource.markNotificationAsRead(notificationId)
    }

    override suspend fun markAllAsRead(): Result<Unit> {
        return firebaseDataSource.markAllNotificationsAsRead()
    }

    override suspend fun getNotificationById(notificationId: String): Result<AppNotification> {
        return firebaseDataSource.getNotificationById(notificationId)
    }

    override suspend fun createNotification(notification: AppNotification): Result<String> {
        return firebaseDataSource.createNotification(notification)
    }

    override suspend fun batchCreateNotifications(notifications: List<AppNotification>): Result<Unit> {
        return firebaseDataSource.batchCreateNotifications(notifications)
    }

    override suspend fun deleteNotification(notificationId: String): Result<Unit> {
        return firebaseDataSource.deleteNotification(notificationId)
    }

    override suspend fun deleteOldNotifications(): Result<Int> {
        return firebaseDataSource.deleteOldNotifications()
    }

    override suspend fun getNotificationsByType(type: NotificationType, limit: Int): Result<List<AppNotification>> {
        return firebaseDataSource.getNotificationsByType(type, limit)
    }

    override suspend fun getPendingActionNotifications(): Result<List<AppNotification>> {
        return firebaseDataSource.getPendingActionNotifications()
    }
}
