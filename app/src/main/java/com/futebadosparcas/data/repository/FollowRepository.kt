package com.futebadosparcas.data.repository

import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

/**
 * Follow/follower social graph backed by the toggleFollowUser callable (#3235).
 */
class FollowRepository(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
    private val functions: FirebaseFunctions
) {
    fun observeFollowing(targetUserId: String): Flow<Boolean> = callbackFlow {
        val currentUserId = auth.currentUser?.uid
        if (currentUserId.isNullOrBlank() || targetUserId.isBlank() || currentUserId == targetUserId) {
            trySend(false)
            close()
            return@callbackFlow
        }

        val listener = firestore.collection("users")
            .document(currentUserId)
            .collection("following")
            .document(targetUserId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    AppLogger.e(TAG, "Erro ao observar follow $currentUserId -> $targetUserId", error)
                    close(error)
                    return@addSnapshotListener
                }
                trySend(snapshot?.exists() == true)
            }

        awaitClose { listener.remove() }
    }

    suspend fun toggleFollow(targetUserId: String, follow: Boolean): Result<Boolean> = runCatching {
        require(targetUserId.isNotBlank()) { "Jogador inválido" }
        val currentUserId = auth.currentUser?.uid
            ?: throw IllegalStateException("Usuário não autenticado")
        require(currentUserId != targetUserId) { "Você não pode seguir a si mesmo" }

        val result = functions
            .getHttpsCallable("toggleFollowUser")
            .call(
                mapOf(
                    "targetUserId" to targetUserId,
                    "follow" to follow
                )
            )
            .await()

        val payload = result.data as? Map<*, *>
        payload?.get("following") as? Boolean ?: follow
    }.onFailure { error ->
        AppLogger.e(TAG, "Erro ao alternar follow para $targetUserId", error)
    }

    fun canFollow(targetUserId: String): Boolean {
        val currentUserId = auth.currentUser?.uid
        return !currentUserId.isNullOrBlank() && targetUserId.isNotBlank() && currentUserId != targetUserId
    }

    companion object {
        private const val TAG = "FollowRepository"
    }
}
