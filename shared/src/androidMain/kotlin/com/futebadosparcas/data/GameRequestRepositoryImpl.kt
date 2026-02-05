package com.futebadosparcas.data

import com.futebadosparcas.domain.model.GameJoinRequest
import com.futebadosparcas.domain.model.RequestStatus
import com.futebadosparcas.domain.repository.AuthRepository
import com.futebadosparcas.domain.repository.GameRequestRepository
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

/**
 * Implementacao Android do GameRequestRepository.
 */
class GameRequestRepositoryImpl(
    private val firebaseDataSource: FirebaseDataSource,
    private val authRepository: AuthRepository
) : GameRequestRepository {

    companion object {
        private const val COLLECTION_GAME_REQUESTS = "game_requests"
    }

    private val firestore get() = firebaseDataSource.getFirestore()

    override suspend fun requestJoinGame(
        gameId: String,
        message: String,
        position: String?
    ): Result<GameJoinRequest> {
        return try {
            val currentUser = authRepository.getCurrentUser().getOrNull()
                ?: return Result.failure(Exception("Usuário não autenticado"))

            // Verificar se já existe solicitação ativa
            val existingRequest = hasActiveRequest(gameId).getOrNull()
            if (existingRequest == true) {
                return Result.failure(Exception("Você já tem uma solicitação pendente para este jogo"))
            }

            val docRef = firestore.collection(COLLECTION_GAME_REQUESTS).document()
            val requestWithId = GameJoinRequest(
                id = docRef.id,
                gameId = gameId,
                userId = currentUser.id,
                userName = currentUser.name,
                userPhoto = currentUser.photoUrl,
                userLevel = 0,
                userPosition = position,
                message = message,
                status = RequestStatus.PENDING.name,
                requestedAt = System.currentTimeMillis()
            )

            val requestData = mapOf(
                "id" to requestWithId.id,
                "game_id" to requestWithId.gameId,
                "user_id" to requestWithId.userId,
                "user_name" to requestWithId.userName,
                "user_photo" to requestWithId.userPhoto,
                "user_level" to requestWithId.userLevel,
                "user_position" to requestWithId.userPosition,
                "message" to requestWithId.message,
                "status" to requestWithId.status,
                "requested_at" to com.google.firebase.firestore.FieldValue.serverTimestamp()
            )

            docRef.set(requestData).await()

            Result.success(requestWithId)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getPendingRequests(gameId: String): Result<List<GameJoinRequest>> {
        return try {
            // PERF P1 #12: Adicionado .limit(100) para evitar leitura ilimitada
            val snapshot = firestore.collection(COLLECTION_GAME_REQUESTS)
                .whereEqualTo("game_id", gameId)
                .whereEqualTo("status", RequestStatus.PENDING.name)
                .orderBy("requested_at", com.google.firebase.firestore.Query.Direction.DESCENDING)
                .limit(100) // Maximo de 100 solicitacoes pendentes por jogo
                .get()
                .await()

            val requests = snapshot.documents.mapNotNull { doc ->
                docToGameJoinRequest(doc.id, doc.data)
            }
            Result.success(requests)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun getPendingRequestsFlow(gameId: String): Flow<List<GameJoinRequest>> = callbackFlow {
        // PERF P1 #12: Adicionado .limit(100) para evitar leitura ilimitada em real-time
        val listener = firestore.collection(COLLECTION_GAME_REQUESTS)
            .whereEqualTo("game_id", gameId)
            .whereEqualTo("status", RequestStatus.PENDING.name)
            .orderBy("requested_at", com.google.firebase.firestore.Query.Direction.DESCENDING)
            .limit(100)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    return@addSnapshotListener
                }

                val requests = snapshot?.documents?.mapNotNull { doc ->
                    docToGameJoinRequest(doc.id, doc.data)
                } ?: emptyList()
                trySend(requests)
            }

        awaitClose { listener.remove() }
    }

    override suspend fun getAllRequests(gameId: String): Result<List<GameJoinRequest>> {
        return try {
            // PERF P1 #12: Adicionado .limit(200) para evitar leitura ilimitada
            val snapshot = firestore.collection(COLLECTION_GAME_REQUESTS)
                .whereEqualTo("game_id", gameId)
                .orderBy("requested_at", com.google.firebase.firestore.Query.Direction.DESCENDING)
                .limit(200) // Maximo de 200 solicitacoes por jogo (incluindo historico)
                .get()
                .await()

            val requests = snapshot.documents.mapNotNull { doc ->
                docToGameJoinRequest(doc.id, doc.data)
            }
            Result.success(requests)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun approveRequest(requestId: String): Result<Unit> {
        return try {
            val currentUserId = authRepository.getCurrentUserId()
                ?: return Result.failure(Exception("Usuário não autenticado"))

            firestore.collection(COLLECTION_GAME_REQUESTS)
                .document(requestId)
                .update(
                    mapOf(
                        "status" to RequestStatus.APPROVED.name,
                        "reviewed_at" to com.google.firebase.firestore.FieldValue.serverTimestamp(),
                        "reviewed_by" to currentUserId
                    )
                )
                .await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun rejectRequest(requestId: String, reason: String?): Result<Unit> {
        return try {
            val currentUserId = authRepository.getCurrentUserId()
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val updateData = mutableMapOf<String, Any>(
                "status" to RequestStatus.REJECTED.name,
                "reviewed_at" to com.google.firebase.firestore.FieldValue.serverTimestamp(),
                "reviewed_by" to currentUserId
            )

            if (!reason.isNullOrBlank()) {
                updateData["rejection_reason"] = reason
            }

            firestore.collection(COLLECTION_GAME_REQUESTS)
                .document(requestId)
                .update(updateData)
                .await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getUserRequests(): Result<List<GameJoinRequest>> {
        return try {
            val currentUserId = authRepository.getCurrentUserId()
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val snapshot = firestore.collection(COLLECTION_GAME_REQUESTS)
                .whereEqualTo("user_id", currentUserId)
                .orderBy("requested_at", com.google.firebase.firestore.Query.Direction.DESCENDING)
                .limit(50)
                .get()
                .await()

            val requests = snapshot.documents.mapNotNull { doc ->
                docToGameJoinRequest(doc.id, doc.data)
            }
            Result.success(requests)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun getUserRequestsFlow(): Flow<List<GameJoinRequest>> = callbackFlow {
        val currentUserId = authRepository.getCurrentUserId()
        if (currentUserId == null) {
            trySend(emptyList())
            close()
            return@callbackFlow
        }

        val listener = firestore.collection(COLLECTION_GAME_REQUESTS)
            .whereEqualTo("user_id", currentUserId)
            .orderBy("requested_at", com.google.firebase.firestore.Query.Direction.DESCENDING)
            .limit(50)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    return@addSnapshotListener
                }

                val requests = snapshot?.documents?.mapNotNull { doc ->
                    docToGameJoinRequest(doc.id, doc.data)
                } ?: emptyList()
                trySend(requests)
            }

        awaitClose { listener.remove() }
    }

    override suspend fun hasActiveRequest(gameId: String): Result<Boolean> {
        return try {
            val currentUserId = authRepository.getCurrentUserId()
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val snapshot = firestore.collection(COLLECTION_GAME_REQUESTS)
                .whereEqualTo("game_id", gameId)
                .whereEqualTo("user_id", currentUserId)
                .whereEqualTo("status", RequestStatus.PENDING.name)
                .limit(1)
                .get()
                .await()

            Result.success(!snapshot.isEmpty)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun cancelRequest(requestId: String): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_GAME_REQUESTS)
                .document(requestId)
                .delete()
                .await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun docToGameJoinRequest(id: String, data: Map<String, Any>?): GameJoinRequest? {
        if (data == null) return null
        return try {
            GameJoinRequest(
                id = id,
                gameId = data["game_id"] as? String ?: "",
                userId = data["user_id"] as? String ?: "",
                userName = data["user_name"] as? String ?: "",
                userPhoto = data["user_photo"] as? String,
                userLevel = (data["user_level"] as? Number)?.toInt() ?: 1,
                userPosition = data["user_position"] as? String,
                message = data["message"] as? String ?: "",
                status = data["status"] as? String ?: RequestStatus.PENDING.name,
                requestedAt = (data["requested_at"] as? com.google.firebase.Timestamp)?.seconds?.times(1000),
                reviewedAt = (data["reviewed_at"] as? com.google.firebase.Timestamp)?.seconds?.times(1000),
                reviewedBy = data["reviewed_by"] as? String,
                rejectionReason = data["rejection_reason"] as? String
            )
        } catch (e: Exception) {
            null
        }
    }
}
