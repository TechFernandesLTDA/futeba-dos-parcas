package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.GameJoinRequest
import com.futebadosparcas.data.model.RequestStatus
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

@Singleton
class GameRequestRepositoryImpl @Inject constructor(
    private val firestore: FirebaseFirestore,
    private val authRepository: AuthRepository
) : GameRequestRepository {

    companion object {
        private const val TAG = "GameRequestRepository"
        private const val COLLECTION_GAME_REQUESTS = "game_requests"
    }

    override suspend fun requestJoinGame(
        gameId: String,
        message: String,
        position: String?
    ): Result<GameJoinRequest> {
        return try {
            val currentUser = authRepository.getCurrentUser().getOrNull()
                ?: return Result.failure(Exception("Usuário não autenticado"))

            // Verificar se já existe solicitação ativa
            val existingRequest = hasActiveCampaignRequest(gameId).getOrNull()
            if (existingRequest == true) {
                return Result.failure(Exception("Você já tem uma solicitação pendente para este jogo"))
            }

            val request = GameJoinRequest(
                gameId = gameId,
                userId = currentUser.id,
                userName = currentUser.getDisplayName(),
                userPhoto = currentUser.photoUrl,
                userLevel = currentUser.level,
                userPosition = position,
                message = message,
                status = RequestStatus.PENDING.name,
                requestedAt = Date()
            )

            val docRef = firestore.collection(COLLECTION_GAME_REQUESTS).document()
            val requestWithId = request.copy(id = docRef.id)

            docRef.set(requestWithId).await()

            AppLogger.d(TAG) { "Solicitação criada: ${docRef.id} para jogo $gameId" }
            Result.success(requestWithId)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao criar solicitação", e)
            Result.failure(e)
        }
    }

    override suspend fun getPendingRequests(gameId: String): Result<List<GameJoinRequest>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_GAME_REQUESTS)
                .whereEqualTo("game_id", gameId)
                .whereEqualTo("status", RequestStatus.PENDING.name)
                .orderBy("requested_at", Query.Direction.DESCENDING)
                .get()
                .await()

            val requests = snapshot.toObjects(GameJoinRequest::class.java)
            Result.success(requests)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar solicitações pendentes", e)
            Result.failure(e)
        }
    }

    override fun getPendingRequestsFlow(gameId: String): Flow<List<GameJoinRequest>> = callbackFlow {
        val listener = firestore.collection(COLLECTION_GAME_REQUESTS)
            .whereEqualTo("game_id", gameId)
            .whereEqualTo("status", RequestStatus.PENDING.name)
            .orderBy("requested_at", Query.Direction.DESCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    AppLogger.e(TAG, "Erro no listener de solicitações", error)
                    return@addSnapshotListener
                }

                val requests = snapshot?.toObjects(GameJoinRequest::class.java) ?: emptyList()
                trySend(requests)
            }

        awaitClose { listener.remove() }
    }

    override suspend fun getAllRequests(gameId: String): Result<List<GameJoinRequest>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_GAME_REQUESTS)
                .whereEqualTo("game_id", gameId)
                .orderBy("requested_at", Query.Direction.DESCENDING)
                .get()
                .await()

            val requests = snapshot.toObjects(GameJoinRequest::class.java)
            Result.success(requests)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar todas as solicitações", e)
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
                        "reviewed_at" to FieldValue.serverTimestamp(),
                        "reviewed_by" to currentUserId
                    )
                )
                .await()

            AppLogger.d(TAG) { "Solicitação aprovada: $requestId" }
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao aprovar solicitação", e)
            Result.failure(e)
        }
    }

    override suspend fun rejectRequest(requestId: String, reason: String?): Result<Unit> {
        return try {
            val currentUserId = authRepository.getCurrentUserId()
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val updateData = mutableMapOf<String, Any>(
                "status" to RequestStatus.REJECTED.name,
                "reviewed_at" to FieldValue.serverTimestamp(),
                "reviewed_by" to currentUserId
            )

            if (!reason.isNullOrBlank()) {
                updateData["rejection_reason"] = reason
            }

            firestore.collection(COLLECTION_GAME_REQUESTS)
                .document(requestId)
                .update(updateData)
                .await()

            AppLogger.d(TAG) { "Solicitação rejeitada: $requestId" }
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao rejeitar solicitação", e)
            Result.failure(e)
        }
    }

    override suspend fun getUserRequests(): Result<List<GameJoinRequest>> {
        return try {
            val currentUserId = authRepository.getCurrentUserId()
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val snapshot = firestore.collection(COLLECTION_GAME_REQUESTS)
                .whereEqualTo("user_id", currentUserId)
                .orderBy("requested_at", Query.Direction.DESCENDING)
                .limit(50)
                .get()
                .await()

            val requests = snapshot.toObjects(GameJoinRequest::class.java)
            Result.success(requests)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao buscar solicitações do usuário", e)
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
            .orderBy("requested_at", Query.Direction.DESCENDING)
            .limit(50)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    AppLogger.e(TAG, "Erro no listener de solicitações do usuário", error)
                    return@addSnapshotListener
                }

                val requests = snapshot?.toObjects(GameJoinRequest::class.java) ?: emptyList()
                trySend(requests)
            }

        awaitClose { listener.remove() }
    }

    override suspend fun hasActiveCampaignRequest(gameId: String): Result<Boolean> {
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
            AppLogger.e(TAG, "Erro ao verificar solicitação ativa", e)
            Result.failure(e)
        }
    }

    override suspend fun cancelRequest(requestId: String): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_GAME_REQUESTS)
                .document(requestId)
                .delete()
                .await()

            AppLogger.d(TAG) { "Solicitação cancelada: $requestId" }
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao cancelar solicitação", e)
            Result.failure(e)
        }
    }
}
