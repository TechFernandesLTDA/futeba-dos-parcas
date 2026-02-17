package com.futebadosparcas.data.model

import com.futebadosparcas.domain.validation.ValidationHelper
import com.futebadosparcas.domain.validation.ValidationResult
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.Exclude
import com.google.firebase.firestore.IgnoreExtraProperties
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

@IgnoreExtraProperties
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
) {
    // ==================== VALIDAÇÃO ====================

    @Exclude
    fun validate(): List<ValidationResult.Invalid> {
        val errors = mutableListOf<ValidationResult.Invalid>()

        val userIdResult = ValidationHelper.validateRequiredId(userId, "user_id")
        if (userIdResult is ValidationResult.Invalid) errors.add(userIdResult)

        val typeResult = ValidationHelper.validateEnumValue<ActivityType>(type, "type", required = true)
        if (typeResult is ValidationResult.Invalid) errors.add(typeResult)

        val visResult = ValidationHelper.validateEnumValue<ActivityVisibility>(visibility, "visibility", required = true)
        if (visResult is ValidationResult.Invalid) errors.add(visResult)

        val titleResult = ValidationHelper.validateLength(title, "title", 0, ValidationHelper.NAME_MAX_LENGTH)
        if (titleResult is ValidationResult.Invalid) errors.add(titleResult)

        val descResult = ValidationHelper.validateLength(description, "description", 0, ValidationHelper.DESCRIPTION_MAX_LENGTH)
        if (descResult is ValidationResult.Invalid) errors.add(descResult)

        return errors
    }
}
