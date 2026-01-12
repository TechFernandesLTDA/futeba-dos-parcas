package com.futebadosparcas.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat
import com.futebadosparcas.domain.model.AppThemeConfig
import com.futebadosparcas.domain.model.ThemeMode
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import com.futebadosparcas.ui.theme.ThemeViewModel
import androidx.compose.ui.platform.LocalInspectionMode

// DEPRECATED: Usar FutebaLightColorScheme e FutebaDarkColorScheme de Color.kt
// Mantido temporariamente para compatibilidade
private val LightColorScheme = FutebaLightColorScheme
private val DarkColorScheme = FutebaDarkColorScheme



// Mantendo compatibilidade com previews existentes
@Composable
@Suppress("DEPRECATION")
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

    val context = LocalContext.current
    val colorScheme = DynamicThemeEngine.generateColorScheme(finalConfig, isDark)

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as? Activity)?.window
            window?.let {
                it.statusBarColor = colorScheme.surface.toArgb()
                it.navigationBarColor = colorScheme.surfaceVariant.toArgb()
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    it.isNavigationBarContrastEnforced = false
                }
                val insetsController = WindowCompat.getInsetsController(it, view)
                insetsController.isAppearanceLightStatusBars = !isDark
                insetsController.isAppearanceLightNavigationBars = !isDark
            }
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = FutebaTypography,
        shapes = FutebaShapes,
        content = content
    )
}
