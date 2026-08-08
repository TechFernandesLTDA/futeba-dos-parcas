package com.futebadosparcas.data.repository

import android.net.Uri
import com.futebadosparcas.ui.components.reactions.SocialReactionEmojis
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.functions.FirebaseFunctions
import com.google.firebase.storage.FirebaseStorage
import com.google.firebase.storage.StorageMetadata
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

data class GameVideo(
    val id: String,
    val gameId: String,
    val url: String,
    val storagePath: String,
    val thumbnailPath: String?,
    val uploadedBy: String,
    val uploadedByName: String,
    val caption: String?,
    val reactions: Map<String, List<String>>,
    val status: String,
    val durationSec: Double?
)

class GameVideosRepository(
    private val firestore: FirebaseFirestore,
    private val storage: FirebaseStorage,
    private val auth: FirebaseAuth,
    private val functions: FirebaseFunctions
) {
    fun observeVideos(gameId: String): Flow<List<GameVideo>> = callbackFlow {
        val listener = firestore.collection("game_videos")
            .whereEqualTo("game_id", gameId)
            .orderBy("created_at", Query.Direction.DESCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    AppLogger.e(TAG, "Erro ao observar vídeos do jogo $gameId", error)
                    close(error)
                    return@addSnapshotListener
                }
                trySend(snapshot?.documents.orEmpty().mapNotNull { doc ->
                    val data = doc.data ?: return@mapNotNull null
                    GameVideo(
                        id = doc.id,
                        gameId = data["game_id"] as? String ?: return@mapNotNull null,
                        url = data["url"] as? String ?: return@mapNotNull null,
                        storagePath = data["storage_path"] as? String ?: return@mapNotNull null,
                        thumbnailPath = data["thumbnail_path"] as? String,
                        uploadedBy = data["uploaded_by"] as? String ?: "",
                        uploadedByName = data["uploaded_by_name"] as? String ?: "Jogador",
                        caption = data["caption"] as? String,
                        reactions = (data["reactions"] as? Map<*, *>)
                            ?.mapNotNull { (emoji, users) ->
                                val key = emoji as? String ?: return@mapNotNull null
                                val value = (users as? List<*>)?.filterIsInstance<String>().orEmpty()
                                key to value
                            }
                            ?.toMap()
                            .orEmpty(),
                        status = data["status"] as? String ?: "PROCESSING",
                        durationSec = (data["duration_sec"] as? Number)?.toDouble()
                    )
                })
            }
        awaitClose { listener.remove() }
    }

    suspend fun uploadVideo(
        gameId: String,
        uri: Uri,
        fileName: String,
        caption: String,
        sizeBytes: Long
    ): Result<Unit> = runCatching {
        val currentUser = auth.currentUser ?: throw IllegalStateException("Usuário não autenticado")
        val uid = currentUser.uid
        val storagePath = "games/$gameId/videos/$uid/$fileName"
        val ref = storage.reference.child(storagePath)
        val metadata = StorageMetadata.Builder()
            .setContentType("video/mp4")
            .setCustomMetadata("gameId", gameId)
            .setCustomMetadata("uploadedBy", uid)
            .build()

        ref.putFile(uri, metadata).await()
        functions.getHttpsCallable("createGameVideo").call(
            mapOf(
                "gameId" to gameId,
                "storagePath" to storagePath,
                "caption" to caption.trim(),
            )
        ).await()
        Unit
    }.onFailure { AppLogger.e(TAG, "Erro ao enviar vídeo do jogo $gameId", it) }

    suspend fun deleteVideo(video: GameVideo): Result<Unit> = runCatching {
        storage.reference.child(video.storagePath).delete().await()
        video.thumbnailPath?.takeIf { it.isNotBlank() }?.let { path ->
            storage.reference.child(path).delete().await()
        }
        firestore.collection("game_videos").document(video.id).delete().await()
        Unit
    }.onFailure { AppLogger.e(TAG, "Erro ao excluir vídeo ${video.id}", it) }

    suspend fun toggleReaction(video: GameVideo, emoji: String): Result<Unit> = runCatching {
        require(emoji in SocialReactionEmojis) { "Reação inválida" }
        val uid = auth.currentUser?.uid ?: throw IllegalStateException("Usuário não autenticado")
        val currentEmoji = SocialReactionEmojis.firstOrNull { reaction ->
            video.reactions[reaction].orEmpty().contains(uid)
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

        firestore.collection("game_videos").document(video.id).update(updates).await()
        Unit
    }.onFailure { AppLogger.e(TAG, "Erro ao alternar reação no vídeo ${video.id}", it) }

    fun currentUserId(): String? = auth.currentUser?.uid

    companion object {
        private const val TAG = "GameVideosRepository"
    }
}
