package com.futebadosparcas.ui.core

import platform.CoreLocation.CLLocationManager
import platform.CoreLocation.CLLocationManagerDelegateProtocol
import platform.CoreLocation.kCLAuthorizationStatusAuthorizedAlways
import platform.CoreLocation.kCLAuthorizationStatusAuthorizedWhenInUse
import platform.CoreLocation.kCLAuthorizationStatusNotDetermined
import platform.UIKit.UIApplication
import platform.UIKit.registerForRemoteNotifications
import platform.UserNotifications.UNAuthorizationOptionAlert
import platform.UserNotifications.UNAuthorizationOptionBadge
import platform.UserNotifications.UNAuthorizationOptionSound
import platform.UserNotifications.UNUserNotificationCenter
import platform.darwin.NSObject
import platform.darwin.dispatch_async
import platform.darwin.dispatch_get_main_queue

actual fun requestSystemNotificationPermission(onResult: (Boolean) -> Unit) {
    val options = UNAuthorizationOptionAlert or UNAuthorizationOptionBadge or UNAuthorizationOptionSound
    UNUserNotificationCenter.currentNotificationCenter()
        .requestAuthorizationWithOptions(options) { granted, _ ->
            dispatch_async(dispatch_get_main_queue()) {
                // O token APNs volta pelo AppDelegate, que repassa ao Firebase Messaging.
                if (granted) UIApplication.sharedApplication.registerForRemoteNotifications()
                onResult(granted)
            }
        }
}

/** Mantém o CLLocationManager vivo até a resposta; sem referência forte ele é liberado. */
private var pendingLocationRequest: LocationPermissionRequest? = null

actual fun requestSystemLocationPermission(onResult: (Boolean) -> Unit) {
    val request = LocationPermissionRequest { granted ->
        pendingLocationRequest = null
        onResult(granted)
    }
    pendingLocationRequest = request
    request.start()
}

private class LocationPermissionRequest(
    private val onResult: (Boolean) -> Unit
) : NSObject(), CLLocationManagerDelegateProtocol {

    private val manager = CLLocationManager()
    private var finished = false

    fun start() {
        manager.delegate = this
        if (manager.authorizationStatus == kCLAuthorizationStatusNotDetermined) {
            manager.requestWhenInUseAuthorization()
        } else {
            finish()
        }
    }

    // Chamado na criação do delegate e de novo quando a pessoa responde ao alerta.
    override fun locationManagerDidChangeAuthorization(manager: CLLocationManager) {
        if (manager.authorizationStatus != kCLAuthorizationStatusNotDetermined) finish()
    }

    private fun finish() {
        if (finished) return
        finished = true
        val status = manager.authorizationStatus
        manager.delegate = null
        onResult(
            status == kCLAuthorizationStatusAuthorizedWhenInUse ||
                status == kCLAuthorizationStatusAuthorizedAlways
        )
    }
}
