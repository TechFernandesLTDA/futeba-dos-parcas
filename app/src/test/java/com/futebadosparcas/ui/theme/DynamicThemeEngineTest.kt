package com.futebadosparcas.ui.theme

import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color
import com.futebadosparcas.domain.model.AppThemeConfig
import com.futebadosparcas.domain.model.ContrastLevel
import com.futebadosparcas.domain.model.SeedColors
import com.futebadosparcas.domain.model.ThemeMode
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

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
            secondary = 0xFF005FCC.toInt(),
            tertiary = 0xFFFF6D00.toInt()
        ),
        contrastLevel = ContrastLevel.NORMAL
    )

    private val configHigh = configNormal.copy(contrastLevel = ContrastLevel.HIGH)

    @Test
    fun configuracaoPadrao_usaLightEMaterialYouOptInDesligado() {
        val config = AppThemeConfig()

        assertEquals(ThemeMode.LIGHT, config.mode)
        assertEquals(ContrastLevel.NORMAL, config.contrastLevel)
        assertFalse(config.useDynamicColor)
    }

    // ==================== Seeds canônicas (#3933/#3934) ====================

    @Test
    fun configuracaoPadrao_seedsSaoCanonicalETernariasDistintas() {
        // AppThemeConfig() default = source unica de verdade (ThemeConfig.kt),
        // espelhando shared/design-tokens.json. Drift aqui deve quebrar o gate de CI.
        val seeds = AppThemeConfig().seedColors

        assertEquals(0xFF00852A.toInt(), seeds.primary, "primary deve ser #00852A (verde marca)")
        assertEquals(0xFF005FCC.toInt(), seeds.secondary, "secondary deve ser #005FCC (azul, paridade web)")
        assertEquals(0xFFFF6D00.toInt(), seeds.tertiary, "tertiary deve ser #FF6D00 (laranja complementar)")

        assertNotEquals(
            seeds.secondary, seeds.tertiary,
            "secondary e tertiary devem ser seeds distintas — caso contrário colapsam (#3933)"
        )
    }

    // ==================== Tertiary != Secondary no ColorScheme (#3933) ====================

    @Test
    fun gerarEsquema_contrasteNormal_modoClaro_secondaryDiferenteDeTertiary() {
        val scheme = DynamicThemeEngine.generateColorScheme(configNormal, isDark = false)

        assertNotEquals(
            scheme.secondary, scheme.tertiary,
            "colorScheme.secondary deve diferir de tertiary no modo claro (#3933)"
        )
        assertNotEquals(
            scheme.secondaryContainer, scheme.tertiaryContainer,
            "secondaryContainer deve diferir de tertiaryContainer no modo claro"
        )
    }

    @Test
    fun gerarEsquema_contrasteNormal_modoEscuro_secondaryDiferenteDeTertiary() {
        val scheme = DynamicThemeEngine.generateColorScheme(configNormal, isDark = true)

        assertNotEquals(
            scheme.secondary, scheme.tertiary,
            "colorScheme.secondary deve diferir de tertiary no modo escuro (#3933)"
        )
        assertNotEquals(
            scheme.secondaryContainer, scheme.tertiaryContainer,
            "secondaryContainer deve diferir de tertiaryContainer no modo escuro"
        )
    }

    // ==================== Testes de alto contraste ====================

    @Test
    fun gerarEsquema_contrasteAlto_modoClaro_onSurfaceVsSurface_atendeWcagAAA() {
        val scheme = DynamicThemeEngine.generateColorScheme(configHigh, isDark = false)

        val ratio = calculateContrastRatio(scheme.onSurface, scheme.surface)
        assertTrue(
            meetsWcagAAA(scheme.onSurface, scheme.surface),
            "onSurface vs surface deve ter contraste >= 7:1 (WCAG AAA) no modo claro. " +
                "Obtido: $ratio"
        )
    }

    @Test
    fun gerarEsquema_contrasteAlto_modoEscuro_onSurfaceVsSurface_atendeWcagAAA() {
        val scheme = DynamicThemeEngine.generateColorScheme(configHigh, isDark = true)

        val ratio = calculateContrastRatio(scheme.onSurface, scheme.surface)
        assertTrue(
            meetsWcagAAA(scheme.onSurface, scheme.surface),
            "onSurface vs surface deve ter contraste >= 7:1 (WCAG AAA) no modo escuro. " +
                "Obtido: $ratio"
        )
    }

    @Test
    fun gerarEsquema_contrasteAlto_modoClaro_onBackgroundVsBackground_atendeWcagAAA() {
        val scheme = DynamicThemeEngine.generateColorScheme(configHigh, isDark = false)

        assertTrue(
            meetsWcagAAA(scheme.onBackground, scheme.background),
            "onBackground vs background deve ter contraste >= 7:1 (WCAG AAA) no modo claro."
        )
    }

    @Test
    fun gerarEsquema_contrasteAlto_modoEscuro_onBackgroundVsBackground_atendeWcagAAA() {
        val scheme = DynamicThemeEngine.generateColorScheme(configHigh, isDark = true)

        assertTrue(
            meetsWcagAAA(scheme.onBackground, scheme.background),
            "onBackground vs background deve ter contraste >= 7:1 (WCAG AAA) no modo escuro."
        )
    }

    @Test
    fun gerarEsquema_contrasteAlto_modoClaro_onPrimaryVsPrimary_atendeWcagAA() {
        val scheme = DynamicThemeEngine.generateColorScheme(configHigh, isDark = false)

        assertTrue(
            meetsWcagAA(scheme.onPrimary, scheme.primary),
            "onPrimary vs primary deve ter contraste >= 4.5:1 (WCAG AA) no modo claro."
        )
    }

    @Test
    fun gerarEsquema_contrasteAlto_modoEscuro_onPrimaryVsPrimary_atendeWcagAA() {
        val scheme = DynamicThemeEngine.generateColorScheme(configHigh, isDark = true)

        assertTrue(
            meetsWcagAA(scheme.onPrimary, scheme.primary),
            "onPrimary vs primary deve ter contraste >= 4.5:1 (WCAG AA) no modo escuro."
        )
    }

    // ==================== Testes de contraste normal (regressão) ====================

    @Test
    fun gerarEsquema_contrasteNormal_modoClaro_onSurfaceVsSurface_atendeWcagAA() {
        val scheme = DynamicThemeEngine.generateColorScheme(configNormal, isDark = false)

        assertTrue(
            meetsWcagAA(scheme.onSurface, scheme.surface),
            "onSurface vs surface deve ter contraste >= 4.5:1 (WCAG AA) no modo claro normal."
        )
    }

    @Test
    fun gerarEsquema_contrasteNormal_modoEscuro_onSurfaceVsSurface_atendeWcagAA() {
        val scheme = DynamicThemeEngine.generateColorScheme(configNormal, isDark = true)

        assertTrue(
            meetsWcagAA(scheme.onSurface, scheme.surface),
            "onSurface vs surface deve ter contraste >= 4.5:1 (WCAG AA) no modo escuro normal."
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
            schemeOnSurface == expectedOnSurface,
            "Esquema claro high-contrast deve usar HighContrastLightColorScheme. " +
                "onSurface esperado: $expectedOnSurface, obtido: $schemeOnSurface"
        )
    }

    @Test
    fun gerarEsquema_contrasteAlto_modoEscuro_retornaHighContrastDarkColorScheme() {
        val scheme = DynamicThemeEngine.generateColorScheme(configHigh, isDark = true)
        val expected = HighContrastDarkColorScheme

        val schemeOnSurface = scheme.onSurface
        val expectedOnSurface = expected.onSurface
        assertTrue(
            schemeOnSurface == expectedOnSurface,
            "Esquema escuro high-contrast deve usar HighContrastDarkColorScheme. " +
                "onSurface esperado: $expectedOnSurface, obtido: $schemeOnSurface"
        )
    }

    @Test
    fun selecionarEsquema_preferenciaContrasteAlto_sobrescreveEsquemaDinamicoClaro() {
        val materialYouLikeScheme = lightColorScheme(
            primary = Color(0xFF7B1FA2),
            surface = Color(0xFFFFF7FF),
            onSurface = Color(0xFF1D1B20)
        )

        val selected = selectAccessibleColorScheme(
            isDarkTheme = false,
            preferHighContrast = true,
            systemHighContrast = false,
            defaultLightScheme = materialYouLikeScheme,
            defaultDarkScheme = darkColorScheme()
        )

        assertEquals(HighContrastLightColorScheme.primary, selected.primary)
        assertEquals(HighContrastLightColorScheme.surface, selected.surface)
        assertTrue(meetsWcagAAA(selected.onSurface, selected.surface))
    }

    @Test
    fun selecionarEsquema_contrasteDoSistema_sobrescreveEsquemaDinamicoEscuro() {
        val materialYouLikeScheme = darkColorScheme(
            primary = Color(0xFFD0BCFF),
            surface = Color(0xFF211F26),
            onSurface = Color(0xFFE6E1E5)
        )

        val selected = selectAccessibleColorScheme(
            isDarkTheme = true,
            preferHighContrast = false,
            systemHighContrast = true,
            defaultLightScheme = lightColorScheme(),
            defaultDarkScheme = materialYouLikeScheme
        )

        assertEquals(HighContrastDarkColorScheme.primary, selected.primary)
        assertEquals(HighContrastDarkColorScheme.surface, selected.surface)
        assertTrue(meetsWcagAAA(selected.onSurface, selected.surface))
    }

    @Test
    fun selecionarEsquema_ambosContrastesAtivos_sobrescreveEsquemaDinamico() {
        val materialYouLikeScheme = lightColorScheme(primary = Color(0xFF6750A4))

        val selected = selectAccessibleColorScheme(
            isDarkTheme = false,
            preferHighContrast = true,
            systemHighContrast = true,
            defaultLightScheme = materialYouLikeScheme,
            defaultDarkScheme = darkColorScheme()
        )

        assertEquals(HighContrastLightColorScheme.primary, selected.primary)
        assertEquals(HighContrastLightColorScheme.surface, selected.surface)
        assertTrue(meetsWcagAAA(selected.onSurface, selected.surface))
    }

    @Test
    fun selecionarEsquema_semContraste_preservaEsquemaDinamicoBase() {
        val lightMaterialYouLikeScheme = lightColorScheme(primary = Color(0xFF6750A4))
        val darkMaterialYouLikeScheme = darkColorScheme(primary = Color(0xFFD0BCFF))

        val lightSelected = selectAccessibleColorScheme(
            isDarkTheme = false,
            preferHighContrast = false,
            systemHighContrast = false,
            defaultLightScheme = lightMaterialYouLikeScheme,
            defaultDarkScheme = darkMaterialYouLikeScheme
        )
        val darkSelected = selectAccessibleColorScheme(
            isDarkTheme = true,
            preferHighContrast = false,
            systemHighContrast = false,
            defaultLightScheme = lightMaterialYouLikeScheme,
            defaultDarkScheme = darkMaterialYouLikeScheme
        )

        assertEquals(lightMaterialYouLikeScheme.primary, lightSelected.primary)
        assertEquals(darkMaterialYouLikeScheme.primary, darkSelected.primary)
    }

    // ==================== Helper para testes de pares de cor ====================

    /**
     * Verifica os pares de erro no alto contraste também atendem AA.
     */
    @Test
    fun gerarEsquema_contrasteAlto_modoClaro_onErrorVsError_atendeWcagAA() {
        val scheme = DynamicThemeEngine.generateColorScheme(configHigh, isDark = false)

        assertTrue(
            meetsWcagAA(scheme.onError, scheme.error),
            "onError vs error deve ter contraste >= 4.5:1 (WCAG AA) no modo claro."
        )
    }

    private fun Color.toHex(): String =
        "#%02X%02X%02X".format(
            (red * 255).toInt(),
            (green * 255).toInt(),
            (blue * 255).toInt()
        )
}
