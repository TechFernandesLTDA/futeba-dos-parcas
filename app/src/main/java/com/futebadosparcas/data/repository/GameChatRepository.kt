package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.GameChatMessage
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

/**
 * Repository do chat em tempo real por jogo (issue #3230, épico #3240).
 *
 * Padrão B (app-level): callbackFlow + addSnapshotListener, espelha
 * [LiveGameRepository]. Coleção: games/{gameId}/chat/{messageId}.
 *
 * Regras de escrita validadas em firestore.rules (create só confirmados/
 * owner/admin, created_at == request.time, arquivamento 7d, soft-delete).
 */
class GameChatRepository constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth
) {
    private fun chatCollection(gameId: String) =
        firestore.collection("games").document(gameId).collection("chat")

    companion object {
        private const val TAG = "GameChatRepository"
        private const val MAX_TEXT_LENGTH = 500
        private const val PAGE_SIZE = 50L
    }

    /**
     * Observa mensagens do chat em tempo real (asc por created_at).
     * Erros propagados via close(error) → consumer usa .catch {}.
     */
    fun observeMessages(gameId: String): Flow<List<GameChatMessage>> = callbackFlow {
        val listener = chatCollection(gameId)
            .orderBy("created_at", Query.Direction.ASCENDING)
            .limit(PAGE_SIZE)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    AppLogger.e(TAG, "Erro ao observar chat do jogo $gameId", error)
                    close(error)
                    return@addSnapshotListener
                }

                val messages = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(GameChatMessage::class.java)?.copy(id = doc.id)
                }?.filter { it.deletedAt == null } ?: emptyList()

                trySend(messages)
            }

        awaitClose { listener.remove() }
    }

    /**
     * Envia mensagem. Valida texto 1..500 e autoria (sender_id == uid).
     * created_at via FieldValue.serverTimestamp() (rules validam == request.time).
     */
    suspend fun sendMessage(gameId: String, text: String): Result<Unit> {
        return try {
            val currentUser = auth.currentUser
                ?: throw IllegalStateException("Usuário não autenticado")
            val cleanText = text.trim()
            require(cleanText.isNotEmpty() && cleanText.length <= MAX_TEXT_LENGTH) {
                "Texto deve ter entre 1 e $MAX_TEXT_LENGTH caracteres"
            }

            val message = mapOf(
                "sender_id" to currentUser.uid,
                "sender_name" to (currentUser.displayName ?: "Jogador"),
                "sender_photo_url" to (currentUser.photoUrl?.toString() ?: null),
                "text" to cleanText,
                "created_at" to FieldValue.serverTimestamp(),
                "deleted_by" to null,
                "deleted_at" to null
            )

            chatCollection(gameId).add(message).await()
            AppLogger.d(TAG) { "Mensagem enviada no jogo $gameId" }
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao enviar mensagem no jogo $gameId", e)
            Result.failure(e)
        }
    }

    /**
     * Soft-delete (deleted_by + deleted_at via serverTimestamp).
     * Rules validam que só autor/owner/admin pode soft-deletar.
     */
    suspend fun deleteMessage(gameId: String, messageId: String): Result<Unit> {
        return try {
            val currentUser = auth.currentUser
                ?: throw IllegalStateException("Usuário não autenticado")

            val updates = mapOf(
                "deleted_by" to currentUser.uid,
                "deleted_at" to FieldValue.serverTimestamp()
            )

            chatCollection(gameId).document(messageId).update(updates).await()
            AppLogger.d(TAG) { "Mensagem $messageId soft-deletada no jogo $gameId" }
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao deletar mensagem $messageId no jogo $gameId", e)
            Result.failure(e)
        }
    }
}
