package com.futebadosparcas.domain.model

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test

/**
 * Testes unitários para GameResult.
 * Cobre enum de resultados de partida.
 */
@DisplayName("GameResult Tests")
class GameResultTest {

    // ==================== TESTES DE ENUM ====================

    @Nested
    @DisplayName("Enum Values")
    inner class EnumValuesTests {

        @Test
        @DisplayName("Deve ter exatamente 3 valores")
        fun `should have exactly 3 values`() {
            assertEquals(3, GameResult.entries.size)
        }

        @Test
        @DisplayName("Deve conter WIN, DRAW e LOSS")
        fun `should contain WIN DRAW and LOSS`() {
            val values = GameResult.entries.map { it.name }

            assertTrue(values.contains("WIN"))
            assertTrue(values.contains("DRAW"))
            assertTrue(values.contains("LOSS"))
        }

        @Test
        @DisplayName("Ordem dos valores deve ser WIN, DRAW, LOSS")
        fun `order should be WIN DRAW LOSS`() {
            val values = GameResult.entries

            assertEquals(GameResult.WIN, values[0])
            assertEquals(GameResult.DRAW, values[1])
            assertEquals(GameResult.LOSS, values[2])
        }

        @Test
        @DisplayName("valueOf deve funcionar corretamente")
        fun `valueOf should work correctly`() {
            assertEquals(GameResult.WIN, GameResult.valueOf("WIN"))
            assertEquals(GameResult.DRAW, GameResult.valueOf("DRAW"))
            assertEquals(GameResult.LOSS, GameResult.valueOf("LOSS"))
        }

        @Test
        @DisplayName("ordinal deve ser correto")
        fun `ordinal should be correct`() {
            assertEquals(0, GameResult.WIN.ordinal)
            assertEquals(1, GameResult.DRAW.ordinal)
            assertEquals(2, GameResult.LOSS.ordinal)
        }
    }

    // ==================== TESTES DE COMPARAÇÃO ====================

    @Nested
    @DisplayName("Comparison")
    inner class ComparisonTests {

        @Test
        @DisplayName("WIN deve ser igual a WIN")
        fun `WIN should equal WIN`() {
            assertEquals(GameResult.WIN, GameResult.WIN)
        }

        @Test
        @DisplayName("WIN não deve ser igual a DRAW")
        fun `WIN should not equal DRAW`() {
            assertNotEquals(GameResult.WIN, GameResult.DRAW)
        }

        @Test
        @DisplayName("Mesma instância deve ser idêntica")
        fun `same instance should be identical`() {
            val result1 = GameResult.WIN
            val result2 = GameResult.WIN
            assertSame(result1, result2)
        }
    }

    // ==================== TESTES DE SERIALIZAÇÃO ====================

    @Nested
    @DisplayName("Serialization")
    inner class SerializationTests {

        @Test
        @DisplayName("name deve retornar string correta")
        fun `name should return correct string`() {
            assertEquals("WIN", GameResult.WIN.name)
            assertEquals("DRAW", GameResult.DRAW.name)
            assertEquals("LOSS", GameResult.LOSS.name)
        }

        @Test
        @DisplayName("toString deve retornar name")
        fun `toString should return name`() {
            assertEquals("WIN", GameResult.WIN.toString())
            assertEquals("DRAW", GameResult.DRAW.toString())
            assertEquals("LOSS", GameResult.LOSS.toString())
        }
    }
}
