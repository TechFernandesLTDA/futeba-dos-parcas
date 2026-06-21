package com.futebadosparcas.ui.theme

import androidx.compose.ui.graphics.Color
import com.futebadosparcas.domain.model.AppThemeConfig
import com.futebadosparcas.domain.model.ContrastLevel
import com.futebadosparcas.domain.model.SeedColors
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Testes unitários para o [DynamicThemeEngine] do :app (Android).
 *
 * #2682: Verifica que o esquema de alto contraste (ContrastLevel.HIGH) atende
 * WCAG AAA (>= 7:1) para os pares de texto/fundo principais.
 *
 * Usa [calculateContrastRatio] e [meetsWcagAAA] de HighContrastTheme.kt
 * (funções pure-Kotlin, sem dependência de Android Color framework).
 */
class DynamicThemeEngineTest {

    private val configNormal = AppThemeConfig(
        seedColors = SeedColors(
            primary = 0xFF00852A.toInt(),
            secondary = 0xFFFF9600.toInt()
        ),
        contrastLevel = ContrastLevel.NORMAL
    )

    private val configHigh = configNormal.copy(contrastLevel = ContrastLevel.HIGH)

    // ==================== Testes de alto contraste ====================

    @Test
    fun gerarEsquema_contrasteAlto_modoClaro_onSurfaceVsSurface_atendeWcagAAA() {
        val scheme = DynamicThemeEngine.generateColorScheme(configHigh, isDark = false)

        val ratio = calculateContrastRatio(scheme.onSurface, scheme.surface)
        assertTrue(
            "onSurface vs surface deve ter contraste >= 7:1 (WCAG AAA) no modo claro. " +
                "Obtido: $ratio",
            meetsWcagAAA(scheme.onSurface, scheme.surface)
        )
    }

    @Test
    fun gerarEsquema_contrasteAlto_modoEscuro_onSurfaceVsSurface_atendeWcagAAA() {
        val scheme = DynamicThemeEngine.generateColorScheme(configHigh, isDark = true)

        val ratio = calculateContrastRatio(scheme.onSurface, scheme.surface)
        assertTrue(
            "onSurface vs surface deve ter contraste >= 7:1 (WCAG AAA) no modo escuro. " +
                "Obtido: $ratio",
            meetsWcagAAA(scheme.onSurface, scheme.surface)
        )
    }

    @Test
    fun gerarEsquema_contrasteAlto_modoClaro_onBackgroundVsBackground_atendeWcagAAA() {
        val scheme = DynamicThemeEngine.generateColorScheme(configHigh, isDark = false)

        assertTrue(
            "onBackground vs background deve ter contraste >= 7:1 (WCAG AAA) no modo claro.",
            meetsWcagAAA(scheme.onBackground, scheme.background)
        )
    }

    @Test
    fun gerarEsquema_contrasteAlto_modoEscuro_onBackgroundVsBackground_atendeWcagAAA() {
        val scheme = DynamicThemeEngine.generateColorScheme(configHigh, isDark = true)

        assertTrue(
            "onBackground vs background deve ter contraste >= 7:1 (WCAG AAA) no modo escuro.",
            meetsWcagAAA(scheme.onBackground, scheme.background)
        )
    }

    @Test
    fun gerarEsquema_contrasteAlto_modoClaro_onPrimaryVsPrimary_atendeWcagAA() {
        val scheme = DynamicThemeEngine.generateColorScheme(configHigh, isDark = false)

        assertTrue(
            "onPrimary vs primary deve ter contraste >= 4.5:1 (WCAG AA) no modo claro.",
            meetsWcagAA(scheme.onPrimary, scheme.primary)
        )
    }

    @Test
    fun gerarEsquema_contrasteAlto_modoEscuro_onPrimaryVsPrimary_atendeWcagAA() {
        val scheme = DynamicThemeEngine.generateColorScheme(configHigh, isDark = true)

        assertTrue(
            "onPrimary vs primary deve ter contraste >= 4.5:1 (WCAG AA) no modo escuro.",
            meetsWcagAA(scheme.onPrimary, scheme.primary)
        )
    }

    // ==================== Testes de contraste normal (regressão) ====================

    @Test
    fun gerarEsquema_contrasteNormal_modoClaro_onSurfaceVsSurface_atendeWcagAA() {
        val scheme = DynamicThemeEngine.generateColorScheme(configNormal, isDark = false)

        assertTrue(
            "onSurface vs surface deve ter contraste >= 4.5:1 (WCAG AA) no modo claro normal.",
            meetsWcagAA(scheme.onSurface, scheme.surface)
        )
    }

    @Test
    fun gerarEsquema_contrasteNormal_modoEscuro_onSurfaceVsSurface_atendeWcagAA() {
        val scheme = DynamicThemeEngine.generateColorScheme(configNormal, isDark = true)

        assertTrue(
            "onSurface vs surface deve ter contraste >= 4.5:1 (WCAG AA) no modo escuro normal.",
            meetsWcagAA(scheme.onSurface, scheme.surface)
        )
    }

    // ==================== Teste de seleção de esquema ====================

    @Test
    fun gerarEsquema_contrasteAlto_modoClaro_retornaHighContrastLightColorScheme() {
        val scheme = DynamicThemeEngine.generateColorScheme(configHigh, isDark = false)
        val expected = HighContrastLightColorScheme

        // Verifica o par mais característico do esquema de alto contraste claro
        val schemeOnSurface = scheme.onSurface
        val expectedOnSurface = expected.onSurface
        assertTrue(
            "Esquema claro high-contrast deve usar HighContrastLightColorScheme. " +
                "onSurface esperado: $expectedOnSurface, obtido: $schemeOnSurface",
            schemeOnSurface == expectedOnSurface
        )
    }

    @Test
    fun gerarEsquema_contrasteAlto_modoEscuro_retornaHighContrastDarkColorScheme() {
        val scheme = DynamicThemeEngine.generateColorScheme(configHigh, isDark = true)
        val expected = HighContrastDarkColorScheme

        val schemeOnSurface = scheme.onSurface
        val expectedOnSurface = expected.onSurface
        assertTrue(
            "Esquema escuro high-contrast deve usar HighContrastDarkColorScheme. " +
                "onSurface esperado: $expectedOnSurface, obtido: $schemeOnSurface",
            schemeOnSurface == expectedOnSurface
        )
    }

    // ==================== Helper para testes de pares de cor ====================

    /**
     * Verifica os pares de erro no alto contraste também atendem AA.
     */
    @Test
    fun gerarEsquema_contrasteAlto_modoClaro_onErrorVsError_atendeWcagAA() {
        val scheme = DynamicThemeEngine.generateColorScheme(configHigh, isDark = false)

        assertTrue(
            "onError vs error deve ter contraste >= 4.5:1 (WCAG AA) no modo claro.",
            meetsWcagAA(scheme.onError, scheme.error)
        )
    }

    private fun Color.toHex(): String =
        "#%02X%02X%02X".format(
            (red * 255).toInt(),
            (green * 255).toInt(),
            (blue * 255).toInt()
        )
}
