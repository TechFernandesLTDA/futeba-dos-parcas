package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.AppNotification
import com.futebadosparcas.data.model.NotificationType
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import java.util.Date
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class NotificationRepository @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth
) {
    private val notificationsCollection = firestore.collection("notifications")

    /**
     * Busca todas as notificações do usuário atual
     */
    suspend fun getMyNotifications(limit: Int = 50): Result<List<AppNotification>> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val snapshot = notificationsCollection
                .whereEqualTo("user_id", userId)
                .orderBy("created_at", com.google.firebase.firestore.Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val notifications = snapshot.toObjects(AppNotification::class.java)
            Result.success(notifications)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Observa notificações do usuário em tempo real
     */
    fun getMyNotificationsFlow(limit: Int = 50): Flow<List<AppNotification>> = callbackFlow {
        val userId = auth.currentUser?.uid ?: run {
            trySend(emptyList())
            close()
            return@callbackFlow
        }

        val listener = notificationsCollection
            .whereEqualTo("user_id", userId)
            .orderBy("created_at", com.google.firebase.firestore.Query.Direction.DESCENDING)
            .limit(limit.toLong())
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(emptyList())
                    return@addSnapshotListener
                }
                val notifications = snapshot?.toObjects(AppNotification::class.java)
                    ?: emptyList()
                trySend(notifications)
            }

        awaitClose { listener.remove() }
    }

    /**
     * Busca apenas notificações não lidas
     */
    suspend fun getUnreadNotifications(): Result<List<AppNotification>> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val snapshot = notificationsCollection
                .whereEqualTo("user_id", userId)
                .whereEqualTo("read", false)
                .get()
                .await()

            val notifications = snapshot.toObjects(AppNotification::class.java)
            Result.success(notifications)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Observa contagem de notificações não lidas em tempo real
     */
    fun getUnreadCountFlow(): Flow<Int> = callbackFlow {
        val userId = auth.currentUser?.uid ?: run {
            trySend(0)
            close()
            return@callbackFlow
        }

        val listener = notificationsCollection
            .whereEqualTo("user_id", userId)
            .whereEqualTo("read", false)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(0)
                    return@addSnapshotListener
                }
                trySend(snapshot?.size() ?: 0)
            }

        awaitClose { listener.remove() }
    }

    /**
     * Conta notificações não lidas
     */
    suspend fun getUnreadCount(): Result<Int> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val snapshot = notificationsCollection
                .whereEqualTo("user_id", userId)
                .whereEqualTo("read", false)
                .get()
                .await()

            Result.success(snapshot.size())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Marca uma notificação como lida
     */
    suspend fun markAsRead(notificationId: String): Result<Unit> {
        return try {
            notificationsCollection.document(notificationId).update(mapOf(
                "read" to true,
                "read_at" to FieldValue.serverTimestamp()
            )).await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Marca todas as notificações como lidas
     */
    suspend fun markAllAsRead(): Result<Unit> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val snapshot = notificationsCollection
                .whereEqualTo("user_id", userId)
                .whereEqualTo("read", false)
                .get()
                .await()

            if (snapshot.isEmpty) {
                return Result.success(Unit)
            }

            val batch = firestore.batch()
            snapshot.documents.forEach { doc ->
                batch.update(doc.reference, mapOf(
                    "read" to true,
                    "read_at" to FieldValue.serverTimestamp()
                ))
            }
            batch.commit().await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Busca uma notificação por ID
     */
    suspend fun getNotificationById(notificationId: String): Result<AppNotification> {
        return try {
            val doc = notificationsCollection.document(notificationId).get().await()

            if (doc.exists()) {
                val notification = doc.toObject(AppNotification::class.java)
                    ?: return Result.failure(Exception("Erro ao converter notificação"))
                Result.success(notification)
            } else {
                Result.failure(Exception("Notificação não encontrada"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Cria múltiplas notificações em lote
     */
    suspend fun batchCreateNotifications(notifications: List<AppNotification>): Result<Unit> {
        return try {
            if (notifications.isEmpty()) return Result.success(Unit)

            val batch = firestore.batch()
            notifications.forEach { notification ->
                val docRef = if (notification.id.isNotEmpty()) {
                    notificationsCollection.document(notification.id)
                } else {
                    notificationsCollection.document()
                }
                val notificationWithId = notification.copy(id = docRef.id)
                batch.set(docRef, notificationWithId)
            }
            batch.commit().await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Cria uma notificação (usado internamente ou por Cloud Functions)
     */
    suspend fun createNotification(notification: AppNotification): Result<String> {
        return try {
            val docRef = if (notification.id.isNotEmpty()) {
                notificationsCollection.document(notification.id)
            } else {
                notificationsCollection.document()
            }

            val notificationWithId = notification.copy(id = docRef.id)
            docRef.set(notificationWithId).await()

            Result.success(docRef.id)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Deleta uma notificação
     */
    suspend fun deleteNotification(notificationId: String): Result<Unit> {
        return try {
            notificationsCollection.document(notificationId).delete().await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Deleta notificações antigas (mais de 30 dias)
     */
    suspend fun deleteOldNotifications(): Result<Int> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val thirtyDaysAgo = Date(System.currentTimeMillis() - 30 * 24 * 60 * 60 * 1000L)

            val snapshot = notificationsCollection
                .whereEqualTo("user_id", userId)
                .whereLessThan("created_at", thirtyDaysAgo)
                .get()
                .await()

            if (snapshot.isEmpty) {
                return Result.success(0)
            }

            val batch = firestore.batch()
            snapshot.documents.forEach { doc ->
                batch.delete(doc.reference)
            }
            batch.commit().await()

            Result.success(snapshot.size())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Busca notificações por tipo
     */
    suspend fun getNotificationsByType(type: NotificationType, limit: Int = 20): Result<List<AppNotification>> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val snapshot = notificationsCollection
                .whereEqualTo("user_id", userId)
                .whereEqualTo("type", type.name)
                .limit(limit.toLong())
                .get()
                .await()

            val notifications = snapshot.toObjects(AppNotification::class.java)
            Result.success(notifications)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Busca notificações com ação pendente (convites, convocações)
     */
    suspend fun getPendingActionNotifications(): Result<List<AppNotification>> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val snapshot = notificationsCollection
                .whereEqualTo("user_id", userId)
                .whereEqualTo("read", false)
                .get()
                .await()

            val notifications = snapshot.toObjects(AppNotification::class.java)
                .filter { it.requiresResponse() }

            Result.success(notifications)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
