package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.GroupWallPost
import com.futebadosparcas.data.model.UserGroup
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.async
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.tasks.await

data class SocialFeedPost(
    val post: GroupWallPost,
    val groupName: String
)

data class SocialFeedResult(
    val posts: List<SocialFeedPost>,
    val hasGroups: Boolean,
    val hasMore: Boolean = false,
    val cursor: SocialFeedCursor? = null
)

/** Cursor composto: cada lote de ate 10 grupos avanca de forma independente. */
class SocialFeedCursor internal constructor(
    internal val scopeKey: String,
    internal val groupNames: Map<String, String>,
    internal val groupChunks: List<List<String>>,
    internal val chunkCursors: Map<String, DocumentSnapshot>,
    internal val exhaustedChunks: Set<String>,
    internal val hiddenKeys: Set<String>,
    internal val hiddenCursor: DocumentSnapshot?,
    internal val hiddenExhausted: Boolean
)

internal data class SocialFeedCandidate(
    val chunkKey: String,
    val feedPost: SocialFeedPost?,
    val document: DocumentSnapshot? = null,
    val visible: Boolean = true,
    val fallbackKey: String = ""
) {
    val createdAtMillis: Long
        get() = feedPost?.post?.createdAt?.time
            ?: document?.getTimestamp("created_at")?.toDate()?.time
            ?: 0L

    val stableKey: String
        get() = feedPost?.let { "${it.post.groupId}_${it.post.id}" }
            ?: fallbackKey
}

internal data class SocialFeedSelection(
    val posts: List<SocialFeedPost>,
    val consumedByChunk: Map<String, SocialFeedCandidate>
)

/** Merge global deterministico, consumindo tambem registros ocultos/deletados. */
internal fun selectSocialFeedPage(
    candidates: List<SocialFeedCandidate>,
    limit: Int
): SocialFeedSelection {
    if (limit <= 0) return SocialFeedSelection(emptyList(), emptyMap())

    val selected = mutableListOf<SocialFeedPost>()
    val consumed = mutableMapOf<String, SocialFeedCandidate>()
    val seenKeys = mutableSetOf<String>()
    val ordered = candidates.sortedWith(
        compareByDescending<SocialFeedCandidate> { it.createdAtMillis }
            .thenBy { it.stableKey }
    )

    for (candidate in ordered) {
        if (selected.size >= limit) break
        consumed[candidate.chunkKey] = candidate
        val post = candidate.feedPost
        if (candidate.visible && post != null && seenKeys.add(candidate.stableKey)) {
            selected += post
        }
    }
    return SocialFeedSelection(selected, consumed)
}

/**
 * Agrega posts dos murais dos grupos do usuario (#3236/#3508).
 *
 * A primeira pagina e realtime e limitada por lote. O historico usa um cursor
 * composto para nao perder itens quando varios lotes competem pela pagina global.
 */
class SocialFeedRepository(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
    private val groupRepository: GroupRepository,
    private val groupWallRepository: GroupWallRepository
) {
    @OptIn(ExperimentalCoroutinesApi::class)
    fun observeFirstPage(): Flow<Result<SocialFeedResult>> {
        return groupRepository.getMyGroupsFlow()
            .flatMapLatest { groups ->
                val currentUserId = auth.currentUser?.uid
                when {
                    currentUserId == null -> flowOf(
                        Result.failure(IllegalStateException("Usuario nao autenticado"))
                    )
                    groups.isEmpty() -> flowOf(
                        Result.success(SocialFeedResult(emptyList(), hasGroups = false))
                    )
                    else -> observeGroupsFirstPage(currentUserId, groups)
                        .map { Result.success(it) }
                }
            }
            .catch { error ->
                AppLogger.e(TAG, "Erro ao observar feed social", error)
                emit(Result.failure(error))
            }
    }

    /** Mantido para chamadores legados; retorna a primeira emissao realtime. */
    suspend fun loadFeed(): Result<SocialFeedResult> = observeFirstPage().first()

    suspend fun loadMore(cursor: SocialFeedCursor): Result<SocialFeedResult> = runCatching {
        val hiddenPage = loadHiddenKeysPage(
            userId = auth.currentUser?.uid
                ?: error("Usuario nao autenticado"),
            startAfter = cursor.hiddenCursor,
            skip = cursor.hiddenExhausted
        )
        val hiddenKeys = cursor.hiddenKeys + hiddenPage.keys

        val pages = coroutineScope {
            cursor.groupChunks
                .filterNot { cursor.exhaustedChunks.contains(it.chunkKey()) }
                .map { chunk ->
                    async {
                        val key = chunk.chunkKey()
                        var query: Query = basePostsQuery(chunk)
                        cursor.chunkCursors[key]?.let { query = query.startAfter(it) }
                        key to query.get().await().documents
                    }
                }
                .map { it.await() }
                .toMap()
        }

        val candidates = pages.flatMap { (chunkKey, documents) ->
            documents.map { document ->
                document.toCandidate(chunkKey, cursor.groupNames, hiddenKeys)
            }
        }
        val selection = selectSocialFeedPage(candidates, PAGE_SIZE.toInt())
        val nextChunkCursors = cursor.chunkCursors.toMutableMap()
        selection.consumedByChunk.forEach { (key, candidate) ->
            candidate.document?.let { nextChunkCursors[key] = it }
        }

        val exhausted = cursor.exhaustedChunks.toMutableSet()
        pages.forEach { (key, documents) ->
            val lastConsumed = selection.consumedByChunk[key]?.document
            if (documents.isEmpty() ||
                (documents.size < PAGE_SIZE.toInt() && lastConsumed == documents.lastOrNull())
            ) {
                exhausted += key
            }
        }

        val nextCursor = SocialFeedCursor(
            scopeKey = cursor.scopeKey,
            groupNames = cursor.groupNames,
            groupChunks = cursor.groupChunks,
            chunkCursors = nextChunkCursors,
            exhaustedChunks = exhausted,
            hiddenKeys = hiddenKeys,
            hiddenCursor = hiddenPage.cursor ?: cursor.hiddenCursor,
            hiddenExhausted = cursor.hiddenExhausted || hiddenPage.exhausted
        )
        SocialFeedResult(
            posts = selection.posts,
            hasGroups = true,
            hasMore = exhausted.size < cursor.groupChunks.size,
            cursor = nextCursor
        )
    }.onFailure { error ->
        AppLogger.e(TAG, "Erro ao carregar historico do feed social", error)
    }

    private fun observeGroupsFirstPage(
        userId: String,
        groups: List<UserGroup>
    ): Flow<SocialFeedResult> = callbackFlow {
        val groupNames = groups
            .mapNotNull { group ->
                group.resolvedGroupId().takeIf { it.isNotBlank() }
                    ?.let { it to group.groupName.ifBlank { "Grupo" } }
            }
            .toMap()
        if (groupNames.isEmpty()) {
            trySend(SocialFeedResult(emptyList(), hasGroups = false))
            close()
            return@callbackFlow
        }

        val chunks = groupNames.keys.sorted().chunked(GROUP_CHUNK_SIZE)
        val documentsByChunk = mutableMapOf<String, List<DocumentSnapshot>>()
        val initializedChunks = mutableSetOf<String>()
        val registrations = mutableListOf<com.google.firebase.firestore.ListenerRegistration>()
        var hiddenKeys = emptySet<String>()
        var hiddenDocuments = emptyList<DocumentSnapshot>()
        var hiddenInitialized = false
        val lock = Any()

        fun emitIfReady() {
            if (!hiddenInitialized || initializedChunks.size != chunks.size) return
            val candidates = documentsByChunk.flatMap { (key, documents) ->
                documents.map { it.toCandidate(key, groupNames, hiddenKeys) }
            }
            val selection = selectSocialFeedPage(candidates, PAGE_SIZE.toInt())
            val cursors = selection.consumedByChunk.mapNotNull { (key, candidate) ->
                candidate.document?.let { key to it }
            }.toMap()
            val exhausted = mutableSetOf<String>()
            documentsByChunk.forEach { (key, documents) ->
                val lastConsumed = selection.consumedByChunk[key]?.document
                if (documents.isEmpty() ||
                    (documents.size < PAGE_SIZE.toInt() && lastConsumed == documents.lastOrNull())
                ) {
                    exhausted += key
                }
            }
            val cursor = SocialFeedCursor(
                scopeKey = groupNames.keys.sorted().joinToString("|"),
                groupNames = groupNames,
                groupChunks = chunks,
                chunkCursors = cursors,
                exhaustedChunks = exhausted,
                hiddenKeys = hiddenKeys,
                hiddenCursor = hiddenDocuments.lastOrNull(),
                hiddenExhausted = hiddenDocuments.size < HIDDEN_PAGE_SIZE.toInt()
            )
            trySend(
                SocialFeedResult(
                    posts = selection.posts,
                    hasGroups = true,
                    hasMore = exhausted.size < chunks.size,
                    cursor = cursor
                )
            )
        }

        val hiddenRegistration = hiddenCollection(userId)
            .orderBy("hidden_at", Query.Direction.DESCENDING)
            .limit(HIDDEN_PAGE_SIZE)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                synchronized(lock) {
                    hiddenDocuments = snapshot?.documents.orEmpty()
                    hiddenKeys = hiddenDocuments.mapTo(mutableSetOf()) { it.id }
                    hiddenInitialized = true
                    emitIfReady()
                }
            }
        registrations += hiddenRegistration

        chunks.forEach { chunk ->
            val key = chunk.chunkKey()
            registrations += basePostsQuery(chunk).addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                synchronized(lock) {
                    documentsByChunk[key] = snapshot?.documents.orEmpty()
                    initializedChunks += key
                    emitIfReady()
                }
            }
        }

        awaitClose { registrations.forEach { it.remove() } }
    }

    private fun basePostsQuery(groupIds: List<String>): Query =
        firestore.collectionGroup("wall_posts")
            .whereIn("group_id", groupIds)
            .orderBy("created_at", Query.Direction.DESCENDING)
            .limit(PAGE_SIZE)

    private fun hiddenCollection(userId: String) = firestore.collection("users")
        .document(userId)
        .collection("hidden_feed_posts")

    private suspend fun loadHiddenKeysPage(
        userId: String,
        startAfter: DocumentSnapshot?,
        skip: Boolean
    ): HiddenKeysPage {
        if (skip) return HiddenKeysPage(emptySet(), startAfter, exhausted = true)
        var query: Query = hiddenCollection(userId)
            .orderBy("hidden_at", Query.Direction.DESCENDING)
            .limit(HIDDEN_PAGE_SIZE)
        if (startAfter != null) query = query.startAfter(startAfter)
        val documents = query.get().await().documents
        return HiddenKeysPage(
            keys = documents.mapTo(mutableSetOf()) { it.id },
            cursor = documents.lastOrNull(),
            exhausted = documents.size < HIDDEN_PAGE_SIZE.toInt()
        )
    }

    private fun DocumentSnapshot.toCandidate(
        chunkKey: String,
        groupNames: Map<String, String>,
        hiddenKeys: Set<String>
    ): SocialFeedCandidate {
        val post = toObject(GroupWallPost::class.java)?.copy(id = id)
        val feedPost = post?.let {
            SocialFeedPost(it, groupNames[it.groupId] ?: "Grupo")
        }
        val key = post?.key()
        return SocialFeedCandidate(
            chunkKey = chunkKey,
            feedPost = feedPost,
            document = this,
            visible = post != null && !post.isDeleted() && !hiddenKeys.contains(key),
            fallbackKey = reference.path
        )
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
    private fun List<String>.chunkKey(): String = joinToString("|")

    suspend fun hidePost(feedPost: SocialFeedPost): Result<Unit> = runCatching {
        val currentUserId = auth.currentUser?.uid
            ?: error("Usuario nao autenticado")
        val key = feedPost.post.key()
        hiddenCollection(currentUserId)
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
            ?: error("Usuario nao autenticado")
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

    private data class HiddenKeysPage(
        val keys: Set<String>,
        val cursor: DocumentSnapshot?,
        val exhausted: Boolean
    )

    companion object {
        private const val TAG = "SocialFeedRepository"
        internal const val GROUP_CHUNK_SIZE = 10
        internal const val PAGE_SIZE = 30L
        internal const val HIDDEN_PAGE_SIZE = 100L
    }
}
