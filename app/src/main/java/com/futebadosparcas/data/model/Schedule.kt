package com.futebadosparcas.data.model

import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

data class Schedule(
    @DocumentId
    val id: String = "",
    @get:PropertyName("owner_id")
    @set:PropertyName("owner_id")
    var ownerId: String = "",
    @get:PropertyName("owner_name")
    @set:PropertyName("owner_name")
    var ownerName: String = "",
    val name: String = "",
    @get:PropertyName("location_id")
    @set:PropertyName("location_id")
    var locationId: String = "",
    @get:PropertyName("location_name")
    @set:PropertyName("location_name")
    var locationName: String = "",
    @get:PropertyName("location_address")
    @set:PropertyName("location_address")
    var locationAddress: String = "",
    @get:PropertyName("location_lat")
    @set:PropertyName("location_lat")
    var locationLat: Double? = null,
    @get:PropertyName("location_lng")
    @set:PropertyName("location_lng")
    var locationLng: Double? = null,
    @get:PropertyName("field_id")
    @set:PropertyName("field_id")
    var fieldId: String = "",
    @get:PropertyName("field_name")
    @set:PropertyName("field_name")
    var fieldName: String = "",
    @get:PropertyName("field_type")
    @set:PropertyName("field_type")
    var fieldType: String = "Society",
    @get:PropertyName("recurrence_type")
    @set:PropertyName("recurrence_type")
    var recurrenceType: RecurrenceType = RecurrenceType.weekly,
    @get:PropertyName("day_of_week")
    @set:PropertyName("day_of_week")
    var dayOfWeek: Int = 0, // 0 = domingo, 1 = segunda, etc.
    val time: String = "",
    val duration: Int = 60, // minutos
    @get:PropertyName("is_public")
    @set:PropertyName("is_public")
    var isPublic: Boolean = false,
    @get:PropertyName("max_players")
    @set:PropertyName("max_players")
    var maxPlayers: Int = 14,
    @get:PropertyName("daily_price")
    @set:PropertyName("daily_price")
    var dailyPrice: Double = 0.0,
    @get:PropertyName("monthly_price")
    @set:PropertyName("monthly_price")
    var monthlyPrice: Double? = null,
    @get:PropertyName("group_id")
    @set:PropertyName("group_id")
    var groupId: String? = null,
    @get:PropertyName("group_name")
    @set:PropertyName("group_name")
    var groupName: String? = null,
    @get:PropertyName("member_ids")
    @set:PropertyName("member_ids")
    var memberIds: List<String> = emptyList(),
    @ServerTimestamp
    @get:PropertyName("created_at")
    @set:PropertyName("created_at")
    var createdAt: Date? = null
) {
    constructor() : this(id = "")
}

enum class RecurrenceType {
    weekly, biweekly, monthly
}
