package com.futebadosparcas.ui.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.ui.graphics.Color
import com.futebadosparcas.domain.model.AppThemeConfig
import com.futebadosparcas.domain.model.ContrastLevel
import com.futebadosparcas.domain.model.LeagueDivision
import com.futebadosparcas.util.ContrastHelper
import java.util.stream.Stream
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource

/**
 * Valida o contraste do foreground de divisao ([divisionTextColor]) sobre os
 * fundos REAIS dos call sites, derivados do [ColorScheme] gerado pelo
 * [DynamicThemeEngine] (nao literais hardcoded como #FAFAFA/#121212, que eram o
 * scheme de alto contraste e nao o default — #4084).
 *
 * Call sites cobertos (base + veu), conforme #4084:
 * - badge da Liga (LeagueScreen) — surfaceVariant @ 0.18
 * - chip de pontos do ranking (RankingList) — surface @ 0.2 sobre o card @ 0.1
 * - header de divisao (RankingList) — background @ 0.1
 * - legenda (LeagueScreen) — primaryContainer @ 0.3 sobre surface
 *
 * Escopo dos schemes (contraste) — #4099:
 * - Os 4 call sites sao validados nos 2 temas E nos 2 schemes (NORMAL + HIGH).
 *   Antes (#4093) so o badge cobria HIGH; a legenda em HIGH light
 *   (primaryContainer #1565C0 -> veu #B9D1EC) reprovava AA para PRATA/OURO/
 *   DIAMANTE (3,83-4,44). [divisionTextColor] agora recebe o [ContrastLevel]
 *   (em runtime via `LocalContrastLevel`) e resolve tokens proprios para HIGH.
 * - Em HIGH exige-se tambem AAA (>= 7:1), que e a promessa do HighContrastTheme.
 * - Os valores do scheme NORMAL sao travados por teste de regressao (#4093).
 */
class DivisionColorsTest {

    /** Call sites reais de [divisionTextColor], mapeados a (base, veu). */
    enum class CallSite {
        BADGE_LIGA,
        CHIP_RANKING,
        HEADER_DIVISAO,
        LEGENDA
    }

    @ParameterizedTest(name = "{0} {1} {2} {3}")
    @MethodSource("allCallSites")
    fun `foreground da divisao passa AA sobre veu composto real`(
        division: LeagueDivision,
        isDarkTheme: Boolean,
        contrastLevel: ContrastLevel,
        callSite: CallSite
    ) {
        val ratio = contrastRatioAt(division, isDarkTheme, contrastLevel, callSite)

        assertTrue(
            ratio >= AA_NORMAL_TEXT,
            "$division/${isDarkTheme.themeName()}/$contrastLevel/$callSite " +
                "deve ter contraste >= $AA_NORMAL_TEXT:1, obtido $ratio"
        )
    }

    @ParameterizedTest(name = "{0} {1} HIGH {2}")
    @MethodSource("highContrastCallSites")
    fun `em alto contraste o foreground da divisao passa AAA`(
        division: LeagueDivision,
        isDarkTheme: Boolean,
        callSite: CallSite
    ) {
        val ratio = contrastRatioAt(division, isDarkTheme, ContrastLevel.HIGH, callSite)

        assertTrue(
            ratio >= AAA_NORMAL_TEXT,
            "$division/${isDarkTheme.themeName()}/HIGH/$callSite " +
                "deve ter contraste >= $AAA_NORMAL_TEXT:1 (promessa do HighContrastTheme), obtido $ratio"
        )
    }

    @ParameterizedTest(name = "{0} {1} NORMAL mantem token do #4093")
    @MethodSource("normalSchemeTokens")
    fun `scheme NORMAL preserva os tokens validados no 4093`(
        division: LeagueDivision,
        isDarkTheme: Boolean,
        expectedColorArgb: Long
    ) {
        // Overload de 2 argumentos (default NORMAL) e chamada explicita devem coincidir.
        assertEquals(Color(expectedColorArgb), divisionTextColor(division, isDarkTheme))
        assertEquals(Color(expectedColorArgb), divisionTextColor(division, isDarkTheme, ContrastLevel.NORMAL))
    }

    @ParameterizedTest(name = "{0} {1} {2} divisionTextColor == gamificationTextColor")
    @MethodSource("allCombinations")
    fun `divisionTextColor e gamificationTextColor resolvem a mesma tabela`(
        division: LeagueDivision,
        isDarkTheme: Boolean,
        contrastLevel: ContrastLevel
    ) {
        assertEquals(
            gamificationTextColor(divisionColor(division), isDarkTheme, contrastLevel),
            divisionTextColor(division, isDarkTheme, contrastLevel)
        )
    }

    @ParameterizedTest(name = "{0} preserva o token de identidade")
    @MethodSource("divisionIdentityTokens")
    fun `tokens de identidade sao uma tabela unica para as quatro divisoes`(
        division: LeagueDivision,
        expectedColorArgb: Long
    ) {
        assertEquals(Color(expectedColorArgb), divisionColor(division))
    }

    private fun contrastRatioAt(
        division: LeagueDivision,
        isDarkTheme: Boolean,
        contrastLevel: ContrastLevel,
        callSite: CallSite
    ): Float {
        val config = AppThemeConfig(contrastLevel = contrastLevel)
        val scheme = DynamicThemeEngine.generateColorScheme(config, isDarkTheme)
        val background = compositeBackground(scheme, division, callSite)
        return ContrastHelper.getContrastRatio(
            divisionTextColor(division, isDarkTheme, contrastLevel),
            background
        )
    }

    private fun compositeBackground(
        scheme: ColorScheme,
        division: LeagueDivision,
        callSite: CallSite
    ): Color {
        val identity = divisionColor(division)
        return when (callSite) {
            CallSite.BADGE_LIGA -> composite(identity, scheme.surfaceVariant, 0.18f)
            CallSite.CHIP_RANKING -> {
                val card = composite(identity, scheme.surface, 0.1f)
                composite(identity, card, 0.2f)
            }
            CallSite.HEADER_DIVISAO -> composite(identity, scheme.background, 0.1f)
            CallSite.LEGENDA -> composite(scheme.primaryContainer, scheme.surface, 0.3f)
        }
    }

    private fun composite(foreground: Color, background: Color, alpha: Float): Color = Color(
        foreground.red * alpha + background.red * (1f - alpha),
        foreground.green * alpha + background.green * (1f - alpha),
        foreground.blue * alpha + background.blue * (1f - alpha),
        1f
    )

    private fun Boolean.themeName() = if (this) "dark" else "light"

    companion object {
        private const val AA_NORMAL_TEXT = 4.5f
        private const val AAA_NORMAL_TEXT = 7.0f

        /** 4 divisoes x 2 temas x 2 niveis de contraste x 4 call sites = 64 casos. */
        @JvmStatic
        fun allCallSites(): Stream<Arguments> {
            val args = mutableListOf<Arguments>()
            for (division in LeagueDivision.entries) {
                for (isDark in listOf(false, true)) {
                    for (level in ContrastLevel.entries) {
                        for (site in CallSite.entries) {
                            args.add(Arguments.of(division, isDark, level, site))
                        }
                    }
                }
            }
            return args.stream()
        }

        @JvmStatic
        fun highContrastCallSites(): Stream<Arguments> {
            val args = mutableListOf<Arguments>()
            for (division in LeagueDivision.entries) {
                for (isDark in listOf(false, true)) {
                    for (site in CallSite.entries) {
                        args.add(Arguments.of(division, isDark, site))
                    }
                }
            }
            return args.stream()
        }

        @JvmStatic
        fun allCombinations(): Stream<Arguments> {
            val args = mutableListOf<Arguments>()
            for (division in LeagueDivision.entries) {
                for (isDark in listOf(false, true)) {
                    for (level in ContrastLevel.entries) {
                        args.add(Arguments.of(division, isDark, level))
                    }
                }
            }
            return args.stream()
        }

        /** Tokens do scheme NORMAL validados no #4093 — nao podem regredir (#4099). */
        @JvmStatic
        fun normalSchemeTokens(): Stream<Arguments> = Stream.of(
            Arguments.of(LeagueDivision.BRONZE, false, 0xFF7A4A1FL),
            Arguments.of(LeagueDivision.PRATA, false, 0xFF616161L),
            Arguments.of(LeagueDivision.OURO, false, 0xFF7A6000L),
            Arguments.of(LeagueDivision.DIAMANTE, false, 0xFF00636FL),
            Arguments.of(LeagueDivision.BRONZE, true, 0xFFEBC98FL),
            Arguments.of(LeagueDivision.PRATA, true, 0xFFE0E0E0L),
            Arguments.of(LeagueDivision.OURO, true, 0xFFFFE45AL),
            Arguments.of(LeagueDivision.DIAMANTE, true, 0xFFB9F2FFL),
        )

        @JvmStatic
        fun divisionIdentityTokens(): Stream<Arguments> = Stream.of(
            Arguments.of(LeagueDivision.BRONZE, 0xFFCD7F32L),
            Arguments.of(LeagueDivision.PRATA, 0xFFE0E0E0L),
            Arguments.of(LeagueDivision.OURO, 0xFFFFD700L),
            Arguments.of(LeagueDivision.DIAMANTE, 0xFFB9F2FFL),
        )
    }
}
