package com.futebadosparcas.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import com.futebadosparcas.domain.model.AppThemeConfig
import com.futebadosparcas.domain.model.ThemeMode

/**
 * Setup de tema específico de plataforma (status bar, dynamic colors, safe-area, etc).
 *
 * - Android: configura cor de status/navigation bar e aparência clara/escura.
 * - iOS: status bar é controlada pelo host SwiftUI; insets de safe-area são tratados
 *   pelo `ComposeUIViewController` + `WindowInsets.safeDrawing` no scaffold raiz.
 */
@Composable
internal expect fun PlatformThemeSetup(
    colorScheme: androidx.compose.material3.ColorScheme,
    isDark: Boolean
)

/**
 * FutebaTheme - Tema principal do app com suporte multiplatform
 *
 * @param darkTheme Se deve usar tema escuro (padrão: segue o sistema)
 * @param themeConfig Configuração do tema (opcional)
 * @param content Conteúdo a ser renderizado com o tema
 */
@Composable
fun FutebaTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    themeConfig: AppThemeConfig? = null,
    content: @Composable () -> Unit
) {
    val finalConfig = themeConfig ?: AppThemeConfig()

    val isDark = when (finalConfig.mode) {
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
        ThemeMode.SYSTEM -> darkTheme
    }

    val colorScheme = DynamicThemeEngine.generateColorScheme(finalConfig, isDark)

    // Setup específico de plataforma (status bar, etc)
    PlatformThemeSetup(colorScheme, isDark)

    MaterialTheme(
        colorScheme = colorScheme,
        // #2675 — Poppins via composeResources (função @Composable, não mais val top-level)
        typography = rememberFutebaTypography(),
        shapes = FutebaShapes,
        content = content
    )
}
