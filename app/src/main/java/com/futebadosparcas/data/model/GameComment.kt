package com.futebadosparcas.data.model

import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

/**
 * Comentário livre persistente por jogo (issue #3234, épico #3240).
 *
 * Coleção: games/{gameId}/comments/{commentId}
 * - create restrito a confirmados/owner/admin
 * - edição só pelo autor
 * - soft-delete via deleted_by/deleted_at
 * - reactions reservado/consumido pela base #3233
 */
@IgnoreExtraProperties
data class GameComment(
    @DocumentId
    val id: String = "",
    @get:PropertyName("author_id")
    @set:PropertyName("author_id")
    var authorId: String = "",
    @get:PropertyName("author_name")
    @set:PropertyName("author_name")
    var authorName: String = "",
    @get:PropertyName("author_photo_url")
    @set:PropertyName("author_photo_url")
    var authorPhotoUrl: String? = null,
    @get:PropertyName("text")
    @set:PropertyName("text")
    var text: String = "",
    @get:PropertyName("parent_id")
    @set:PropertyName("parent_id")
    var parentId: String? = null,
    @get:PropertyName("created_at")
    @set:PropertyName("created_at")
    @ServerTimestamp
    var createdAt: Date? = null,
    @get:PropertyName("edited_at")
    @set:PropertyName("edited_at")
    var editedAt: Date? = null,
    @get:PropertyName("deleted_by")
    @set:PropertyName("deleted_by")
    var deletedBy: String? = null,
    @get:PropertyName("deleted_at")
    @set:PropertyName("deleted_at")
    var deletedAt: Date? = null,
    @get:PropertyName("reactions")
    @set:PropertyName("reactions")
    var reactions: Map<String, List<String>> = emptyMap(),
    @get:PropertyName("context")
    @set:PropertyName("context")
    var context: String = "game"
) {
    constructor() : this(id = "")
}
