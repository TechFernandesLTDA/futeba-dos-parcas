package com.futebadosparcas.data.repository

import android.content.Context
import android.net.Uri
import com.futebadosparcas.data.model.GroupWallPost
import com.futebadosparcas.ui.components.reactions.SocialReactionEmojis
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.DocumentReference
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.storage.FirebaseStorage
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import java.util.Date
import java.util.UUID

data class GroupWallRealtimeSnapshot(
    val recentPosts: List<GroupWallPost>,
    val pinnedPosts: List<GroupWallPost>,
    val nextCursor: DocumentSnapshot?,
    val hasMore: Boolean
)

data class GroupWallPage(
    val posts: List<GroupWallPost>,
    val nextCursor: DocumentSnapshot?,
    val hasMore: Boolean
)

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
    private val storage: FirebaseStorage,
    private val context: Context,
    private val functions: FirebaseFunctions,
    private val mediaPipeline: GroupWallMediaPipeline = FirebaseGroupWallMediaPipeline(
        context = context,
        auth = auth,
        functions = functions,
        storage = storage,
        firestore = firestore
    )
) {
    private fun wallCollection(groupId: String) =
        firestore.collection("groups").document(groupId).collection("wall_posts")

    companion object {
        private const val TAG = "GroupWallRepository"
        private const val MAX_TEXT_LENGTH = 500
        private const val PAGE_SIZE = 20
    }

    /**
     * Observa posts do mural em tempo real (desc por created_at).
     * Erros propagados via close(error) → consumer usa .catch {}.
     */
    fun observePosts(groupId: String): Flow<GroupWallRealtimeSnapshot> = callbackFlow {
        var recentPosts = emptyList<GroupWallPost>()
        var pinnedPosts = emptyList<GroupWallPost>()
        var recentCursor: DocumentSnapshot? = null
        var recentHasMore = false
        var hasInitialRecentSnapshot = false
        var hasInitialPinnedSnapshot = false

        fun emitMergedPosts() {
            if (!hasInitialRecentSnapshot || !hasInitialPinnedSnapshot) {
                return
            }
            trySend(
                GroupWallRealtimeSnapshot(
                    recentPosts = recentPosts,
                    pinnedPosts = pinnedPosts,
                    nextCursor = recentCursor,
                    hasMore = recentHasMore
                )
            )
        }

        val recentListener = wallCollection(groupId)
            .orderBy("created_at", Query.Direction.DESCENDING)
            .limit((PAGE_SIZE + 1).toLong())
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    AppLogger.e(TAG, "Erro ao observar mural do grupo $groupId", error)
                    close(error)
                    return@addSnapshotListener
                }

                val documents = snapshot?.documents.orEmpty()
                val pageDocuments = documents.take(PAGE_SIZE)
                recentPosts = pageDocuments.toWallPosts()
                recentCursor = pageDocuments.lastOrNull()
                recentHasMore = documents.size > PAGE_SIZE
                hasInitialRecentSnapshot = true

                emitMergedPosts()
            }

        val pinnedListener = wallCollection(groupId)
            .whereEqualTo("pinned", true)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    AppLogger.e(TAG, "Erro ao observar fixados do mural do grupo $groupId", error)
                    close(error)
                    return@addSnapshotListener
                }

                pinnedPosts = snapshot?.documents.orEmpty().toWallPosts()
                hasInitialPinnedSnapshot = true

                emitMergedPosts()
            }

        awaitClose {
            recentListener.remove()
            pinnedListener.remove()
        }
    }

    /**
     * Carrega a próxima página histórica sem ampliar o listener em tempo real.
     * O cursor é o último documento bruto da página anterior para não perder
     * itens com o mesmo `created_at` e para avançar mesmo sobre soft-deletes.
     */
    suspend fun loadOlderPosts(
        groupId: String,
        after: DocumentSnapshot
    ): Result<GroupWallPage> {
        return try {
            val snapshot = wallCollection(groupId)
                .orderBy("created_at", Query.Direction.DESCENDING)
                .startAfter(after)
                .limit((PAGE_SIZE + 1).toLong())
                .get()
                .await()
            val pageDocuments = snapshot.documents.take(PAGE_SIZE)
            Result.success(
                GroupWallPage(
                    posts = pageDocuments.toWallPosts(),
                    nextCursor = pageDocuments.lastOrNull(),
                    hasMore = snapshot.documents.size > PAGE_SIZE
                )
            )
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            AppLogger.e(TAG, "Erro ao carregar posts antigos do grupo $groupId", error)
            Result.failure(error)
        }
    }

    /**
     * Cria post de texto diretamente ou envia foto/vídeo pelo pipeline assíncrono.
     *
     * [clientRequestId] é estável entre retries: texto usa esse valor como id do
     * documento e mídia o envia ao callable de reserva. Assim uma resposta perdida
     * não cria duas publicações. O callback só chega a 100 quando o upload terminou;
     * a função retorna sucesso apenas depois que o draft do servidor fica READY.
     */
    suspend fun createPost(
        groupId: String,
        text: String,
        mediaUri: Uri? = null,
        clientRequestId: String = UUID.randomUUID().toString(),
        onProgress: (Int) -> Unit = {}
    ): Result<Unit> {
        return try {
            val currentUser = auth.currentUser
                ?: error("Usuário não autenticado")
            val cleanText = text.trim()
            require(cleanText.length <= MAX_TEXT_LENGTH) {
                "Texto deve ter no máximo $MAX_TEXT_LENGTH caracteres"
            }
            require(CLIENT_REQUEST_ID_REGEX.matches(clientRequestId)) {
                "Identificador de envio inválido"
            }

            val media = mediaUri?.let { mediaPipeline.inspect(it) }
            require(cleanText.isNotEmpty() || media != null) {
                "Escreva uma mensagem ou escolha uma foto ou vídeo."
            }

            if (media == null) {
                createTextPostIdempotently(
                    groupId = groupId,
                    clientRequestId = clientRequestId,
                    authorId = currentUser.uid,
                    authorName = currentUser.displayName ?: "Jogador",
                    authorPhotoUrl = currentUser.photoUrl?.toString(),
                    text = cleanText
                )
            } else {
                createMediaPost(
                    groupId = groupId,
                    text = cleanText,
                    media = media,
                    clientRequestId = clientRequestId,
                    onProgress = onProgress
                )
            }

            AppLogger.d(TAG) { "Post criado no mural do grupo $groupId" }
            Result.success(Unit)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao criar post no mural do grupo $groupId", e)
            Result.failure(e)
        }
    }

    private suspend fun createTextPostIdempotently(
        groupId: String,
        clientRequestId: String,
        authorId: String,
        authorName: String,
        authorPhotoUrl: String?,
        text: String
    ) {
        val postRef = wallCollection(groupId).document(clientRequestId)
        val post = mapOf(
            "group_id" to groupId,
            "author_id" to authorId,
            "author_name" to authorName,
            "author_photo_url" to authorPhotoUrl,
            "text" to text,
            "media_url" to null,
            "media_path" to null,
            "media_type" to null,
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

        try {
            firestore.runTransaction { transaction ->
                val existing = transaction.get(postRef)
                if (existing.exists()) {
                    require(isSameTextPostIntent(existing.data.orEmpty(), authorId, text)) {
                        "Identificador de envio já utilizado por outra publicação"
                    }
                } else {
                    transaction.set(postRef, post)
                }
            }.await()
        } catch (e: CancellationException) {
            throw e
        } catch (writeError: Exception) {
            // Resposta de rede perdida depois do commit: confirma pelo id estável.
            val committed = postRef.matchesTextPostIntentOrFalse(authorId, text)
            if (!committed) throw writeError
        }
    }

    private suspend fun createMediaPost(
        groupId: String,
        text: String,
        media: GroupWallMediaFile,
        clientRequestId: String,
        onProgress: (Int) -> Unit
    ) {
        var lastReportedProgress: Int? = null
        val reportProgress: (Int) -> Unit = { progress ->
            val normalizedProgress = progress.coerceIn(0, 100)
            if (normalizedProgress != lastReportedProgress) {
                lastReportedProgress = normalizedProgress
                onProgress(normalizedProgress)
            }
        }
        val draft = mediaPipeline.createDraft(
            groupId = groupId,
            text = text,
            media = media,
            clientRequestId = clientRequestId
        )
        require(media.sizeBytes < draft.maxBytes) {
            "A mídia excede o limite aceito pelo servidor."
        }

        val initialStatus = mediaPipeline.getDraftStatus(groupId, draft.postId)
        when (initialStatus.state) {
            GroupWallMediaDraftState.AWAITING_UPLOAD -> {
                mediaPipeline.upload(draft, media, reportProgress)
            }
            GroupWallMediaDraftState.PROCESSING -> reportProgress(100)
            GroupWallMediaDraftState.READY,
            GroupWallMediaDraftState.REJECTED,
            GroupWallMediaDraftState.EXPIRED -> {
                initialStatus.requireReady()
                return
            }
            GroupWallMediaDraftState.UNKNOWN -> error(
                "O servidor retornou um estado de mídia desconhecido."
            )
        }

        reportProgress(100)
        mediaPipeline.awaitTerminalStatus(groupId, draft.postId).requireReady()
    }

    /**
     * Edita texto do próprio post.
     */
    suspend fun editPost(groupId: String, postId: String, text: String): Result<Unit> {
        return try {
            val currentUser = auth.currentUser
                ?: error("Usuário não autenticado")
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
                ?: error("Usuário não autenticado")

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
     * Alterna uma reação no post, mantendo no máximo uma reação ativa por usuário.
     */
    suspend fun toggleReaction(
        groupId: String,
        postId: String,
        reactions: Map<String, List<String>>?,
        emoji: String
    ): Result<Unit> {
        return try {
            val currentUser = auth.currentUser
                ?: error("Usuário não autenticado")
            require(SocialReactionEmojis.contains(emoji)) {
                "Reação inválida"
            }

            val uid = currentUser.uid
            val currentEmoji = SocialReactionEmojis.firstOrNull { reaction ->
                reactions?.get(reaction)?.contains(uid) == true
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

            wallCollection(groupId).document(postId).update(updates).await()
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao alternar reação do post $postId no grupo $groupId", e)
            Result.failure(e)
        }
    }

    /**
     * Soft-delete (deleted_by + deleted_at via serverTimestamp).
     * Rules validam que só autor/owner/admin pode soft-deletar.
     */
    suspend fun deletePost(groupId: String, post: GroupWallPost): Result<Unit> {
        return try {
            val currentUser = auth.currentUser
                ?: error("Usuário não autenticado")

            val batch = firestore.batch()
            val postRef = wallCollection(groupId).document(post.id)
            batch.update(
                postRef,
                mapOf(
                    "deleted_by" to currentUser.uid,
                    "deleted_at" to FieldValue.serverTimestamp(),
                    "updated_at" to FieldValue.serverTimestamp()
                )
            )
            batch.commit().await()

            deleteStoragePaths(storage, TAG, post.mediaPath, post.thumbnailPath)

            AppLogger.d(TAG) { "Post ${post.id} soft-deletado no grupo $groupId" }
            Result.success(Unit)
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao deletar post ${post.id} no grupo $groupId", e)
            Result.failure(e)
        }
    }

}

private val CLIENT_REQUEST_ID_REGEX = Regex(
    "^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    RegexOption.IGNORE_CASE
)

internal fun mergeRecentAndPinnedPosts(
    recentPosts: List<GroupWallPost>,
    pinnedPosts: List<GroupWallPost>
): List<GroupWallPost> = mergeWallPostTimeline(
    recentPosts = recentPosts,
    pinnedPosts = pinnedPosts
)

internal fun mergeWallPostTimeline(
    recentPosts: List<GroupWallPost>,
    olderPosts: List<GroupWallPost> = emptyList(),
    pinnedPosts: List<GroupWallPost> = emptyList()
): List<GroupWallPost> {
    val visiblePosts = (recentPosts + pinnedPosts + olderPosts)
        .distinctBy { it.id }
        .filterNot { it.isDeleted() }

    val pinned = visiblePosts
        .filter { it.pinned && !it.isDeleted() }
        .sortedWith(
            compareByDescending<GroupWallPost> { it.pinnedAt ?: it.createdAt ?: Date(0) }
                .thenByDescending { it.createdAt ?: Date(0) }
                .thenByDescending { it.id }
        )

    val regular = visiblePosts
        .filter { !it.pinned && !it.isDeleted() }
        .sortedWith(
            // Um serverTimestamp local ainda pendente chega como null; por ser a
            // publicação recém-enviada, ela deve permanecer no topo até o ACK.
            compareByDescending<GroupWallPost> { it.createdAt ?: Date(Long.MAX_VALUE) }
                .thenByDescending { it.id }
        )

    return pinned + regular
}

private fun List<DocumentSnapshot>.toWallPosts(): List<GroupWallPost> = mapNotNull { document ->
    document.toObject(GroupWallPost::class.java)?.copy(id = document.id)
}

internal fun isSameTextPostIntent(
    existing: Map<String, Any?>,
    authorId: String,
    text: String
): Boolean = existing["author_id"] == authorId &&
    existing["text"] == text &&
    existing["media_url"] == null &&
    existing["media_path"] == null

private suspend fun DocumentReference.matchesTextPostIntentOrFalse(
    authorId: String,
    text: String
): Boolean = try {
    val snapshot = get().await()
    snapshot.exists() && isSameTextPostIntent(snapshot.data.orEmpty(), authorId, text)
} catch (error: CancellationException) {
    throw error
} catch (_: Exception) {
    false
}

private suspend fun deleteStoragePaths(storage: FirebaseStorage, tag: String, vararg paths: String?) {
    paths
        .filterNotNull()
        .filter { it.isNotBlank() }
        .distinct()
        .forEach { path ->
            try {
                storage.getReference(path).delete().await()
            } catch (e: Exception) {
                AppLogger.w(tag) { "Falha ao deletar mídia $path: ${e.message}" }
            }
        }
}
