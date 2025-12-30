package com.futebadosparcas.data.model

import android.graphics.Color

enum class ThemeMode {
    LIGHT, DARK, SYSTEM
}

enum class ContrastLevel {
    NORMAL, HIGH
}

data class SeedColors(
    val primary: Int = Color.parseColor("#58CC02"), // Futeba Green
    val secondary: Int = Color.parseColor("#FF9600"), // Badge Orange
    val tertiary: Int? = null
)

data class AppThemeConfig(
    val seedColors: SeedColors = SeedColors(),
    val mode: ThemeMode = ThemeMode.SYSTEM,
    val contrastLevel: ContrastLevel = ContrastLevel.NORMAL
)
