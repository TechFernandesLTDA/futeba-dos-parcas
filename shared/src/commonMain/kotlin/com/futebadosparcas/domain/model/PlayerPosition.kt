package com.futebadosparcas.domain.model

/**
 * Posicao do jogador em campo.
 */
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
