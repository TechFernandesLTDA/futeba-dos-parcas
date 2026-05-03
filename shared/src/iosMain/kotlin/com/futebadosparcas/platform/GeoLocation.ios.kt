package com.futebadosparcas.platform

import kotlinx.cinterop.useContents
import platform.CoreLocation.CLLocation
import platform.CoreLocation.CLLocationCoordinate2DMake
import platform.Foundation.timeIntervalSince1970

/**
 * Extensões para converter entre GeoLocation e CLLocation (iOS)
 */

/**
 * Converte CLLocation para GeoLocation comum
 */
fun CLLocation.toGeoLocation(): GeoLocation {
    // CLLocationCoordinate2D eh um struct C - precisa de useContents para acessar campos
    val (lat, lng) = coordinate.useContents { latitude to longitude }
    return GeoLocation(
        latitude = lat,
        longitude = lng,
        altitude = altitude,
        accuracy = horizontalAccuracy,
        // NSDate.timeIntervalSince1970 retorna Double (segundos) - converter para Long (millis)
        timestamp = (timestamp.timeIntervalSince1970 * 1000).toLong()
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
