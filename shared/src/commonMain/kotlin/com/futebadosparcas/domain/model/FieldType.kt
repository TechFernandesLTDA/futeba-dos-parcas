package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Tipos de quadra/campo.
 */
@Serializable
enum class FieldType(val displayName: String) {
    @SerialName("SOCIETY")
    SOCIETY("Society"),

    @SerialName("FUTSAL")
    FUTSAL("Futsal"),

    @SerialName("CAMPO")
    CAMPO("Campo"),

    @SerialName("AREIA")
    AREIA("Areia"),

    @SerialName("OUTROS")
    OUTROS("Outros");
}
