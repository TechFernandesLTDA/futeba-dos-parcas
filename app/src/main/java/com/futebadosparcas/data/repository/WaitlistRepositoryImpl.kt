package com.futebadosparcas.data.repository

import com.futebadosparcas.domain.model.GameWaitlist
import com.futebadosparcas.domain.model.WaitlistStatus
import com.futebadosparcas.data.model.AndroidGameWaitlist
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.firestore.Query
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

/**
 * Implementacao do WaitlistRepository usando Firebase Firestore.
 *
 * Estrutura:
 * - games/{gameId}/waitlist/{userId}
 */
class WaitlistRepositoryImpl constructor(
    private val firestore: FirebaseFirestore,
    private val functions: FirebaseFunctions
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
            val result = functions.getHttpsCallable("joinGameWaitlist")
                .call(mapOf("gameId" to gameId, "position" to position))
                .await()
            val data = result.data as? Map<*, *> ?: error("Resposta invalida da waitlist")
            val queuePosition = (data["queuePosition"] as? Number)?.toInt()
                ?: error("Posicao ausente na resposta da waitlist")
            val entryWithId = GameWaitlist(
                id = userId,
                gameId = gameId,
                userId = userId,
                userName = userName,
                userPhoto = userPhoto,
                position = position,
                queuePosition = queuePosition,
                status = WaitlistStatus.WAITING.name,
            )

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
                doc.toObject(AndroidGameWaitlist::class.java)?.toDomain(doc.id)
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
                    doc.toObject(AndroidGameWaitlist::class.java)?.toDomain(doc.id)
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
                ?.toObject(AndroidGameWaitlist::class.java)
                ?.toDomain()

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
}

private fun AndroidGameWaitlist.toDomain(documentId: String = id): GameWaitlist = GameWaitlist(
    id = documentId,
    gameId = gameId,
    userId = userId,
    userName = userName,
    userPhoto = userPhoto,
    position = position,
    queuePosition = queuePosition.toInt(),
    status = status,
    addedAt = timestampMillis(addedAt),
    notifiedAt = timestampMillis(notifiedAt),
    responseDeadline = timestampMillis(responseDeadline),
)
