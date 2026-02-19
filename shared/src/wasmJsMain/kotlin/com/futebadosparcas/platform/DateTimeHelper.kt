package com.futebadosparcas.platform

import kotlinx.datetime.Clock

actual object DateTimeHelper {
    actual fun now(): Long = Clock.System.now().toEpochMilliseconds()

    actual fun formatDate(timestamp: Long, pattern: String): String {
        // TODO: Fase 3 - implementar via Intl.DateTimeFormat para web
        return timestamp.toString()
    }
}
