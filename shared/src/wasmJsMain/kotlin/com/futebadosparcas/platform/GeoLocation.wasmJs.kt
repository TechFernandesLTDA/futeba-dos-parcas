package com.futebadosparcas.platform

/**
 * Extensões para Web (Geolocation API)
 *
 * No Web, usamos diretamente o GeoLocation comum com dados da Geolocation API:
 * navigator.geolocation.getCurrentPosition() retorna um objeto Position com:
 * - coords.latitude
 * - coords.longitude
 * - coords.altitude
 * - coords.accuracy
 * - timestamp
 *
 * External declarations estão em BrowserExternals.kt
 */

/**
 * Cria GeoLocation a partir de coordenadas simples (helper para Web)
 */
fun createGeoLocation(
    latitude: Double,
    longitude: Double,
    altitude: Double? = null,
    accuracy: Double? = null
): GeoLocation {
    return GeoLocation(
        latitude = latitude,
        longitude = longitude,
        altitude = altitude,
        accuracy = accuracy,
        timestamp = Date.now().toLong()
    )
}
