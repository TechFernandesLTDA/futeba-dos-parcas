package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Representa um horario recorrente para jogos (Schedule).
 * Usado para criacao automatica de jogos em datas futuras.
 */
@Serializable
data class Schedule(
    val id: String = "",
    val ownerId: String = "",
    val ownerName: String = "",
    val name: String = "",
    val locationId: String = "",
    val locationName: String = "",
    val locationAddress: String = "",
    val locationLat: Double? = null,
    val locationLng: Double? = null,
    val fieldId: String = "",
    val fieldName: String = "",
    val fieldType: String = "Society",
    val recurrenceType: RecurrenceType = RecurrenceType.WEEKLY,
    val dayOfWeek: Int = 0, // 0 = domingo, 1 = segunda, etc.
    val time: String = "",
    val duration: Int = 60, // minutos
    val isPublic: Boolean = false,
    val maxPlayers: Int = 14,
    val dailyPrice: Double = 0.0,
    val monthlyPrice: Double? = null,
    val groupId: String? = null,
    val groupName: String? = null,
    val memberIds: List<String> = emptyList(),
    val createdAt: Long? = null
)

/**
 * Tipos de recorrencia para horarios.
 */
@Serializable
enum class RecurrenceType {
    @SerialName("weekly")
    WEEKLY,

    @SerialName("biweekly")
    BIWEEKLY,

    @SerialName("monthly")
    MONTHLY;

    companion object {
        fun fromString(value: String): RecurrenceType {
            return when (value.lowercase()) {
                "weekly", "semanal" -> WEEKLY
                "biweekly", "quinzenal" -> BIWEEKLY
                "monthly", "mensal" -> MONTHLY
                else -> WEEKLY
            }
        }
    }
}
