package com.futebadosparcas.util

import android.content.Context
import android.text.format.DateFormat
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.time.format.FormatStyle
import java.util.Locale

/**
 * Utilitario para formatacao de horarios de locais de acordo com o locale do usuario.
 *
 * Suporta:
 * - Formato 24h (ex: "08:00", "14:30") para locales como pt_BR
 * - Formato 12h (ex: "8:00 AM", "2:30 PM") para locales como en_US
 * - Deteccao automatica via configuracao do sistema Android
 * - Preferencia manual do usuario (auto/12h/24h)
 *
 * Uso:
 * ```kotlin
 * // Formato automatico baseado no sistema
 * LocationTimeFormatter.formatTime("08:00", context) // "8:00 AM" ou "08:00"
 *
 * // Range de horarios
 * LocationTimeFormatter.formatTimeRange("08:00", "22:00", context) // "8:00 AM - 10:00 PM"
 *
 * // Parse reverso
 * LocationTimeFormatter.parseTime("8:00 AM", Locale.US) // "08:00"
 * ```
 */
object LocationTimeFormatter {

    // Formatadores padrao para parse de entrada (sempre 24h)
    private val INPUT_FORMATTER_24H = DateTimeFormatter.ofPattern("HH:mm")

    // Formatadores de saida
    private val OUTPUT_FORMATTER_24H = DateTimeFormatter.ofPattern("HH:mm")
    private val OUTPUT_FORMATTER_12H = DateTimeFormatter.ofPattern("h:mm a")

    // Formatadores para parse de entrada 12h
    private val INPUT_FORMATTER_12H_US = DateTimeFormatter.ofPattern("h:mm a", Locale.US)
    private val INPUT_FORMATTER_12H_DEFAULT = DateTimeFormatter.ofPattern("h:mm a")

    /**
     * Enum para preferencia de formato de hora.
     */
    enum class TimeFormatPreference {
        /** Usa configuracao do sistema Android */
        AUTO,
        /** Forca formato 12h (AM/PM) */
        FORMAT_12H,
        /** Forca formato 24h */
        FORMAT_24H
    }

    /**
     * Formata um horario no formato "HH:mm" para exibicao de acordo com o locale.
     *
     * @param time Horario no formato 24h (ex: "08:00", "14:30")
     * @param context Context Android para detectar configuracao do sistema
     * @param preference Preferencia de formato (auto/12h/24h)
     * @param locale Locale para formatacao (default: Locale.getDefault())
     * @return Horario formatado (ex: "8:00 AM" ou "08:00")
     */
    fun formatTime(
        time: String,
        context: Context? = null,
        preference: TimeFormatPreference = TimeFormatPreference.AUTO,
        locale: Locale = Locale.getDefault()
    ): String {
        if (time.isBlank()) return ""

        return try {
            val localTime = LocalTime.parse(time, INPUT_FORMATTER_24H)
            val use24Hour = shouldUse24HourFormat(context, preference)

            if (use24Hour) {
                localTime.format(OUTPUT_FORMATTER_24H)
            } else {
                // Usa locale especifico para AM/PM
                val formatter = DateTimeFormatter.ofPattern("h:mm a", locale)
                localTime.format(formatter)
            }
        } catch (e: DateTimeParseException) {
            AppLogger.w("LocationTimeFormatter") { "Falha ao parsear horario: $time" }
            time // Retorna original em caso de erro
        }
    }

    /**
     * Formata um range de horarios para exibicao.
     *
     * @param openingTime Horario de abertura no formato 24h
     * @param closingTime Horario de fechamento no formato 24h
     * @param context Context Android para detectar configuracao do sistema
     * @param preference Preferencia de formato
     * @param locale Locale para formatacao
     * @return Range formatado (ex: "8:00 AM - 10:00 PM" ou "08:00 - 22:00")
     */
    fun formatTimeRange(
        openingTime: String,
        closingTime: String,
        context: Context? = null,
        preference: TimeFormatPreference = TimeFormatPreference.AUTO,
        locale: Locale = Locale.getDefault()
    ): String {
        val formattedOpening = formatTime(openingTime, context, preference, locale)
        val formattedClosing = formatTime(closingTime, context, preference, locale)

        return if (formattedOpening.isNotEmpty() && formattedClosing.isNotEmpty()) {
            "$formattedOpening - $formattedClosing"
        } else if (formattedOpening.isNotEmpty()) {
            formattedOpening
        } else {
            formattedClosing
        }
    }

    /**
     * Converte um horario formatado de volta para o formato 24h de armazenamento.
     *
     * @param formatted Horario formatado (ex: "8:00 AM", "14:30")
     * @param locale Locale do horario formatado
     * @return Horario no formato 24h (ex: "08:00")
     */
    fun parseTime(formatted: String, locale: Locale = Locale.getDefault()): String {
        if (formatted.isBlank()) return ""

        return try {
            // Tenta parse como 24h primeiro
            val localTime = try {
                LocalTime.parse(formatted, INPUT_FORMATTER_24H)
            } catch (e: DateTimeParseException) {
                // Tenta parse como 12h
                try {
                    LocalTime.parse(formatted.uppercase(), INPUT_FORMATTER_12H_US)
                } catch (e2: DateTimeParseException) {
                    // Tenta com locale especifico
                    val localeFormatter = DateTimeFormatter.ofPattern("h:mm a", locale)
                    LocalTime.parse(formatted, localeFormatter)
                }
            }

            localTime.format(OUTPUT_FORMATTER_24H)
        } catch (e: Exception) {
            AppLogger.w("LocationTimeFormatter") { "Falha ao parsear horario formatado: $formatted" }
            formatted
        }
    }

    /**
     * Verifica se o sistema esta configurado para formato 24h.
     *
     * @param context Context Android
     * @return true se o sistema usa formato 24h
     */
    fun is24HourFormat(context: Context): Boolean {
        return DateFormat.is24HourFormat(context)
    }

    /**
     * Determina se deve usar formato 24h baseado na preferencia e configuracao do sistema.
     *
     * @param context Context Android (pode ser null)
     * @param preference Preferencia do usuario
     * @return true se deve usar formato 24h
     */
    fun shouldUse24HourFormat(
        context: Context?,
        preference: TimeFormatPreference = TimeFormatPreference.AUTO
    ): Boolean {
        return when (preference) {
            TimeFormatPreference.FORMAT_24H -> true
            TimeFormatPreference.FORMAT_12H -> false
            TimeFormatPreference.AUTO -> {
                // Se temos context, usa configuracao do sistema
                // Senao, decide baseado no locale
                context?.let { is24HourFormat(it) } ?: isLocale24Hour(Locale.getDefault())
            }
        }
    }

    /**
     * Verifica se um locale tipicamente usa formato 24h.
     * Usado como fallback quando nao temos Context.
     *
     * @param locale Locale a verificar
     * @return true se o locale tipicamente usa formato 24h
     */
    fun isLocale24Hour(locale: Locale): Boolean {
        // Locales que tipicamente usam formato 12h (AM/PM)
        val locales12Hour = setOf("en_US", "en_AU", "en_CA", "en_PH")
        val localeString = "${locale.language}_${locale.country}"

        // Brasil e maioria dos paises usam 24h
        return localeString !in locales12Hour && locale.language != "en"
    }

    /**
     * Retorna os nomes dos dias da semana de acordo com o locale.
     *
     * @param dayNumbers Lista de numeros dos dias (1 = Domingo, 2 = Segunda, ..., 7 = Sabado)
     * @param locale Locale para nomes dos dias
     * @param abbreviated Se true, retorna abreviacoes (Seg, Ter, ...)
     * @return Lista de nomes dos dias
     */
    fun getDayNames(
        dayNumbers: List<Int>,
        locale: Locale = Locale.getDefault(),
        abbreviated: Boolean = true
    ): List<String> {
        val dayNamesFull = getDayNamesForLocale(locale)
        val dayNamesAbbrev = getDayNamesAbbrevForLocale(locale)

        return dayNumbers.mapNotNull { dayNumber ->
            // Ajusta indice (1-7 para 0-6)
            val index = (dayNumber - 1).coerceIn(0, 6)
            if (abbreviated) dayNamesAbbrev.getOrNull(index) else dayNamesFull.getOrNull(index)
        }
    }

    /**
     * Formata uma lista de dias de operacao para exibicao.
     *
     * @param operatingDays Lista de dias (1 = Domingo, ..., 7 = Sabado)
     * @param locale Locale para formatacao
     * @return String formatada (ex: "Seg - Sex", "Todos os dias", "Seg, Qua, Sex")
     */
    fun formatOperatingDays(
        operatingDays: List<Int>,
        locale: Locale = Locale.getDefault()
    ): String {
        if (operatingDays.isEmpty()) return ""

        val sortedDays = operatingDays.sorted()

        // Todos os dias
        if (sortedDays == listOf(1, 2, 3, 4, 5, 6, 7)) {
            return getTextForLocale("all_days", locale)
        }

        // Segunda a Sexta (dias uteis)
        if (sortedDays == listOf(2, 3, 4, 5, 6)) {
            return getTextForLocale("weekdays", locale)
        }

        // Fim de semana
        if (sortedDays == listOf(1, 7)) {
            return getTextForLocale("weekend", locale)
        }

        // Verifica se sao dias consecutivos
        if (areConsecutiveDays(sortedDays)) {
            val dayNames = getDayNamesAbbrevForLocale(locale)
            val first = dayNames.getOrNull((sortedDays.first() - 1).coerceIn(0, 6)) ?: ""
            val last = dayNames.getOrNull((sortedDays.last() - 1).coerceIn(0, 6)) ?: ""
            return "$first - $last"
        }

        // Lista individual de dias
        val dayNames = getDayNames(sortedDays, locale, abbreviated = true)
        return dayNames.joinToString(", ")
    }

    /**
     * Verifica se uma lista de dias sao consecutivos.
     */
    private fun areConsecutiveDays(days: List<Int>): Boolean {
        if (days.size < 2) return true
        for (i in 1 until days.size) {
            if (days[i] != days[i - 1] + 1) return false
        }
        return true
    }

    /**
     * Retorna nomes completos dos dias da semana para um locale.
     */
    private fun getDayNamesForLocale(locale: Locale): List<String> {
        return if (locale.language == "pt") {
            listOf("Domingo", "Segunda-feira", "Terca-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sabado")
        } else {
            listOf("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday")
        }
    }

    /**
     * Retorna abreviacoes dos dias da semana para um locale.
     */
    private fun getDayNamesAbbrevForLocale(locale: Locale): List<String> {
        return if (locale.language == "pt") {
            listOf("Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab")
        } else {
            listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")
        }
    }

    /**
     * Retorna texto localizado para strings comuns.
     */
    private fun getTextForLocale(key: String, locale: Locale): String {
        return if (locale.language == "pt") {
            when (key) {
                "all_days" -> "Todos os dias"
                "weekdays" -> "Seg - Sex"
                "weekend" -> "Fim de semana"
                else -> ""
            }
        } else {
            when (key) {
                "all_days" -> "Every day"
                "weekdays" -> "Mon - Fri"
                "weekend" -> "Weekends"
                else -> ""
            }
        }
    }

    /**
     * Valida se uma string esta no formato de horario valido.
     *
     * @param time String a validar
     * @return true se e um horario valido no formato HH:mm
     */
    fun isValidTimeFormat(time: String): Boolean {
        return try {
            LocalTime.parse(time, INPUT_FORMATTER_24H)
            true
        } catch (e: DateTimeParseException) {
            false
        }
    }

    /**
     * Normaliza um horario para o formato padrao HH:mm.
     * Aceita formatos como "8:00", "08:00", "8:0" e normaliza para "08:00".
     *
     * @param time Horario em formato variado
     * @return Horario normalizado ou o original se nao conseguir parsear
     */
    fun normalizeTime(time: String): String {
        if (time.isBlank()) return ""

        return try {
            // Tenta varios formatos comuns
            val formats = listOf(
                DateTimeFormatter.ofPattern("H:mm"),
                DateTimeFormatter.ofPattern("HH:mm"),
                DateTimeFormatter.ofPattern("H:m"),
                DateTimeFormatter.ofPattern("HH:m")
            )

            var localTime: LocalTime? = null
            for (format in formats) {
                try {
                    localTime = LocalTime.parse(time, format)
                    break
                } catch (e: DateTimeParseException) {
                    // Tenta proximo formato
                }
            }

            localTime?.format(OUTPUT_FORMATTER_24H) ?: time
        } catch (e: Exception) {
            time
        }
    }
}
