package com.futebadosparcas.data.model

import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

/**
 * Representa um post no mural de resenha/provocações do grupo.
 * Coleção: groups/{groupId}/wall_posts
 */
@IgnoreExtraProperties
data class GroupWallPost(
    @DocumentId
    var id: String = "",

    @get:PropertyName("group_id")
    @set:PropertyName("group_id")
    var groupId: String = "",

    @get:PropertyName("author_id")
    @set:PropertyName("author_id")
    var authorId: String = "",

    @get:PropertyName("author_name")
    @set:PropertyName("author_name")
    var authorName: String = "",

    @get:PropertyName("author_photo_url")
    @set:PropertyName("author_photo_url")
    var authorPhotoUrl: String? = null,

    var text: String = "",

    @get:PropertyName("media_url")
    @set:PropertyName("media_url")
    var mediaUrl: String? = null,

    @get:PropertyName("media_path")
    @set:PropertyName("media_path")
    var mediaPath: String? = null,

    @get:PropertyName("media_type")
    @set:PropertyName("media_type")
    var mediaType: String? = null,

    @get:PropertyName("thumbnail_path")
    @set:PropertyName("thumbnail_path")
    var thumbnailPath: String? = null,

    @get:PropertyName("thumbnail_url")
    @set:PropertyName("thumbnail_url")
    var thumbnailUrl: String? = null,

    @get:PropertyName("media_status")
    @set:PropertyName("media_status")
    var mediaStatus: String? = null,

    @get:PropertyName("media_pipeline_version")
    @set:PropertyName("media_pipeline_version")
    var mediaPipelineVersion: Int? = null,

    @get:PropertyName("media_sha256")
    @set:PropertyName("media_sha256")
    var mediaSha256: String? = null,

    @get:PropertyName("media_source_type")
    @set:PropertyName("media_source_type")
    var mediaSourceType: String? = null,

    @get:PropertyName("media_duration_sec")
    @set:PropertyName("media_duration_sec")
    var mediaDurationSec: Double? = null,

    @get:PropertyName("media_video_codec")
    @set:PropertyName("media_video_codec")
    var mediaVideoCodec: String? = null,

    @get:PropertyName("media_audio_codec")
    @set:PropertyName("media_audio_codec")
    var mediaAudioCodec: String? = null,

    @get:PropertyName("media_container")
    @set:PropertyName("media_container")
    var mediaContainer: String? = null,

    @get:PropertyName("media_width")
    @set:PropertyName("media_width")
    var mediaWidth: Int? = null,

    @get:PropertyName("media_height")
    @set:PropertyName("media_height")
    var mediaHeight: Int? = null,

    @get:PropertyName("highlight_ref")
    @set:PropertyName("highlight_ref")
    var highlightRef: HighlightRef? = null,

    var pinned: Boolean = false,

    @get:PropertyName("pinned_by")
    @set:PropertyName("pinned_by")
    var pinnedBy: String? = null,

    @get:PropertyName("pinned_at")
    @set:PropertyName("pinned_at")
    var pinnedAt: Date? = null,

    @get:PropertyName("reactions")
    @set:PropertyName("reactions")
    var reactions: Map<String, List<String>>? = null,

    @get:PropertyName("comments_count")
    @set:PropertyName("comments_count")
    var commentsCount: Int = 0,

    @ServerTimestamp
    @get:PropertyName("created_at")
    @set:PropertyName("created_at")
    var createdAt: Date? = null,

    @get:PropertyName("updated_at")
    @set:PropertyName("updated_at")
    var updatedAt: Date? = null,

    @get:PropertyName("edited_at")
    @set:PropertyName("edited_at")
    var editedAt: Date? = null,

    @get:PropertyName("deleted_by")
    @set:PropertyName("deleted_by")
    var deletedBy: String? = null,

    @get:PropertyName("deleted_at")
    @set:PropertyName("deleted_at")
    var deletedAt: Date? = null
) {
    constructor() : this(id = "")

    fun isDeleted(): Boolean = deletedAt != null
}

@IgnoreExtraProperties
data class HighlightRef(
    @get:PropertyName("game_id")
    @set:PropertyName("game_id")
    var gameId: String = "",

    @get:PropertyName("highlight_id")
    @set:PropertyName("highlight_id")
    var highlightId: String = ""
) {
    constructor() : this("", "")
}
