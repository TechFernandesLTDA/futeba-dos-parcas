package com.futebadosparcas.util

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource

@DisplayName("FormattingHelper Tests")
@ExtendWith(MockLogExtension::class)
class FormattingHelperTest {

    private lateinit var formattingHelper: FormattingHelper

    @BeforeEach
    fun setup() {
        formattingHelper = FormattingHelper()
    }

    @Nested
    @DisplayName("formatCurrency")
    inner class FormatCurrencyTests {

        @Test
        @DisplayName("Formata valor em Real brasileiro")
        fun `formats value in Brazilian Real`() {
            val result = formattingHelper.formatCurrency(1500.50)
            assertEquals("R$ 1.500,50", result)
        }

        @Test
        @DisplayName("Formata valor zero")
        fun `formats zero`() {
            val result = formattingHelper.formatCurrency(0.0)
            assertEquals("R$ 0,00", result)
        }
    }

    @Nested
    @DisplayName("formatPercentage")
    inner class FormatPercentageTests {

        @ParameterizedTest
        @CsvSource("0.0, 0%", "0.5, 50%", "1.0, 100%", "0.25, 25%", "0.75, 75%")
        @DisplayName("Formata porcentagem corretamente")
        fun `formats percentage correctly`(value: Double, expected: String) {
            assertEquals(expected, formattingHelper.formatPercentage(value))
        }
    }

    @Nested
    @DisplayName("formatLargeNumber")
    inner class FormatLargeNumberTests {

        @ParameterizedTest
        @CsvSource("500, 500", "1500, '1,50K'", "1000000, '1,00M'", "1500000000, '1,50B'")
        @DisplayName("Formata numeros grandes com sufixo")
        fun `formats large numbers with suffix`(value: Long, expected: String) {
            assertEquals(expected, formattingHelper.formatLargeNumber(value))
        }
    }

    @Nested
    @DisplayName("formatPhone")
    inner class FormatPhoneTests {

        @Test
        @DisplayName("Formata telefone celular 11 digitos")
        fun `formats mobile phone 11 digits`() {
            val result = formattingHelper.formatPhone("11987654321")
            assertEquals("(11) 98765-4321", result)
        }

        @Test
        @DisplayName("Formata telefone fixo 10 digitos")
        fun `formats landline phone 10 digits`() {
            val result = formattingHelper.formatPhone("1132345678")
            assertEquals("(11) 3234-5678", result)
        }

        @Test
        @DisplayName("Retorna original se formato invalido")
        fun `returns original if invalid format`() {
            val result = formattingHelper.formatPhone("12345")
            assertEquals("12345", result)
        }
    }

    @Nested
    @DisplayName("formatPlayerCount e formatGoals")
    inner class PluralizationTests {

        @Test
        @DisplayName("formatPlayerCount singular")
        fun `player count singular`() {
            assertEquals("1 jogador", formattingHelper.formatPlayerCount(1))
        }

        @Test
        @DisplayName("formatPlayerCount plural")
        fun `player count plural`() {
            assertEquals("5 jogadores", formattingHelper.formatPlayerCount(5))
        }

        @Test
        @DisplayName("formatGoals singular")
        fun `goals singular`() {
            assertEquals("1 gol", formattingHelper.formatGoals(1))
        }

        @Test
        @DisplayName("formatGoals plural")
        fun `goals plural`() {
            assertEquals("3 gols", formattingHelper.formatGoals(3))
        }
    }

    @Nested
    @DisplayName("formatDuration e formatGameDuration")
    inner class DurationTests {

        @Test
        @DisplayName("Formata duracao em minutos e segundos")
        fun `formats duration in minutes and seconds`() {
            assertEquals("05:30", formattingHelper.formatDuration(330_000))
        }

        @Test
        @DisplayName("Formata duracao com horas")
        fun `formats duration with hours`() {
            assertEquals("01:30:00", formattingHelper.formatDuration(5_400_000))
        }

        @Test
        @DisplayName("Formata duracao de jogo")
        fun `formats game duration`() {
            assertEquals("1h 30min", formattingHelper.formatGameDuration(90))
        }
    }

    @Nested
    @DisplayName("formatScore e formatOrdinal")
    inner class ScoreAndOrdinalTests {

        @Test
        @DisplayName("Formata placar")
        fun `formats score`() {
            assertEquals("3 x 1", formattingHelper.formatScore(3, 1))
        }

        @Test
        @DisplayName("Formata numero ordinal")
        fun `formats ordinal number`() {
            assertEquals("3º", formattingHelper.formatOrdinal(3))
        }
    }

    @Nested
    @DisplayName("formatNameList e truncate")
    inner class StringFormattingTests {

        @Test
        @DisplayName("Formata lista vazia")
        fun `formats empty list`() {
            assertEquals("", formattingHelper.formatNameList(emptyList()))
        }

        @Test
        @DisplayName("Formata lista com um nome")
        fun `formats single name list`() {
            assertEquals("Joao", formattingHelper.formatNameList(listOf("Joao")))
        }

        @Test
        @DisplayName("Formata lista com tres nomes")
        fun `formats three name list`() {
            assertEquals("Joao, Maria e Pedro", formattingHelper.formatNameList(listOf("Joao", "Maria", "Pedro")))
        }

        @Test
        @DisplayName("Trunca texto com ellipsis")
        fun `truncates text with ellipsis`() {
            assertEquals("He...", formattingHelper.truncate("Hello World", 5))
        }

        @Test
        @DisplayName("Nao trunca texto curto")
        fun `does not truncate short text`() {
            assertEquals("Hi", formattingHelper.truncate("Hi", 10))
        }
    }
}
