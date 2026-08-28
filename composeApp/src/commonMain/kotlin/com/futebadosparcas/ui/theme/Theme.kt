package com.futebadosparcas.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import com.futebadosparcas.domain.model.AppThemeConfig
import com.futebadosparcas.domain.model.ContrastLevel
import com.futebadosparcas.domain.model.ThemeMode

/**
 * Setup de tema específico de plataforma (status bar, dynamic colors, safe-area, etc).
 *
 * - Android: configura cor de status/navigation bar e aparência clara/escura.
 * - iOS: status bar é controlada via `ComposeUIViewControllerConfiguration.delegate`
 *   (`MainViewController.kt`); insets de safe-area são tratados pelo
 *   `ComposeUIViewController` + `WindowInsets.safeDrawing` no scaffold raiz.
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

    // #2677: Auto-eleva contrastLevel para HIGH quando o SO sinalizou contraste aumentado
    // (iOS: UIAccessibility.isDarkerSystemColorsEnabled; Android: fallback false, usa toggle).
    val effectiveConfig = if (
        finalConfig.contrastLevel == ContrastLevel.NORMAL && isSystemIncreasedContrast()
    ) {
        finalConfig.copy(contrastLevel = ContrastLevel.HIGH)
    } else {
        finalConfig
    }

    val colorScheme = DynamicThemeEngine.generateColorScheme(effectiveConfig, isDark)

    // #2735: lê reduced-motion do sistema via função expect (Android/iOS cada uma com sua impl)
    val reducedMotion = readSystemReduceMotion()
    val density = LocalDensity.current
    val fontScale = platformFontScale(density.fontScale).coerceAtLeast(1f)

    // Setup específico de plataforma (status bar, etc.)
    PlatformThemeSetup(colorScheme, isDark)

    CompositionLocalProvider(
        LocalReducedMotion provides reducedMotion,
        LocalDensity provides Density(density = density.density, fontScale = fontScale)
    ) {
        MaterialTheme(
            colorScheme = colorScheme,
            // #2675 — Poppins via composeResources (função @Composable, não mais val top-level)
            typography = rememberFutebaTypography(),
            shapes = FutebaShapes,
            content = content
        )
    }
}
