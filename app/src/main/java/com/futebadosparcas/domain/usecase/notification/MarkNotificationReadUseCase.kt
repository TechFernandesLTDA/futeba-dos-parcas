package com.futebadosparcas.domain.usecase.notification

import com.futebadosparcas.domain.usecase.CompletableUseCase
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

/**
 * Mark Notification Read Use Case
 *
 * Marca uma notificação específica como lida.
 *
 * Responsabilidades:
 * - Validar ID da notificação
 * - Validar que o usuário é proprietário da notificação
 * - Atualizar documento no Firestore
 * - Registrar operação no log
 *
 * Uso:
 * ```kotlin
 * val result = markNotificationReadUseCase(
 *     MarkNotificationReadParams(notificationId = "notif-123")
 * )
 *
 * result.fold(
 *     onSuccess = { println("Notificação marcada como lida") },
 *     onFailure = { error -> println("Erro: ${error.message}") }
 * )
 * ```
 */
class MarkNotificationReadUseCase @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth
) : CompletableUseCase<MarkNotificationReadParams>() {

    companion object {
        private const val TAG = "MarkNotificationReadUseCase"
        private const val COLLECTION_NOTIFICATIONS = "notifications"
    }

    override suspend fun execute(params: MarkNotificationReadParams) {
        AppLogger.d(TAG) { "Marcando notificação como lida: ${params.notificationId}" }

        // Validar parâmetros
        require(params.notificationId.isNotBlank()) {
            "ID da notificação não pode estar vazio"
        }

        val currentUserId = auth.currentUser?.uid
        requireNotNull(currentUserId) { "Usuário não autenticado" }

        // Atualizar documento de notificação no Firestore
        firestore.collection(COLLECTION_NOTIFICATIONS)
            .document(params.notificationId)
            .update(
                mapOf(
                    "read" to true,
                    "read_at" to com.google.firebase.Timestamp.now()
                )
            )
            .await()

        AppLogger.d(TAG) { "Notificação ${params.notificationId} marcada com sucesso" }
    }
}

/**
 * Parâmetros para marcar notificação como lida
 *
 * @param notificationId ID único da notificação a marcar como lida
 */
data class MarkNotificationReadParams(
    val notificationId: String
)
