package com.futebadosparcas.data.model

import com.google.firebase.Timestamp
import com.google.firebase.firestore.PropertyName

/** DTO Firestore: CustomClassMapper nao interpreta kotlinx.serialization.SerialName. */
data class AndroidGameWaitlist(
    val id: String = "",
    @get:PropertyName("game_id") @set:PropertyName("game_id") var gameId: String = "",
    @get:PropertyName("user_id") @set:PropertyName("user_id") var userId: String = "",
    @get:PropertyName("user_name") @set:PropertyName("user_name") var userName: String = "",
    @get:PropertyName("user_photo") @set:PropertyName("user_photo") var userPhoto: String? = null,
    val position: String = "FIELD",
    @get:PropertyName("queue_position") @set:PropertyName("queue_position") var queuePosition: Long = 0,
    val status: String = "WAITING",
    @get:PropertyName("added_at") @set:PropertyName("added_at") var addedAt: Any? = null,
    @get:PropertyName("notified_at") @set:PropertyName("notified_at") var notifiedAt: Any? = null,
    @get:PropertyName("response_deadline") @set:PropertyName("response_deadline") var responseDeadline: Any? = null,
) {
    fun timestampMillis(value: Any?): Long? = when (value) {
        is Timestamp -> value.toDate().time
        is java.util.Date -> value.time
        is Number -> value.toLong()
        else -> null
    }
}
