package com.futebadosparcas.platform

/**
 * Abstração multiplataforma para URIs
 * - Android: android.net.Uri
 * - iOS: NSURL
 * - Web: String (URL)
 */
expect class PlatformUri {
    /**
     * Retorna a representação em String da URI
     */
    fun asString(): String

    companion object {
        /**
         * Cria uma PlatformUri a partir de uma String
         */
        fun parse(uriString: String): PlatformUri?
    }
}
