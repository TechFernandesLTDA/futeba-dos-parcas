package com.futebadosparcas.data.repository

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import java.util.Date

/**
 * Modelo de solicitacao de entrada em grupo publico (issue #517 Phase 2).
 */
data class JoinRequest(
    val id: String = "",
    val userId: String = "",
    val userName: String = "",
    val userPhoto: String? = null,
    val status: JoinRequestStatus = JoinRequestStatus.PENDING,
    val requestedAt: Date? = null,
    val respondedAt: Date? = null,
    val respondedBy: String? = null
)

enum class JoinRequestStatus {
    PENDING,
    APPROVED,
    REJECTED;

    companion object {
        fun fromString(s: String?): JoinRequestStatus =
            entries.find { it.name == s } ?: PENDING
    }
}

/**
 * Repository para join_requests em grupos publicos (issue #517 Phase 2).
 *
 * Fluxo:
 *  - requester chama createRequest() em grupo publico (status=PENDING)
 *  - owner/admin chama approve() ou reject() (transicao PENDING -> APPROVED/REJECTED)
 *  - Cloud Function onJoinRequestApproved cria member automaticamente
 */
class JoinRequestRepository(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
) {
    private fun joinRequestsCol(groupId: String) =
        firestore.collection("groups").document(groupId).collection("join_requests")

    /**
     * Observa o request do USUARIO ATUAL em um grupo.
     * Emite null se nao tem request, ou o JoinRequest existente.
     */
    fun observeMyRequest(groupId: String): Flow<JoinRequest?> = callbackFlow {
        val userId = auth.currentUser?.uid ?: run {
            trySend(null)
            close()
            return@callbackFlow
        }
        val listener = joinRequestsCol(groupId).document(userId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(null)
                    return@addSnapshotListener
                }
                if (snapshot == null || !snapshot.exists()) {
                    trySend(null)
                    return@addSnapshotListener
                }
                trySend(snapshot.toJoinRequest())
            }
        awaitClose { listener.remove() }
    }

    /**
     * Observa todos os requests PENDING em um grupo (apenas owner/admin pode ler).
     * Ordenado por requested_at ASC (mais antigos primeiro).
     */
    fun observePendingRequests(groupId: String): Flow<List<JoinRequest>> = callbackFlow {
        val listener = joinRequestsCol(groupId)
            .whereEqualTo("status", JoinRequestStatus.PENDING.name)
            .orderBy("requested_at", Query.Direction.ASCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(emptyList())
                    return@addSnapshotListener
                }
                val items = snapshot?.documents
                    ?.mapNotNull { it.toJoinRequest() }
                    ?: emptyList()
                trySend(items)
            }
        awaitClose { listener.remove() }
    }

    /**
     * Cria request do usuario atual no grupo. Rule garante:
     *  - grupo eh publico
     *  - usuario nao eh membro
     */
    suspend fun createRequest(
        groupId: String,
        userName: String,
        userPhoto: String?,
    ): Result<Unit> = try {
        val userId = auth.currentUser?.uid
            ?: return Result.failure(Exception("Usuario nao autenticado"))
        val data = mapOf(
            "user_id" to userId,
            "user_name" to userName,
            "user_photo" to userPhoto,
            "status" to JoinRequestStatus.PENDING.name,
            "requested_at" to FieldValue.serverTimestamp(),
        )
        joinRequestsCol(groupId).document(userId).set(data).await()
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }

    /**
     * Cancela proprio request (delete). Rule permite requester deletar proprio.
     */
    suspend fun cancelRequest(groupId: String): Result<Unit> = try {
        val userId = auth.currentUser?.uid
            ?: return Result.failure(Exception("Usuario nao autenticado"))
        joinRequestsCol(groupId).document(userId).delete().await()
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }

    /**
     * Owner/admin aprova request (PENDING -> APPROVED). Cloud Function
     * onJoinRequestApproved cria member + notification.
     */
    suspend fun approveRequest(groupId: String, requesterId: String): Result<Unit> = try {
        val approverId = auth.currentUser?.uid
            ?: return Result.failure(Exception("Usuario nao autenticado"))
        val updates = mapOf(
            "status" to JoinRequestStatus.APPROVED.name,
            "responded_at" to FieldValue.serverTimestamp(),
            "responded_by" to approverId,
        )
        joinRequestsCol(groupId).document(requesterId).update(updates).await()
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }

    /**
     * Owner/admin recusa request (PENDING -> REJECTED). Sem cascade.
     */
    suspend fun rejectRequest(groupId: String, requesterId: String): Result<Unit> = try {
        val approverId = auth.currentUser?.uid
            ?: return Result.failure(Exception("Usuario nao autenticado"))
        val updates = mapOf(
            "status" to JoinRequestStatus.REJECTED.name,
            "responded_at" to FieldValue.serverTimestamp(),
            "responded_by" to approverId,
        )
        joinRequestsCol(groupId).document(requesterId).update(updates).await()
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }

    private fun com.google.firebase.firestore.DocumentSnapshot.toJoinRequest(): JoinRequest? {
        return try {
            JoinRequest(
                id = id,
                userId = getString("user_id") ?: id,
                userName = getString("user_name") ?: "",
                userPhoto = getString("user_photo"),
                status = JoinRequestStatus.fromString(getString("status")),
                requestedAt = getDate("requested_at"),
                respondedAt = getDate("responded_at"),
                respondedBy = getString("responded_by"),
            )
        } catch (e: Exception) {
            null
        }
    }
}
