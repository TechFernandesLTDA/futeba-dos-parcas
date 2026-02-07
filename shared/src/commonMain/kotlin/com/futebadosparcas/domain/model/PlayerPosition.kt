package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Posicao do jogador em campo.
 */
// NOTA: PlayerPosition nao usa @Serializable para evitar bug do
// compilador Kotlin 2.2.x com enums + companion object.
// Serializado como String nos modelos que o referenciam.
enum class PlayerPosition(val displayName: String) {
    LINE("Linha"),
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
