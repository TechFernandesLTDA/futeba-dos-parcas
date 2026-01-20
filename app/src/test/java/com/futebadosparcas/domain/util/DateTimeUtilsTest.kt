package com.futebadosparcas.domain.util

import kotlinx.datetime.LocalDate
import kotlinx.datetime.LocalDateTime
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource

/**
 * Testes unitários para DateTimeUtils.
 * Cobre funções de data/hora multiplataforma.
 */
@DisplayName("DateTimeUtils Tests")
class DateTimeUtilsTest {

    // ==================== TESTES DE currentTimeMillis ====================

    @Nested
    @DisplayName("currentTimeMillis")
    inner class CurrentTimeMillisTests {

        @Test
        @DisplayName("Deve retornar timestamp positivo")
        fun `should return positive timestamp`() {
            val millis = DateTimeUtils.currentTimeMillis()
            assertTrue(millis > 0)
        }

        @Test
        @DisplayName("Timestamp deve estar no futuro de 2020")
        fun `timestamp should be after year 2020`() {
            val millis = DateTimeUtils.currentTimeMillis()
            // 1 Jan 2020 00:00:00 UTC = 1577836800000
            assertTrue(millis > 1577836800000L)
        }

        @Test
        @DisplayName("Timestamps consecutivos devem ser crescentes ou iguais")
        fun `consecutive timestamps should be increasing or equal`() {
            val first = DateTimeUtils.currentTimeMillis()
            val second = DateTimeUtils.currentTimeMillis()
            assertTrue(second >= first)
        }
    }

    // ==================== TESTES DE today ====================

    @Nested
    @DisplayName("today")
    inner class TodayTests {

        @Test
        @DisplayName("Deve retornar data válida")
        fun `should return valid date`() {
            val today = DateTimeUtils.today()

            assertTrue(today.year >= 2024)
            assertTrue(today.monthNumber in 1..12)
            assertTrue(today.dayOfMonth in 1..31)
        }
    }

    // ==================== TESTES DE now ====================

    @Nested
    @DisplayName("now")
    inner class NowTests {

        @Test
        @DisplayName("Deve retornar Instant válido")
        fun `should return valid Instant`() {
            val now = DateTimeUtils.now()
            assertTrue(now.toEpochMilliseconds() > 0)
        }
    }

    // ==================== TESTES DE fromMillis ====================

    @Nested
    @DisplayName("fromMillis")
    inner class FromMillisTests {

        @Test
        @DisplayName("Deve converter epoch 0 corretamente")
        fun `should convert epoch 0 correctly`() {
            // Nota: resultado depende do timezone do sistema
            val dateTime = DateTimeUtils.fromMillis(0)
            assertTrue(dateTime.year in 1969..1970) // Pode variar por timezone
        }

        @Test
        @DisplayName("Deve converter timestamp conhecido")
        fun `should convert known timestamp`() {
            // 1 Jan 2024 12:00:00 UTC = 1704110400000
            val dateTime = DateTimeUtils.fromMillis(1704110400000L)
            assertEquals(2024, dateTime.year)
            assertEquals(1, dateTime.monthNumber)
        }

        @Test
        @DisplayName("Conversão de ida e volta deve ser consistente")
        fun `round trip conversion should be consistent`() {
            val originalMillis = DateTimeUtils.currentTimeMillis()
            val dateTime = DateTimeUtils.fromMillis(originalMillis)
            val backToMillis = DateTimeUtils.toMillis(dateTime)

            // Pode haver pequena diferença por arredondamento de milissegundos
            assertTrue(kotlin.math.abs(originalMillis - backToMillis) < 1000)
        }
    }

    // ==================== TESTES DE toMillis ====================

    @Nested
    @DisplayName("toMillis")
    inner class ToMillisTests {

        @Test
        @DisplayName("Deve converter LocalDateTime para millis")
        fun `should convert LocalDateTime to millis`() {
            val dateTime = LocalDateTime(2024, 1, 1, 12, 0, 0, 0)
            val millis = DateTimeUtils.toMillis(dateTime)
            assertTrue(millis > 0)
        }

        @Test
        @DisplayName("Data mais recente deve ter timestamp maior")
        fun `later date should have larger timestamp`() {
            val earlier = LocalDateTime(2024, 1, 1, 0, 0, 0, 0)
            val later = LocalDateTime(2024, 12, 31, 23, 59, 59, 0)

            assertTrue(DateTimeUtils.toMillis(later) > DateTimeUtils.toMillis(earlier))
        }
    }

    // ==================== TESTES DE formatDate ====================

    @Nested
    @DisplayName("formatDate")
    inner class FormatDateTests {

        @ParameterizedTest
        @CsvSource(
            "2024, 1, 1, 01/01/2024",
            "2024, 12, 31, 31/12/2024",
            "2024, 5, 9, 09/05/2024",
            "2024, 11, 25, 25/11/2024"
        )
        @DisplayName("Deve formatar data como dd/MM/yyyy")
        fun `should format date as dd MM yyyy`(
            year: Int,
            month: Int,
            day: Int,
            expected: String
        ) {
            val date = LocalDate(year, month, day)
            val formatted = DateTimeUtils.formatDate(date)
            assertEquals(expected, formatted)
        }

        @Test
        @DisplayName("Dia e mês devem ter zero à esquerda")
        fun `day and month should have leading zero`() {
            val date = LocalDate(2024, 1, 5)
            val formatted = DateTimeUtils.formatDate(date)
            assertEquals("05/01/2024", formatted)
        }
    }

    // ==================== TESTES DE formatTime ====================

    @Nested
    @DisplayName("formatTime")
    inner class FormatTimeTests {

        @ParameterizedTest
        @CsvSource(
            "0, 0, 00:00",
            "9, 5, 09:05",
            "12, 30, 12:30",
            "23, 59, 23:59"
        )
        @DisplayName("Deve formatar hora como HH:mm")
        fun `should format time as HH mm`(
            hour: Int,
            minute: Int,
            expected: String
        ) {
            val formatted = DateTimeUtils.formatTime(hour, minute)
            assertEquals(expected, formatted)
        }

        @Test
        @DisplayName("Hora e minuto devem ter zero à esquerda")
        fun `hour and minute should have leading zero`() {
            val formatted = DateTimeUtils.formatTime(5, 8)
            assertEquals("05:08", formatted)
        }
    }

    // ==================== TESTES DE daysBetween ====================

    @Nested
    @DisplayName("daysBetween")
    inner class DaysBetweenTests {

        @Test
        @DisplayName("Mesma data deve retornar 0")
        fun `same date should return 0`() {
            val date = LocalDate(2024, 6, 15)
            assertEquals(0, DateTimeUtils.daysBetween(date, date))
        }

        @Test
        @DisplayName("Datas consecutivas devem retornar 1")
        fun `consecutive dates should return 1`() {
            val start = LocalDate(2024, 6, 15)
            val end = LocalDate(2024, 6, 16)
            assertEquals(1, DateTimeUtils.daysBetween(start, end))
        }

        @Test
        @DisplayName("Data anterior deve retornar negativo")
        fun `earlier end date should return negative`() {
            val start = LocalDate(2024, 6, 20)
            val end = LocalDate(2024, 6, 15)
            assertEquals(-5, DateTimeUtils.daysBetween(start, end))
        }

        @Test
        @DisplayName("Um ano deve retornar 365 ou 366 dias")
        fun `one year should return 365 or 366 days`() {
            val start = LocalDate(2024, 1, 1)
            val end = LocalDate(2025, 1, 1)
            val days = DateTimeUtils.daysBetween(start, end)
            assertTrue(days in 365..366) // 2024 é bissexto
        }

        @Test
        @DisplayName("Um mês deve retornar dias corretos")
        fun `one month should return correct days`() {
            val start = LocalDate(2024, 1, 1)
            val end = LocalDate(2024, 2, 1)
            assertEquals(31, DateTimeUtils.daysBetween(start, end))
        }
    }

    // ==================== TESTES DE firstDayOfCurrentMonth ====================

    @Nested
    @DisplayName("firstDayOfCurrentMonth")
    inner class FirstDayOfCurrentMonthTests {

        @Test
        @DisplayName("Primeiro dia deve ser 1")
        fun `first day should be 1`() {
            val firstDay = DateTimeUtils.firstDayOfCurrentMonth()
            assertEquals(1, firstDay.dayOfMonth)
        }

        @Test
        @DisplayName("Deve estar no mesmo ano que hoje")
        fun `should be in same year as today`() {
            val firstDay = DateTimeUtils.firstDayOfCurrentMonth()
            val today = DateTimeUtils.today()
            assertEquals(today.year, firstDay.year)
        }

        @Test
        @DisplayName("Deve estar no mesmo mês que hoje")
        fun `should be in same month as today`() {
            val firstDay = DateTimeUtils.firstDayOfCurrentMonth()
            val today = DateTimeUtils.today()
            assertEquals(today.month, firstDay.month)
        }
    }

    // ==================== TESTES DE generateSeasonId ====================

    @Nested
    @DisplayName("generateSeasonId")
    inner class GenerateSeasonIdTests {

        @ParameterizedTest
        @CsvSource(
            "2024, 1, monthly_2024_01",
            "2024, 12, monthly_2024_12",
            "2025, 6, monthly_2025_06",
            "2030, 11, monthly_2030_11"
        )
        @DisplayName("Deve gerar ID no formato monthly_YYYY_MM")
        fun `should generate ID in format monthly_YYYY_MM`(
            year: Int,
            month: Int,
            expected: String
        ) {
            val seasonId = DateTimeUtils.generateSeasonId(year, month)
            assertEquals(expected, seasonId)
        }

        @Test
        @DisplayName("Mês deve ter zero à esquerda")
        fun `month should have leading zero`() {
            val seasonId = DateTimeUtils.generateSeasonId(2024, 5)
            assertEquals("monthly_2024_05", seasonId)
        }
    }

    // ==================== TESTES DE currentSeasonId ====================

    @Nested
    @DisplayName("currentSeasonId")
    inner class CurrentSeasonIdTests {

        @Test
        @DisplayName("Deve começar com monthly_")
        fun `should start with monthly_`() {
            val seasonId = DateTimeUtils.currentSeasonId()
            assertTrue(seasonId.startsWith("monthly_"))
        }

        @Test
        @DisplayName("Deve conter ano atual")
        fun `should contain current year`() {
            val seasonId = DateTimeUtils.currentSeasonId()
            val today = DateTimeUtils.today()
            assertTrue(seasonId.contains(today.year.toString()))
        }

        @Test
        @DisplayName("Formato deve ser monthly_YYYY_MM")
        fun `format should be monthly_YYYY_MM`() {
            val seasonId = DateTimeUtils.currentSeasonId()
            val regex = Regex("monthly_\\d{4}_\\d{2}")
            assertTrue(seasonId.matches(regex))
        }

        @Test
        @DisplayName("Deve ser consistente com generateSeasonId para data atual")
        fun `should be consistent with generateSeasonId for current date`() {
            val today = DateTimeUtils.today()
            val expected = DateTimeUtils.generateSeasonId(today.year, today.monthNumber)
            val actual = DateTimeUtils.currentSeasonId()
            assertEquals(expected, actual)
        }
    }
}
