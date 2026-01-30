package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Representa uma entrada de log de auditoria para alteracoes em locais.
 *
 * Armazenado em: locations/{locationId}/audit_logs/{logId}
 */
@Serializable
data class LocationAuditLog(
    val id: String = "",
    @SerialName("location_id") val locationId: String = "",
    @SerialName("user_id") val userId: String = "",
    @SerialName("user_name") val userName: String = "",
    val action: LocationAuditAction = LocationAuditAction.CREATE,
    val changes: Map<String, FieldChange>? = null,
    val timestamp: Long = 0
)

/**
 * Representa uma alteracao em um campo especifico.
 */
@Serializable
data class FieldChange(
    val before: String? = null,
    val after: String? = null
)

/**
 * Tipos de acoes de auditoria para locais.
 */
@Serializable
enum class LocationAuditAction {
    @SerialName("CREATE")
    CREATE,

    @SerialName("UPDATE")
    UPDATE,

    @SerialName("DELETE")
    DELETE
}
