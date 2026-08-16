package com.futebadosparcas.util

import androidx.compose.ui.graphics.Color
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/**
 * Testes para [ContrastHelper.getContrastingTextColor] (#4059).
 *
 * O helper deve escolher entre #1A1A1A e #FFFFFF comparando o contraste dos dois
 * candidatos — não por um limiar fixo de luminância (o empate real é L = 0,2017,
 * não 0,5). Os 6 fundos abaixo caem na banda (0,2017 ; 0,5] onde o antigo limiar
 * devolvia a PIOR das duas opções.
 */
class ContrastHelperTest {

    private val dark = Color(0xFF1A1A1A)
    private val light = Color(0xFFFFFFFF)

    private val affectedBackgrounds = listOf(
        "Bronze #CD7F32" to Color(0xFFCD7F32),
        "TeamColor.BLUE #2196F3" to Color(0xFF2196F3),
        "TeamColor.RED #F44336" to Color(0xFFF44336),
        "TeamColor.GREEN #4CAF50" to Color(0xFF4CAF50),
        "TeamColor.CYAN #00BCD4" to Color(0xFF00BCD4),
        "TeamColor.ORANGE #FF9800" to Color(0xFFFF9800),
    )

    @Test
    fun `devolve texto escuro com contraste AA nos 6 fundos da banda`() {
        for ((label, bg) in affectedBackgrounds) {
            val chosen = ContrastHelper.getContrastingTextColor(bg)
            assertEquals(dark, chosen, "$label deve usar texto escuro (#1A1A1A)")
            val ratio = ContrastHelper.getContrastRatio(chosen, bg)
            assertTrue(
                ratio >= 4.5f,
                "$label deve ter contraste >= 4.5:1, obtido $ratio"
            )
        }
    }

    @Test
    fun `empate real em luminancia 0_2017 devolve o melhor candidato`() {
        // #7C7C7C tem luminância ~0.2015 (< empate 0.2017) -> branco é melhor.
        val belowTie = Color(0xFF7C7C7C)
        assertEquals(
            light,
            ContrastHelper.getContrastingTextColor(belowTie),
            "#7C7C7C (luminância < 0.2017) deve devolver branco"
        )

        // #7D7D7D tem luminância ~0.2051 (> empate 0.2017) -> escuro é melhor.
        val aboveTie = Color(0xFF7D7D7D)
        assertEquals(
            dark,
            ContrastHelper.getContrastingTextColor(aboveTie),
            "#7D7D7D (luminância > 0.2017) deve devolver escuro"
        )
    }
}
