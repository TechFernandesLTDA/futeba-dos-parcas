package com.futebadosparcas.ui.theme

import androidx.compose.ui.graphics.Color
import kotlin.math.pow
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

/**
 * Testes para a variante de foreground theme-aware da paleta de gamificação (#4060).
 *
 * Os tokens Gold/Silver/Bronze/Diamond são fixos e claros demais para uso como TEXTO
 * sobre a surface clara (tone 99). [GamificationTextColors] (dark tones, light theme)
 * e [GamificationTextColorsDark] (light tones, dark theme) devem passar WCAG AA (>= 4.5:1)
 * contra a surface do tema respectivo, enquanto os hex originais de [GamificationColors]
 * seguem como fundo de medalha.
 */
class GamificationTextColorsTest {

    // surface light = neutralPalette.toneColor(99); dark = toneColor(6).
    // Em M3, tone == L*, e Y = ((L* + 16) / 116)^3.
    private val lightSurface = greyWithLuminance(Math.pow((99.0 + 16.0) / 116.0, 3.0).toFloat())
    private val darkSurface = greyWithLuminance(Math.pow((6.0 + 16.0) / 116.0, 3.0).toFloat())

    private data class Division(val name: String, val lightText: Color, val darkText: Color)

    private val divisions = listOf(
        Division("Diamond", GamificationTextColors.Diamond, GamificationTextColorsDark.Diamond),
        Division("Gold", GamificationTextColors.Gold, GamificationTextColorsDark.Gold),
        Division("Silver", GamificationTextColors.Silver, GamificationTextColorsDark.Silver),
        Division("Bronze", GamificationTextColors.Bronze, GamificationTextColorsDark.Bronze),
    )

    @Test
    fun `nomes das divisoes passam AA nos dois temas`() {
        for (division in divisions) {
            val lightRatio = calculateContrastRatio(division.lightText, lightSurface)
            assertTrue(
                lightRatio >= 4.5f,
                "${division.name} no tema light deve ser >= 4.5:1, obtido $lightRatio"
            )

            val darkRatio = calculateContrastRatio(division.darkText, darkSurface)
            assertTrue(
                darkRatio >= 4.5f,
                "${division.name} no tema dark deve ser >= 4.5:1, obtido $darkRatio"
            )
        }
    }

    @Test
    fun `tokens de medalha preservam os hex de fundo originais`() {
        assertEquals(Color(0xFFFFD700), GamificationColors.Gold)
        assertEquals(Color(0xFFE0E0E0), GamificationColors.Silver)
        assertEquals(Color(0xFFCD7F32), GamificationColors.Bronze)
        assertEquals(Color(0xFFB9F2FF), GamificationColors.Diamond)
    }

    private fun greyWithLuminance(y: Float): Color {
        val c = if (y <= 0.03928f) {
            y / 12.92f
        } else {
            1.055f * y.pow(1f / 2.4f) - 0.055f
        }
        return Color(c, c, c)
    }
}
