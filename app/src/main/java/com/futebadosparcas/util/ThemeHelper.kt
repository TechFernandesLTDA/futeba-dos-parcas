package com.futebadosparcas.util

import android.content.Context
import android.content.res.Configuration
import android.os.Build
import androidx.appcompat.app.AppCompatDelegate
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Theme Helper
 *
 * Provides utilities for managing app theme (light/dark mode) and Material 3 dynamic colors.
 *
 * Usage:
 * ```kotlin
 * @Inject lateinit var themeHelper: ThemeHelper
 *
 * // Check if dark mode is enabled
 * if (themeHelper.isDarkMode()) {
 *     // Apply dark theme UI
 * }
 *
 * // Set theme mode
 * themeHelper.setThemeMode(ThemeMode.DARK)
 * ```
 */
@Singleton
class ThemeHelper @Inject constructor(
    @ApplicationContext private val context: Context
) {

    /**
     * Check if device is in dark mode
     */
    fun isDarkMode(): Boolean {
        return when (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) {
            Configuration.UI_MODE_NIGHT_YES -> true
            Configuration.UI_MODE_NIGHT_NO -> false
            else -> false
        }
    }

    /**
     * Check if system is in dark mode (respects system settings)
     */
    fun isSystemInDarkMode(): Boolean {
        return isDarkMode()
    }

    /**
     * Set theme mode programmatically
     */
    fun setThemeMode(mode: ThemeMode) {
        val nightMode = when (mode) {
            ThemeMode.LIGHT -> AppCompatDelegate.MODE_NIGHT_NO
            ThemeMode.DARK -> AppCompatDelegate.MODE_NIGHT_YES
            ThemeMode.SYSTEM -> AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
        }
        AppCompatDelegate.setDefaultNightMode(nightMode)
    }

    /**
     * Get current theme mode
     */
    fun getCurrentThemeMode(): ThemeMode {
        return when (AppCompatDelegate.getDefaultNightMode()) {
            AppCompatDelegate.MODE_NIGHT_NO -> ThemeMode.LIGHT
            AppCompatDelegate.MODE_NIGHT_YES -> ThemeMode.DARK
            else -> ThemeMode.SYSTEM
        }
    }

    /**
     * Check if dynamic colors are supported (Android 12+)
     */
    fun isDynamicColorSupported(): Boolean {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
    }

    /**
     * Get primary color from current theme
     */
    fun getPrimaryColor(): Int {
        val typedValue = android.util.TypedValue()
        context.theme.resolveAttribute(
            com.google.android.material.R.attr.colorPrimary,
            typedValue,
            true
        )
        return typedValue.data
    }

    /**
     * Get secondary color from current theme
     */
    fun getSecondaryColor(): Int {
        val typedValue = android.util.TypedValue()
        context.theme.resolveAttribute(
            com.google.android.material.R.attr.colorSecondary,
            typedValue,
            true
        )
        return typedValue.data
    }

    /**
     * Get background color from current theme
     */
    fun getBackgroundColor(): Int {
        val typedValue = android.util.TypedValue()
        context.theme.resolveAttribute(
            android.R.attr.colorBackground,
            typedValue,
            true
        )
        return typedValue.data
    }

    /**
     * Get surface color from current theme
     */
    fun getSurfaceColor(): Int {
        val typedValue = android.util.TypedValue()
        context.theme.resolveAttribute(
            com.google.android.material.R.attr.colorSurface,
            typedValue,
            true
        )
        return typedValue.data
    }

    /**
     * Get error color from current theme
     */
    fun getErrorColor(): Int {
        val typedValue = android.util.TypedValue()
        context.theme.resolveAttribute(
            com.google.android.material.R.attr.colorError,
            typedValue,
            true
        )
        return typedValue.data
    }

    companion object {
        /**
         * Legacy method for backward compatibility
         * @deprecated Use setThemeMode() with ThemeMode enum instead
         */
        @Deprecated("Use setThemeMode() with ThemeMode enum", ReplaceWith("setThemeMode(ThemeMode.LIGHT/DARK/SYSTEM)"))
        fun applyTheme(theme: String) {
            when (theme) {
                "light" -> AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO)
                "dark" -> AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES)
                else -> AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM)
            }
        }
    }
}

/**
 * Theme mode enum
 */
enum class ThemeMode {
    LIGHT,
    DARK,
    SYSTEM
}

/**
 * Compose extensions for theme
 */
@Composable
fun getDynamicColorScheme(isDark: Boolean): ColorScheme? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
        return null
    }

    val context = LocalContext.current
    return if (isDark) {
        dynamicDarkColorScheme(context)
    } else {
        dynamicLightColorScheme(context)
    }
}

@Composable
fun isDarkTheme(): Boolean {
    return isSystemInDarkTheme()
}
