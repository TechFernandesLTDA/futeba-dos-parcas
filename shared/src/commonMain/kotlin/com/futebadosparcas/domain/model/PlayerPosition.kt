package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Posicao do jogador em campo.
 */
@Serializable
enum class PlayerPosition(val displayName: String) {
    @SerialName("LINE")
    LINE("Linha"),

    @SerialName("GOALKEEPER")
    GOALKEEPER("Goleiro");

    companion object {
        fun fromString(value: String?): PlayerPosition {
            return when (value?.uppercase()) {
                "GOALKEEPER", "GOLEIRO", "GK" -> GOALKEEPER
                else -> LINE
            }
        }
    }
}
