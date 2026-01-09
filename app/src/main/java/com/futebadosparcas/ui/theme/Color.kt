package com.futebadosparcas.ui.theme

import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color

/**
 * Material Design 3 Color System para Futeba dos Parças
 *
 * Inspirado no Duolingo: cores vibrantes, premium e gamificadas
 * - Light Theme: Clean, airy, energético
 * - Dark Theme: OLED-optimized, alto contraste, cores neon
 *
 * Color Roles MD3:
 * - Primary: Ação principal, FABs, botões destacados
 * - Secondary: Ações secundárias, chips, toggles
 * - Tertiary: Contraste complementar, badges, highlights
 * - Error: Estados de erro e validação
 * - Surface: Backgrounds de cards e containers
 * - Background: Fundo geral do app
 */

// ==========================================
// LIGHT THEME COLORS
// ==========================================
private val md3_light_primary = Color(0xFF00C853) // Vibrant Green
private val md3_light_onPrimary = Color(0xFFFFFFFF)
private val md3_light_primaryContainer = Color(0xFFB7F7D2) // Light mint
private val md3_light_onPrimaryContainer = Color(0xFF002910)

private val md3_light_secondary = Color(0xFF2979FF) // Electric Blue
private val md3_light_onSecondary = Color(0xFFFFFFFF)
private val md3_light_secondaryContainer = Color(0xFFD0E4FF)
private val md3_light_onSecondaryContainer = Color(0xFF001B3D)

private val md3_light_tertiary = Color(0xFFFF6D00) // Deep Orange
private val md3_light_onTertiary = Color(0xFFFFFFFF)
private val md3_light_tertiaryContainer = Color(0xFFFFDCC2)
private val md3_light_onTertiaryContainer = Color(0xFF2A1700)

private val md3_light_error = Color(0xFFD32F2F)
private val md3_light_onError = Color(0xFFFFFFFF)
private val md3_light_errorContainer = Color(0xFFFFDAD6)
private val md3_light_onErrorContainer = Color(0xFF410002)

private val md3_light_background = Color(0xFFFCFCFC) // Off-white premium
private val md3_light_onBackground = Color(0xFF1A1C1E)

private val md3_light_surface = Color(0xFFFFFFFF)
private val md3_light_onSurface = Color(0xFF1A1C1E)
private val md3_light_surfaceVariant = Color(0xFFF1F5F9) // Slate-tinted
private val md3_light_onSurfaceVariant = Color(0xFF444746)

private val md3_light_outline = Color(0xFF79747E)
private val md3_light_outlineVariant = Color(0xFFCAC4D0)

private val md3_light_inverseSurface = Color(0xFF2F3033)
private val md3_light_inverseOnSurface = Color(0xFFF1F4F5)
private val md3_light_inversePrimary = Color(0xFF4ADE80)

// ==========================================
// DARK THEME COLORS (OLED Optimized)
// ==========================================
private val md3_dark_primary = Color(0xFF4ADE80) // Neon green
private val md3_dark_onPrimary = Color(0xFF003918)
private val md3_dark_primaryContainer = Color(0xFF005227)
private val md3_dark_onPrimaryContainer = Color(0xFFB7F7D2)

private val md3_dark_secondary = Color(0xFF5CC8FF) // Cyan
private val md3_dark_onSecondary = Color(0xFF003351)
private val md3_dark_secondaryContainer = Color(0xFF004B73)
private val md3_dark_onSecondaryContainer = Color(0xFFD0E4FF)

private val md3_dark_tertiary = Color(0xFFFFB74D) // Amber/Gold
private val md3_dark_onTertiary = Color(0xFF4A2800)
private val md3_dark_tertiaryContainer = Color(0xFF6A3C00)
private val md3_dark_onTertiaryContainer = Color(0xFFFFDCC2)

private val md3_dark_error = Color(0xFFFFB4AB)
private val md3_dark_onError = Color(0xFF690005)
private val md3_dark_errorContainer = Color(0xFF93000A)
private val md3_dark_onErrorContainer = Color(0xFFFFDAD6)

private val md3_dark_background = Color(0xFF0F1114) // True black OLED
private val md3_dark_onBackground = Color(0xFFE8ECEF)

private val md3_dark_surface = Color(0xFF15191C) // Subtle elevation
private val md3_dark_onSurface = Color(0xFFE8ECEF)
private val md3_dark_surfaceVariant = Color(0xFF20252A)
private val md3_dark_onSurfaceVariant = Color(0xFFC7CDD1)

private val md3_dark_outline = Color(0xFF445058)
private val md3_dark_outlineVariant = Color(0xFF30373C)

private val md3_dark_inverseSurface = Color(0xFFE6E6E6)
private val md3_dark_inverseOnSurface = Color(0xFF1C1B1F)
private val md3_dark_inversePrimary = Color(0xFF00C853)

/**
 * Material Design 3 Light Color Scheme
 */
val FutebaLightColorScheme = lightColorScheme(
    primary = md3_light_primary,
    onPrimary = md3_light_onPrimary,
    primaryContainer = md3_light_primaryContainer,
    onPrimaryContainer = md3_light_onPrimaryContainer,

    secondary = md3_light_secondary,
    onSecondary = md3_light_onSecondary,
    secondaryContainer = md3_light_secondaryContainer,
    onSecondaryContainer = md3_light_onSecondaryContainer,

    tertiary = md3_light_tertiary,
    onTertiary = md3_light_onTertiary,
    tertiaryContainer = md3_light_tertiaryContainer,
    onTertiaryContainer = md3_light_onTertiaryContainer,

    error = md3_light_error,
    onError = md3_light_onError,
    errorContainer = md3_light_errorContainer,
    onErrorContainer = md3_light_onErrorContainer,

    background = md3_light_background,
    onBackground = md3_light_onBackground,

    surface = md3_light_surface,
    onSurface = md3_light_onSurface,
    surfaceVariant = md3_light_surfaceVariant,
    onSurfaceVariant = md3_light_onSurfaceVariant,

    outline = md3_light_outline,
    outlineVariant = md3_light_outlineVariant,

    inverseSurface = md3_light_inverseSurface,
    inverseOnSurface = md3_light_inverseOnSurface,
    inversePrimary = md3_light_inversePrimary,

    surfaceTint = md3_light_primary
)

/**
 * Material Design 3 Dark Color Scheme (OLED Optimized)
 */
val FutebaDarkColorScheme = darkColorScheme(
    primary = md3_dark_primary,
    onPrimary = md3_dark_onPrimary,
    primaryContainer = md3_dark_primaryContainer,
    onPrimaryContainer = md3_dark_onPrimaryContainer,

    secondary = md3_dark_secondary,
    onSecondary = md3_dark_onSecondary,
    secondaryContainer = md3_dark_secondaryContainer,
    onSecondaryContainer = md3_dark_onSecondaryContainer,

    tertiary = md3_dark_tertiary,
    onTertiary = md3_dark_onTertiary,
    tertiaryContainer = md3_dark_tertiaryContainer,
    onTertiaryContainer = md3_dark_onTertiaryContainer,

    error = md3_dark_error,
    onError = md3_dark_onError,
    errorContainer = md3_dark_errorContainer,
    onErrorContainer = md3_dark_onErrorContainer,

    background = md3_dark_background,
    onBackground = md3_dark_onBackground,

    surface = md3_dark_surface,
    onSurface = md3_dark_onSurface,
    surfaceVariant = md3_dark_surfaceVariant,
    onSurfaceVariant = md3_dark_onSurfaceVariant,

    outline = md3_dark_outline,
    outlineVariant = md3_dark_outlineVariant,

    inverseSurface = md3_dark_inverseSurface,
    inverseOnSurface = md3_dark_inverseOnSurface,
    inversePrimary = md3_dark_inversePrimary,

    surfaceTint = md3_dark_primary
)

// ==========================================
// LEGACY COLORS (Compatibilidade com código XML)
// Manter para transição gradual
// ==========================================
object FutebaColors {

    // ==========================================
    // PRIMARY - Electric Pro Green
    // Modern, energetic, yet professional.
    // ==========================================
    val Primary = android.graphics.Color.parseColor("#00C853") // Vibrant Green (Material A700 equivalent)
    val PrimaryDark = android.graphics.Color.parseColor("#009624")
    val PrimaryLight = android.graphics.Color.parseColor("#5EFC82") // Neon pop
    val PrimaryContainer = android.graphics.Color.parseColor("#E0F2F1") // Very subtle mint tint
    val OnPrimary = android.graphics.Color.parseColor("#FFFFFF")
    val OnPrimaryContainer = android.graphics.Color.parseColor("#003300")

    // PRIMARY OLED - High Contrast Neon
    val PrimaryDarkTheme = android.graphics.Color.parseColor("#4ADE80") // Balanced vivid green
    val PrimaryContainerDark = android.graphics.Color.parseColor("#0F3B24")
    val OnPrimaryDark = android.graphics.Color.parseColor("#0B0F0D")
    val OnPrimaryContainerDark = android.graphics.Color.parseColor("#B7F7D2")

    // ==========================================
    // SECONDARY - Electric Blue / Accent
    // ==========================================
    val Secondary = android.graphics.Color.parseColor("#2979FF") // Electric Blue
    val SecondaryDark = android.graphics.Color.parseColor("#004ECB")
    val SecondaryLight = android.graphics.Color.parseColor("#75A7FF")
    val SecondaryContainer = android.graphics.Color.parseColor("#E3F2FD")
    val OnSecondary = android.graphics.Color.parseColor("#FFFFFF")
    val OnSecondaryContainer = android.graphics.Color.parseColor("#0D47A1")

    // SECONDARY OLED - Cyan/Teal
    val SecondaryDarkTheme = android.graphics.Color.parseColor("#5CC8FF")
    val SecondaryContainerDark = android.graphics.Color.parseColor("#103447")
    val OnSecondaryDark = android.graphics.Color.parseColor("#0B1114")
    val OnSecondaryContainerDark = android.graphics.Color.parseColor("#BFE9FF")

    // ==========================================
    // TERTIARY - Energetic Orange (Action)
    // ==========================================
    val Tertiary = android.graphics.Color.parseColor("#FF6D00") // Deep Orange
    val Accent = android.graphics.Color.parseColor("#FF6D00")
    val TertiaryContainer = android.graphics.Color.parseColor("#FFF3E0")
    val OnTertiary = android.graphics.Color.parseColor("#FFFFFF")
    val OnTertiaryContainer = android.graphics.Color.parseColor("#E65100")

    // TERTIARY OLED - Amber/Gold
    val TertiaryDarkTheme = android.graphics.Color.parseColor("#FFB74D")
    val TertiaryContainerDark = android.graphics.Color.parseColor("#4A2A00")
    val OnTertiaryDark = android.graphics.Color.parseColor("#2A1700")
    val OnTertiaryContainerDark = android.graphics.Color.parseColor("#FFD9A0")

    // ==========================================
    // SEMANTIC COLORS - Field Types
    // ==========================================
    val FieldGrass = android.graphics.Color.parseColor("#388E3C")
    val FieldSynthetic = android.graphics.Color.parseColor("#4CAF50")
    val FieldFutsal = android.graphics.Color.parseColor("#1976D2")
    val FieldSand = android.graphics.Color.parseColor("#FBC02D")

    // ==========================================
    // STATUS COLORS
    // ==========================================
    val Success = android.graphics.Color.parseColor("#00C853")
    val SuccessDark = android.graphics.Color.parseColor("#69F0AE")

    val Warning = android.graphics.Color.parseColor("#FFD600") // Vibrant Yellow
    val WarningDark = android.graphics.Color.parseColor("#F7D87A")

    val Error = android.graphics.Color.parseColor("#D32F2F")
    val ErrorDark = android.graphics.Color.parseColor("#FF5252") // Red A200

    val Info = android.graphics.Color.parseColor("#0288D1")
    val InfoDark = android.graphics.Color.parseColor("#40C4FF")

    // ==========================================
    // LIGHT THEME - BACKGROUNDS & SURFACES
    // Clean, airy, premium white/grey
    // ==========================================
    val Background = android.graphics.Color.parseColor("#F8F9FA") // Off-white, easier on eyes than #FFFFFF
    val Surface = android.graphics.Color.parseColor("#FFFFFF")
    val SurfaceVariant = android.graphics.Color.parseColor("#F1F5F9") // Slate-tinted grey
    val OnBackground = android.graphics.Color.parseColor("#1A1C1E")
    val OnSurface = android.graphics.Color.parseColor("#1A1C1E")
    val OnSurfaceVariant = android.graphics.Color.parseColor("#49454F")
    val Outline = android.graphics.Color.parseColor("#79747E")
    val OutlineVariant = android.graphics.Color.parseColor("#CAC4D0")

    // ==========================================
    // DARK THEME - OLED OPTIMIZED
    // True Black & Slate Greys
    // ==========================================
    val BackgroundDark = android.graphics.Color.parseColor("#0F1114")
    val SurfaceDark = android.graphics.Color.parseColor("#15191C")
    val SurfaceVariantDark = android.graphics.Color.parseColor("#20252A")
    val OnBackgroundDark = android.graphics.Color.parseColor("#E8ECEF")
    val OnSurfaceDark = android.graphics.Color.parseColor("#E8ECEF")
    val OnSurfaceVariantDark = android.graphics.Color.parseColor("#C7CDD1")
    val OutlineDark = android.graphics.Color.parseColor("#445058")
    val OutlineVariantDark = android.graphics.Color.parseColor("#30373C")

    // ==========================================
    // TEXT COLORS
    // ==========================================
    val TextPrimary = android.graphics.Color.parseColor("#1A1C1E")
    val TextSecondary = android.graphics.Color.parseColor("#49454F")
    val TextPrimaryDark = android.graphics.Color.parseColor("#E8ECEF")
    val TextSecondaryDark = android.graphics.Color.parseColor("#C7CDD1")

    // ==========================================
    // GAMIFICATION - Premium Metals & Effects
    // ==========================================
    val Gold = android.graphics.Color.parseColor("#FFD700")
    val Silver = android.graphics.Color.parseColor("#E0E0E0")
    val Bronze = android.graphics.Color.parseColor("#CD7F32")

    // Royal Purple for Premium/MVP
    val Purple = android.graphics.Color.parseColor("#6200EA") // Deep Purple A700
    val PurpleLight = android.graphics.Color.parseColor("#B388FF")

    // XP Gradients
    val XpStart = android.graphics.Color.parseColor("#00C853")
    val XpEnd = android.graphics.Color.parseColor("#64DD17")
    val LevelUpGold = android.graphics.Color.parseColor("#FFAB00")

    // ==========================================
    // LEGACY
    // ==========================================
    val Divider = android.graphics.Color.parseColor("#E0E0E0")
    val DividerDark = android.graphics.Color.parseColor("#30373C")
}

// ==========================================
// SEMANTIC COLORS COMPOSE (Gamificação)
// Para uso em Compose com cores especiais
// ==========================================

object ThemePresets {
    val Green = Color(0xFF58CC02)
    val Blue = Color(0xFF1CB0F6)
    val Orange = Color(0xFFFF9600)
    val Purple = Color(0xFFCE82FF)
    val Red = Color(0xFFFF4B4B)
    val Navy = Color(0xFF2B70C9)

    val All = listOf(Green, Blue, Orange, Purple, Red, Navy)
}

/**
 * Cores especiais para gamificação
 */
object GamificationColors {
    val Gold = Color(0xFFFFD700)
    val Silver = Color(0xFFE0E0E0)
    val Bronze = Color(0xFFCD7F32)
    val Diamond = Color(0xFFB9F2FF)

    val Purple = Color(0xFF6200EA)
    val PurpleLight = Color(0xFFB388FF)

    val XpGreen = Color(0xFF00C853)
    val XpLightGreen = Color(0xFF64DD17)
    val LevelUpGold = Color(0xFFFFAB00)
    
    // Contraste para texto/ícones
    val DiamondDark = Color(0xFF008394) // Cyan 700
    val SilverDark = Color(0xFF616161) // Grey 700

    val FireStart = Color(0xFFFF9800) // Orange
    val FireEnd = Color(0xFFF44336) // Red

    // Gradient Variants
    val GoldLight = Color(0xFFFFE082)
    val BronzeLight = Color(0xFFE6A370)
}

/**
 * Cores para tipos de campo
 */
object FieldTypeColors {
    val Society = Color(0xFF2E7D32) // Verde escuro
    val Futsal = Color(0xFF1565C0) // Azul profundo
    val Campo = Color(0xFF558B2F) // Verde campo
    val Areia = Color(0xFFF9A825) // Amarelo areia
    val Outros = Color(0xFF757575) // Cinza neutro

    // Legacy aliases
    val Grass = Color(0xFF388E3C)
    val Synthetic = Color(0xFF4CAF50)
    val Sand = Color(0xFFFBC02D)
}

/**
 * Cores para status de jogos
 */
object GameStatusColors {
    val Scheduled = Color(0xFF388E3C) // Verde
    val InProgress = Color(0xFF1976D2) // Azul
    val Finished = Color(0xFF616161) // Cinza
    val Cancelled = Color(0xFFD32F2F) // Vermelho
    val Full = Color(0xFFFF6F00) // Laranja
    val Warning = Color(0xFFE6A300) // Amarelo/Laranja aviso
}

/**
 * Cores para eventos de partida ao vivo
 */
object MatchEventColors {
    // Backgrounds claros para eventos
    val GoalBackground = Color(0xFFE8F5E9) // Verde claro
    val SubstitutionBackground = Color(0xFFFFF3E0) // Laranja claro
    val YellowCardBackground = Color(0xFFFFFDE7) // Amarelo claro
    val RedCardBackground = Color(0xFFFFEBEE) // Vermelho claro
    val FoulBackground = Color(0xFFF3E5F5) // Roxo claro

    // Cores de ícones/badges
    val YellowCard = Color(0xFFFDD835) // Cartão amarelo
    val RedCard = Color(0xFFE53935) // Cartão vermelho
}

/**
 * Cores de marcas/brands
 */
object BrandColors {
    val WhatsApp = Color(0xFF25D366) // Verde oficial WhatsApp
    val Pix = Color(0xFF00C9A7) // Verde-água Pix
}

/**
 * Cores para raridades de badges
 */
object BadgeRarityColors {
    val Common = Color(0xFF8E8E8E) // Cinza
    val Rare = Color(0xFF2196F3) // Azul
    val Epic = Color(0xFF9C27B0) // Roxo
    val Legendary = Color(0xFFFF9800) // Laranja/Dourado
}
