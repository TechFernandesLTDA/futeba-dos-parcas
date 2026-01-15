package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Template de jogo para reutilizar configuracoes.
 * Permite salvar configuracoes frequentes de jogos para criacao rapida.
 */
@Serializable
data class GameTemplate(
    @SerialName("id")
    val id: String = "",

    @SerialName("user_id")
    val userId: String = "", // O dono do template

    @SerialName("template_name")
    val templateName: String = "",

    // Dados do Jogo a serem replicados
    @SerialName("location_name")
    val locationName: String = "",

    @SerialName("location_address")
    val locationAddress: String = "",

    @SerialName("location_id")
    val locationId: String = "",

    @SerialName("field_name")
    val fieldName: String = "",

    @SerialName("field_id")
    val fieldId: String = "",

    @SerialName("game_time")
    val gameTime: String = "19:00",

    @SerialName("game_end_time")
    val gameEndTime: String = "20:00",

    @SerialName("max_players")
    val maxPlayers: Int = 14,

    @SerialName("daily_price")
    val dailyPrice: Double = 0.0,

    @SerialName("recurrence")
    val recurrence: String = "none",

    @SerialName("created_at")
    val createdAt: Long? = null
)
