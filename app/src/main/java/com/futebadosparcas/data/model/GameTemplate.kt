package com.futebadosparcas.data.model

import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.Exclude
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.PropertyName
import java.util.Date

@IgnoreExtraProperties
data class GameTemplate(
    @DocumentId
    @get:Exclude
    val id: String = "",
    
    @get:PropertyName("user_id")
    @set:PropertyName("user_id")
    var userId: String = "", // O dono do template
    
    @get:PropertyName("template_name")
    @set:PropertyName("template_name")
    var templateName: String = "",
    
    // Dados do Jogo a serem replicados
    @get:PropertyName("location_name")
    @set:PropertyName("location_name")
    var locationName: String = "",
    @get:PropertyName("location_address")
    @set:PropertyName("location_address")
    var locationAddress: String = "",
    @get:PropertyName("location_id")
    @set:PropertyName("location_id")
    var locationId: String = "",
    @get:PropertyName("field_name")
    @set:PropertyName("field_name")
    var fieldName: String = "",
    @get:PropertyName("field_id")
    @set:PropertyName("field_id")
    var fieldId: String = "",
    
    @get:PropertyName("game_time")
    @set:PropertyName("game_time")
    var gameTime: String = "19:00",
    @get:PropertyName("game_end_time")
    @set:PropertyName("game_end_time")
    var gameEndTime: String = "20:00",
    
    @get:PropertyName("max_players")
    @set:PropertyName("max_players")
    var maxPlayers: Int = 14,
    
    @get:PropertyName("daily_price")
    @set:PropertyName("daily_price")
    var dailyPrice: Double = 0.0,
    
    @get:PropertyName("recurrence")
    @set:PropertyName("recurrence")
    var recurrence: String = "none",
    
    @get:PropertyName("created_at")
    @set:PropertyName("created_at")
    var createdAt: Date? = null
) {
    constructor() : this(id = "")
}
