package com.futebadosparcas.util

import java.text.DecimalFormat
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Currency
import java.util.Date
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Formatting Helper
 *
 * Provides utilities for formatting numbers, dates, currency, and other data types.
 *
 * Usage:
 * ```kotlin
 * @Inject lateinit var formattingHelper: FormattingHelper
 *
 * // Format currency
 * val formatted = formattingHelper.formatCurrency(1500.50) // "R$ 1.500,50"
 *
 * // Format percentage
 * val percent = formattingHelper.formatPercentage(0.85) // "85%"
 *
 * // Format large numbers
 * val xp = formattingHelper.formatLargeNumber(1250000) // "1,25M"
 * ```
 */
@Singleton
class FormattingHelper @Inject constructor() {

    private val brazilLocale = Locale.forLanguageTag("pt-BR")

    /**
     * Format currency in Brazilian Reais
     */
    fun formatCurrency(value: Double): String {
        val format = NumberFormat.getCurrencyInstance(brazilLocale)
        return format.format(value)
    }

    /**
     * Format currency without symbol
     */
    fun formatCurrencyWithoutSymbol(value: Double): String {
        val numberFormat = NumberFormat.getNumberInstance(brazilLocale) as DecimalFormat
        val symbols = numberFormat.decimalFormatSymbols
        val decimalFormat = DecimalFormat("#,##0.00", symbols)
        return decimalFormat.format(value)
    }

    /**
     * Format percentage (0.0-1.0 to 0-100%)
     */
    fun formatPercentage(value: Double, decimals: Int = 0): String {
        val percentage = value * 100
        val format = if (decimals > 0) {
            "%.${decimals}f%%"
        } else {
            "%.0f%%"
        }
        return format.format(percentage)
    }

    /**
     * Format win rate
     */
    fun formatWinRate(wins: Int, total: Int): String {
        if (total == 0) return "0%"
        val rate = wins.toDouble() / total
        return formatPercentage(rate)
    }

    /**
     * Format large numbers with abbreviations (K, M, B)
     */
    fun formatLargeNumber(value: Long): String {
        return when {
            value >= 1_000_000_000 -> String.format("%.2fB", value / 1_000_000_000.0)
            value >= 1_000_000 -> String.format("%.2fM", value / 1_000_000.0)
            value >= 1_000 -> String.format("%.2fK", value / 1_000.0)
            else -> value.toString()
        }
    }

    /**
     * Format XP with K suffix
     */
    fun formatXP(xp: Int): String {
        return if (xp >= 1000) {
            formatLargeNumber(xp.toLong())
        } else {
            xp.toString()
        }
    }

    /**
     * Format decimal number with specific decimal places
     */
    fun formatDecimal(value: Double, decimals: Int = 2): String {
        val pattern = "0.${"0".repeat(decimals)}"
        val numberFormat = NumberFormat.getNumberInstance(brazilLocale) as DecimalFormat
        val symbols = numberFormat.decimalFormatSymbols
        val decimalFormat = DecimalFormat(pattern, symbols)
        return decimalFormat.format(value)
    }

    /**
     * Format player rating (0.0-5.0)
     */
    fun formatRating(rating: Double): String {
        return formatDecimal(rating, 1)
    }

    /**
     * Format Brazilian CPF (000.000.000-00)
     */
    fun formatCPF(cpf: String): String {
        val clean = cpf.replace(Regex("[^0-9]"), "")
        if (clean.length != 11) return cpf

        return "${clean.substring(0, 3)}.${clean.substring(3, 6)}.${clean.substring(6, 9)}-${clean.substring(9)}"
    }

    /**
     * Format Brazilian phone number ((00) 00000-0000 or (00) 0000-0000)
     */
    fun formatPhone(phone: String): String {
        val clean = phone.replace(Regex("[^0-9]"), "")

        return when (clean.length) {
            11 -> "(${clean.substring(0, 2)}) ${clean.substring(2, 7)}-${clean.substring(7)}"
            10 -> "(${clean.substring(0, 2)}) ${clean.substring(2, 6)}-${clean.substring(6)}"
            else -> phone
        }
    }

    /**
     * Format duration in milliseconds to readable format
     */
    fun formatDuration(millis: Long): String {
        val seconds = (millis / 1000) % 60
        val minutes = (millis / (1000 * 60)) % 60
        val hours = millis / (1000 * 60 * 60)

        return when {
            hours > 0 -> String.format("%02d:%02d:%02d", hours, minutes, seconds)
            else -> String.format("%02d:%02d", minutes, seconds)
        }
    }

    /**
     * Format game duration
     */
    fun formatGameDuration(durationMinutes: Int): String {
        val hours = durationMinutes / 60
        val minutes = durationMinutes % 60

        return when {
            hours > 0 -> "${hours}h ${minutes}min"
            else -> "${minutes}min"
        }
    }

    /**
     * Format player count with "jogadores" suffix
     */
    fun formatPlayerCount(count: Int): String {
        return if (count == 1) {
            "1 jogador"
        } else {
            "$count jogadores"
        }
    }

    /**
     * Format goals count
     */
    fun formatGoals(count: Int): String {
        return if (count == 1) {
            "1 gol"
        } else {
            "$count gols"
        }
    }

    /**
     * Format assists count
     */
    fun formatAssists(count: Int): String {
        return if (count == 1) {
            "1 assistência"
        } else {
            "$count assistências"
        }
    }

    /**
     * Format ordinal number (1º, 2º, 3º, etc.)
     */
    fun formatOrdinal(number: Int): String {
        return "${number}º"
    }

    /**
     * Format ranking position with medal emoji
     */
    fun formatRankingPosition(position: Int): String {
        val medal = when (position) {
            1 -> "\uD83E\uDD47" // 🥇
            2 -> "\uD83E\uDD48" // 🥈
            3 -> "\uD83E\uDD49" // 🥉
            else -> ""
        }
        return "$medal ${formatOrdinal(position)}"
    }

    /**
     * Format file size (bytes to human-readable)
     */
    fun formatFileSize(bytes: Long): String {
        return when {
            bytes >= 1024 * 1024 * 1024 -> String.format("%.2f GB", bytes / (1024.0 * 1024 * 1024))
            bytes >= 1024 * 1024 -> String.format("%.2f MB", bytes / (1024.0 * 1024))
            bytes >= 1024 -> String.format("%.2f KB", bytes / 1024.0)
            else -> "$bytes B"
        }
    }

    /**
     * Format distance (meters to km if needed)
     */
    fun formatDistance(meters: Int): String {
        return if (meters >= 1000) {
            String.format("%.1f km", meters / 1000.0)
        } else {
            "$meters m"
        }
    }

    /**
     * Pluralize word based on count
     */
    fun pluralize(count: Int, singular: String, plural: String): String {
        return if (count == 1) {
            "$count $singular"
        } else {
            "$count $plural"
        }
    }

    /**
     * Format list of names with "and"
     */
    fun formatNameList(names: List<String>): String {
        return when (names.size) {
            0 -> ""
            1 -> names[0]
            2 -> "${names[0]} e ${names[1]}"
            else -> {
                val allButLast = names.dropLast(1).joinToString(", ")
                "$allButLast e ${names.last()}"
            }
        }
    }

    /**
     * Truncate text with ellipsis
     */
    fun truncate(text: String, maxLength: Int, suffix: String = "..."): String {
        return if (text.length <= maxLength) {
            text
        } else {
            text.substring(0, maxLength - suffix.length) + suffix
        }
    }

    /**
     * Format score (00 x 00)
     */
    fun formatScore(teamA: Int, teamB: Int): String {
        return "$teamA x $teamB"
    }

    /**
     * Capitalize first letter
     */
    fun capitalize(text: String): String {
        return text.replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.getDefault()) else it.toString() }
    }

    /**
     * Capitalize words
     */
    fun capitalizeWords(text: String): String {
        return text.split(" ").joinToString(" ") { capitalize(it) }
    }

    /**
     * Remove accents from text
     */
    fun removeAccents(text: String): String {
        val normalized = java.text.Normalizer.normalize(text, java.text.Normalizer.Form.NFD)
        return normalized.replace(Regex("\\p{M}"), "")
    }
}
