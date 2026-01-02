package com.futebadosparcas.data.model

import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

enum class ActivityType {
    GAME_FINISHED, 
    BADGE_EARNED, 
    MILESTONE_REACHED, 
    LEVEL_UP,
    STREAK_MILESTONE, 
    CHALLENGE_COMPLETED, 
    MVP_EARNED, 
    HAT_TRICK, 
    CLEAN_SHEET
}

enum class ActivityVisibility {
    PRIVATE, 
    FRIENDS, 
    PUBLIC
}

data class Activity(
    @DocumentId val id: String = "",
    @get:PropertyName("user_id") var userId: String = "",
    @get:PropertyName("user_name") var userName: String = "",
    @get:PropertyName("user_photo") var userPhoto: String? = null,
    val type: String = ActivityType.GAME_FINISHED.name,
    val title: String = "",
    val description: String = "",
    @get:PropertyName("reference_id") var referenceId: String? = null,
    @get:PropertyName("reference_type") var referenceType: String? = null,
    val metadata: Map<String, Any> = emptyMap(),
    @ServerTimestamp @get:PropertyName("created_at") var createdAt: Date? = null,
    val visibility: String = ActivityVisibility.PUBLIC.name
)
