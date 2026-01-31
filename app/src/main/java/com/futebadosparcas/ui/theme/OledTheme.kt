package com.futebadosparcas.ui.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/**
 * Tema Dark Mode OLED - Pure Black.
 * Otimizado para telas AMOLED, economizando bateria com pretos verdadeiros.
 */

// ==================== OLED Colors ====================

/**
 * Cores específicas para OLED.
 * Usa preto puro (#000000) para máxima economia de bateria.
 */
object OledColors {
    // Backgrounds - Preto puro
    val PureBlack = Color(0xFF000000)
    val SurfaceDark = Color(0xFF0A0A0A)
    val SurfaceContainer = Color(0xFF121212)
    val SurfaceContainerHigh = Color(0xFF1A1A1A)
    val SurfaceContainerHighest = Color(0xFF222222)

    // Cores de destaque (mantém vibrância em fundo preto)
    val Primary = Color(0xFF90CAF9)           // Azul claro vibrante
    val PrimaryContainer = Color(0xFF1565C0)   // Azul container
    val Secondary = Color(0xFF80CBC4)          // Verde água
    val SecondaryContainer = Color(0xFF00695C)
    val Tertiary = Color(0xFFFFCC80)           // Laranja dourado
    val TertiaryContainer = Color(0xFFE65100)

    // Texto em fundo preto
    val OnSurface = Color(0xFFEEEEEE)          // Branco suave (não puro)
    val OnSurfaceVariant = Color(0xFFB0B0B0)   // Cinza claro
    val Outline = Color(0xFF444444)
    val OutlineVariant = Color(0xFF333333)

    // Cores de estado
    val Error = Color(0xFFFF8A80)              // Vermelho vibrante
    val ErrorContainer = Color(0xFFB71C1C)
    val OnError = Color(0xFF000000)
}

// ==================== OLED Color Scheme ====================

/**
 * ColorScheme otimizado para OLED.
 */
val OledDarkColorScheme = darkColorScheme(
    // Primary
    primary = OledColors.Primary,
    onPrimary = Color.Black,
    primaryContainer = OledColors.PrimaryContainer,
    onPrimaryContainer = OledColors.Primary,

    // Secondary
    secondary = OledColors.Secondary,
    onSecondary = Color.Black,
    secondaryContainer = OledColors.SecondaryContainer,
    onSecondaryContainer = OledColors.Secondary,

    // Tertiary
    tertiary = OledColors.Tertiary,
    onTertiary = Color.Black,
    tertiaryContainer = OledColors.TertiaryContainer,
    onTertiaryContainer = OledColors.Tertiary,

    // Error
    error = OledColors.Error,
    onError = OledColors.OnError,
    errorContainer = OledColors.ErrorContainer,
    onErrorContainer = OledColors.Error,

    // Background & Surface - PRETO PURO
    background = OledColors.PureBlack,
    onBackground = OledColors.OnSurface,
    surface = OledColors.PureBlack,
    onSurface = OledColors.OnSurface,
    surfaceVariant = OledColors.SurfaceContainer,
    onSurfaceVariant = OledColors.OnSurfaceVariant,

    // Surface containers
    surfaceDim = OledColors.PureBlack,
    surfaceBright = OledColors.SurfaceContainerHigh,
    surfaceContainerLowest = OledColors.PureBlack,
    surfaceContainerLow = OledColors.SurfaceDark,
    surfaceContainer = OledColors.SurfaceContainer,
    surfaceContainerHigh = OledColors.SurfaceContainerHigh,
    surfaceContainerHighest = OledColors.SurfaceContainerHighest,

    // Outline
    outline = OledColors.Outline,
    outlineVariant = OledColors.OutlineVariant,

    // Inverse
    inverseSurface = OledColors.OnSurface,
    inverseOnSurface = OledColors.PureBlack,
    inversePrimary = OledColors.PrimaryContainer,

    // Scrim
    scrim = Color.Black
)

// ==================== Theme Composable ====================

/**
 * Tema OLED que substitui o tema dark padrão.
 */
@Composable
fun OledTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = OledDarkColorScheme,
        typography = MaterialTheme.typography,
        shapes = MaterialTheme.shapes,
        content = content
    )
}

/**
 * Verifica se o dispositivo tem tela OLED/AMOLED.
 * Heurística simples - em produção, pode usar APIs específicas do fabricante.
 */
fun isOledScreen(): Boolean {
    // Dispositivos conhecidos com OLED
    val oledManufacturers = listOf(
        "samsung",
        "google",
        "oneplus",
        "oppo",
        "vivo",
        "xiaomi",
        "huawei"
    )

    val manufacturer = Build.MANUFACTURER.lowercase()
    val model = Build.MODEL.lowercase()

    // Samsung Galaxy S e Note series geralmente são OLED
    if (manufacturer == "samsung" && (model.contains("sm-g") || model.contains("sm-n"))) {
        return true
    }

    // Google Pixel 2+ são OLED
    if (manufacturer == "google" && model.contains("pixel")) {
        return true
    }

    // Heurística genérica para flagships recentes
    return oledManufacturers.any { manufacturer.contains(it) } &&
           Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
}

// ==================== Helper Functions ====================

/**
 * Retorna o ColorScheme apropriado baseado nas preferências.
 */
@Composable
fun getOptimalDarkColorScheme(
    preferOled: Boolean = false,
    forceOled: Boolean = false
): ColorScheme {
    return when {
        forceOled -> OledDarkColorScheme
        preferOled && isOledScreen() -> OledDarkColorScheme
        else -> darkColorScheme() // Dark theme padrão
    }
}

/**
 * Extensão para verificar se está usando tema OLED.
 */
@Composable
fun isUsingOledTheme(): Boolean {
    val background = MaterialTheme.colorScheme.background
    return background == OledColors.PureBlack
}

// ==================== Color Extensions ====================

/**
 * Ajusta cor para melhor visibilidade em fundo OLED.
 */
fun Color.adjustForOled(): Color {
    // Aumenta levemente a luminosidade para melhor contraste em preto puro
    val hsv = FloatArray(3)
    android.graphics.Color.RGBToHSV(
        (red * 255).toInt(),
        (green * 255).toInt(),
        (blue * 255).toInt(),
        hsv
    )

    // Aumenta value (brilho) em 10%
    hsv[2] = (hsv[2] * 1.1f).coerceAtMost(1f)

    val adjusted = android.graphics.Color.HSVToColor(hsv)
    return Color(adjusted)
}

/**
 * Retorna versão mais suave de uma cor para texto em OLED.
 * Evita "bleeding" de cores muito vibrantes em preto puro.
 */
fun Color.softenForOled(): Color {
    return copy(
        red = red * 0.95f,
        green = green * 0.95f,
        blue = blue * 0.95f
    )
}
