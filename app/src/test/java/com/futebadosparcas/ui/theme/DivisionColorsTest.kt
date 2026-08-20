package com.futebadosparcas.ui.theme

import androidx.compose.ui.graphics.Color
import com.futebadosparcas.domain.model.LeagueDivision
import com.futebadosparcas.util.ContrastHelper
import java.util.stream.Stream
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource

class DivisionColorsTest {
    @ParameterizedTest(name = "{0} no tema {1}")
    @MethodSource("divisionsAndThemes")
    fun `foreground da divisao passa AA sobre veu composto`(
        division: LeagueDivision,
        isDarkTheme: Boolean,
        surface: Color
    ) {
        val background = composite(divisionColor(division), surface, 0.18f)
        val ratio = ContrastHelper.getContrastRatio(divisionTextColor(division, isDarkTheme), background)

        assertTrue(ratio >= 4.5f, "$division/$isDarkTheme deve ter contraste >= 4.5:1, obtido $ratio")
    }

    @ParameterizedTest(name = "{0} preserva o token de identidade")
    @MethodSource("divisionIdentityTokens")
    fun `tokens de identidade sao uma tabela unica para as quatro divisoes`(
        division: LeagueDivision,
        expectedColor: Color
    ) {
        assertEquals(expectedColor, divisionColor(division))
    }

    private fun composite(foreground: Color, background: Color, alpha: Float): Color = Color(
        foreground.red * alpha + background.red * (1f - alpha),
        foreground.green * alpha + background.green * (1f - alpha),
        foreground.blue * alpha + background.blue * (1f - alpha),
        1f
    )

    companion object {
        @JvmStatic
        fun divisionsAndThemes(): Stream<Arguments> {
            val lightSurface = Color(0xFFFAFAFA)
            val darkSurface = Color(0xFF121212)
            return Stream.of(
                Arguments.of(LeagueDivision.BRONZE, false, lightSurface),
                Arguments.of(LeagueDivision.PRATA, false, lightSurface),
                Arguments.of(LeagueDivision.OURO, false, lightSurface),
                Arguments.of(LeagueDivision.DIAMANTE, false, lightSurface),
                Arguments.of(LeagueDivision.BRONZE, true, darkSurface),
                Arguments.of(LeagueDivision.PRATA, true, darkSurface),
                Arguments.of(LeagueDivision.OURO, true, darkSurface),
                Arguments.of(LeagueDivision.DIAMANTE, true, darkSurface),
            )
        }

        @JvmStatic
        fun divisionIdentityTokens(): Stream<Arguments> = Stream.of(
            Arguments.of(LeagueDivision.BRONZE, GamificationColors.Bronze),
            Arguments.of(LeagueDivision.PRATA, GamificationColors.Silver),
            Arguments.of(LeagueDivision.OURO, GamificationColors.Gold),
            Arguments.of(LeagueDivision.DIAMANTE, GamificationColors.Diamond),
        )
    }
}
