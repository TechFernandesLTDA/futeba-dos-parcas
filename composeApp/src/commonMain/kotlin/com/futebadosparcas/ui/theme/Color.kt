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

// Surface Containers (M3 1.2+) - Hierarquia de elevacao visual
private val md3_light_surfaceDim = Color(0xFFDDD8DD)
private val md3_light_surfaceBright = Color(0xFFFDF8FD)
private val md3_light_surfaceContainerLowest = Color(0xFFFFFFFF)
private val md3_light_surfaceContainerLow = Color(0xFFF7F5F8)
private val md3_light_surfaceContainer = Color(0xFFF1EFF2)
private val md3_light_surfaceContainerHigh = Color(0xFFEBE9EC)
private val md3_light_surfaceContainerHighest = Color(0xFFE5E3E6)

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

// Surface Containers Dark (M3 1.2+) - OLED optimized
private val md3_dark_surfaceDim = Color(0xFF0F1114)
private val md3_dark_surfaceBright = Color(0xFF36393E)
private val md3_dark_surfaceContainerLowest = Color(0xFF0A0C0E)
private val md3_dark_surfaceContainerLow = Color(0xFF15191C)
private val md3_dark_surfaceContainer = Color(0xFF1A1D21)
private val md3_dark_surfaceContainerHigh = Color(0xFF24282C)
private val md3_dark_surfaceContainerHighest = Color(0xFF2F3337)

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

    surfaceTint = md3_light_primary,

    // Surface Containers (M3 1.2+)
    surfaceDim = md3_light_surfaceDim,
    surfaceBright = md3_light_surfaceBright,
    surfaceContainerLowest = md3_light_surfaceContainerLowest,
    surfaceContainerLow = md3_light_surfaceContainerLow,
    surfaceContainer = md3_light_surfaceContainer,
    surfaceContainerHigh = md3_light_surfaceContainerHigh,
    surfaceContainerHighest = md3_light_surfaceContainerHighest
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

    surfaceTint = md3_dark_primary,

    // Surface Containers (M3 1.2+) - OLED optimized
    surfaceDim = md3_dark_surfaceDim,
    surfaceBright = md3_dark_surfaceBright,
    surfaceContainerLowest = md3_dark_surfaceContainerLowest,
    surfaceContainerLow = md3_dark_surfaceContainerLow,
    surfaceContainer = md3_dark_surfaceContainer,
    surfaceContainerHigh = md3_dark_surfaceContainerHigh,
    surfaceContainerHighest = md3_dark_surfaceContainerHighest
)

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
