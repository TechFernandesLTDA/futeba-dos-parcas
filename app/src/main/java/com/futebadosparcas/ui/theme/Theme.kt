package com.futebadosparcas.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat
import com.futebadosparcas.data.model.AppThemeConfig
import com.futebadosparcas.data.model.ThemeMode
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import com.futebadosparcas.ui.theme.ThemeViewModel
import androidx.compose.ui.platform.LocalInspectionMode

private val LightColorScheme = lightColorScheme(
    primary = Color(FutebaColors.Primary),
    onPrimary = Color(FutebaColors.OnPrimary),
    primaryContainer = Color(FutebaColors.PrimaryContainer),
    onPrimaryContainer = Color(FutebaColors.OnPrimaryContainer),
    secondary = Color(FutebaColors.Secondary),
    onSecondary = Color(FutebaColors.OnSecondary),
    secondaryContainer = Color(FutebaColors.SecondaryContainer),
    onSecondaryContainer = Color(FutebaColors.OnSecondaryContainer),
    tertiary = Color(FutebaColors.Tertiary),
    onTertiary = Color(FutebaColors.OnTertiary),
    tertiaryContainer = Color(FutebaColors.TertiaryContainer),
    onTertiaryContainer = Color(FutebaColors.OnTertiaryContainer),
    error = Color(FutebaColors.Error),
    background = Color(FutebaColors.Background),
    onBackground = Color(FutebaColors.OnBackground),
    surface = Color(FutebaColors.Surface),
    onSurface = Color(FutebaColors.OnSurface),
    surfaceVariant = Color(FutebaColors.SurfaceVariant),
    onSurfaceVariant = Color(FutebaColors.OnSurfaceVariant),
    outline = Color(FutebaColors.Outline),
    outlineVariant = Color(FutebaColors.OutlineVariant)
)

private val DarkColorScheme = darkColorScheme(
    primary = Color(FutebaColors.PrimaryDarkTheme),
    onPrimary = Color(FutebaColors.OnPrimaryDark),
    primaryContainer = Color(FutebaColors.PrimaryContainerDark),
    onPrimaryContainer = Color(FutebaColors.OnPrimaryContainerDark),
    secondary = Color(FutebaColors.SecondaryDarkTheme),
    onSecondary = Color(FutebaColors.OnSecondaryDark),
    secondaryContainer = Color(FutebaColors.SecondaryContainerDark),
    onSecondaryContainer = Color(FutebaColors.OnSecondaryContainerDark),
    tertiary = Color(FutebaColors.TertiaryDarkTheme),
    onTertiary = Color(FutebaColors.OnTertiaryDark),
    tertiaryContainer = Color(FutebaColors.TertiaryContainerDark),
    onTertiaryContainer = Color(FutebaColors.OnTertiaryContainerDark),
    error = Color(FutebaColors.ErrorDark),
    background = Color(FutebaColors.BackgroundDark),
    onBackground = Color(FutebaColors.OnBackgroundDark),
    surface = Color(FutebaColors.SurfaceDark),
    onSurface = Color(FutebaColors.OnSurfaceDark),
    surfaceVariant = Color(FutebaColors.SurfaceVariantDark),
    onSurfaceVariant = Color(FutebaColors.OnSurfaceVariantDark),
    outline = Color(FutebaColors.OutlineDark),
    outlineVariant = Color(FutebaColors.OutlineVariantDark)
)



// Mantendo compatibilidade com previews existentes
@Composable
fun FutebaTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    themeConfig: AppThemeConfig? = null, // Config manual opcional
    content: @Composable () -> Unit
) {
    // Lógica para obter a configuração correta
    val finalConfig = if (themeConfig != null) {
        themeConfig
    } else if (LocalInspectionMode.current) {
         // Fallback para Previews onde Hilt não existe
        AppThemeConfig()
    } else {
        // Em runtime, usa o ViewModel injetado
        val viewModel: ThemeViewModel = hiltViewModel()
        val state by viewModel.themeConfig.collectAsState()
        state
    }

    val isDark = when (finalConfig.mode) {
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
        ThemeMode.SYSTEM -> darkTheme
    }

    val colorScheme = DynamicThemeEngine.generateColorScheme(finalConfig, isDark)

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as? Activity)?.window
            window?.let {
                it.statusBarColor = colorScheme.primary.toArgb()
                WindowCompat.getInsetsController(it, view).isAppearanceLightStatusBars = !isDark
            }
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
