package com.futebadosparcas.domain.model

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource
import org.junit.jupiter.params.provider.ValueSource

/**
 * Testes unitários para LeagueDivision.
 * Cobre divisões, thresholds e conversões.
 */
@DisplayName("LeagueDivision Tests")
class LeagueDivisionTest {

    // ==================== TESTES DE fromRating ====================

    @Nested
    @DisplayName("fromRating")
    inner class FromRatingTests {

        @ParameterizedTest
        @CsvSource(
            "0.0, BRONZE",
            "29.99, BRONZE",
            "30.0, PRATA",
            "49.99, PRATA",
            "50.0, OURO",
            "69.99, OURO",
            "70.0, DIAMANTE",
            "100.0, DIAMANTE"
        )
        @DisplayName("Rating deve retornar divisão correta")
        fun `rating should return correct division`(rating: Double, expectedDivision: LeagueDivision) {
            val division = LeagueDivision.fromRating(rating)
            assertEquals(expectedDivision, division)
        }

        @Test
        @DisplayName("Rating negativo deve retornar Bronze")
        fun `negative rating should return Bronze`() {
            assertEquals(LeagueDivision.BRONZE, LeagueDivision.fromRating(-50.0))
        }

        @Test
        @DisplayName("Rating muito alto deve retornar Diamante")
        fun `very high rating should return Diamante`() {
            assertEquals(LeagueDivision.DIAMANTE, LeagueDivision.fromRating(150.0))
        }
    }

    // ==================== TESTES DE fromString ====================

    @Nested
    @DisplayName("fromString")
    inner class FromStringTests {

        @ParameterizedTest
        @ValueSource(strings = ["BRONZE", "bronze", "Bronze"])
        @DisplayName("Bronze string variations should return BRONZE")
        fun `bronze string variations should return BRONZE`(input: String) {
            assertEquals(LeagueDivision.BRONZE, LeagueDivision.fromString(input))
        }

        @ParameterizedTest
        @ValueSource(strings = ["PRATA", "prata", "SILVER", "silver"])
        @DisplayName("Prata/Silver string variations should return PRATA")
        fun `prata silver string variations should return PRATA`(input: String) {
            assertEquals(LeagueDivision.PRATA, LeagueDivision.fromString(input))
        }

        @ParameterizedTest
        @ValueSource(strings = ["OURO", "ouro", "GOLD", "gold"])
        @DisplayName("Ouro/Gold string variations should return OURO")
        fun `ouro gold string variations should return OURO`(input: String) {
            assertEquals(LeagueDivision.OURO, LeagueDivision.fromString(input))
        }

        @ParameterizedTest
        @ValueSource(strings = ["DIAMANTE", "diamante", "DIAMOND", "diamond"])
        @DisplayName("Diamante/Diamond string variations should return DIAMANTE")
        fun `diamante diamond string variations should return DIAMANTE`(input: String) {
            assertEquals(LeagueDivision.DIAMANTE, LeagueDivision.fromString(input))
        }

        @Test
        @DisplayName("Null deve retornar Bronze")
        fun `null should return Bronze`() {
            assertEquals(LeagueDivision.BRONZE, LeagueDivision.fromString(null))
        }

        @Test
        @DisplayName("String inválida deve retornar Bronze")
        fun `invalid string should return Bronze`() {
            assertEquals(LeagueDivision.BRONZE, LeagueDivision.fromString("INVALID"))
            assertEquals(LeagueDivision.BRONZE, LeagueDivision.fromString(""))
        }
    }

    // ==================== TESTES DE getNextDivision ====================

    @Nested
    @DisplayName("getNextDivision")
    inner class GetNextDivisionTests {

        @Test
        @DisplayName("Bronze -> Prata")
        fun `bronze should promote to prata`() {
            assertEquals(LeagueDivision.PRATA, LeagueDivision.getNextDivision(LeagueDivision.BRONZE))
        }

        @Test
        @DisplayName("Prata -> Ouro")
        fun `prata should promote to ouro`() {
            assertEquals(LeagueDivision.OURO, LeagueDivision.getNextDivision(LeagueDivision.PRATA))
        }

        @Test
        @DisplayName("Ouro -> Diamante")
        fun `ouro should promote to diamante`() {
            assertEquals(LeagueDivision.DIAMANTE, LeagueDivision.getNextDivision(LeagueDivision.OURO))
        }

        @Test
        @DisplayName("Diamante -> Diamante (já é o máximo)")
        fun `diamante should stay diamante`() {
            assertEquals(LeagueDivision.DIAMANTE, LeagueDivision.getNextDivision(LeagueDivision.DIAMANTE))
        }
    }

    // ==================== TESTES DE getPreviousDivision ====================

    @Nested
    @DisplayName("getPreviousDivision")
    inner class GetPreviousDivisionTests {

        @Test
        @DisplayName("Bronze -> Bronze (já é o mínimo)")
        fun `bronze should stay bronze`() {
            assertEquals(LeagueDivision.BRONZE, LeagueDivision.getPreviousDivision(LeagueDivision.BRONZE))
        }

        @Test
        @DisplayName("Prata -> Bronze")
        fun `prata should demote to bronze`() {
            assertEquals(LeagueDivision.BRONZE, LeagueDivision.getPreviousDivision(LeagueDivision.PRATA))
        }

        @Test
        @DisplayName("Ouro -> Prata")
        fun `ouro should demote to prata`() {
            assertEquals(LeagueDivision.PRATA, LeagueDivision.getPreviousDivision(LeagueDivision.OURO))
        }

        @Test
        @DisplayName("Diamante -> Ouro")
        fun `diamante should demote to ouro`() {
            assertEquals(LeagueDivision.OURO, LeagueDivision.getPreviousDivision(LeagueDivision.DIAMANTE))
        }
    }

    // ==================== TESTES DE getNextDivisionThreshold ====================

    @Nested
    @DisplayName("getNextDivisionThreshold")
    inner class GetNextDivisionThresholdTests {

        @Test
        @DisplayName("Bronze threshold para subir é 30")
        fun `bronze threshold to promote is 30`() {
            assertEquals(30.0, LeagueDivision.getNextDivisionThreshold(LeagueDivision.BRONZE), 0.001)
        }

        @Test
        @DisplayName("Prata threshold para subir é 50")
        fun `prata threshold to promote is 50`() {
            assertEquals(50.0, LeagueDivision.getNextDivisionThreshold(LeagueDivision.PRATA), 0.001)
        }

        @Test
        @DisplayName("Ouro threshold para subir é 70")
        fun `ouro threshold to promote is 70`() {
            assertEquals(70.0, LeagueDivision.getNextDivisionThreshold(LeagueDivision.OURO), 0.001)
        }

        @Test
        @DisplayName("Diamante threshold é 100 (máximo)")
        fun `diamante threshold is 100`() {
            assertEquals(100.0, LeagueDivision.getNextDivisionThreshold(LeagueDivision.DIAMANTE), 0.001)
        }
    }

    // ==================== TESTES DE getPreviousDivisionThreshold ====================

    @Nested
    @DisplayName("getPreviousDivisionThreshold")
    inner class GetPreviousDivisionThresholdTests {

        @Test
        @DisplayName("Bronze threshold para cair é 0")
        fun `bronze threshold to demote is 0`() {
            assertEquals(0.0, LeagueDivision.getPreviousDivisionThreshold(LeagueDivision.BRONZE), 0.001)
        }

        @Test
        @DisplayName("Prata threshold para cair é 0")
        fun `prata threshold to demote is 0`() {
            assertEquals(0.0, LeagueDivision.getPreviousDivisionThreshold(LeagueDivision.PRATA), 0.001)
        }

        @Test
        @DisplayName("Ouro threshold para cair é 30")
        fun `ouro threshold to demote is 30`() {
            assertEquals(30.0, LeagueDivision.getPreviousDivisionThreshold(LeagueDivision.OURO), 0.001)
        }

        @Test
        @DisplayName("Diamante threshold para cair é 50")
        fun `diamante threshold to demote is 50`() {
            assertEquals(50.0, LeagueDivision.getPreviousDivisionThreshold(LeagueDivision.DIAMANTE), 0.001)
        }
    }

    // ==================== TESTES DE PROPRIEDADES ====================

    @Nested
    @DisplayName("Division Properties")
    inner class DivisionPropertiesTests {

        @Test
        @DisplayName("Bronze deve ter displayName correto")
        fun `bronze should have correct displayName`() {
            assertEquals("Bronze", LeagueDivision.BRONZE.displayName)
        }

        @Test
        @DisplayName("Todas as divisões devem ter emoji")
        fun `all divisions should have emoji`() {
            LeagueDivision.entries.forEach { division ->
                assertTrue(division.emoji.isNotEmpty())
            }
        }

        @Test
        @DisplayName("Todas as divisões devem ter colorHex válido")
        fun `all divisions should have valid colorHex`() {
            LeagueDivision.entries.forEach { division ->
                assertTrue(division.colorHex.startsWith("#"))
                assertEquals(7, division.colorHex.length)
            }
        }

        @Test
        @DisplayName("MinRating deve ser menor que MaxRating")
        fun `minRating should be less than maxRating`() {
            LeagueDivision.entries.forEach { division ->
                assertTrue(division.minRating < division.maxRating)
            }
        }

        @Test
        @DisplayName("Ranges de divisão não devem ter gaps")
        fun `division ranges should not have gaps`() {
            // Bronze: 0-29.99, Prata: 30-49.99, Ouro: 50-69.99, Diamante: 70-100
            assertEquals(0.0, LeagueDivision.BRONZE.minRating, 0.001)
            assertEquals(30.0, LeagueDivision.PRATA.minRating, 0.001)
            assertEquals(50.0, LeagueDivision.OURO.minRating, 0.001)
            assertEquals(70.0, LeagueDivision.DIAMANTE.minRating, 0.001)
        }
    }
}
