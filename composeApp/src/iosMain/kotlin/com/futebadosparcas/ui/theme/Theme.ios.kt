package com.futebadosparcas.ui.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.runtime.Composable

@Composable
internal actual fun PlatformThemeSetup(
    colorScheme: ColorScheme,
    isDark: Boolean
) {
    // iOS-specific theme setup (status bar, etc) can be added here
    // For now, no platform-specific setup needed
}
