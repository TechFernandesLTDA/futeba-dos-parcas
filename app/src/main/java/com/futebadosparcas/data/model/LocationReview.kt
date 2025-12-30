package com.futebadosparcas.data.model

import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

data class LocationReview(
    @DocumentId
    val id: String = "",
    val locationId: String = "",
    val userId: String = "",
    val userName: String = "",
    val userPhotoUrl: String? = null,
    val rating: Float = 0f,
    val comment: String = "",
    @ServerTimestamp
    val createdAt: Date? = null
)
