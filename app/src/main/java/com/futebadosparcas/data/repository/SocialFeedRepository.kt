package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.GroupWallPost
import com.futebadosparcas.data.model.UserGroup
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.tasks.await

data class SocialFeedPost(
    val post: GroupWallPost,
    val groupName: String
)

data class SocialFeedResult(
    val posts: List<SocialFeedPost>,
    val hasGroups: Boolean
)

/**
 * Agrega posts dos murais dos grupos do usuário (#3236).
 */
class SocialFeedRepository(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
    private val groupRepository: GroupRepository,
    private val groupWallRepository: GroupWallRepository
) {
    suspend fun loadFeed(): Result<SocialFeedResult> = runCatching {
        val currentUserId = auth.currentUser?.uid
            ?: throw IllegalStateException("Usuário não autenticado")
        val groups = groupRepository.getMyGroups().getOrThrow()
        if (groups.isEmpty()) return@runCatching SocialFeedResult(emptyList(), hasGroups = false)

        val groupNames = groups.associate { it.resolvedGroupId() to it.groupName.ifBlank { "Grupo" } }
        val hiddenKeys = loadHiddenPostKeys(currentUserId)
        val chunks = groupNames.keys.filter { it.isNotBlank() }.chunked(GROUP_CHUNK_SIZE)
        val posts = mutableListOf<SocialFeedPost>()

        for (chunk in chunks) {
            val snapshot = firestore.collectionGroup("wall_posts")
                .whereIn("group_id", chunk)
                .orderBy("created_at", Query.Direction.DESCENDING)
                .limit(PAGE_SIZE)
                .get()
                .await()

            snapshot.documents.mapNotNullTo(posts) { doc ->
                val post = doc.toObject(GroupWallPost::class.java)?.copy(id = doc.id)
                    ?: return@mapNotNullTo null
                if (post.isDeleted()) return@mapNotNullTo null
                if (hiddenKeys.contains(post.key())) return@mapNotNullTo null
                SocialFeedPost(
                    post = post,
                    groupName = groupNames[post.groupId] ?: "Grupo"
                )
            }
        }

        posts
            .sortedByDescending { it.post.createdAt?.time ?: 0L }
            .take(PAGE_SIZE.toInt())
            .also {
                AppLogger.d(TAG) { "Feed social carregado para $currentUserId: ${it.size} posts" }
            }
            .let { SocialFeedResult(it, hasGroups = true) }
    }.onFailure { error ->
        AppLogger.e(TAG, "Erro ao carregar feed social", error)
    }

    suspend fun toggleReaction(feedPost: SocialFeedPost, emoji: String): Result<Unit> {
        return groupWallRepository.toggleReaction(
            groupId = feedPost.post.groupId,
            postId = feedPost.post.id,
            reactions = feedPost.post.reactions,
            emoji = emoji
        )
    }

    fun currentUserId(): String? = auth.currentUser?.uid

    private fun UserGroup.resolvedGroupId(): String = groupId.ifBlank { id }
    private fun GroupWallPost.key(): String = "${groupId}_$id"

    private suspend fun loadHiddenPostKeys(userId: String): Set<String> {
        return firestore.collection("users")
            .document(userId)
            .collection("hidden_feed_posts")
            .get()
            .await()
            .documents
            .mapTo(mutableSetOf()) { it.id }
    }

    suspend fun hidePost(feedPost: SocialFeedPost): Result<Unit> = runCatching {
        val currentUserId = auth.currentUser?.uid
            ?: throw IllegalStateException("Usuário não autenticado")
        val key = feedPost.post.key()
        firestore.collection("users")
            .document(currentUserId)
            .collection("hidden_feed_posts")
            .document(key)
            .set(
                mapOf(
                    "user_id" to currentUserId,
                    "group_id" to feedPost.post.groupId,
                    "post_id" to feedPost.post.id,
                    "post_key" to key,
                    "target_path" to "groups/${feedPost.post.groupId}/wall_posts/${feedPost.post.id}",
                    "hidden_at" to FieldValue.serverTimestamp()
                )
            )
            .await()
        Unit
    }.onFailure { error ->
        AppLogger.e(TAG, "Erro ao ocultar post do feed", error)
    }

    suspend fun reportPost(feedPost: SocialFeedPost): Result<Unit> = runCatching {
        val currentUserId = auth.currentUser?.uid
            ?: throw IllegalStateException("Usuário não autenticado")
        firestore.collection("reports")
            .add(
                mapOf(
                    "reporter_id" to currentUserId,
                    "target_type" to "group_wall_post",
                    "group_id" to feedPost.post.groupId,
                    "post_id" to feedPost.post.id,
                    "target_path" to "groups/${feedPost.post.groupId}/wall_posts/${feedPost.post.id}",
                    "reason" to "inappropriate_content",
                    "status" to "OPEN",
                    "created_at" to FieldValue.serverTimestamp()
                )
            )
            .await()
        Unit
    }.onFailure { error ->
        AppLogger.e(TAG, "Erro ao denunciar post do feed", error)
    }

    companion object {
        private const val TAG = "SocialFeedRepository"
        private const val GROUP_CHUNK_SIZE = 10
        private const val PAGE_SIZE = 30L
    }
}
