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
    // PRIMARY - Duolingo Signature Green
    // ==========================================
    val Primary = Color.parseColor("#58CC02") // Vibrante (Duolingo)
    val PrimaryDark = Color.parseColor("#43C000")
    val PrimaryLight = Color.parseColor("#89E219")
    val PrimaryContainer = Color.parseColor("#D6F5C6") // Mais suave para M3
    val OnPrimary = Color.parseColor("#FFFFFF")
    val OnPrimaryContainer = Color.parseColor("#113800")

    // Primary for OLED Dark Theme (more vibrant)
    val PrimaryDarkTheme = Color.parseColor("#7CFC00")
    val PrimaryContainerDark = Color.parseColor("#2D5A00")
    val OnPrimaryDark = Color.parseColor("#003300")
    val OnPrimaryContainerDark = Color.parseColor("#B8FF6E")

    // ==========================================
    // SECONDARY - Duolingo Blue
    // ==========================================
    val Secondary = Color.parseColor("#1CB0F6") // Azul Duolingo
    val SecondaryDark = Color.parseColor("#0996CC")
    val SecondaryLight = Color.parseColor("#D6F1FF")
    val SecondaryContainer = Color.parseColor("#D6F1FF")
    val OnSecondary = Color.parseColor("#FFFFFF")
    val OnSecondaryContainer = Color.parseColor("#003D5C")

    // Secondary for OLED Dark Theme (electric blue)
    val SecondaryDarkTheme = Color.parseColor("#4DD0E1")
    val SecondaryContainerDark = Color.parseColor("#004F58")
    val OnSecondaryDark = Color.parseColor("#00363D")
    val OnSecondaryContainerDark = Color.parseColor("#97F0FF")

    // ==========================================
    // TERTIARY/ACCENT - Duolingo Orange
    // ==========================================
    val Tertiary = Color.parseColor("#FF9600")
    val Accent = Color.parseColor("#FF9600")
    val TertiaryContainer = Color.parseColor("#FFE0B3")
    val OnTertiary = Color.parseColor("#FFFFFF")
    val OnTertiaryContainer = Color.parseColor("#4A2800")

    // Tertiary for OLED Dark Theme (vibrant orange)
    val TertiaryDarkTheme = Color.parseColor("#FFAB40")
    val TertiaryContainerDark = Color.parseColor("#5E3A00")
    val OnTertiaryDark = Color.parseColor("#442800")
    val OnTertiaryContainerDark = Color.parseColor("#FFDDB3")

    // ==========================================
    // STATUS COLORS
    // ==========================================
    val Success = Color.parseColor("#58CC02")
    val SuccessDark = Color.parseColor("#69F0AE")

    val Warning = Color.parseColor("#FFC800")
    val WarningDark = Color.parseColor("#FFD54F")

    val Error = Color.parseColor("#FF4B4B")
    val ErrorDark = Color.parseColor("#FF6B6B")

    val Info = Color.parseColor("#1CB0F6")
    val InfoDark = Color.parseColor("#40C4FF")

    // ==========================================
    // LIGHT THEME - BACKGROUNDS & SURFACES
    // Clean white like Duolingo
    // ==========================================
    val Background = Color.parseColor("#FFFFFF")
    val Surface = Color.parseColor("#FFFFFF")
    val SurfaceVariant = Color.parseColor("#F7F7F7")
    val OnBackground = Color.parseColor("#3C3C3C")
    val OnSurface = Color.parseColor("#3C3C3C")
    val OnSurfaceVariant = Color.parseColor("#6F6F6F")
    val Outline = Color.parseColor("#CFCFCF")
    val OutlineVariant = Color.parseColor("#E5E5E5")

    // ==========================================
    // DARK THEME - OLED OPTIMIZED
    // Pure black + vibrant colors
    // ==========================================
    val BackgroundDark = Color.parseColor("#000000")
    val SurfaceDark = Color.parseColor("#000000")
    val SurfaceVariantDark = Color.parseColor("#1A1A1A")
    val OnBackgroundDark = Color.parseColor("#E8E8E8")
    val OnSurfaceDark = Color.parseColor("#F0F0F0")
    val OnSurfaceVariantDark = Color.parseColor("#CCCCCC")
    val OutlineDark = Color.parseColor("#444444")
    val OutlineVariantDark = Color.parseColor("#2A2A2A")

    // ==========================================
    // TEXT COLORS
    // ==========================================
    val TextPrimary = Color.parseColor("#3C3C3C")
    val TextSecondary = Color.parseColor("#6F6F6F")
    val TextPrimaryDark = Color.parseColor("#F0F0F0")
    val TextSecondaryDark = Color.parseColor("#CCCCCC")

    // ==========================================
    // GAMIFICATION - Expressive Variants
    // ==========================================
    val Gold = Color.parseColor("#FFC800")
    val Silver = Color.parseColor("#C0C0C0")
    val Bronze = Color.parseColor("#CD7F32")

    // Purple for streaks/premium features
    val Purple = Color.parseColor("#A560E8")
    val PurpleLight = Color.parseColor("#CE93D8")
    
    // Expressive XP Gradient colors
    val XpStart = Color.parseColor("#58CC02")
    val XpEnd = Color.parseColor("#89E219")
    val LevelUpGold = Color.parseColor("#FFD700")

    // ==========================================
    // LEGACY - Compatibility
    // ==========================================
    val Divider = Color.parseColor("#E5E5E5")
    val DividerDark = Color.parseColor("#2A2A2A")
}
