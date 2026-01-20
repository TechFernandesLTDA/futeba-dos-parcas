package com.futebadosparcas.domain.model

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource

/**
 * Testes unitários para PlayerPosition.
 * Cobre conversões de string e propriedades.
 */
@DisplayName("PlayerPosition Tests")
class PlayerPositionTest {

    // ==================== TESTES DE fromString ====================

    @Nested
    @DisplayName("fromString")
    inner class FromStringTests {

        @ParameterizedTest
        @ValueSource(strings = ["GOALKEEPER", "goalkeeper", "Goalkeeper", "GOLEIRO", "goleiro", "GK", "gk"])
        @DisplayName("Strings de goleiro devem retornar GOALKEEPER")
        fun `goalkeeper strings should return GOALKEEPER`(input: String) {
            assertEquals(PlayerPosition.GOALKEEPER, PlayerPosition.fromString(input))
        }

        @ParameterizedTest
        @ValueSource(strings = ["LINE", "line", "LINHA", "linha", "PLAYER", "player", "ATACANTE", "MEIO", "DEFENSOR"])
        @DisplayName("Outras strings devem retornar LINE")
        fun `other strings should return LINE`(input: String) {
            assertEquals(PlayerPosition.LINE, PlayerPosition.fromString(input))
        }

        @Test
        @DisplayName("Null deve retornar LINE")
        fun `null should return LINE`() {
            assertEquals(PlayerPosition.LINE, PlayerPosition.fromString(null))
        }

        @Test
        @DisplayName("String vazia deve retornar LINE")
        fun `empty string should return LINE`() {
            assertEquals(PlayerPosition.LINE, PlayerPosition.fromString(""))
        }

        @Test
        @DisplayName("String inválida deve retornar LINE")
        fun `invalid string should return LINE`() {
            assertEquals(PlayerPosition.LINE, PlayerPosition.fromString("INVALID"))
            assertEquals(PlayerPosition.LINE, PlayerPosition.fromString("12345"))
        }
    }

    // ==================== TESTES DE displayName ====================

    @Nested
    @DisplayName("displayName")
    inner class DisplayNameTests {

        @Test
        @DisplayName("LINE deve ter displayName 'Linha'")
        fun `LINE should have displayName Linha`() {
            assertEquals("Linha", PlayerPosition.LINE.displayName)
        }

        @Test
        @DisplayName("GOALKEEPER deve ter displayName 'Goleiro'")
        fun `GOALKEEPER should have displayName Goleiro`() {
            assertEquals("Goleiro", PlayerPosition.GOALKEEPER.displayName)
        }

        @Test
        @DisplayName("Todos os valores devem ter displayName não vazio")
        fun `all values should have non-empty displayName`() {
            PlayerPosition.entries.forEach { position ->
                assertTrue(position.displayName.isNotEmpty())
            }
        }
    }

    // ==================== TESTES DE ENUM ====================

    @Nested
    @DisplayName("Enum Properties")
    inner class EnumPropertiesTests {

        @Test
        @DisplayName("Deve ter exatamente 2 valores")
        fun `should have exactly 2 values`() {
            assertEquals(2, PlayerPosition.entries.size)
        }

        @Test
        @DisplayName("Valores devem ser LINE e GOALKEEPER")
        fun `values should be LINE and GOALKEEPER`() {
            val values = PlayerPosition.entries.map { it.name }
            assertTrue(values.contains("LINE"))
            assertTrue(values.contains("GOALKEEPER"))
        }

        @Test
        @DisplayName("valueOf deve funcionar para nomes válidos")
        fun `valueOf should work for valid names`() {
            assertEquals(PlayerPosition.LINE, PlayerPosition.valueOf("LINE"))
            assertEquals(PlayerPosition.GOALKEEPER, PlayerPosition.valueOf("GOALKEEPER"))
        }
    }
}
