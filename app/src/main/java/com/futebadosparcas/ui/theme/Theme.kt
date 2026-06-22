package com.futebadosparcas.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat
import com.futebadosparcas.domain.model.AppThemeConfig
import com.futebadosparcas.domain.model.ContrastLevel
import com.futebadosparcas.domain.model.ThemeMode
import androidx.compose.runtime.getValue
import org.koin.compose.viewmodel.koinViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.ui.theme.ThemeViewModel
import androidx.compose.ui.platform.LocalInspectionMode



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
        val viewModel: ThemeViewModel = koinViewModel()
        val state by viewModel.themeConfig.collectAsStateWithLifecycle()
        state
    }

    val isDark = when (finalConfig.mode) {
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
        ThemeMode.SYSTEM -> darkTheme
    }

    val context = LocalContext.current
    val reducedMotion = remember { readSystemReduceMotion(context) }
    val baseColorScheme = if (finalConfig.useDynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        if (isDark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
    } else {
        DynamicThemeEngine.generateColorScheme(finalConfig, isDark)
    }
    val colorScheme = getAccessibleColorScheme(
        isDarkTheme = isDark,
        preferHighContrast = finalConfig.contrastLevel == ContrastLevel.HIGH,
        defaultLightScheme = baseColorScheme,
        defaultDarkScheme = baseColorScheme
    )

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

    // Envolve MaterialTheme com ResponsiveTypographyProvider para disponibilizar
    // LocalResponsiveTextDimens em toda a árvore de composição (#2209).
    ResponsiveTypographyProvider {
        CompositionLocalProvider(LocalReducedMotion provides reducedMotion) {
            MaterialTheme(
                colorScheme = colorScheme,
                typography = FutebaTypography,
                shapes = FutebaShapes,
                content = content
            )
        }
    }
}
