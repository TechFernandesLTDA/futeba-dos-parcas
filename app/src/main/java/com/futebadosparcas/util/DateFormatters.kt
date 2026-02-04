package com.futebadosparcas.util

import java.text.SimpleDateFormat
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Date
import java.util.Locale

/**
 * Objeto centralizado para formatacao de datas e horas.
 * Evita duplicacao de SimpleDateFormat e DateTimeFormatter em todo o projeto.
 *
 * Uso:
 * - DateFormatters.formatDate(date) -> "01/01/2024"
 * - DateFormatters.formatDateTime(date) -> "01/01/2024 14:30"
 * - DateFormatters.parseDate("2024-01-01") -> Date
 */
object DateFormatters {

    // ========== LOCALE PADRAO ==========
    private val LOCALE_BR = Locale.forLanguageTag("pt-BR")

    // ========== FORMATOS DE EXIBICAO (UI) ==========

    /** Formato: dd/MM/yyyy (ex: 01/01/2024) */
    val DATE_DISPLAY: SimpleDateFormat
        get() = SimpleDateFormat("dd/MM/yyyy", LOCALE_BR)

    /** Formato: dd/MM/yyyy HH:mm (ex: 01/01/2024 14:30) */
    val DATE_TIME_DISPLAY: SimpleDateFormat
        get() = SimpleDateFormat("dd/MM/yyyy HH:mm", LOCALE_BR)

    /** Formato: dd/MM/yyyy 'as' HH:mm (ex: 01/01/2024 as 14:30) */
    val DATE_TIME_DISPLAY_AS: SimpleDateFormat
        get() = SimpleDateFormat("dd/MM/yyyy 'às' HH:mm", LOCALE_BR)

    /** Formato: HH:mm (ex: 14:30) */
    val TIME_DISPLAY: SimpleDateFormat
        get() = SimpleDateFormat("HH:mm", LOCALE_BR)

    /** Formato: dd/MM - HH:mm (ex: 01/01 - 14:30) */
    val DATE_TIME_SHORT: SimpleDateFormat
        get() = SimpleDateFormat("dd/MM - HH:mm", LOCALE_BR)

    /** Formato: EEEE, dd 'de' MMMM (ex: Segunda-feira, 01 de Janeiro) */
    val DATE_FULL_WEEKDAY: SimpleDateFormat
        get() = SimpleDateFormat("EEEE, dd 'de' MMMM", LOCALE_BR)

    /** Formato: MMMM yyyy (ex: Janeiro 2024) */
    val MONTH_YEAR: SimpleDateFormat
        get() = SimpleDateFormat("MMMM yyyy", LOCALE_BR)

    /** Formato: MMMM (ex: Janeiro) */
    val MONTH_ONLY: SimpleDateFormat
        get() = SimpleDateFormat("MMMM", LOCALE_BR)

    // ========== FORMATOS DE ARMAZENAMENTO (FIRESTORE/API) ==========

    /** Formato ISO: yyyy-MM-dd (ex: 2024-01-01) */
    val DATE_ISO: SimpleDateFormat
        get() = SimpleDateFormat("yyyy-MM-dd", Locale.US)

    /** Formato ISO: yyyy-MM-dd HH:mm (ex: 2024-01-01 14:30) */
    val DATE_TIME_ISO: SimpleDateFormat
        get() = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US)

    /** Formato ISO: yyyy-MM-dd HH:mm:ss (ex: 2024-01-01 14:30:00) */
    val DATE_TIME_ISO_FULL: SimpleDateFormat
        get() = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)

    // ========== JAVA TIME FORMATTERS (API 26+) ==========

    /** DateTimeFormatter: dd/MM/yyyy */
    val LOCAL_DATE_DISPLAY: DateTimeFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy", LOCALE_BR)

    /** DateTimeFormatter: HH:mm */
    val LOCAL_TIME_DISPLAY: DateTimeFormatter = DateTimeFormatter.ofPattern("HH:mm", LOCALE_BR)

    /** DateTimeFormatter: yyyy-MM-dd (ISO) */
    val LOCAL_DATE_ISO: DateTimeFormatter = DateTimeFormatter.ISO_LOCAL_DATE

    /** DateTimeFormatter: dd/MM/yyyy HH:mm */
    val LOCAL_DATE_TIME_DISPLAY: DateTimeFormatter = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm", LOCALE_BR)

    // ========== FUNCOES DE FORMATACAO ==========

    /** Formata Date para exibicao: dd/MM/yyyy */
    fun formatDate(date: Date?): String = date?.let { DATE_DISPLAY.format(it) } ?: ""

    /** Formata Date para exibicao: dd/MM/yyyy HH:mm */
    fun formatDateTime(date: Date?): String = date?.let { DATE_TIME_DISPLAY.format(it) } ?: ""

    /** Formata Date para exibicao: dd/MM/yyyy as HH:mm */
    fun formatDateTimeAs(date: Date?): String = date?.let { DATE_TIME_DISPLAY_AS.format(it) } ?: ""

    /** Formata Date para armazenamento ISO: yyyy-MM-dd */
    fun formatDateIso(date: Date?): String = date?.let { DATE_ISO.format(it) } ?: ""

    /** Formata Date para armazenamento ISO: yyyy-MM-dd HH:mm */
    fun formatDateTimeIso(date: Date?): String = date?.let { DATE_TIME_ISO.format(it) } ?: ""

    /** Formata LocalDate para exibicao: dd/MM/yyyy */
    fun formatLocalDate(date: LocalDate?): String = date?.format(LOCAL_DATE_DISPLAY) ?: ""

    /** Formata LocalTime para exibicao: HH:mm */
    fun formatLocalTime(time: LocalTime?): String = time?.format(LOCAL_TIME_DISPLAY) ?: ""

    /** Formata LocalDateTime para exibicao: dd/MM/yyyy HH:mm */
    fun formatLocalDateTime(dateTime: LocalDateTime?): String = dateTime?.format(LOCAL_DATE_TIME_DISPLAY) ?: ""

    /** Formata LocalDate para ISO: yyyy-MM-dd */
    fun formatLocalDateIso(date: LocalDate?): String = date?.format(LOCAL_DATE_ISO) ?: ""

    // ========== FUNCOES DE PARSE ==========

    /** Parse de string ISO (yyyy-MM-dd) para Date */
    fun parseDateIso(dateStr: String?): Date? = try {
        dateStr?.let { DATE_ISO.parse(it) }
    } catch (e: Exception) {
        null
    }

    /** Parse de string ISO (yyyy-MM-dd HH:mm) para Date */
    fun parseDateTimeIso(dateTimeStr: String?): Date? = try {
        dateTimeStr?.let { DATE_TIME_ISO.parse(it) }
    } catch (e: Exception) {
        null
    }

    /** Parse de string display (dd/MM/yyyy) para Date */
    fun parseDateDisplay(dateStr: String?): Date? = try {
        dateStr?.let { DATE_DISPLAY.parse(it) }
    } catch (e: Exception) {
        null
    }

    /** Parse de string ISO (yyyy-MM-dd) para LocalDate */
    fun parseLocalDateIso(dateStr: String?): LocalDate? = try {
        dateStr?.let { LocalDate.parse(it, LOCAL_DATE_ISO) }
    } catch (e: Exception) {
        null
    }

    /** Parse de string (HH:mm) para LocalTime */
    fun parseLocalTime(timeStr: String?): LocalTime? = try {
        timeStr?.let { LocalTime.parse(it, LOCAL_TIME_DISPLAY) }
    } catch (e: Exception) {
        null
    }

    // ========== DIAS DA SEMANA ==========

    /** Retorna nome do dia da semana em portugues */
    fun getDayOfWeekName(dayOfWeek: Int): String = when (dayOfWeek) {
        1 -> "Domingo"
        2 -> "Segunda-feira"
        3 -> "Terça-feira"
        4 -> "Quarta-feira"
        5 -> "Quinta-feira"
        6 -> "Sexta-feira"
        7 -> "Sábado"
        else -> ""
    }

    /** Lista de dias da semana em portugues */
    val DAYS_OF_WEEK = listOf(
        "Domingo",
        "Segunda-feira",
        "Terça-feira",
        "Quarta-feira",
        "Quinta-feira",
        "Sexta-feira",
        "Sábado"
    )

    /** Lista de frequencias de recorrencia */
    val RECURRENCE_OPTIONS = listOf(
        "Semanal",
        "Quinzenal",
        "Mensal"
    )
}
