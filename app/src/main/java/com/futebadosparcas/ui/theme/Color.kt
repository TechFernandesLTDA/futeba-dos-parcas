package com.futebadosparcas.ui.theme

import android.graphics.Color

/**
 * Duolingo-inspired color palette for Futeba dos Parcas
 *
 * Light Theme: Clean, vibrant Duolingo style
 * Dark Theme: OLED-optimized with vibrant colors
 */
object FutebaColors {

    // ==========================================
    // PRIMARY - Electric Pro Green
    // Modern, energetic, yet professional.
    // ==========================================
    val Primary = Color.parseColor("#00C853") // Vibrant Green (Material A700 equivalent)
    val PrimaryDark = Color.parseColor("#009624")
    val PrimaryLight = Color.parseColor("#5EFC82") // Neon pop
    val PrimaryContainer = Color.parseColor("#E0F2F1") // Very subtle mint tint
    val OnPrimary = Color.parseColor("#FFFFFF")
    val OnPrimaryContainer = Color.parseColor("#003300")

    // PRIMARY OLED - High Contrast Neon
    val PrimaryDarkTheme = Color.parseColor("#00E676") // Neon Green
    val PrimaryContainerDark = Color.parseColor("#003300") // Deep Green
    val OnPrimaryDark = Color.parseColor("#000000") // Black text on neon
    val OnPrimaryContainerDark = Color.parseColor("#B9F6CA")

    // ==========================================
    // SECONDARY - Electric Blue / Accent
    // ==========================================
    val Secondary = Color.parseColor("#2979FF") // Electric Blue
    val SecondaryDark = Color.parseColor("#004ECB")
    val SecondaryLight = Color.parseColor("#75A7FF")
    val SecondaryContainer = Color.parseColor("#E3F2FD")
    val OnSecondary = Color.parseColor("#FFFFFF")
    val OnSecondaryContainer = Color.parseColor("#0D47A1")

    // SECONDARY OLED - Cyan/Teal
    val SecondaryDarkTheme = Color.parseColor("#40C4FF") // Sky Blue
    val SecondaryContainerDark = Color.parseColor("#004B73")
    val OnSecondaryDark = Color.parseColor("#000000")
    val OnSecondaryContainerDark = Color.parseColor("#C3E7FF")

    // ==========================================
    // TERTIARY - Energetic Orange (Action)
    // ==========================================
    val Tertiary = Color.parseColor("#FF6D00") // Deep Orange
    val Accent = Color.parseColor("#FF6D00")
    val TertiaryContainer = Color.parseColor("#FFF3E0")
    val OnTertiary = Color.parseColor("#FFFFFF")
    val OnTertiaryContainer = Color.parseColor("#E65100")

    // TERTIARY OLED - Amber/Gold
    val TertiaryDarkTheme = Color.parseColor("#FFAB00") // Amber A700
    val TertiaryContainerDark = Color.parseColor("#5A3600")
    val OnTertiaryDark = Color.parseColor("#000000")
    val OnTertiaryContainerDark = Color.parseColor("#FFD180")

    // ==========================================
    // SEMANTIC COLORS - Field Types
    // ==========================================
    val FieldGrass = Color.parseColor("#388E3C")
    val FieldSynthetic = Color.parseColor("#4CAF50")
    val FieldFutsal = Color.parseColor("#1976D2")
    val FieldSand = Color.parseColor("#FBC02D")

    // ==========================================
    // STATUS COLORS
    // ==========================================
    val Success = Color.parseColor("#00C853")
    val SuccessDark = Color.parseColor("#69F0AE")

    val Warning = Color.parseColor("#FFD600") // Vibrant Yellow
    val WarningDark = Color.parseColor("#FFFF00")

    val Error = Color.parseColor("#D32F2F")
    val ErrorDark = Color.parseColor("#FF5252") // Red A200

    val Info = Color.parseColor("#0288D1")
    val InfoDark = Color.parseColor("#40C4FF")

    // ==========================================
    // LIGHT THEME - BACKGROUNDS & SURFACES
    // Clean, airy, premium white/grey
    // ==========================================
    val Background = Color.parseColor("#F8F9FA") // Off-white, easier on eyes than #FFFFFF
    val Surface = Color.parseColor("#FFFFFF")
    val SurfaceVariant = Color.parseColor("#F1F5F9") // Slate-tinted grey
    val OnBackground = Color.parseColor("#1A1C1E")
    val OnSurface = Color.parseColor("#1A1C1E")
    val OnSurfaceVariant = Color.parseColor("#49454F")
    val Outline = Color.parseColor("#79747E")
    val OutlineVariant = Color.parseColor("#CAC4D0")

    // ==========================================
    // DARK THEME - OLED OPTIMIZED
    // True Black & Slate Greys
    // ==========================================
    val BackgroundDark = Color.parseColor("#000000") // True Black for OLED
    val SurfaceDark = Color.parseColor("#121212") // Material Dark Surface
    val SurfaceVariantDark = Color.parseColor("#1E1E1E") // Slightly Elevated
    val OnBackgroundDark = Color.parseColor("#E1E1E1")
    val OnSurfaceDark = Color.parseColor("#E1E1E1")
    val OnSurfaceVariantDark = Color.parseColor("#C4C7C5")
    val OutlineDark = Color.parseColor("#8E918F")
    val OutlineVariantDark = Color.parseColor("#444746")

    // ==========================================
    // TEXT COLORS
    // ==========================================
    val TextPrimary = Color.parseColor("#1A1C1E")
    val TextSecondary = Color.parseColor("#49454F")
    val TextPrimaryDark = Color.parseColor("#E1E1E1")
    val TextSecondaryDark = Color.parseColor("#C4C7C5")

    // ==========================================
    // GAMIFICATION - Premium Metals & Effects
    // ==========================================
    val Gold = Color.parseColor("#FFD700")
    val Silver = Color.parseColor("#E0E0E0")
    val Bronze = Color.parseColor("#CD7F32")

    // Royal Purple for Premium/MVP
    val Purple = Color.parseColor("#6200EA") // Deep Purple A700
    val PurpleLight = Color.parseColor("#B388FF")
    
    // XP Gradients
    val XpStart = Color.parseColor("#00C853")
    val XpEnd = Color.parseColor("#64DD17")
    val LevelUpGold = Color.parseColor("#FFAB00")

    // ==========================================
    // LEGACY
    // ==========================================
    val Divider = Color.parseColor("#E0E0E0")
    val DividerDark = Color.parseColor("#333333")
}
