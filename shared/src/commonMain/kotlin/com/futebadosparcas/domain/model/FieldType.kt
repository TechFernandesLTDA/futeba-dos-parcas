package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Tipos de quadra/campo.
 *
 * Cada tipo inclui a quantidade recomendada de jogadores por time,
 * util para sugestao automatica ao criar jogos.
 *
 * @property displayName Nome para exibicao
 * @property recommendedPlayersPerTeam Jogadores recomendados por time
 * @property typicalTotalPlayers Total tipico de jogadores (2 times)
 */
@Serializable
enum class FieldType(
    val displayName: String,
    val recommendedPlayersPerTeam: Int,
    val typicalTotalPlayers: Int
) {
    @SerialName("SOCIETY")
    SOCIETY("Society", 7, 14),

    @SerialName("FUTSAL")
    FUTSAL("Futsal", 5, 10),

    @SerialName("CAMPO")
    CAMPO("Campo", 11, 22),

    @SerialName("AREIA")
    AREIA("Areia", 5, 10),

    @SerialName("OUTROS")
    OUTROS("Outros", 7, 14);

    companion object {
        /**
         * Converte String para FieldType. Retorna OUTROS se invalido.
         */
        fun fromString(value: String?): FieldType {
            return entries.find { it.name == value } ?: OUTROS
        }

        /**
         * Sugere o FieldType mais adequado baseado no numero de jogadores.
         */
        fun suggestForPlayerCount(totalPlayers: Int): FieldType = when {
            totalPlayers <= 10 -> FUTSAL
            totalPlayers <= 16 -> SOCIETY
            else -> CAMPO
        }
    }
}
