package com.futebadosparcas.util

import java.text.Normalizer
import java.util.Locale

/**
 * String Extension Functions
 *
 * Provides convenient string manipulation and formatting utilities.
 */

// ============================================
// String Manipulation
// ============================================

/**
 * Capitalize first letter of each word
 */
fun String.toTitleCase(): String {
    return this.lowercase()
        .split(" ")
        .joinToString(" ") { it.replaceFirstChar { char -> char.uppercaseChar() } }
}

/**
 * Remove accents and diacritics
 */
fun String.removeAccents(): String {
    val normalized = Normalizer.normalize(this, Normalizer.Form.NFD)
    return normalized.replace(Regex("\\p{InCombiningDiacriticalMarks}+"), "")
}

/**
 * Truncate string with ellipsis
 */
fun String.truncate(maxLength: Int, ellipsis: String = "..."): String {
    return if (this.length <= maxLength) {
        this
    } else {
        this.take(maxLength - ellipsis.length) + ellipsis
    }
}

/**
 * Extract initials from name (e.g., "João Silva" -> "JS")
 */
fun String.toInitials(): String {
    return this.split(" ")
        .mapNotNull { it.firstOrNull()?.uppercaseChar() }
        .take(2)
        .joinToString("")
}

// ============================================
// Validation Helpers
// ============================================

/**
 * Check if string is a valid email
 */
fun String.isValidEmail(): Boolean {
    return android.util.Patterns.EMAIL_ADDRESS.matcher(this).matches()
}

/**
 * Check if string contains only digits
 */
fun String.isDigitsOnly(): Boolean {
    return this.matches(Regex("^\\d+$"))
}

/**
 * Check if string is a valid phone number (Brazilian format)
 */
fun String.isValidBrazilianPhone(): Boolean {
    val digitsOnly = this.replace(Regex("[^\\d]"), "")
    return digitsOnly.length >= 10 && digitsOnly.length <= 11
}

// ============================================
// Formatting
// ============================================

/**
 * Format phone number to Brazilian format
 */
fun String.toBrazilianPhoneFormat(): String {
    val digitsOnly = this.replace(Regex("[^\\d]"), "")

    return when (digitsOnly.length) {
        10 -> "(${digitsOnly.substring(0, 2)}) ${digitsOnly.substring(2, 6)}-${digitsOnly.substring(6)}"
        11 -> "(${digitsOnly.substring(0, 2)}) ${digitsOnly.substring(2, 7)}-${digitsOnly.substring(7)}"
        else -> this
    }
}

/**
 * Format number as currency (Brazilian Real)
 */
fun Double.toCurrencyString(): String {
    return String.format(Locale.forLanguageTag("pt-BR"), "R$ %.2f", this)
}

fun Int.toCurrencyString(): String {
    return this.toDouble().toCurrencyString()
}

/**
 * Format number with thousands separator
 */
fun Int.toFormattedNumber(): String {
    return String.format(Locale.forLanguageTag("pt-BR"), "%,d", this)
}

/**
 * Format percentage
 */
fun Double.toPercentageString(decimals: Int = 1): String {
    return String.format(Locale.forLanguageTag("pt-BR"), "%.${decimals}f%%", this * 100)
}

// ============================================
// XP and Gamification
// ============================================

/**
 * Format XP with "+" prefix for gains
 */
fun Int.toXpGainString(): String {
    return if (this > 0) "+$this XP" else "$this XP"
}

/**
 * Format large numbers with K/M suffix
 */
fun Int.toCompactString(): String {
    return when {
        this >= 1_000_000 -> String.format(Locale.forLanguageTag("pt-BR"), "%.1fM", this / 1_000_000.0)
        this >= 1_000 -> String.format(Locale.forLanguageTag("pt-BR"), "%.1fK", this / 1_000.0)
        else -> this.toString()
    }
}

// ============================================
// Nullability Helpers
// ============================================

/**
 * Returns string or default if null/blank
 */
fun String?.orDefault(default: String = "-"): String {
    return if (this.isNullOrBlank()) default else this
}

/**
 * Returns string or placeholder for UI
 */
fun String?.orPlaceholder(): String {
    return this.orDefault("Não informado")
}

// ============================================
// Search/Filter Helpers
// ============================================

/**
 * Check if string contains query (case-insensitive, accent-insensitive)
 */
fun String.containsQuery(query: String): Boolean {
    val normalizedThis = this.lowercase().removeAccents()
    val normalizedQuery = query.lowercase().removeAccents()
    return normalizedThis.contains(normalizedQuery)
}

/**
 * Highlight query in string (for search results)
 */
fun String.highlightQuery(query: String): String {
    if (query.isBlank()) return this

    val normalizedThis = this.lowercase().removeAccents()
    val normalizedQuery = query.lowercase().removeAccents()

    val index = normalizedThis.indexOf(normalizedQuery)
    if (index == -1) return this

    val start = this.substring(0, index)
    val match = this.substring(index, index + query.length)
    val end = this.substring(index + query.length)

    return "$start**$match**$end"
}
