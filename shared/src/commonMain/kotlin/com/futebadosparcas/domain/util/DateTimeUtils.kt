package com.futebadosparcas.domain.util

import kotlinx.datetime.*

/**
 * Utilitarios de data/hora multiplataforma.
 */
object DateTimeUtils {

    /**
     * Retorna o timestamp atual em milissegundos.
     */
    fun currentTimeMillis(): Long {
        return Clock.System.now().toEpochMilliseconds()
    }

    /**
     * Retorna a data atual.
     */
    fun today(): LocalDate {
        return Clock.System.todayIn(TimeZone.currentSystemDefault())
    }

    /**
     * Retorna o Instant atual.
     */
    fun now(): Instant {
        return Clock.System.now()
    }

    /**
     * Converte timestamp em milissegundos para LocalDateTime.
     */
    fun fromMillis(millis: Long): LocalDateTime {
        return Instant.fromEpochMilliseconds(millis)
            .toLocalDateTime(TimeZone.currentSystemDefault())
    }

    /**
     * Converte LocalDateTime para timestamp em milissegundos.
     */
    fun toMillis(dateTime: LocalDateTime): Long {
        return dateTime.toInstant(TimeZone.currentSystemDefault()).toEpochMilliseconds()
    }

    /**
     * Formata data como "dd/MM/yyyy".
     */
    fun formatDate(date: LocalDate): String {
        return "${date.dayOfMonth.toString().padStart(2, '0')}/" +
                "${date.monthNumber.toString().padStart(2, '0')}/" +
                "${date.year}"
    }

    /**
     * Formata hora como "HH:mm".
     */
    fun formatTime(hour: Int, minute: Int): String {
        return "${hour.toString().padStart(2, '0')}:" +
                "${minute.toString().padStart(2, '0')}"
    }

    /**
     * Calcula a diferenca em dias entre duas datas.
     */
    fun daysBetween(start: LocalDate, end: LocalDate): Int {
        return (end.toEpochDays() - start.toEpochDays()).toInt()
    }

    /**
     * Retorna o primeiro dia do mes atual.
     */
    fun firstDayOfCurrentMonth(): LocalDate {
        val today = today()
        return LocalDate(today.year, today.month, 1)
    }

    /**
     * Gera ID de temporada no formato "monthly_YYYY_MM".
     */
    fun generateSeasonId(year: Int, month: Int): String {
        return "monthly_${year}_${month.toString().padStart(2, '0')}"
    }

    /**
     * Gera ID da temporada atual.
     */
    fun currentSeasonId(): String {
        val today = today()
        return generateSeasonId(today.year, today.monthNumber)
    }
}
