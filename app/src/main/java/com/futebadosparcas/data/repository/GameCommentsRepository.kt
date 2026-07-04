package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.GameComment
import com.futebadosparcas.ui.components.reactions.SocialReactionEmojis
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
 * Repository dos comentários livres por jogo (issue #3234, épico #3240).
 */
class GameCommentsRepository constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth
) {
    private fun commentsCollection(gameId: String) =
        firestore.collection("games").document(gameId).collection("comments")

    companion object {
        private const val TAG = "GameCommentsRepository"
        private const val MAX_TEXT_LENGTH = 500
        private const val VOTE_RESULT_MAX_TEXT_LENGTH = 200
        private const val PAGE_SIZE = 30L
    }

    fun observeComments(gameId: String, context: String = "game"): Flow<List<GameComment>> = callbackFlow {
        val listener = commentsCollection(gameId)
            .orderBy("created_at", Query.Direction.DESCENDING)
            .limit(PAGE_SIZE)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    AppLogger.e(TAG, "Erro ao observar comentários do jogo $gameId", error)
                    close(error)
                    return@addSnapshotListener
                }

                val comments = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(GameComment::class.java)?.copy(id = doc.id)
                }?.asReversed()?.filter {
                    it.deletedAt == null && it.context.ifBlank { "game" } == context
                } ?: emptyList()

                trySend(comments)
            }

        awaitClose { listener.remove() }
    }

    suspend fun addComment(
        gameId: String,
        text: String,
        parentId: String? = null,
        context: String = "game"
    ): Result<Unit> = runCatching {
        val currentUser = auth.currentUser
            ?: throw IllegalStateException("Usuário não autenticado")
        val cleanText = validateText(text, context)

        val comment = mapOf(
            "author_id" to currentUser.uid,
            "author_name" to (currentUser.displayName ?: "Jogador"),
            "author_photo_url" to (currentUser.photoUrl?.toString() ?: null),
            "text" to cleanText,
            "parent_id" to parentId,
            "created_at" to FieldValue.serverTimestamp(),
            "edited_at" to null,
            "deleted_by" to null,
            "deleted_at" to null,
            "reactions" to emptyMap<String, List<String>>(),
            "context" to context
        )

        commentsCollection(gameId).add(comment).await()
        AppLogger.d(TAG) { "Comentário criado no jogo $gameId" }
    }.onFailure { e ->
        AppLogger.e(TAG, "Erro ao criar comentário no jogo $gameId", e)
    }

    suspend fun editComment(
        gameId: String,
        commentId: String,
        text: String
    ): Result<Unit> = runCatching {
        val cleanText = validateText(text)
        commentsCollection(gameId).document(commentId).update(
            mapOf(
                "text" to cleanText,
                "edited_at" to FieldValue.serverTimestamp()
            )
        ).await()
        AppLogger.d(TAG) { "Comentário $commentId editado no jogo $gameId" }
    }.onFailure { e ->
        AppLogger.e(TAG, "Erro ao editar comentário $commentId no jogo $gameId", e)
    }

    suspend fun deleteComment(gameId: String, commentId: String): Result<Unit> = runCatching {
        val currentUser = auth.currentUser
            ?: throw IllegalStateException("Usuário não autenticado")
        commentsCollection(gameId).document(commentId).update(
            mapOf(
                "deleted_by" to currentUser.uid,
                "deleted_at" to FieldValue.serverTimestamp()
            )
        ).await()
        AppLogger.d(TAG) { "Comentário $commentId soft-deletado no jogo $gameId" }
    }.onFailure { e ->
        AppLogger.e(TAG, "Erro ao deletar comentário $commentId no jogo $gameId", e)
    }

    suspend fun toggleReaction(
        gameId: String,
        comment: GameComment,
        emoji: String
    ): Result<Unit> = runCatching {
        require(emoji in SocialReactionEmojis) { "Reação inválida" }
        val currentUser = auth.currentUser
            ?: throw IllegalStateException("Usuário não autenticado")
        val uid = currentUser.uid
        val currentEmoji = SocialReactionEmojis.firstOrNull { reaction ->
            comment.reactions[reaction].orEmpty().contains(uid)
        }
        val updates = mutableMapOf<String, Any>()

        SocialReactionEmojis.forEach { reaction ->
            if (currentEmoji == emoji || reaction != emoji) {
                updates["reactions.$reaction"] = FieldValue.arrayRemove(uid)
            }
        }
        if (currentEmoji != emoji) {
            updates["reactions.$emoji"] = FieldValue.arrayUnion(uid)
        }

        commentsCollection(gameId).document(comment.id).update(updates).await()
        AppLogger.d(TAG) { "Reação $emoji alternada no comentário ${comment.id}" }
    }.onFailure { e ->
        AppLogger.e(TAG, "Erro ao alternar reação no comentário ${comment.id}", e)
    }

    private fun validateText(text: String, context: String = "game"): String {
        val cleanText = text.trim()
        val maxLength = if (context == "vote_result") VOTE_RESULT_MAX_TEXT_LENGTH else MAX_TEXT_LENGTH
        require(cleanText.isNotEmpty() && cleanText.length <= maxLength) {
            "Comentário deve ter entre 1 e $maxLength caracteres"
        }
        return cleanText
    }
}
