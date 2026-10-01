package com.futebadosparcas.ui.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color
import com.futebadosparcas.domain.model.AppThemeConfig
import com.futebadosparcas.domain.model.ContrastLevel

/**
 * Helpers para manipulação de cores multiplatform
 */
internal expect fun blendColors(base: Color, target: Color, ratio: Float): Color
internal expect fun calculateLuminance(color: Color): Float

/**
 * #2677: Verifica se o sistema operacional sinalizou contraste aumentado.
 *
 * - Android: [android.view.accessibility.AccessibilityManager] (acessibilidade ativa)
 * - iOS: UIAccessibility.isDarkerSystemColorsEnabled (Configurações → Acessibilidade → Aumentar contraste)
 *
 * Quando true, [FutebaTheme] eleva automaticamente [ContrastLevel] para HIGH,
 * independente da preferência salva pelo usuário.
 */
internal expect fun isSystemIncreasedContrast(): Boolean

// ==================== Esquemas de Alto Contraste (CMP/iOS) ====================
// #2677: Espelha HighContrastTheme.kt do :app, garantindo paridade cross-platform.
// Todos os pares on-X/X validados em WCAG AAA (>=7:1) para texto normal.

/** Cores de alto contraste — modo claro (CMP). */
private object HcLightColors {
    val Background          = Color(0xFFFFFFFF)
    val OnBackground        = Color(0xFF000000)
    val Surface             = Color(0xFFFFFFFF)
    val OnSurface           = Color(0xFF000000)
    val SurfaceVariant      = Color(0xFFF5F5F5)
    val OnSurfaceVariant    = Color(0xFF1A1A1A)
    val Primary             = Color(0xFF0D47A1)
    val OnPrimary           = Color(0xFFFFFFFF)
    val PrimaryContainer    = Color(0xFF1565C0)
    val OnPrimaryContainer  = Color(0xFFFFFFFF)
    val Secondary           = Color(0xFF004D40)
    val OnSecondary         = Color(0xFFFFFFFF)
    val SecondaryContainer  = Color(0xFF00695C)
    val OnSecondaryContainer = Color(0xFFFFFFFF)
    // Terciário: laranja/marrom escuro — distinto do teal secundário, AA vs branco (#2749)
    val Tertiary            = Color(0xFF8A3A00)
    val OnTertiary          = Color(0xFFFFFFFF)
    val TertiaryContainer   = Color(0xFFB45309)
    val OnTertiaryContainer = Color(0xFFFFFFFF)
    val Error               = Color(0xFFB71C1C)
    val OnError             = Color(0xFFFFFFFF)
    val ErrorContainer      = Color(0xFFC62828)
    val OnErrorContainer    = Color(0xFFFFFFFF)
    val Outline             = Color(0xFF000000)
    val OutlineVariant      = Color(0xFF424242)
}

/** Cores de alto contraste — modo escuro (CMP). */
private object HcDarkColors {
    val Background          = Color(0xFF000000)
    val OnBackground        = Color(0xFFFFFFFF)
    val Surface             = Color(0xFF000000)
    val OnSurface           = Color(0xFFFFFFFF)
    val SurfaceVariant      = Color(0xFF121212)
    val OnSurfaceVariant    = Color(0xFFE0E0E0)
    val Primary             = Color(0xFF82B1FF)
    val OnPrimary           = Color(0xFF000000)
    val PrimaryContainer    = Color(0xFF448AFF)
    val OnPrimaryContainer  = Color(0xFF000000)
    val Secondary           = Color(0xFF80CBC4)
    val OnSecondary         = Color(0xFF000000)
    val SecondaryContainer  = Color(0xFF4DB6AC)
    val OnSecondaryContainer = Color(0xFF000000)
    // Terciário: âmbar claro — distinto do teal secundário, AA vs preto (#2749)
    val Tertiary            = Color(0xFFFFB74D)
    val OnTertiary          = Color(0xFF000000)
    val TertiaryContainer   = Color(0xFFFF9E40)
    val OnTertiaryContainer = Color(0xFF000000)
    val Error               = Color(0xFFFF8A80)
    val OnError             = Color(0xFF000000)
    val ErrorContainer      = Color(0xFFFF5252)
    val OnErrorContainer    = Color(0xFF000000)
    val Outline             = Color(0xFFFFFFFF)
    val OutlineVariant      = Color(0xFFBDBDBD)
}

/** ColorScheme de alto contraste — modo claro (CMP/iOS). */
internal val HighContrastLightColorSchemeCmp = lightColorScheme(
    primary = HcLightColors.Primary,
    onPrimary = HcLightColors.OnPrimary,
    primaryContainer = HcLightColors.PrimaryContainer,
    onPrimaryContainer = HcLightColors.OnPrimaryContainer,
    secondary = HcLightColors.Secondary,
    onSecondary = HcLightColors.OnSecondary,
    secondaryContainer = HcLightColors.SecondaryContainer,
    onSecondaryContainer = HcLightColors.OnSecondaryContainer,
    tertiary = HcLightColors.Tertiary,
    onTertiary = HcLightColors.OnTertiary,
    tertiaryContainer = HcLightColors.TertiaryContainer,
    onTertiaryContainer = HcLightColors.OnTertiaryContainer,
    error = HcLightColors.Error,
    onError = HcLightColors.OnError,
    errorContainer = HcLightColors.ErrorContainer,
    onErrorContainer = HcLightColors.OnErrorContainer,
    background = HcLightColors.Background,
    onBackground = HcLightColors.OnBackground,
    surface = HcLightColors.Surface,
    onSurface = HcLightColors.OnSurface,
    surfaceVariant = HcLightColors.SurfaceVariant,
    onSurfaceVariant = HcLightColors.OnSurfaceVariant,
    outline = HcLightColors.Outline,
    outlineVariant = HcLightColors.OutlineVariant,
    surfaceContainerLowest = HcLightColors.Background,
    surfaceContainerLow = HcLightColors.Background,
    surfaceContainer = HcLightColors.SurfaceVariant,
    surfaceContainerHigh = HcLightColors.SurfaceVariant,
    surfaceContainerHighest = HcLightColors.SurfaceVariant
)

/** ColorScheme de alto contraste — modo escuro (CMP/iOS). */
internal val HighContrastDarkColorSchemeCmp = darkColorScheme(
    primary = HcDarkColors.Primary,
    onPrimary = HcDarkColors.OnPrimary,
    primaryContainer = HcDarkColors.PrimaryContainer,
    onPrimaryContainer = HcDarkColors.OnPrimaryContainer,
    secondary = HcDarkColors.Secondary,
    onSecondary = HcDarkColors.OnSecondary,
    secondaryContainer = HcDarkColors.SecondaryContainer,
    onSecondaryContainer = HcDarkColors.OnSecondaryContainer,
    tertiary = HcDarkColors.Tertiary,
    onTertiary = HcDarkColors.OnTertiary,
    tertiaryContainer = HcDarkColors.TertiaryContainer,
    onTertiaryContainer = HcDarkColors.OnTertiaryContainer,
    error = HcDarkColors.Error,
    onError = HcDarkColors.OnError,
    errorContainer = HcDarkColors.ErrorContainer,
    onErrorContainer = HcDarkColors.OnErrorContainer,
    background = HcDarkColors.Background,
    onBackground = HcDarkColors.OnBackground,
    surface = HcDarkColors.Surface,
    onSurface = HcDarkColors.OnSurface,
    surfaceVariant = HcDarkColors.SurfaceVariant,
    onSurfaceVariant = HcDarkColors.OnSurfaceVariant,
    outline = HcDarkColors.Outline,
    outlineVariant = HcDarkColors.OutlineVariant,
    surfaceContainerLowest = HcDarkColors.Background,
    surfaceContainerLow = HcDarkColors.Background,
    surfaceContainer = HcDarkColors.SurfaceVariant,
    surfaceContainerHigh = HcDarkColors.SurfaceVariant,
    surfaceContainerHighest = HcDarkColors.SurfaceVariant
)

object DynamicThemeEngine {

    private fun blend(base: Color, target: Color, ratio: Float): Color {
        return blendColors(base, target, ratio)
    }

    /**
     * #2677/#4096: escolhe o foreground (texto escuro ou claro) com maior contraste WCAG
     * sobre [background]. `internal` para que telas com fundos opacos fixos (ex.: medalhas
     * do pódio em PostGameReportScreen) reutilizem o mesmo algoritmo em vez de hardcodar
     * Color.White/Color.Black.
     */
    internal fun onColorFor(background: Color): Color {
        // #2677: WCAG AA contrast-aware. Tenta texto escuro e claro; fallback ao maior contraste.
        val darkText = Color(0xFF0B0F0D)
        val lightText = Color(0xFFF5F7F6)
        val bgLuminance = calculateLuminance(background).toDouble()
        val darkL = calculateLuminance(darkText).toDouble()
        val lightL = calculateLuminance(lightText).toDouble()

        fun ratio(l1: Double, l2: Double): Double {
            val lighter = maxOf(l1, l2)
            val darker = minOf(l1, l2)
            return (lighter + 0.05) / (darker + 0.05)
        }

        val darkRatio = ratio(darkL, bgLuminance)
        val lightRatio = ratio(lightL, bgLuminance)
        return when {
            darkRatio >= 4.5 -> darkText
            lightRatio >= 4.5 -> lightText
            darkRatio >= lightRatio -> darkText
            else -> lightText
        }
    }

    /**
     * Gera o [ColorScheme] adequado para a [config] e modo claro/escuro.
     *
     * #2677: Quando [config.contrastLevel] == HIGH (seja por toggle do usuário ou por
     * auto-detecção do sistema iOS via [isSystemIncreasedContrast]), retorna o esquema
     * de alto contraste com pares WCAG AAA (>=7:1).
     */
    fun generateColorScheme(
        config: AppThemeConfig,
        isDark: Boolean
    ): ColorScheme {
        // #2677: Ramifica para esquema de alto contraste quando solicitado pelo
        // usuário ou pelo sistema operacional.
        if (config.contrastLevel == ContrastLevel.HIGH) {
            return if (isDark) HighContrastDarkColorSchemeCmp else HighContrastLightColorSchemeCmp
        }

        val primaryInt = config.seedColors.primary
        val secondaryInt = config.seedColors.secondary
        val tertiaryInt = config.seedColors.tertiary ?: secondaryInt

        val primarySeed = Color(primaryInt)
        val secondarySeed = Color(secondaryInt)
        val tertiarySeed = Color(tertiaryInt)

        // Semantic Colors (Fixed) - Usando cores hexadecimais para consistência
        val errorColor = if(isDark) Color(0xFFFFB4AB) else Color(0xFFBA1A1A)
        val onErrorColor = if(isDark) Color(0xFF690005) else Color(0xFFFFFFFF)  // Branco em hex para consistência
        val errorContainerColor = if(isDark) Color(0xFF93000A) else Color(0xFFFFDAD6)
        val onErrorContainerColor = if(isDark) Color(0xFFFFDAD6) else Color(0xFF410002)

        return if (isDark) {
            val background = Color(0xFF0F1114)
            val surface = Color(0xFF15191C)
            val surfaceVariant = Color(0xFF20252A)
            val primary = primarySeed
            val primaryContainer = blend(primarySeed, Color.Black, 0.7f)
            val secondary = secondarySeed
            val secondaryContainer = blend(secondarySeed, Color.Black, 0.7f)
            val tertiary = tertiarySeed
            val tertiaryContainer = blend(tertiarySeed, Color.Black, 0.7f)

            darkColorScheme(
                primary = primary,
                onPrimary = onColorFor(primary),
                primaryContainer = primaryContainer,
                onPrimaryContainer = onColorFor(primaryContainer),

                secondary = secondary,
                onSecondary = onColorFor(secondary),
                secondaryContainer = secondaryContainer,
                onSecondaryContainer = onColorFor(secondaryContainer),

                tertiary = tertiary,
                onTertiary = onColorFor(tertiary),
                tertiaryContainer = tertiaryContainer,
                onTertiaryContainer = onColorFor(tertiaryContainer),

                background = background,
                onBackground = Color(0xFFE8ECEF),

                surface = surface,
                onSurface = Color(0xFFE8ECEF),
                surfaceVariant = surfaceVariant,
                onSurfaceVariant = Color(0xFFC7CDD1),

                outline = Color(0xFF445058),
                outlineVariant = Color(0xFF30373C),

                inverseSurface = Color(0xFFE6E6E6),
                inverseOnSurface = Color(0xFF1C1B1F),
                inversePrimary = blend(primarySeed, Color.Black, 0.2f),
                surfaceTint = primary,

                error = errorColor,
                onError = onErrorColor,
                errorContainer = errorContainerColor,
                onErrorContainer = onErrorContainerColor,

                // Surface Containers (M3 1.2+) - OLED optimized
                surfaceDim = Color(0xFF0F1114),
                surfaceBright = Color(0xFF36393E),
                surfaceContainerLowest = Color(0xFF0A0C0E),
                surfaceContainerLow = Color(0xFF15191C),
                surfaceContainer = Color(0xFF1A1D21),
                surfaceContainerHigh = Color(0xFF24282C),
                surfaceContainerHighest = Color(0xFF2F3337)
            )
        } else {
            val primary = primarySeed
            val secondary = secondarySeed
            val tertiary = tertiarySeed

            lightColorScheme(
                primary = primary,
                onPrimary = onColorFor(primary),
                primaryContainer = blend(primary, Color.White, 0.82f),
                onPrimaryContainer = onColorFor(blend(primary, Color.White, 0.82f)),

                secondary = secondary,
                onSecondary = onColorFor(secondary),
                secondaryContainer = blend(secondary, Color.White, 0.82f),
                onSecondaryContainer = onColorFor(blend(secondary, Color.White, 0.82f)),

                tertiary = tertiary,
                onTertiary = onColorFor(tertiary),
                tertiaryContainer = blend(tertiary, Color.White, 0.82f),
                onTertiaryContainer = onColorFor(blend(tertiary, Color.White, 0.82f)),

                background = Color(0xFFFFFFFF),
                onBackground = Color(0xFF1D1B20),

                surface = Color(0xFFFFFFFF),
                onSurface = Color(0xFF1D1B20),
                surfaceVariant = Color(0xFFF0F2F5),
                onSurfaceVariant = Color(0xFF444746),

                outline = Color(0xFF79747E),
                outlineVariant = Color(0xFFCAC4D0),

                inverseSurface = Color(0xFF2C3133),
                inverseOnSurface = Color(0xFFF1F4F5),
                inversePrimary = blend(primary, Color.White, 0.2f),
                surfaceTint = primary,

                error = errorColor,
                onError = onErrorColor,
                errorContainer = errorContainerColor,
                onErrorContainer = onErrorContainerColor,

                // Surface Containers (M3 1.2+) - Clean light hierarchy
                surfaceDim = Color(0xFFDDD9DE),
                surfaceBright = Color(0xFFFDF8FD),
                surfaceContainerLowest = Color(0xFFFFFFFF),
                surfaceContainerLow = Color(0xFFF7F2F7),
                surfaceContainer = Color(0xFFF1ECF1),
                surfaceContainerHigh = Color(0xFFEBE6EB),
                surfaceContainerHighest = Color(0xFFE5E1E6)
            )
        }
    }
}
