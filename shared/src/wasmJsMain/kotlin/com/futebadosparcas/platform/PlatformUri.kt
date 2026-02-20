package com.futebadosparcas.platform

/**
 * Implementação Web para PlatformUri usando String
 */
actual class PlatformUri(private val urlString: String) {
    actual fun asString(): String = urlString

    actual companion object {
        actual fun parse(uriString: String): PlatformUri? {
            return try {
                // Validação básica de URL
                if (uriString.isBlank()) null
                else PlatformUri(uriString)
            } catch (e: Exception) {
                null
            }
        }
    }
}
