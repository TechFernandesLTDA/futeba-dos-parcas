package com.futebadosparcas.data

import com.futebadosparcas.domain.model.GameJoinRequest
import com.futebadosparcas.domain.model.RequestStatus
import com.futebadosparcas.domain.repository.AuthRepository
import com.futebadosparcas.domain.repository.GameRequestRepository
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.firestore.Direction
import dev.gitlive.firebase.firestore.DocumentSnapshot
import dev.gitlive.firebase.firestore.FieldValue
import dev.gitlive.firebase.firestore.Timestamp
import dev.gitlive.firebase.firestore.firestore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf

/**
 * Implementação compartilhada (Android+iOS) do GameRequestRepository.
 *
 * Usa GitLive Firebase Kotlin SDK (cross-platform).
 */
class GameRequestRepositoryImpl(
    private val firebaseDataSource: FirebaseDataSource,
    private val authRepository: AuthRepository
) : GameRequestRepository {

    companion object {
        private const val COLLECTION_GAME_REQUESTS = "game_requests"
    }

    private val firestore = Firebase.firestore
    private val collection = firestore.collection(COLLECTION_GAME_REQUESTS)

    override suspend fun requestJoinGame(
        gameId: String,
        message: String,
        position: String?
    ): Result<GameJoinRequest> {
        return try {
            val currentUser = authRepository.getCurrentUser().getOrNull()
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val existingRequest = hasActiveRequest(gameId).getOrNull()
            if (existingRequest == true) {
                return Result.failure(Exception("Você já tem uma solicitação pendente para este jogo"))
            }

            val docRef = collection.document
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
                "requested_at" to FieldValue.serverTimestamp,
            )

            docRef.set(requestData)
            Result.success(requestWithId)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getPendingRequests(gameId: String): Result<List<GameJoinRequest>> {
        return try {
            val snapshot = collection
                .where { "game_id" equalTo gameId }
                .where { "status" equalTo RequestStatus.PENDING.name }
                .orderBy("requested_at", Direction.DESCENDING)
                .limit(100)
                .get()
            Result.success(snapshot.documents.mapNotNull { docToGameJoinRequest(it.id, it) })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun getPendingRequestsFlow(gameId: String): Flow<List<GameJoinRequest>> = flow {
        collection
            .where { "game_id" equalTo gameId }
            .where { "status" equalTo RequestStatus.PENDING.name }
            .orderBy("requested_at", Direction.DESCENDING)
            .limit(100)
            .snapshots
            .catch { emit(emptyList()) }
            .collect { snap ->
                emit(snap.documents.mapNotNull { docToGameJoinRequest(it.id, it) })
            }
    }

    override suspend fun getAllRequests(gameId: String): Result<List<GameJoinRequest>> {
        return try {
            val snapshot = collection
                .where { "game_id" equalTo gameId }
                .orderBy("requested_at", Direction.DESCENDING)
                .limit(100)
                .get()
            Result.success(snapshot.documents.mapNotNull { docToGameJoinRequest(it.id, it) })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun approveRequest(requestId: String): Result<Unit> {
        return try {
            val currentUserId = authRepository.getCurrentUserId()
                ?: return Result.failure(Exception("Usuário não autenticado"))
            collection.document(requestId).update(
                mapOf(
                    "status" to RequestStatus.APPROVED.name,
                    "reviewed_at" to FieldValue.serverTimestamp,
                    "reviewed_by" to currentUserId,
                )
            )
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
                "reviewed_at" to FieldValue.serverTimestamp,
                "reviewed_by" to currentUserId,
            )
            if (!reason.isNullOrBlank()) {
                updateData["rejection_reason"] = reason
            }
            collection.document(requestId).update(updateData)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun getUserRequests(): Result<List<GameJoinRequest>> {
        return try {
            val currentUserId = authRepository.getCurrentUserId()
                ?: return Result.failure(Exception("Usuário não autenticado"))
            val snapshot = collection
                .where { "user_id" equalTo currentUserId }
                .orderBy("requested_at", Direction.DESCENDING)
                .limit(50)
                .get()
            Result.success(snapshot.documents.mapNotNull { docToGameJoinRequest(it.id, it) })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun getUserRequestsFlow(): Flow<List<GameJoinRequest>> {
        val currentUserId = authRepository.getCurrentUserId() ?: return flowOf(emptyList())
        return flow {
            collection
                .where { "user_id" equalTo currentUserId }
                .orderBy("requested_at", Direction.DESCENDING)
                .limit(50)
                .snapshots
                .catch { emit(emptyList()) }
                .collect { snap ->
                    emit(snap.documents.mapNotNull { docToGameJoinRequest(it.id, it) })
                }
        }
    }

    override suspend fun hasActiveRequest(gameId: String): Result<Boolean> {
        return try {
            val currentUserId = authRepository.getCurrentUserId()
                ?: return Result.failure(Exception("Usuário não autenticado"))
            val snapshot = collection
                .where { "game_id" equalTo gameId }
                .where { "user_id" equalTo currentUserId }
                .where { "status" equalTo RequestStatus.PENDING.name }
                .limit(1)
                .get()
            Result.success(snapshot.documents.isNotEmpty())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun cancelRequest(requestId: String): Result<Unit> {
        return try {
            collection.document(requestId).delete()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun docToGameJoinRequest(id: String, doc: DocumentSnapshot): GameJoinRequest? {
        return try {
            val requestedAtTs = doc.get<Timestamp?>("requested_at")
            val reviewedAtTs = doc.get<Timestamp?>("reviewed_at")
            GameJoinRequest(
                id = id,
                gameId = doc.get<String?>("game_id") ?: "",
                userId = doc.get<String?>("user_id") ?: "",
                userName = doc.get<String?>("user_name") ?: "",
                userPhoto = doc.get<String?>("user_photo"),
                userLevel = doc.get<Long?>("user_level")?.toInt() ?: 1,
                userPosition = doc.get<String?>("user_position"),
                message = doc.get<String?>("message") ?: "",
                status = doc.get<String?>("status") ?: RequestStatus.PENDING.name,
                requestedAt = requestedAtTs?.let { it.seconds * 1000L + it.nanoseconds / 1_000_000L },
                reviewedAt = reviewedAtTs?.let { it.seconds * 1000L + it.nanoseconds / 1_000_000L },
                reviewedBy = doc.get<String?>("reviewed_by"),
                rejectionReason = doc.get<String?>("rejection_reason"),
            )
        } catch (_: Exception) {
            null
        }
    }
}
