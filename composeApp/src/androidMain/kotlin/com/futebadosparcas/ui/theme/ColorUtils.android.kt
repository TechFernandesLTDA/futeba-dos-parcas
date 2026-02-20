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
