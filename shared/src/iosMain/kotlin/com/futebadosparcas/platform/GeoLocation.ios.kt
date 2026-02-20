package com.futebadosparcas.platform

import platform.CoreLocation.CLLocation
import platform.CoreLocation.CLLocationCoordinate2DMake

/**
 * Extensões para converter entre GeoLocation e CLLocation (iOS)
 */

/**
 * Converte CLLocation para GeoLocation comum
 */
fun CLLocation.toGeoLocation(): GeoLocation {
    return GeoLocation(
        latitude = coordinate.latitude,
        longitude = coordinate.longitude,
        altitude = altitude,
        accuracy = horizontalAccuracy,
        timestamp = timestamp.toLong()
    )
}

/**
 * Converte GeoLocation para CLLocation
 * Nota: CLLocation é imutável no iOS, então criamos uma nova instância
 */
fun GeoLocation.toCLLocation(): CLLocation {
    val coordinate = CLLocationCoordinate2DMake(latitude, longitude)
    return CLLocation(
        coordinate = coordinate,
        altitude = altitude ?: 0.0,
        horizontalAccuracy = accuracy ?: -1.0,
        verticalAccuracy = -1.0,
        timestamp = platform.Foundation.NSDate()
    )
}
