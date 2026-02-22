package com.futebadosparcas.data.repository

import com.futebadosparcas.domain.model.GameWaitlist
import com.futebadosparcas.domain.model.WaitlistStatus
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import java.util.Date

/**
 * Implementacao do WaitlistRepository usando Firebase Firestore.
 *
 * Estrutura:
 * - games/{gameId}/waitlist/{waitlistId}
 */
class WaitlistRepositoryImpl constructor(
    private val firestore: FirebaseFirestore
) : WaitlistRepository {

    companion object {
        private const val TAG = "WaitlistRepository"
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
            // P1 #12: Verificar se ja esta na lista (limit 1 - basta saber se existe)
            val existing = waitlistCollection(gameId)
                .whereEqualTo("user_id", userId)
                .whereIn("status", listOf(
                    WaitlistStatus.WAITING.name,
                    WaitlistStatus.NOTIFIED.name
                ))
                .limit(1)
                .get()
                .await()

            if (!existing.isEmpty) {
                return Result.failure(
                    IllegalStateException("Voce ja esta na lista de espera deste jogo")
                )
            }

            // P1 #12: Calcular posicao na fila (limit 50 - maximo realista)
            val currentCount = waitlistCollection(gameId)
                .whereIn("status", listOf(
                    WaitlistStatus.WAITING.name,
                    WaitlistStatus.NOTIFIED.name
                ))
                .limit(50)
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
                addedAt = Date().time
            )

            val docRef = waitlistCollection(gameId).add(entry).await()
            val entryWithId = entry.copy(id = docRef.id)

            AppLogger.i(TAG) { "Usuario $userId adicionado a lista de espera do jogo $gameId na posicao ${entryWithId.queuePosition}" }

            Result.success(entryWithId)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao adicionar a lista de espera", e)
            Result.failure(e)
        }
    }

    override suspend fun removeFromWaitlist(gameId: String, userId: String): Result<Unit> {
        return try {
            // P1 #12: Limit para seguranca (usuario deve ter no max 1-2 entradas)
            val docs = waitlistCollection(gameId)
                .whereEqualTo("user_id", userId)
                .limit(10)
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
            // P1 #12: Limit 50 - maximo realista de jogadores na fila
            val snapshot = waitlistCollection(gameId)
                .whereIn("status", listOf(
                    WaitlistStatus.WAITING.name,
                    WaitlistStatus.NOTIFIED.name
                ))
                .orderBy("queue_position", Query.Direction.ASCENDING)
                .limit(50)
                .get()
                .await()

            val list = snapshot.documents.mapNotNull { doc ->
                doc.toObject(GameWaitlist::class.java)?.copy(id = doc.id)
            }

            Result.success(list)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar lista de espera", e)
            Result.failure(e)
        }
    }

    override fun getWaitlistFlow(gameId: String): Flow<Result<List<GameWaitlist>>> = callbackFlow {
        // P1 #12: Limit 50 no listener real-time
        val listener = waitlistCollection(gameId)
            .whereIn("status", listOf(
                WaitlistStatus.WAITING.name,
                WaitlistStatus.NOTIFIED.name
            ))
            .orderBy("queue_position", Query.Direction.ASCENDING)
            .limit(50)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }

                val list = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(GameWaitlist::class.java)?.copy(id = doc.id)
                } ?: emptyList()

                trySend(Result.success(list))
            }

        awaitClose { listener.remove() }
    }

    override suspend fun getWaitlistPosition(gameId: String, userId: String): Result<Int?> {
        return try {
            // P1 #12: Limit 1 - basta a primeira entrada do usuario
            val docs = waitlistCollection(gameId)
                .whereEqualTo("user_id", userId)
                .whereIn("status", listOf(
                    WaitlistStatus.WAITING.name,
                    WaitlistStatus.NOTIFIED.name
                ))
                .limit(1)
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
            // P1 #12: Limit 1 - basta saber se existe
            val docs = waitlistCollection(gameId)
                .whereEqualTo("user_id", userId)
                .whereIn("status", listOf(
                    WaitlistStatus.WAITING.name,
                    WaitlistStatus.NOTIFIED.name
                ))
                .limit(1)
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
            val entry = doc.toObject(GameWaitlist::class.java)?.copy(id = doc.id)
                ?: return Result.success(null)

            // Atualizar status para PROMOTED
            doc.reference.update(
                mapOf(
                    "status" to WaitlistStatus.PROMOTED.name
                )
            ).await()

            val updatedEntry = entry.copy(status = WaitlistStatus.PROMOTED.name)

            // Reordenar fila
            reorderQueue(gameId)

            AppLogger.i(TAG) { "Usuario ${updatedEntry.userId} promovido da lista de espera do jogo $gameId" }

            Result.success(updatedEntry)
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
            val entry = doc.toObject(GameWaitlist::class.java)?.copy(id = doc.id)
                ?: return Result.success(null)

            // Calcular deadline de resposta
            val now = Date()
            val deadline = Date(now.time + (autoPromoteMinutes * 60 * 1000L))

            // Atualizar status para NOTIFIED
            doc.reference.update(
                mapOf(
                    "status" to WaitlistStatus.NOTIFIED.name,
                    "notified_at" to now.time,
                    "response_deadline" to deadline.time
                )
            ).await()

            val updatedEntry = entry.copy(
                status = WaitlistStatus.NOTIFIED.name,
                notifiedAt = now.time,
                responseDeadline = deadline.time
            )

            AppLogger.i(TAG) { "Usuario ${updatedEntry.userId} notificado sobre vaga no jogo $gameId" }

            Result.success(updatedEntry)
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
            // P1 #12: Limit 5 - usuario deve ter poucas entradas
            val docs = waitlistCollection(gameId)
                .whereEqualTo("user_id", userId)
                .limit(5)
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

            // P1 #12: Limit 100 - protecao contra query bomb em collectionGroup
            val snapshot = firestore.collectionGroup(SUBCOLLECTION_WAITLIST)
                .whereEqualTo("status", WaitlistStatus.NOTIFIED.name)
                .whereLessThan("response_deadline", now)
                .limit(100)
                .get()
                .await()

            val list = snapshot.documents.mapNotNull { doc ->
                doc.toObject(GameWaitlist::class.java)?.copy(id = doc.id)
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
            if (expired.isEmpty()) return Result.success(0)

            // Buscar todos os games unicos em batch (evita N+1)
            val gameIds = expired.map { it.gameId }.distinct()
            val gamesMap = gameIds.chunked(10).flatMap { chunk ->
                firestore.collection(COLLECTION_GAMES)
                    .whereIn(
                        com.google.firebase.firestore.FieldPath.documentId(),
                        chunk
                    )
                    .get()
                    .await()
                    .documents
            }.associateBy { it.id }

            var promotedCount = 0

            for (entry in expired) {
                // Marcar como expirado
                updateWaitlistStatus(entry.gameId, entry.userId, WaitlistStatus.EXPIRED)

                // Notificar proximo (usa cache do batch)
                val autoPromoteMinutes = gamesMap[entry.gameId]
                    ?.getLong("waitlist_auto_promote_minutes")?.toInt() ?: 30
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
            // P1 #12: Limit 50 - contagem limitada ao maximo realista
            val snapshot = waitlistCollection(gameId)
                .whereIn("status", listOf(
                    WaitlistStatus.WAITING.name,
                    WaitlistStatus.NOTIFIED.name
                ))
                .limit(50)
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
            // P1 #12: Limit 50 - maximo realista de jogadores na fila
            val snapshot = waitlistCollection(gameId)
                .whereIn("status", listOf(
                    WaitlistStatus.WAITING.name,
                    WaitlistStatus.NOTIFIED.name
                ))
                .orderBy("added_at", Query.Direction.ASCENDING)
                .limit(50)
                .get()
                .await()

            // Batch write para atualizar posicoes atomicamente
            val batch = firestore.batch()
            var position = 1
            for (doc in snapshot.documents) {
                batch.update(doc.reference, "queue_position", position)
                position++
            }
            batch.commit().await()
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao reordenar fila", e)
        }
    }
}
