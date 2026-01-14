package com.futebadosparcas.data.model

import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

/**
 * Avaliação de um local.
 * Subcoleção: locations/{locationId}/reviews
 */
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
)
