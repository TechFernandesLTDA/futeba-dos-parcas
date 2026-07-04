package com.futebadosparcas.data.repository

import com.futebadosparcas.util.AppLogger
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.functions.FirebaseFunctions
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

data class DirectChat(
    val id: String,
    val participants: List<String>,
    val participantNames: Map<String, String>,
    val participantPhotos: Map<String, String?>,
    val lastMessage: String?,
    val lastMessageAt: Timestamp?,
    val lastSenderId: String?,
    val unreadCount: Map<String, Int>
)

data class DirectMessage(
    val id: String,
    val senderId: String,
    val senderName: String,
    val senderPhotoUrl: String?,
    val text: String,
    val createdAt: Timestamp?,
    val deletedBy: String?,
    val deletedAt: Timestamp?
)

class DirectMessagesRepository(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
    private val functions: FirebaseFunctions
) {
    fun observeChats(): Flow<List<DirectChat>> = callbackFlow {
        val uid = currentUid()
        val listener = firestore.collection("chats")
            .whereArrayContains("participants", uid)
            .orderBy("last_message_at", Query.Direction.DESCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    AppLogger.e(TAG, "Erro ao observar DMs", error)
                    close(error)
                    return@addSnapshotListener
                }
                trySend(snapshot?.documents?.mapNotNull(::mapChat) ?: emptyList())
            }
        awaitClose { listener.remove() }
    }

    fun observeChat(chatId: String): Flow<DirectChat?> = callbackFlow {
        val listener = firestore.collection("chats").document(chatId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    AppLogger.e(TAG, "Erro ao observar DM $chatId", error)
                    close(error)
                    return@addSnapshotListener
                }
                trySend(snapshot?.let(::mapChat))
            }
        awaitClose { listener.remove() }
    }

    fun observeMessages(chatId: String): Flow<List<DirectMessage>> = callbackFlow {
        val listener = firestore.collection("chats").document(chatId)
            .collection("messages")
            .orderBy("created_at", Query.Direction.DESCENDING)
            .limit(PAGE_SIZE)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    AppLogger.e(TAG, "Erro ao observar mensagens DM $chatId", error)
                    close(error)
                    return@addSnapshotListener
                }
                val messages = snapshot?.documents
                    ?.mapNotNull(::mapMessage)
                    ?.asReversed()
                    ?: emptyList()
                trySend(messages)
            }
        awaitClose { listener.remove() }
    }

    suspend fun createChat(targetUid: String): Result<String> = runCatching {
        val result = functions.getHttpsCallable("createDirectChat")
            .call(mapOf("targetUid" to targetUid))
            .await()
        val data = result.data as? Map<*, *> ?: error("Resposta inválida")
        data["chatId"] as? String ?: error("Conversa não encontrada")
    }.onFailure { AppLogger.e(TAG, "Erro ao criar DM com $targetUid", it) }

    suspend fun sendMessage(chat: DirectChat, text: String): Result<Unit> = runCatching {
        val currentUser = auth.currentUser ?: error("Usuário não autenticado")
        val cleanText = text.trim()
        require(cleanText.isNotEmpty() && cleanText.length <= MAX_TEXT_LENGTH) {
            "Mensagem deve ter entre 1 e $MAX_TEXT_LENGTH caracteres"
        }

        val chatRef = firestore.collection("chats").document(chat.id)
        val messageRef = chatRef.collection("messages").document()
        val batch = firestore.batch()
        batch.set(
            messageRef,
            mapOf(
                "sender_id" to currentUser.uid,
                "sender_name" to (currentUser.displayName ?: "Jogador"),
                "sender_photo_url" to currentUser.photoUrl?.toString(),
                "text" to cleanText,
                "created_at" to FieldValue.serverTimestamp(),
                "deleted_by" to null,
                "deleted_at" to null
            )
        )
        val updates = mutableMapOf<String, Any>(
            "last_message" to cleanText,
            "last_message_at" to FieldValue.serverTimestamp(),
            "last_sender_id" to currentUser.uid,
            "unread_count.${currentUser.uid}" to 0
        )
        chat.participants
            .filter { it != currentUser.uid }
            .forEach { updates["unread_count.$it"] = FieldValue.increment(1) }
        batch.update(chatRef, updates)
        batch.commit().await()
        Unit
    }.onFailure { AppLogger.e(TAG, "Erro ao enviar DM ${chat.id}", it) }

    suspend fun markRead(chatId: String): Result<Unit> = runCatching {
        val uid = currentUid()
        firestore.collection("chats").document(chatId)
            .update("unread_count.$uid", 0)
            .await()
        Unit
    }.onFailure { AppLogger.e(TAG, "Erro ao marcar DM lida $chatId", it) }

    suspend fun deleteMessage(chatId: String, messageId: String): Result<Unit> = runCatching {
        val uid = currentUid()
        firestore.collection("chats").document(chatId)
            .collection("messages").document(messageId)
            .update(
                mapOf(
                    "deleted_by" to uid,
                    "deleted_at" to FieldValue.serverTimestamp()
                )
            )
            .await()
        Unit
    }.onFailure { AppLogger.e(TAG, "Erro ao excluir mensagem DM $messageId", it) }

    fun currentUserId(): String? = auth.currentUser?.uid

    private fun currentUid(): String =
        auth.currentUser?.uid ?: throw IllegalStateException("Usuário não autenticado")

    @Suppress("UNCHECKED_CAST")
    private fun mapChat(document: com.google.firebase.firestore.DocumentSnapshot): DirectChat? {
        if (!document.exists()) return null
        val participants = document.get("participants") as? List<String> ?: return null
        val unreadRaw = document.get("unread_count") as? Map<String, Number> ?: emptyMap()
        return DirectChat(
            id = document.id,
            participants = participants,
            participantNames = document.get("participant_names") as? Map<String, String> ?: emptyMap(),
            participantPhotos = document.get("participant_photos") as? Map<String, String?> ?: emptyMap(),
            lastMessage = document.getString("last_message"),
            lastMessageAt = document.getTimestamp("last_message_at"),
            lastSenderId = document.getString("last_sender_id"),
            unreadCount = unreadRaw.mapValues { it.value.toInt() }
        )
    }

    private fun mapMessage(document: com.google.firebase.firestore.DocumentSnapshot): DirectMessage? {
        if (!document.exists()) return null
        return DirectMessage(
            id = document.id,
            senderId = document.getString("sender_id") ?: return null,
            senderName = document.getString("sender_name") ?: "Jogador",
            senderPhotoUrl = document.getString("sender_photo_url"),
            text = document.getString("text") ?: "",
            createdAt = document.getTimestamp("created_at"),
            deletedBy = document.getString("deleted_by"),
            deletedAt = document.getTimestamp("deleted_at")
        )
    }

    companion object {
        private const val TAG = "DirectMessagesRepository"
        private const val PAGE_SIZE = 50L
        private const val MAX_TEXT_LENGTH = 1000
    }
}
