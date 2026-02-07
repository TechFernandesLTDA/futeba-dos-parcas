package com.futebadosparcas.platform

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Implementacao Android do DateTimeHelper usando SimpleDateFormat.
 *
 * Usa Locale("pt", "BR") para formatacao padrao em portugues.
 */
actual object DateTimeHelper {

    actual fun now(): Long {
        return System.currentTimeMillis()
    }

    actual fun formatDate(timestamp: Long, pattern: String): String {
        return try {
            val sdf = SimpleDateFormat(pattern, Locale("pt", "BR"))
            sdf.format(Date(timestamp))
        } catch (e: Exception) {
            // Fallback seguro em caso de pattern invalido
            timestamp.toString()
        }
    }
}
