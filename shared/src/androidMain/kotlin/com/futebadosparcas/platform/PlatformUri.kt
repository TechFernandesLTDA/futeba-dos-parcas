package com.futebadosparcas.platform

import android.net.Uri

/**
 * Implementação Android para PlatformUri usando android.net.Uri
 */
actual class PlatformUri(val uri: Uri) {
    actual fun asString(): String = uri.toString()

    actual companion object {
        actual fun parse(uriString: String): PlatformUri? {
            return try {
                PlatformUri(Uri.parse(uriString))
            } catch (e: Exception) {
                null
            }
        }
    }
}
