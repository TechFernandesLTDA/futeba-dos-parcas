package com.futebadosparcas.data.model

import com.futebadosparcas.domain.validation.ValidationErrorCode
import com.futebadosparcas.domain.validation.ValidationHelper
import com.futebadosparcas.domain.validation.ValidationResult
import com.google.firebase.firestore.Exclude
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

/**
 * Avaliação de um local.
 * Subcoleção: locations/{locationId}/reviews
 */
@IgnoreExtraProperties
data class LocationReview(
    val id: String = "",
    @PropertyName("location_id")
    val locationId: String = "",
    @PropertyName("user_id")
    val userId: String = "",
    @PropertyName("user_name")
    val userName: String = "",
    @PropertyName("user_photo_url")
    val userPhotoUrl: String? = null,
    val rating: Float = 0f,
    val comment: String = "",
    @ServerTimestamp
    @PropertyName("created_at")
    val createdAt: Date? = null
) {
    // ==================== VALIDAÇÃO ====================

    @Exclude
    fun validate(): List<ValidationResult.Invalid> {
        val errors = mutableListOf<ValidationResult.Invalid>()
        val lResult = ValidationHelper.validateRequiredId(locationId, "location_id")
        if (lResult is ValidationResult.Invalid) errors.add(lResult)
        val uResult = ValidationHelper.validateRequiredId(userId, "user_id")
        if (uResult is ValidationResult.Invalid) errors.add(uResult)
        if (rating < 0f || rating > ValidationHelper.REVIEW_RATING_MAX) {
            errors.add(ValidationResult.Invalid("rating", "Rating deve estar entre 0 e ${ValidationHelper.REVIEW_RATING_MAX}", ValidationErrorCode.OUT_OF_RANGE))
        }
        val commentResult = ValidationHelper.validateLength(comment, "comment", 0, ValidationHelper.REVIEW_COMMENT_MAX_LENGTH)
        if (commentResult is ValidationResult.Invalid) errors.add(commentResult)
        return errors
    }
}
