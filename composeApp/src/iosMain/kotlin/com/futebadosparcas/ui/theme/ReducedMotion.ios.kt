package com.futebadosparcas.ui.theme

import androidx.compose.runtime.Composable
import platform.UIKit.UIAccessibilityIsReduceMotionEnabled

/**
 * Implementação iOS de readSystemReduceMotion (#2735).
 *
 * Lê UIAccessibility.isReduceMotionEnabled via interop Kotlin/Native.
 * O usuário ativa isso em Ajustes → Acessibilidade → Movimento → Reduzir Movimento.
 */
@Composable
internal actual fun readSystemReduceMotion(): Boolean {
    return UIAccessibilityIsReduceMotionEnabled()
}
