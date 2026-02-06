package com.futebadosparcas.platform

import platform.UIKit.UIDevice

/**
 * Implementacao iOS da classe Platform.
 *
 * Usa UIDevice para identificar a versao do iOS.
 */
actual class Platform actual constructor() {
    actual val name: String = "${UIDevice.currentDevice.systemName()} ${UIDevice.currentDevice.systemVersion}"
    actual val isAndroid: Boolean = false
    actual val isIOS: Boolean = true
}
