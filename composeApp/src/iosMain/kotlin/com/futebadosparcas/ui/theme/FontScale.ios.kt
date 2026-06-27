package com.futebadosparcas.ui.theme

import platform.UIKit.UIFont
import platform.UIKit.UIFontTextStyleBody

internal actual fun platformFontScale(currentFontScale: Float): Float {
    val bodyPointSize = UIFont.preferredFontForTextStyle(UIFontTextStyleBody).pointSize.toFloat()
    val dynamicTypeScale = bodyPointSize / 17f
    return maxOf(currentFontScale, dynamicTypeScale)
}
