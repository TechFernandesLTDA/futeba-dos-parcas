package com.futebadosparcas.ui.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.core.graphics.ColorUtils
import com.futebadosparcas.domain.model.AppThemeConfig

object DynamicThemeEngine {

    private fun blend(base: Color, target: Color, ratio: Float): Color {
        return Color(ColorUtils.blendARGB(base.toArgb(), target.toArgb(), ratio))
    }

    private fun onColorFor(background: Color): Color {
        return if (ColorUtils.calculateLuminance(background.toArgb()) > 0.6) {
            Color(0xFF0B0F0D)
        } else {
            Color(0xFFF5F7F6)
        }
    }

    fun generateColorScheme(
        config: AppThemeConfig,
        isDark: Boolean
    ): ColorScheme {
        val primaryInt = config.seedColors.primary
        val secondaryInt = config.seedColors.secondary
        val tertiaryInt = config.seedColors.tertiary ?: secondaryInt

        val primarySeed = Color(primaryInt)
        val secondarySeed = Color(secondaryInt)
        val tertiarySeed = Color(tertiaryInt)

        // Semantic Colors (Fixed)
        val errorColor = if(isDark) Color(0xFFFFB4AB) else Color(0xFFBA1A1A)
        val onErrorColor = if(isDark) Color(0xFF690005) else Color.White
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
                onErrorContainer = onErrorContainerColor
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
                onErrorContainer = onErrorContainerColor
            )
        }
    }
}
