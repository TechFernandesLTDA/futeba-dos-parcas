package com.futebadosparcas.data.model

import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

/**
 * Mensagem do chat em tempo real por jogo (issue #3230, épico #3240).
 *
 * Coleção: games/{gameId}/chat/{messageId}
 * - create restrito a confirmados/owner/admin (firestore.rules)
 * - created_at == request.time (anti-backdate)
 * - arquivamento 7d após game.date_time (só-leitura)
 * - soft-delete via deleted_by/deleted_at (hard delete bloqueado)
 */
@IgnoreExtraProperties
data class GameChatMessage(
    @DocumentId
    val id: String = "",
    @get:PropertyName("sender_id")
    @set:PropertyName("sender_id")
    var senderId: String = "",
    @get:PropertyName("sender_name")
    @set:PropertyName("sender_name")
    var senderName: String = "",
    @get:PropertyName("sender_photo_url")
    @set:PropertyName("sender_photo_url")
    var senderPhotoUrl: String? = null,
    @get:PropertyName("text")
    @set:PropertyName("text")
    var text: String = "",
    @get:PropertyName("created_at")
    @set:PropertyName("created_at")
    @ServerTimestamp
    var createdAt: Date? = null,
    @get:PropertyName("deleted_by")
    @set:PropertyName("deleted_by")
    var deletedBy: String? = null,
    @get:PropertyName("deleted_at")
    @set:PropertyName("deleted_at")
    var deletedAt: Date? = null
) {
    constructor() : this(id = "")
}
