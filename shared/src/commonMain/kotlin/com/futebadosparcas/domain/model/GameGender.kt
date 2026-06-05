package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Gênero/categoria de um jogo: define se é um jogo masculino, feminino ou misto.
 *
 * Persistido como String (UPPER_SNAKE) no campo `gender` do documento de jogo
 * e `default_gender` do grupo. Segue o mesmo padrão de [GameVisibility].
 *
 * Compatibilidade: documentos legados sem o campo são lidos como [MIXED] via
 * [fromString], preservando o comportamento anterior (todos os jogos eram mistos).
 */
@Serializable
enum class GameGender(val displayName: String) {
    @SerialName("MALE")
    MALE("Masculino"),

    @SerialName("FEMALE")
    FEMALE("Feminino"),

    @SerialName("MIXED")
    MIXED("Misto");

    companion object {
        /**
         * Converte uma String (ou null) para [GameGender] de forma tolerante.
         * Valores desconhecidos ou ausentes retornam [MIXED] (default seguro).
         */
        fun fromString(value: String?): GameGender =
            entries.find { it.name.equals(value, ignoreCase = true) } ?: MIXED
    }
}
