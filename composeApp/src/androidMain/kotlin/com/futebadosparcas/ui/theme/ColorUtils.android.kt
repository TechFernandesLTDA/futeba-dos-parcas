package com.futebadosparcas.ui.theme

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.core.graphics.ColorUtils as AndroidColorUtils

internal actual fun blendColors(base: Color, target: Color, ratio: Float): Color {
    return Color(AndroidColorUtils.blendARGB(base.toArgb(), target.toArgb(), ratio))
}

internal actual fun calculateLuminance(color: Color): Float {
    return AndroidColorUtils.calculateLuminance(color.toArgb()).toFloat()
}

/**
 * #2677: No Android, o contraste aumentado do sistema é sinalizado pela acessibilidade.
 * Nota: a detecção exata de "high text contrast" (isHighTextContrastEnabled) requer
 * Context, que não está disponível aqui sem injeção. Retornamos false como fallback seguro;
 * o Android usa o campo contrastLevel do ThemeConfig (persistido via DataStore/toggle) como
 * fonte de verdade primária.
 */
internal actual fun isSystemIncreasedContrast(): Boolean = false
