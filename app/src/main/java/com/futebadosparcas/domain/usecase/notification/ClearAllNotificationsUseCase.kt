package com.futebadosparcas.domain.usecase.notification

import com.futebadosparcas.domain.usecase.CompletableUseCase
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

/**
 * Clear All Notifications Use Case
 *
 * Limpa/deleta todas as notificações do usuário atual.
 *
 * Responsabilidades:
 * - Buscar todas as notificações do usuário
 * - Deletar cada notificação em lote
 * - Registrar operação no log
 * - Validar que usuário está autenticado
 *
 * Uso:
 * ```kotlin
 * val result = clearAllNotificationsUseCase(NoParams)
 *
 * result.fold(
 *     onSuccess = { println("Todas as notificações foram limpas") },
 *     onFailure = { error -> println("Erro: ${error.message}") }
 * )
 * ```
 */
class ClearAllNotificationsUseCase @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth
) : CompletableUseCase<Unit>() {

    companion object {
        private const val TAG = "ClearAllNotificationsUseCase"
        private const val COLLECTION_NOTIFICATIONS = "notifications"
        private const val BATCH_SIZE = 500
    }

    override suspend fun execute(params: Unit) {
        AppLogger.d(TAG) { "Limpando todas as notificações do usuário" }

        val currentUserId = auth.currentUser?.uid
        requireNotNull(currentUserId) { "Usuário não autenticado" }

        // Buscar todas as notificações do usuário
        val snapshot = firestore.collection(COLLECTION_NOTIFICATIONS)
            .whereEqualTo("user_id", currentUserId)
            .get()
            .await()

        val notificationIds = snapshot.documents.map { it.id }

        AppLogger.d(TAG) { "Encontradas ${notificationIds.size} notificações para limpar" }

        // Deletar em lotes (Firestore batch tem limite de 500 operações)
        notificationIds.chunked(BATCH_SIZE).forEach { chunk ->
            val batch = firestore.batch()

            chunk.forEach { notificationId ->
                batch.delete(
                    firestore.collection(COLLECTION_NOTIFICATIONS)
                        .document(notificationId)
                )
            }

            batch.commit().await()
            AppLogger.d(TAG) { "Lote de ${chunk.size} notificações deletado" }
        }

        AppLogger.d(TAG) { "Todas as notificações foram limpas com sucesso" }
    }
}
