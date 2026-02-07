package com.futebadosparcas.platform

import platform.Foundation.NSDate
import platform.Foundation.NSDateFormatter
import platform.Foundation.NSLocale
import platform.Foundation.NSTimeZone
import platform.Foundation.dateWithTimeIntervalSince1970
import platform.Foundation.localTimeZone
import platform.Foundation.timeIntervalSince1970

/**
 * Implementacao iOS do DateTimeHelper usando NSDateFormatter.
 *
 * Usa NSLocale pt_BR para formatacao padrao em portugues.
 */
actual object DateTimeHelper {

    actual fun now(): Long {
        return (NSDate().timeIntervalSince1970 * 1000).toLong()
    }

    actual fun formatDate(timestamp: Long, pattern: String): String {
        return try {
            val date = NSDate.dateWithTimeIntervalSince1970(timestamp / 1000.0)
            val formatter = NSDateFormatter()
            formatter.dateFormat = pattern
            formatter.locale = NSLocale("pt_BR")
            formatter.timeZone = NSTimeZone.localTimeZone
            formatter.stringFromDate(date)
        } catch (e: Exception) {
            // Fallback seguro em caso de pattern invalido
            timestamp.toString()
        }
    }
}
