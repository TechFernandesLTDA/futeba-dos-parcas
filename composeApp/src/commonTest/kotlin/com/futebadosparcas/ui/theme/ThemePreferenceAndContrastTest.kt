package com.futebadosparcas.ui.theme

import androidx.compose.ui.graphics.Color
import com.futebadosparcas.domain.model.ContrastLevel
import com.futebadosparcas.domain.model.ThemeMode
import kotlin.test.Test
import kotlin.test.assertEquals

class ThemePreferenceAndContrastTest {
    @Test
    fun absentOrInvalidThemePreferenceDefaultsToSystem() {
        assertEquals(ThemeMode.SYSTEM, themeModeFromPreference(null))
        assertEquals(ThemeMode.SYSTEM, themeModeFromPreference("obsolete-value"))
        assertEquals(ThemeMode.DARK, themeModeFromPreference(ThemeMode.DARK.name))
    }

    @Test
    fun invalidContrastPreferenceDefaultsToNormal() {
        assertEquals(ContrastLevel.NORMAL, contrastLevelFromPreference(null))
        assertEquals(ContrastLevel.NORMAL, contrastLevelFromPreference("obsolete-value"))
        assertEquals(ContrastLevel.HIGH, contrastLevelFromPreference(ContrastLevel.HIGH.name))
    }

    @Test
    fun opaquePodiumMedalsChooseDarkAccessibleForeground() {
        val accessibleForeground = Color(0xFF0B0F0D)
        listOf(0xFFFFD700, 0xFFE0E0E0, 0xFFCD7F32).forEach { medal ->
            assertEquals(accessibleForeground, DynamicThemeEngine.onColorFor(Color(medal)))
        }
    }
}
