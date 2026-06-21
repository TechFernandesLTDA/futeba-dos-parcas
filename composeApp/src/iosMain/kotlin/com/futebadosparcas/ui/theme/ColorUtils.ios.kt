package com.futebadosparcas.ui.theme

import androidx.compose.ui.graphics.Color
import kotlin.math.pow
import platform.UIKit.UIAccessibilityDarkerSystemColorsEnabled

internal actual fun blendColors(base: Color, target: Color, ratio: Float): Color {
    val inverseRatio = 1f - ratio
    return Color(
        red = base.red * inverseRatio + target.red * ratio,
        green = base.green * inverseRatio + target.green * ratio,
        blue = base.blue * inverseRatio + target.blue * ratio,
        alpha = base.alpha * inverseRatio + target.alpha * ratio
    )
}

internal actual fun calculateLuminance(color: Color): Float {
    // Relative luminance calculation per WCAG
    fun linearize(component: Float): Float {
        return if (component <= 0.03928f) {
            component / 12.92f
        } else {
            ((component + 0.055f) / 1.055f).pow(2.4f)
        }
    }

    val r = linearize(color.red)
    val g = linearize(color.green)
    val b = linearize(color.blue)

    return 0.2126f * r + 0.7152f * g + 0.0722f * b
}

/**
 * #2677: Retorna true quando "Aumentar Contraste" (Increase Contrast) está ativo no iOS.
 *
 * Mapeado para UIAccessibility.isDarkerSystemColorsEnabled via
 * UIAccessibilityDarkerSystemColorsEnabled() da interop Kotlin/Native.
 */
internal actual fun isSystemIncreasedContrast(): Boolean {
    return UIAccessibilityDarkerSystemColorsEnabled()
}
