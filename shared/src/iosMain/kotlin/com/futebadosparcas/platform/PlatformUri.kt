package com.futebadosparcas.platform

import platform.Foundation.NSURL

/**
 * Implementação iOS para PlatformUri usando NSURL
 */
actual class PlatformUri(val nsUrl: NSURL) {
    actual fun asString(): String = nsUrl.absoluteString ?: ""

    actual companion object {
        actual fun parse(uriString: String): PlatformUri? {
            return NSURL.URLWithString(uriString)?.let { PlatformUri(it) }
        }
    }
}
