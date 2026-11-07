package com.futebadosparcas.ui.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color
import androidx.core.graphics.ColorUtils
import com.futebadosparcas.domain.model.AppThemeConfig
import com.futebadosparcas.domain.model.ContrastLevel
import kotlin.math.pow

object DynamicThemeEngine {

    private class HslPalette(val hue: Float, val saturation: Float) {
        fun toneColor(toneValue: Int): Color =
            colorWithTargetTone(
                hue = hue.coerceIn(0f, 360f),
                saturation = saturation.coerceIn(0f, 1f),
                tone = toneValue
            )

        companion object {
            /**
             * Gera uma cor com matiz e saturação preservadas cuja luminância relativa
             * corresponde exatamente ao tom perceptual CIE L* (0..100) do Material 3,
             * usando apenas APIs públicas.
             */
            private fun colorWithTargetTone(hue: Float, saturation: Float, tone: Int): Color {
                val clamped = tone.coerceIn(0, 100)
                if (clamped == 0) return Color.Black
                if (clamped == 100) return Color.White
                val targetY = yFromLStar(clamped.toDouble())
                var low = 0f
                var high = 1f
                var best = Color.hsl(hue, saturation, clamped / 100f)
                repeat(12) {
                    val mid = (low + high) * 0.5f
                    val candidate = Color.hsl(hue, saturation, mid)
                    best = candidate
                    if (relativeLuminance(candidate) < targetY) {
                        low = mid
                    } else {
                        high = mid
                    }
                }
                return best
            }

            private fun yFromLStar(lStar: Double): Double =
                if (lStar > 8.0) {
                    ((lStar + 16.0) / 116.0).pow(3.0)
                } else {
                    lStar / 903.2962962962963
                }

            private fun relativeLuminance(color: Color): Double {
                fun linearize(channel: Float): Double {
                    val c = channel.toDouble()
                    return if (c <= 0.04045) c / 12.92 else ((c + 0.055) / 1.055).pow(2.4)
                }
                return 0.2126 * linearize(color.red) +
                    0.7152 * linearize(color.green) +
                    0.0722 * linearize(color.blue)
            }

            fun fromInt(argb: Int): HslPalette {
                val r = (argb ushr 16) and 0xFF
                val g = (argb ushr 8) and 0xFF
                val b = argb and 0xFF
                val hsl = FloatArray(3)
                ColorUtils.RGBToHSL(r, g, b, hsl)
                return HslPalette(hue = hsl[0], saturation = hsl[1])
            }

            fun fromHueAndChroma(hue: Float, chroma: Float): HslPalette =
                HslPalette(hue = hue, saturation = (chroma / 120f).coerceIn(0f, 1f))
        }
    }

    fun generateColorScheme(
        config: AppThemeConfig,
        isDark: Boolean
    ): ColorScheme {
        if (config.contrastLevel == ContrastLevel.HIGH) {
            return if (isDark) HighContrastDarkColorScheme else HighContrastLightColorScheme
        }

        val primaryPalette = HslPalette.fromInt(config.seedColors.primary)
        val secondaryPalette = HslPalette.fromInt(config.seedColors.secondary)
        val tertiaryPalette = HslPalette.fromInt(config.seedColors.tertiary ?: config.seedColors.secondary)
        val neutralPalette = HslPalette.fromHueAndChroma(primaryPalette.hue, 6f)
        val neutralVariantPalette = HslPalette.fromHueAndChroma(primaryPalette.hue, 8f)
        val errorPalette = HslPalette.fromHueAndChroma(25f, 84f)

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
