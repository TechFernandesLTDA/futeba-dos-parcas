package com.futebadosparcas.util

import java.text.SimpleDateFormat
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Date
import java.util.Locale

/**
 * Date/Time Extension Functions
 *
 * Provides convenient date/time formatting and manipulation.
 * Uses Java 8 Time API (available via desugaring).
 */

// ============================================
// Date Formatting
// ============================================

private val DATE_FORMAT_PT_BR = SimpleDateFormat("dd/MM/yyyy", Locale.forLanguageTag("pt-BR"))
private val TIME_FORMAT_PT_BR = SimpleDateFormat("HH:mm", Locale.forLanguageTag("pt-BR"))
private val DATETIME_FORMAT_PT_BR = SimpleDateFormat("dd/MM/yyyy 'às' HH:mm", Locale.forLanguageTag("pt-BR"))

/**
 * Format Date to Brazilian format: 21/01/2025
 */
fun Date.toFormattedDate(): String {
    return DATE_FORMAT_PT_BR.format(this)
}

/**
 * Format Date to time: 14:30
 */
fun Date.toFormattedTime(): String {
    return TIME_FORMAT_PT_BR.format(this)
}

/**
 * Format Date to full datetime: 21/01/2025 às 14:30
 */
fun Date.toFormattedDateTime(): String {
    return DATETIME_FORMAT_PT_BR.format(this)
}

/**
 * Convert Date to relative time (e.g., "há 2 horas")
 */
fun Date.toRelativeTime(): String {
    val now = System.currentTimeMillis()
    val diff = now - this.time

    return when {
        diff < 60_000 -> "agora"
        diff < 3600_000 -> "${diff / 60_000} min atrás"
        diff < 86400_000 -> "${diff / 3600_000}h atrás"
        diff < 604800_000 -> "${diff / 86400_000}d atrás"
        else -> toFormattedDate()
    }
}

// ============================================
// LocalDateTime Extensions
// ============================================

private val DATETIME_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm", Locale.forLanguageTag("pt-BR"))
private val DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy", Locale.forLanguageTag("pt-BR"))
private val TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm", Locale.forLanguageTag("pt-BR"))

fun LocalDateTime.toFormattedString(): String {
    return this.format(DATETIME_FORMATTER)
}

fun LocalDate.toFormattedString(): String {
    return this.format(DATE_FORMATTER)
}

// ============================================
// Conversions
// ============================================

fun Date.toLocalDateTime(): LocalDateTime {
    return Instant.ofEpochMilli(this.time)
        .atZone(ZoneId.systemDefault())
        .toLocalDateTime()
}

fun LocalDateTime.toDate(): Date {
    return Date.from(this.atZone(ZoneId.systemDefault()).toInstant())
}

fun Long.toDate(): Date {
    return Date(this)
}

/**
 * Convert String in format "yyyy-MM-dd HH:mm" to Date
 * Returns null if parsing fails
 */
fun String.toDate(): Date? {
    if (this.isBlank()) return null
    return try {
        val format = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.forLanguageTag("pt-BR"))
        format.parse(this)
    } catch (e: Exception) {
        null
    }
}

/**
 * Convert Date to Instant
 */
fun Date.toInstant(): Instant {
    return Instant.ofEpochMilli(this.time)
}

// ============================================
// Time Calculations
// ============================================

/**
 * Check if Date is today
 */
fun Date.isToday(): Boolean {
    val today = LocalDate.now()
    val dateLocal = this.toLocalDateTime().toLocalDate()
    return dateLocal == today
}

/**
 * Check if Date is in the past
 */
fun Date.isPast(): Boolean {
    return this.time < System.currentTimeMillis()
}

/**
 * Check if Date is in the future
 */
fun Date.isFuture(): Boolean {
    return this.time > System.currentTimeMillis()
}

/**
 * Add days to Date
 */
fun Date.plusDays(days: Int): Date {
    val localDateTime = this.toLocalDateTime()
    return localDateTime.plusDays(days.toLong()).toDate()
}

/**
 * Add hours to Date
 */
fun Date.plusHours(hours: Int): Date {
    val localDateTime = this.toLocalDateTime()
    return localDateTime.plusHours(hours.toLong()).toDate()
}

/**
 * Calculate duration between two dates
 */
fun Date.durationUntil(other: Date): Duration {
    return Duration.between(
        this.toInstant(),
        other.toInstant()
    )
}

/**
 * Format duration in human-readable format
 */
fun Duration.toHumanReadable(): String {
    val hours = this.toHours()
    val minutes = this.toMinutesPart()

    return when {
        hours > 0 -> "${hours}h ${minutes}min"
        minutes > 0 -> "${minutes} min"
        else -> "${this.seconds}s"
    }
}
