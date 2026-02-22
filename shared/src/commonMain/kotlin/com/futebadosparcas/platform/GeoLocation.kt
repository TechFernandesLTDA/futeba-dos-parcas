package com.futebadosparcas.platform

import kotlinx.serialization.Serializable

/**
 * Classe de dados comum para representar localização geográfica
 * Multiplataforma - funciona em Android, iOS e Web
 */
@Serializable
data class GeoLocation(
    val latitude: Double,
    val longitude: Double,
    val altitude: Double? = null,
    val accuracy: Double? = null,
    val timestamp: Long = 0L
)
