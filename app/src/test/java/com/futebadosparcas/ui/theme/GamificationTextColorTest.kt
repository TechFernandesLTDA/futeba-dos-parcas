package com.futebadosparcas.ui.theme

import androidx.compose.ui.graphics.Color
import com.futebadosparcas.domain.model.AppThemeConfig
import com.futebadosparcas.domain.model.ContrastLevel
import com.futebadosparcas.util.ContrastHelper
import java.util.stream.Stream
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.Arguments
import org.junit.jupiter.params.provider.MethodSource

/**
 * Testes da versao pura de [gamificationTextColor] (#4099).
 *
 * Call site real: chip de nivel em PlayersScreen — texto sobre
 * `GamificationColors.Gold @ 0.15` composto sobre a surface do card. Validado nos
 * 2 temas x 2 niveis de contraste para as 4 medalhas da tabela.
 */
class GamificationTextColorTest {

    /**
     * [Color] e uma value class (long na JVM) e o JUnit 5 nao consegue injeta-la
     * como argumento parametrizado; por isso os casos sao enumerados por nome.
     */
    enum class Medal(val color: Color) {
        GOLD(GamificationColors.Gold),
        SILVER(GamificationColors.Silver),
        BRONZE(GamificationColors.Bronze),
        DIAMOND(GamificationColors.Diamond)
    }

    @ParameterizedTest(name = "{0} {1} {2} passa AA sobre medalha @0.15 na surface")
    @MethodSource("medalsByThemeAndContrast")
    fun `foreground de medalha passa AA sobre o chip real`(
        medalName: Medal,
        isDarkTheme: Boolean,
        contrastLevel: ContrastLevel
    ) {
        val medal = medalName.color
        val scheme = DynamicThemeEngine.generateColorScheme(AppThemeConfig(contrastLevel = contrastLevel), isDarkTheme)
        val background = composite(medal, scheme.surface, 0.15f)
        val ratio = ContrastHelper.getContrastRatio(
            gamificationTextColor(medal, isDarkTheme, contrastLevel),
            background
        )

        assertTrue(
            ratio >= 4.5f,
            "$medal/${if (isDarkTheme) "dark" else "light"}/$contrastLevel deve ter contraste >= 4.5:1, obtido $ratio"
        )
    }

    @ParameterizedTest(name = "{0} {1} NORMAL == tabela light/dark original")
    @MethodSource("medalsByTheme")
    fun `scheme NORMAL nao regride a tabela original`(medalName: Medal, isDarkTheme: Boolean) {
        val medal = medalName.color
        val expected = when (medal) {
            GamificationColors.Gold -> if (isDarkTheme) GamificationTextColorsDark.Gold else GamificationTextColors.Gold
            GamificationColors.Silver -> if (isDarkTheme) GamificationTextColorsDark.Silver else GamificationTextColors.Silver
            GamificationColors.Bronze -> if (isDarkTheme) GamificationTextColorsDark.Bronze else GamificationTextColors.Bronze
            else -> if (isDarkTheme) GamificationTextColorsDark.Diamond else GamificationTextColors.Diamond
        }
        // Default do parametro e NORMAL: as duas formas de chamar coincidem.
        assertEquals(expected, gamificationTextColor(medal, isDarkTheme))
        assertEquals(expected, gamificationTextColor(medal, isDarkTheme, ContrastLevel.NORMAL))
    }

    @ParameterizedTest(name = "{0} HIGH light usa a tabela de alto contraste")
    @MethodSource("medals")
    fun `HIGH light resolve para GamificationTextColorsHighContrast`(medalName: Medal) {
        val medal = medalName.color
        val expected = when (medal) {
            GamificationColors.Gold -> GamificationTextColorsHighContrast.Gold
            GamificationColors.Silver -> GamificationTextColorsHighContrast.Silver
            GamificationColors.Bronze -> GamificationTextColorsHighContrast.Bronze
            else -> GamificationTextColorsHighContrast.Diamond
        }
        assertEquals(expected, gamificationTextColor(medal, isDarkTheme = false, contrastLevel = ContrastLevel.HIGH))
    }

    @ParameterizedTest(name = "{0} HIGH dark reutiliza a tabela dark")
    @MethodSource("medals")
    fun `HIGH dark reutiliza GamificationTextColorsDark`(medalName: Medal) {
        val medal = medalName.color
        assertEquals(
            gamificationTextColor(medal, isDarkTheme = true, contrastLevel = ContrastLevel.NORMAL),
            gamificationTextColor(medal, isDarkTheme = true, contrastLevel = ContrastLevel.HIGH)
        )
    }

    @Test
    fun `token fora da tabela devolve a propria cor em qualquer combinacao`() {
        val unknown = GamificationColors.Platinum
        for (isDark in listOf(false, true)) {
            for (level in ContrastLevel.entries) {
                assertEquals(unknown, gamificationTextColor(unknown, isDark, level))
            }
        }
    }

    private fun composite(foreground: Color, background: Color, alpha: Float): Color = Color(
        foreground.red * alpha + background.red * (1f - alpha),
        foreground.green * alpha + background.green * (1f - alpha),
        foreground.blue * alpha + background.blue * (1f - alpha),
        1f
    )

    companion object {
        private val MEDALS = Medal.entries

        @JvmStatic
        fun medals(): Stream<Arguments> = MEDALS.stream().map { Arguments.of(it) }

        @JvmStatic
        fun medalsByTheme(): Stream<Arguments> {
            val args = mutableListOf<Arguments>()
            for (medal in MEDALS) {
                for (isDark in listOf(false, true)) {
                    args.add(Arguments.of(medal, isDark))
                }
            }
            return args.stream()
        }

        @JvmStatic
        fun medalsByThemeAndContrast(): Stream<Arguments> {
            val args = mutableListOf<Arguments>()
            for (medal in MEDALS) {
                for (isDark in listOf(false, true)) {
                    for (level in ContrastLevel.entries) {
                        args.add(Arguments.of(medal, isDark, level))
                    }
                }
            }
            return args.stream()
        }
    }
}
