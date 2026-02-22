package com.futebadosparcas.platform

import android.location.Location

/**
 * Extensões para converter entre GeoLocation e android.location.Location
 */

/**
 * Converte android.location.Location para GeoLocation comum
 */
fun Location.toGeoLocation(): GeoLocation {
    return GeoLocation(
        latitude = latitude,
        longitude = longitude,
        altitude = if (hasAltitude()) altitude else null,
        accuracy = if (hasAccuracy()) accuracy.toDouble() else null,
        timestamp = time
    )
}

/**
 * Converte GeoLocation para android.location.Location
 */
fun GeoLocation.toAndroidLocation(provider: String = "platform"): Location {
    return Location(provider).apply {
        latitude = this@toAndroidLocation.latitude
        longitude = this@toAndroidLocation.longitude
        this@toAndroidLocation.altitude?.let { altitude = it }
        this@toAndroidLocation.accuracy?.let { accuracy = it.toFloat() }
        time = this@toAndroidLocation.timestamp
    }
}
