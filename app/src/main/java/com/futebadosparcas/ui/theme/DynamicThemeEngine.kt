package com.futebadosparcas.ui.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color
import com.futebadosparcas.domain.model.AppThemeConfig
import com.futebadosparcas.domain.model.ContrastLevel
import com.google.android.material.color.utilities.TonalPalette

object DynamicThemeEngine {

    private fun TonalPalette.toneColor(toneValue: Int): Color = Color(tone(toneValue))

    fun generateColorScheme(
        config: AppThemeConfig,
        isDark: Boolean
    ): ColorScheme {
        if (config.contrastLevel == ContrastLevel.HIGH) {
            return if (isDark) HighContrastDarkColorScheme else HighContrastLightColorScheme
        }

        val primaryPalette = TonalPalette.fromInt(config.seedColors.primary)
        val secondaryPalette = TonalPalette.fromInt(config.seedColors.secondary)
        val tertiaryPalette = TonalPalette.fromInt(config.seedColors.tertiary ?: config.seedColors.secondary)
        val neutralPalette = TonalPalette.fromHueAndChroma(primaryPalette.hue, 6.0)
        val neutralVariantPalette = TonalPalette.fromHueAndChroma(primaryPalette.hue, 8.0)
        val errorPalette = TonalPalette.fromHueAndChroma(25.0, 84.0)

        return if (isDark) {
            darkColorScheme(
                primary = primaryPalette.toneColor(80),
                onPrimary = primaryPalette.toneColor(20),
                primaryContainer = primaryPalette.toneColor(30),
                onPrimaryContainer = primaryPalette.toneColor(90),

                secondary = secondaryPalette.toneColor(80),
                onSecondary = secondaryPalette.toneColor(20),
                secondaryContainer = secondaryPalette.toneColor(30),
                onSecondaryContainer = secondaryPalette.toneColor(90),

                tertiary = tertiaryPalette.toneColor(80),
                onTertiary = tertiaryPalette.toneColor(20),
                tertiaryContainer = tertiaryPalette.toneColor(30),
                onTertiaryContainer = tertiaryPalette.toneColor(90),

                background = neutralPalette.toneColor(6),
                onBackground = neutralPalette.toneColor(90),

                surface = neutralPalette.toneColor(6),
                onSurface = neutralPalette.toneColor(90),
                surfaceVariant = neutralVariantPalette.toneColor(30),
                onSurfaceVariant = neutralVariantPalette.toneColor(80),

                outline = neutralVariantPalette.toneColor(60),
                outlineVariant = neutralVariantPalette.toneColor(30),

                inverseSurface = neutralPalette.toneColor(90),
                inverseOnSurface = neutralPalette.toneColor(20),
                inversePrimary = primaryPalette.toneColor(40),
                surfaceTint = primaryPalette.toneColor(80),

                error = errorPalette.toneColor(80),
                onError = errorPalette.toneColor(20),
                errorContainer = errorPalette.toneColor(30),
                onErrorContainer = errorPalette.toneColor(90),

                surfaceDim = neutralPalette.toneColor(6),
                surfaceBright = neutralPalette.toneColor(24),
                surfaceContainerLowest = neutralPalette.toneColor(4),
                surfaceContainerLow = neutralPalette.toneColor(10),
                surfaceContainer = neutralPalette.toneColor(12),
                surfaceContainerHigh = neutralPalette.toneColor(17),
                surfaceContainerHighest = neutralPalette.toneColor(22)
            )
        } else {
            lightColorScheme(
                primary = primaryPalette.toneColor(40),
                onPrimary = primaryPalette.toneColor(100),
                primaryContainer = primaryPalette.toneColor(90),
                onPrimaryContainer = primaryPalette.toneColor(10),

                secondary = secondaryPalette.toneColor(40),
                onSecondary = secondaryPalette.toneColor(100),
                secondaryContainer = secondaryPalette.toneColor(90),
                onSecondaryContainer = secondaryPalette.toneColor(10),

                tertiary = tertiaryPalette.toneColor(40),
                onTertiary = tertiaryPalette.toneColor(100),
                tertiaryContainer = tertiaryPalette.toneColor(90),
                onTertiaryContainer = tertiaryPalette.toneColor(10),

                background = neutralPalette.toneColor(99),
                onBackground = neutralPalette.toneColor(10),

                surface = neutralPalette.toneColor(99),
                onSurface = neutralPalette.toneColor(10),
                surfaceVariant = neutralVariantPalette.toneColor(90),
                onSurfaceVariant = neutralVariantPalette.toneColor(30),

                outline = neutralVariantPalette.toneColor(50),
                outlineVariant = neutralVariantPalette.toneColor(80),

                inverseSurface = neutralPalette.toneColor(20),
                inverseOnSurface = neutralPalette.toneColor(95),
                inversePrimary = primaryPalette.toneColor(80),
                surfaceTint = primaryPalette.toneColor(40),

                error = errorPalette.toneColor(40),
                onError = errorPalette.toneColor(100),
                errorContainer = errorPalette.toneColor(90),
                onErrorContainer = errorPalette.toneColor(10),

                surfaceDim = neutralPalette.toneColor(87),
                surfaceBright = neutralPalette.toneColor(98),
                surfaceContainerLowest = neutralPalette.toneColor(100),
                surfaceContainerLow = neutralPalette.toneColor(96),
                surfaceContainer = neutralPalette.toneColor(94),
                surfaceContainerHigh = neutralPalette.toneColor(92),
                surfaceContainerHighest = neutralPalette.toneColor(90)
            )
        }
    }
}
