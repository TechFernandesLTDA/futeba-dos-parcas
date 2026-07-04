package com.futebadosparcas.data.repository

import android.net.Uri
import com.futebadosparcas.data.model.GroupWallPost
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.QueryDocumentSnapshot
import com.google.firebase.storage.FirebaseStorage
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import java.util.UUID

/**
 * Repository do mural de resenha/provocações do grupo (issue #3232, épico #3240).
 *
 * Padrão: callbackFlow + addSnapshotListener, espelha [GameChatRepository].
 * Coleção: groups/{groupId}/wall_posts/{postId}.
 *
 * Regras de escrita validadas em firestore.rules (create só membros ativos,
 * created_at == request.time, soft-delete, pin por admin).
 */
class GroupWallRepository constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
    private val storage: FirebaseStorage
) {
    private fun wallCollection(groupId: String) =
        firestore.collection("groups").document(groupId).collection("wall_posts")

    companion object {
        private const val TAG = "GroupWallRepository"
        private const val MAX_TEXT_LENGTH = 500
        private const val PAGE_SIZE = 20L
        private const val MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024L
    }

    /**
     * Observa posts do mural em tempo real (desc por created_at).
     * Erros propagados via close(error) → consumer usa .catch {}.
     */
    fun observePosts(groupId: String): Flow<List<GroupWallPost>> = callbackFlow {
        val listener = wallCollection(groupId)
            .orderBy("created_at", Query.Direction.DESCENDING)
            .limit(PAGE_SIZE)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    AppLogger.e(TAG, "Erro ao observar mural do grupo $groupId", error)
                    close(error)
                    return@addSnapshotListener
                }

                val posts = snapshot?.documents?.mapNotNull { doc ->
                    doc.toObject(GroupWallPost::class.java)?.copy(id = doc.id)
                }?.filter { !it.isDeleted() } ?: emptyList()

                trySend(posts)
            }

        awaitClose { listener.remove() }
    }

    /**
     * Cria post no mural. Valida texto 1..500 e autoria (author_id == uid).
     * created_at via FieldValue.serverTimestamp() (rules validam == request.time).
     */
    suspend fun createPost(groupId: String, text: String, imageUri: Uri? = null): Result<Unit> {
        return try {
            val currentUser = auth.currentUser
                ?: throw IllegalStateException("Usuário não autenticado")
            val cleanText = text.trim()
            require(cleanText.isNotEmpty() || imageUri != null) {
                "Escreva algo ou anexe uma foto"
            }
            require(cleanText.length <= MAX_TEXT_LENGTH) {
                "Texto deve ter no máximo $MAX_TEXT_LENGTH caracteres"
            }

            var mediaUrl: String? = null
            var mediaPath: String? = null
            var mediaType: String? = null

            if (imageUri != null) {
                val uploadResult = uploadWallMedia(groupId, imageUri)
                mediaUrl = uploadResult.first
                mediaPath = uploadResult.second
                mediaType = "image/jpeg"
            }

            val post = mapOf(
                "group_id" to groupId,
                "author_id" to currentUser.uid,
                "author_name" to (currentUser.displayName ?: "Jogador"),
                "author_photo_url" to (currentUser.photoUrl?.toString() ?: null),
                "text" to cleanText,
                "media_url" to mediaUrl,
                "media_path" to mediaPath,
                "media_type" to mediaType,
                "thumbnail_path" to null,
                "highlight_ref" to null,
                "pinned" to false,
                "pinned_by" to null,
                "pinned_at" to null,
                "reactions" to emptyMap<String, List<String>>(),
                "comments_count" to 0,
                "created_at" to FieldValue.serverTimestamp(),
                "updated_at" to FieldValue.serverTimestamp(),
                "edited_at" to null,
                "deleted_by" to null,
                "deleted_at" to null
            )

            wallCollection(groupId).add(post).await()
            AppLogger.d(TAG) { "Post criado no mural do grupo $groupId" }
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao criar post no mural do grupo $groupId", e)
            Result.failure(e)
        }
    }

    /**
     * Edita texto do próprio post.
     */
    suspend fun editPost(groupId: String, postId: String, text: String): Result<Unit> {
        return try {
            val currentUser = auth.currentUser
                ?: throw IllegalStateException("Usuário não autenticado")
            val cleanText = text.trim()
            require(cleanText.isNotEmpty() && cleanText.length <= MAX_TEXT_LENGTH) {
                "Texto deve ter entre 1 e $MAX_TEXT_LENGTH caracteres"
            }

            val updates = mapOf(
                "text" to cleanText,
                "edited_at" to FieldValue.serverTimestamp(),
                "updated_at" to FieldValue.serverTimestamp()
            )

            wallCollection(groupId).document(postId).update(updates).await()
            AppLogger.d(TAG) { "Post $postId editado no grupo $groupId" }
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao editar post $postId no grupo $groupId", e)
            Result.failure(e)
        }
    }

    /**
     * Fixa/desfixa post no topo do mural. Apenas admin/owner do grupo.
     */
    suspend fun togglePin(groupId: String, postId: String, pinned: Boolean): Result<Unit> {
        return try {
            val currentUser = auth.currentUser
                ?: throw IllegalStateException("Usuário não autenticado")

            val updates = if (pinned) {
                mapOf(
                    "pinned" to true,
                    "pinned_by" to currentUser.uid,
                    "pinned_at" to FieldValue.serverTimestamp(),
                    "updated_at" to FieldValue.serverTimestamp()
                )
            } else {
                mapOf(
                    "pinned" to false,
                    "pinned_by" to null,
                    "pinned_at" to null,
                    "updated_at" to FieldValue.serverTimestamp()
                )
            }

            wallCollection(groupId).document(postId).update(updates).await()
            AppLogger.d(TAG) { "Post $postId pin=$pinned no grupo $groupId" }
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao alterar pin do post $postId no grupo $groupId", e)
            Result.failure(e)
        }
    }

    /**
     * Soft-delete (deleted_by + deleted_at via serverTimestamp).
     * Rules validam que só autor/owner/admin pode soft-deletar.
     */
    suspend fun deletePost(groupId: String, postId: String, mediaPath: String?): Result<Unit> {
        return try {
            val currentUser = auth.currentUser
                ?: throw IllegalStateException("Usuário não autenticado")

            val batch = firestore.batch()
            val postRef = wallCollection(groupId).document(postId)
            batch.update(
                postRef,
                mapOf(
                    "deleted_by" to currentUser.uid,
                    "deleted_at" to FieldValue.serverTimestamp(),
                    "updated_at" to FieldValue.serverTimestamp()
                )
            )
            batch.commit().await()

            if (!mediaPath.isNullOrBlank()) {
                try {
                    storage.getReference(mediaPath).delete().await()
                } catch (e: Exception) {
                    AppLogger.w(TAG) { "Falha ao deletar mídia $mediaPath: ${e.message}" }
                }
            }

            AppLogger.d(TAG) { "Post $postId soft-deletado no grupo $groupId" }
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao deletar post $postId no grupo $groupId", e)
            Result.failure(e)
        }
    }

    private suspend fun uploadWallMedia(groupId: String, uri: Uri): Pair<String, String> {
        val currentUser = auth.currentUser ?: throw IllegalStateException("Usuário não autenticado")
        val extension = "jpg"
        val fileName = "${System.currentTimeMillis()}-${UUID.randomUUID()}.$extension"
        val path = "groups/$groupId/wall_media/__draft__/${currentUser.uid}/$fileName"
        val ref = storage.getReference(path)

        val metadata = com.google.firebase.storage.StorageMetadata.Builder()
            .setContentType("image/jpeg")
            .build()

        ref.putFile(uri, metadata).await()
        val downloadUrl = ref.downloadUrl.await().toString()
        return downloadUrl to path
    }
}
