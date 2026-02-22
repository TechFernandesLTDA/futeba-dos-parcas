package com.futebadosparcas.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import com.futebadosparcas.domain.model.AppThemeConfig
import com.futebadosparcas.domain.model.ThemeMode

/**
 * Platform-specific theming setup (status bar, dynamic colors, etc)
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

    // Platform-specific setup (status bar, etc)
    PlatformThemeSetup(colorScheme, isDark)

    MaterialTheme(
        colorScheme = colorScheme,
        typography = FutebaTypography,
        shapes = FutebaShapes,
        content = content
    )
}
