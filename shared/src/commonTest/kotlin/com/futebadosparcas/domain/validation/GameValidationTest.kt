package com.futebadosparcas.domain.validation

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Testes da fonte-unica de validacao de criacao de jogo (spec #2400).
 * Cobre boundaries de goleiros (0..4) e times (2..4). Executam em Android (JVM) e iOS (Native).
 */
class GameValidationTest {

    @Test
    fun `goleiros validos no range 0 a 4`() {
        assertTrue(GameValidation.isGoalkeepersValid(0))
        assertTrue(GameValidation.isGoalkeepersValid(3))
        assertTrue(GameValidation.isGoalkeepersValid(4))
    }

    @Test
    fun `goleiros invalidos fora do range`() {
        assertFalse(GameValidation.isGoalkeepersValid(-1))
        assertFalse(GameValidation.isGoalkeepersValid(5))
    }

    @Test
    fun `times validos no range 2 a 4`() {
        assertTrue(GameValidation.isNumberOfTeamsValid(2))
        assertTrue(GameValidation.isNumberOfTeamsValid(4))
    }

    @Test
    fun `times invalidos fora do range`() {
        assertFalse(GameValidation.isNumberOfTeamsValid(1))
        assertFalse(GameValidation.isNumberOfTeamsValid(5))
    }

    @Test
    fun `coerce goleiros faz clamp nos limites`() {
        assertEquals(0, GameValidation.coerceGoalkeepers(-3))
        assertEquals(4, GameValidation.coerceGoalkeepers(99))
        assertEquals(2, GameValidation.coerceGoalkeepers(2))
    }

    @Test
    fun `coerce times faz clamp nos limites`() {
        assertEquals(2, GameValidation.coerceNumberOfTeams(0))
        assertEquals(4, GameValidation.coerceNumberOfTeams(10))
        assertEquals(3, GameValidation.coerceNumberOfTeams(3))
    }

    @Test
    fun `defaults conferem com produto`() {
        assertEquals(3, GameValidation.DEFAULT_MAX_GOALKEEPERS)
        assertEquals(2, GameValidation.DEFAULT_NUMBER_OF_TEAMS)
    }
}
