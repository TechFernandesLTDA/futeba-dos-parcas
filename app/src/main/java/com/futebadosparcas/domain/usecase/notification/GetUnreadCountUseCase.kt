package com.futebadosparcas.domain.usecase.notification

import com.futebadosparcas.domain.usecase.SuspendNoParamsUseCase
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

/**
 * Get Unread Count Use Case
 *
 * Obtém a contagem de notificações não lidas do usuário atual.
 *
 * Responsabilidades:
 * - Buscar contagem de notificações não lidas via Firestore query
 * - Validar que usuário está autenticado
 * - Retornar contagem numérica
 * - Registrar operação no log
 *
 * Uso:
 * ```kotlin
 * val result = getUnreadCountUseCase()
 *
 * result.fold(
 *     onSuccess = { count ->
 *         println("Notificações não lidas: $count")
 *     },
 *     onFailure = { error ->
 *         println("Erro: ${error.message}")
 *     }
 * )
 * ```
 */
class GetUnreadCountUseCase @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth
) : SuspendNoParamsUseCase<Int>() {

    companion object {
        private const val TAG = "GetUnreadCountUseCase"
        private const val COLLECTION_NOTIFICATIONS = "notifications"
    }

    override suspend fun execute(): Int {
        AppLogger.d(TAG) { "Buscando contagem de notificações não lidas" }

        val currentUserId = auth.currentUser?.uid
        requireNotNull(currentUserId) { "Usuário não autenticado" }

        // Executar query para contar notificações não lidas
        val snapshot = firestore.collection(COLLECTION_NOTIFICATIONS)
            .whereEqualTo("user_id", currentUserId)
            .whereEqualTo("read", false)
            .get()
            .await()

        val unreadCount = snapshot.size()

        AppLogger.d(TAG) { "Contagem de não lidas: $unreadCount" }

        return unreadCount
    }
}
