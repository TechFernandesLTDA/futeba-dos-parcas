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
        surfaceArgb: Long
    ) {
        val surface = Color(surfaceArgb)
        val background = composite(divisionColor(division), surface, 0.18f)
        val ratio = ContrastHelper.getContrastRatio(divisionTextColor(division, isDarkTheme), background)

        assertTrue(ratio >= 4.5f, "$division/$isDarkTheme deve ter contraste >= 4.5:1, obtido $ratio")
    }

    @ParameterizedTest(name = "{0} preserva o token de identidade")
    @MethodSource("divisionIdentityTokens")
    fun `tokens de identidade sao uma tabela unica para as quatro divisoes`(
        division: LeagueDivision,
        expectedColorArgb: Long
    ) {
        assertEquals(Color(expectedColorArgb), divisionColor(division))
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
            return Stream.of(
                Arguments.of(LeagueDivision.BRONZE, false, 0xFFFAFAFAL),
                Arguments.of(LeagueDivision.PRATA, false, 0xFFFAFAFAL),
                Arguments.of(LeagueDivision.OURO, false, 0xFFFAFAFAL),
                Arguments.of(LeagueDivision.DIAMANTE, false, 0xFFFAFAFAL),
                Arguments.of(LeagueDivision.BRONZE, true, 0xFF121212L),
                Arguments.of(LeagueDivision.PRATA, true, 0xFF121212L),
                Arguments.of(LeagueDivision.OURO, true, 0xFF121212L),
                Arguments.of(LeagueDivision.DIAMANTE, true, 0xFF121212L),
            )
        }

        @JvmStatic
        fun divisionIdentityTokens(): Stream<Arguments> = Stream.of(
            Arguments.of(LeagueDivision.BRONZE, 0xFFCD7F32L),
            Arguments.of(LeagueDivision.PRATA, 0xFFE0E0E0L),
            Arguments.of(LeagueDivision.OURO, 0xFFFFD700L),
            Arguments.of(LeagueDivision.DIAMANTE, 0xFFB9F2FFL),
        )
    }
}
