package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.GameWaitlist
import com.futebadosparcas.data.model.WaitlistStatus
import com.futebadosparcas.util.AppLogger
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

private const val TAG = "WaitlistRepository"

/**
 * Implementacao do WaitlistRepository usando Firebase Firestore.
 *
 * Estrutura:
 * - games/{gameId}/waitlist/{waitlistId}
 */
@Singleton
class WaitlistRepositoryImpl @Inject constructor(
    private val firestore: FirebaseFirestore
) : WaitlistRepository {

    companion object {
        private const val COLLECTION_GAMES = "games"
        private const val SUBCOLLECTION_WAITLIST = "waitlist"
    }

    private fun waitlistCollection(gameId: String) =
        firestore.collection(COLLECTION_GAMES)
            .document(gameId)
            .collection(SUBCOLLECTION_WAITLIST)

    override suspend fun addToWaitlist(
        gameId: String,
        userId: String,
        userName: String,
        userPhoto: String?,
        position: String
    ): Result<GameWaitlist> {
        return try {
            // Verificar se ja esta na lista
            val existing = waitlistCollection(gameId)
                .whereEqualTo("user_id", userId)
                .whereIn("status", listOf(
                    WaitlistStatus.WAITING.name,
                    WaitlistStatus.NOTIFIED.name
                ))
                .get()
                .await()

            if (!existing.isEmpty) {
                return Result.failure(
                    IllegalStateException("Voce ja esta na lista de espera deste jogo")
                )
            }

            // Calcular posicao na fila
            val currentCount = waitlistCollection(gameId)
                .whereIn("status", listOf(
                    WaitlistStatus.WAITING.name,
                    WaitlistStatus.NOTIFIED.name
                ))
                .get()
                .await()
                .size()

            val entry = GameWaitlist(
                gameId = gameId,
                userId = userId,
                userName = userName,
                userPhoto = userPhoto,
                position = position,
                queuePosition = currentCount + 1,
                status = WaitlistStatus.WAITING.name,
                addedAtRaw = Date()
            )

            val docRef = waitlistCollection(gameId).add(entry).await()
            entry.id = docRef.id

            AppLogger.i(TAG) { "Usuario $userId adicionado a lista de espera do jogo $gameId na posicao ${entry.queuePosition}" }

            Result.success(entry)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao adicionar a lista de espera", e)
            Result.failure(e)
        }
    }

    override suspend fun removeFromWaitlist(gameId: String, userId: String): Result<Unit> {
        return try {
            val docs = waitlistCollection(gameId)
                .whereEqualTo("user_id", userId)
                .get()
                .await()

            if (docs.isEmpty) {
                return Result.success(Unit)
            }

            // Remover todas as entradas do usuario
            for (doc in docs) {
                doc.reference.delete().await()
            }

            // Reordenar posicoes restantes
            reorderQueue(gameId)

            AppLogger.i(TAG) { "Usuario $userId removido da lista de espera do jogo $gameId" }

            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao remover da lista de espera", e)
            Result.failure(e)
        }
    }

    override suspend fun getWaitlist(gameId: String): Result<List<GameWaitlist>> {
        return try {
            val snapshot = waitlistCollection(gameId)
                .whereIn("status", listOf(
                    WaitlistStatus.WAITING.name,
                    WaitlistStatus.NOTIFIED.name
                ))
                .orderBy("queue_position", Query.Direction.ASCENDING)
                .get()
                .await()

            val list = snapshot.documents.mapNotNull { doc ->
                doc.toObject(GameWaitlist::class.java)?.apply { id = doc.id }
            }

            Result.success(list)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar lista de espera", e)
            Result.failure(e)
        }
    }

    override fun getWaitlistFlow(gameId: String): Flow<Result<List<GameWaitlist>>> = callbackFlow {
        val listener = waitlistCollection(gameId)
            .whereIn("status", listOf(
                WaitlistStatus.WAITING.name,
                WaitlistStatus.NOTIFIED.name
            ))
            .orderBy("queue_position", Query.Direction.ASCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }

                val list = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(GameWaitlist::class.java)?.apply { id = doc.id }
                } ?: emptyList()

                trySend(Result.success(list))
            }

        awaitClose { listener.remove() }
    }

    override suspend fun getWaitlistPosition(gameId: String, userId: String): Result<Int?> {
        return try {
            val docs = waitlistCollection(gameId)
                .whereEqualTo("user_id", userId)
                .whereIn("status", listOf(
                    WaitlistStatus.WAITING.name,
                    WaitlistStatus.NOTIFIED.name
                ))
                .get()
                .await()

            val entry = docs.documents.firstOrNull()
                ?.toObject(GameWaitlist::class.java)

            Result.success(entry?.queuePosition)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar posicao na lista de espera", e)
            Result.failure(e)
        }
    }

    override suspend fun isInWaitlist(gameId: String, userId: String): Result<Boolean> {
        return try {
            val docs = waitlistCollection(gameId)
                .whereEqualTo("user_id", userId)
                .whereIn("status", listOf(
                    WaitlistStatus.WAITING.name,
                    WaitlistStatus.NOTIFIED.name
                ))
                .get()
                .await()

            Result.success(!docs.isEmpty)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao verificar lista de espera", e)
            Result.failure(e)
        }
    }

    override suspend fun promoteNextInLine(gameId: String): Result<GameWaitlist?> {
        return try {
            val snapshot = waitlistCollection(gameId)
                .whereIn("status", listOf(
                    WaitlistStatus.WAITING.name,
                    WaitlistStatus.NOTIFIED.name
                ))
                .orderBy("queue_position", Query.Direction.ASCENDING)
                .limit(1)
                .get()
                .await()

            val doc = snapshot.documents.firstOrNull() ?: return Result.success(null)
            val entry = doc.toObject(GameWaitlist::class.java)?.apply { id = doc.id }
                ?: return Result.success(null)

            // Atualizar status para PROMOTED
            doc.reference.update(
                mapOf(
                    "status" to WaitlistStatus.PROMOTED.name
                )
            ).await()

            entry.status = WaitlistStatus.PROMOTED.name

            // Reordenar fila
            reorderQueue(gameId)

            AppLogger.i(TAG) { "Usuario ${entry.userId} promovido da lista de espera do jogo $gameId" }

            Result.success(entry)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao promover proximo da fila", e)
            Result.failure(e)
        }
    }

    override suspend fun notifyNextInLine(
        gameId: String,
        autoPromoteMinutes: Int
    ): Result<GameWaitlist?> {
        return try {
            val snapshot = waitlistCollection(gameId)
                .whereEqualTo("status", WaitlistStatus.WAITING.name)
                .orderBy("queue_position", Query.Direction.ASCENDING)
                .limit(1)
                .get()
                .await()

            val doc = snapshot.documents.firstOrNull() ?: return Result.success(null)
            val entry = doc.toObject(GameWaitlist::class.java)?.apply { id = doc.id }
                ?: return Result.success(null)

            // Calcular deadline de resposta
            val now = Date()
            val deadline = Date(now.time + (autoPromoteMinutes * 60 * 1000L))

            // Atualizar status para NOTIFIED
            doc.reference.update(
                mapOf(
                    "status" to WaitlistStatus.NOTIFIED.name,
                    "notified_at" to now,
                    "response_deadline" to deadline
                )
            ).await()

            entry.status = WaitlistStatus.NOTIFIED.name
            entry.notifiedAtRaw = now
            entry.responseDeadlineRaw = deadline

            AppLogger.i(TAG) { "Usuario ${entry.userId} notificado sobre vaga no jogo $gameId" }

            Result.success(entry)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao notificar proximo da fila", e)
            Result.failure(e)
        }
    }

    override suspend fun updateWaitlistStatus(
        gameId: String,
        userId: String,
        status: WaitlistStatus
    ): Result<Unit> {
        return try {
            val docs = waitlistCollection(gameId)
                .whereEqualTo("user_id", userId)
                .get()
                .await()

            val doc = docs.documents.firstOrNull()
                ?: return Result.failure(Exception("Entrada nao encontrada"))

            doc.reference.update("status", status.name).await()

            if (status == WaitlistStatus.PROMOTED || status == WaitlistStatus.CANCELLED || status == WaitlistStatus.EXPIRED) {
                reorderQueue(gameId)
            }

            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao atualizar status na lista de espera", e)
            Result.failure(e)
        }
    }

    override suspend fun getExpiredEntries(): Result<List<GameWaitlist>> {
        return try {
            val now = Date()

            val snapshot = firestore.collectionGroup(SUBCOLLECTION_WAITLIST)
                .whereEqualTo("status", WaitlistStatus.NOTIFIED.name)
                .whereLessThan("response_deadline", now)
                .get()
                .await()

            val list = snapshot.documents.mapNotNull { doc ->
                doc.toObject(GameWaitlist::class.java)?.apply { id = doc.id }
            }

            Result.success(list)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar entradas expiradas", e)
            Result.failure(e)
        }
    }

    override suspend fun processExpiredEntries(): Result<Int> {
        return try {
            val expiredResult = getExpiredEntries()
            val expired = expiredResult.getOrNull() ?: emptyList()

            var promotedCount = 0

            for (entry in expired) {
                // Marcar como expirado
                updateWaitlistStatus(entry.gameId, entry.userId, WaitlistStatus.EXPIRED)

                // Notificar proximo
                val game = firestore.collection(COLLECTION_GAMES)
                    .document(entry.gameId)
                    .get()
                    .await()

                val autoPromoteMinutes = game.getLong("waitlist_auto_promote_minutes")?.toInt() ?: 30
                val nextResult = notifyNextInLine(entry.gameId, autoPromoteMinutes)

                if (nextResult.isSuccess && nextResult.getOrNull() != null) {
                    promotedCount++
                }
            }

            AppLogger.i(TAG) { "Processadas $promotedCount entradas expiradas" }

            Result.success(promotedCount)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao processar entradas expiradas", e)
            Result.failure(e)
        }
    }

    override suspend fun getWaitlistCount(gameId: String): Result<Int> {
        return try {
            val snapshot = waitlistCollection(gameId)
                .whereIn("status", listOf(
                    WaitlistStatus.WAITING.name,
                    WaitlistStatus.NOTIFIED.name
                ))
                .get()
                .await()

            Result.success(snapshot.size())
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao contar lista de espera", e)
            Result.failure(e)
        }
    }

    /**
     * Reordena as posicoes na fila apos remocao ou promocao.
     */
    private suspend fun reorderQueue(gameId: String) {
        try {
            val snapshot = waitlistCollection(gameId)
                .whereIn("status", listOf(
                    WaitlistStatus.WAITING.name,
                    WaitlistStatus.NOTIFIED.name
                ))
                .orderBy("added_at", Query.Direction.ASCENDING)
                .get()
                .await()

            var position = 1
            for (doc in snapshot.documents) {
                doc.reference.update("queue_position", position).await()
                position++
            }
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao reordenar fila", e)
        }
    }
}
