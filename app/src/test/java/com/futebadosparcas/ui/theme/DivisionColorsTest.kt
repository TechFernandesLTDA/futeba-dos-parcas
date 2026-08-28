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
 * Escopo dos schemes (contraste):
 * - O BADGE e o objeto desta issue (#4084): validado nos 2 temas E nos 2
 *   schemes (NORMAL + HIGH), porque o bug original era exatamente testar o
 *   badge contra os literais de ALTO CONTRASTE como se fossem o default.
 * - Os outros 3 call sites sao validados no scheme DEFAULT, como na analise da
 *   propria issue. Eles usam [divisionTextColor], que (assim como
 *   gamificationTextColor) so distingue light/dark e NAO e contrast-level-aware
 *   — em HIGH, a legenda (primaryContainer #1565C0) reprova AA para PRATA/OURO/
 *   DIAMANTE no light. Tratar isso exigiria um LocalContrastLevel novo, fora do
 *   escopo desta issue (follow-up separado).
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
        val config = AppThemeConfig(contrastLevel = contrastLevel)
        val scheme = DynamicThemeEngine.generateColorScheme(config, isDarkTheme)
        val background = compositeBackground(scheme, division, callSite)
        val ratio = ContrastHelper.getContrastRatio(divisionTextColor(division, isDarkTheme), background)

        assertTrue(
            ratio >= 4.5f,
            "$division/${if (isDarkTheme) "dark" else "light"}/$contrastLevel/$callSite " +
                "deve ter contraste >= 4.5:1, obtido $ratio"
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

    companion object {
        @JvmStatic
        fun allCallSites(): Stream<Arguments> {
            val args = mutableListOf<Arguments>()
            for (division in LeagueDivision.entries) {
                for (isDark in listOf(false, true)) {
                    for (level in ContrastLevel.entries) {
                        for (site in CallSite.entries) {
                            // HIGH so e exercitado no BADGE (objeto do #4084);
                            // os demais call sites sao validados no scheme DEFAULT.
                            if (level == ContrastLevel.HIGH && site != CallSite.BADGE_LIGA) continue
                            args.add(Arguments.of(division, isDark, level, site))
                        }
                    }
                }
            }
            return args.stream()
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
