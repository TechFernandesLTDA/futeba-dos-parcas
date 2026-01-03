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
    val PrimaryDarkTheme = Color.parseColor("#4ADE80") // Balanced vivid green
    val PrimaryContainerDark = Color.parseColor("#0F3B24")
    val OnPrimaryDark = Color.parseColor("#0B0F0D")
    val OnPrimaryContainerDark = Color.parseColor("#B7F7D2")

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
    val SecondaryDarkTheme = Color.parseColor("#5CC8FF")
    val SecondaryContainerDark = Color.parseColor("#103447")
    val OnSecondaryDark = Color.parseColor("#0B1114")
    val OnSecondaryContainerDark = Color.parseColor("#BFE9FF")

    // ==========================================
    // TERTIARY - Energetic Orange (Action)
    // ==========================================
    val Tertiary = Color.parseColor("#FF6D00") // Deep Orange
    val Accent = Color.parseColor("#FF6D00")
    val TertiaryContainer = Color.parseColor("#FFF3E0")
    val OnTertiary = Color.parseColor("#FFFFFF")
    val OnTertiaryContainer = Color.parseColor("#E65100")

    // TERTIARY OLED - Amber/Gold
    val TertiaryDarkTheme = Color.parseColor("#FFB74D")
    val TertiaryContainerDark = Color.parseColor("#4A2A00")
    val OnTertiaryDark = Color.parseColor("#2A1700")
    val OnTertiaryContainerDark = Color.parseColor("#FFD9A0")

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
    val WarningDark = Color.parseColor("#F7D87A")

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
    val BackgroundDark = Color.parseColor("#0F1114")
    val SurfaceDark = Color.parseColor("#15191C")
    val SurfaceVariantDark = Color.parseColor("#20252A")
    val OnBackgroundDark = Color.parseColor("#E8ECEF")
    val OnSurfaceDark = Color.parseColor("#E8ECEF")
    val OnSurfaceVariantDark = Color.parseColor("#C7CDD1")
    val OutlineDark = Color.parseColor("#445058")
    val OutlineVariantDark = Color.parseColor("#30373C")

    // ==========================================
    // TEXT COLORS
    // ==========================================
    val TextPrimary = Color.parseColor("#1A1C1E")
    val TextSecondary = Color.parseColor("#49454F")
    val TextPrimaryDark = Color.parseColor("#E8ECEF")
    val TextSecondaryDark = Color.parseColor("#C7CDD1")

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
    val DividerDark = Color.parseColor("#30373C")
}
