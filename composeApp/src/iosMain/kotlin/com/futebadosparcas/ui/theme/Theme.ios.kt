package com.futebadosparcas.ui.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.runtime.Composable

@Composable
internal actual fun PlatformThemeSetup(
    colorScheme: ColorScheme,
    isDark: Boolean
) {
    // Status bar styling é gerenciado pela camada SwiftUI (ContentView.swift)
    // via .preferredColorScheme(). O Compose Multiplatform no iOS delega a
    // aparência da status bar ao UIViewController host.
}
