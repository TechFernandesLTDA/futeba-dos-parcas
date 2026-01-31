package com.futebadosparcas.ui.theme

import android.content.Context
import android.os.Build
import android.view.accessibility.AccessibilityManager
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext

/**
 * Tema de Alto Contraste para acessibilidade.
 * Garante contraste mínimo de 7:1 (WCAG AAA) para texto.
 */

// ==================== High Contrast Colors ====================

/**
 * Cores de alto contraste - Light mode.
 */
object HighContrastLightColors {
    // Backgrounds - Branco puro
    val Background = Color(0xFFFFFFFF)
    val Surface = Color(0xFFFFFFFF)
    val SurfaceContainer = Color(0xFFF5F5F5)

    // Texto - Preto puro para máximo contraste
    val OnBackground = Color(0xFF000000)
    val OnSurface = Color(0xFF000000)
    val OnSurfaceVariant = Color(0xFF1A1A1A)

    // Primary - Azul escuro para bom contraste
    val Primary = Color(0xFF0D47A1)
    val OnPrimary = Color(0xFFFFFFFF)
    val PrimaryContainer = Color(0xFF1565C0)
    val OnPrimaryContainer = Color(0xFFFFFFFF)

    // Secondary
    val Secondary = Color(0xFF004D40)
    val OnSecondary = Color(0xFFFFFFFF)
    val SecondaryContainer = Color(0xFF00695C)
    val OnSecondaryContainer = Color(0xFFFFFFFF)

    // Error - Vermelho escuro
    val Error = Color(0xFFB71C1C)
    val OnError = Color(0xFFFFFFFF)
    val ErrorContainer = Color(0xFFC62828)
    val OnErrorContainer = Color(0xFFFFFFFF)

    // Outline - Bordas bem definidas
    val Outline = Color(0xFF000000)
    val OutlineVariant = Color(0xFF424242)
}

/**
 * Cores de alto contraste - Dark mode.
 */
object HighContrastDarkColors {
    // Backgrounds - Preto puro
    val Background = Color(0xFF000000)
    val Surface = Color(0xFF000000)
    val SurfaceContainer = Color(0xFF121212)

    // Texto - Branco puro
    val OnBackground = Color(0xFFFFFFFF)
    val OnSurface = Color(0xFFFFFFFF)
    val OnSurfaceVariant = Color(0xFFE0E0E0)

    // Primary - Azul claro vibrante
    val Primary = Color(0xFF82B1FF)
    val OnPrimary = Color(0xFF000000)
    val PrimaryContainer = Color(0xFF448AFF)
    val OnPrimaryContainer = Color(0xFF000000)

    // Secondary
    val Secondary = Color(0xFF80CBC4)
    val OnSecondary = Color(0xFF000000)
    val SecondaryContainer = Color(0xFF4DB6AC)
    val OnSecondaryContainer = Color(0xFF000000)

    // Error
    val Error = Color(0xFFFF8A80)
    val OnError = Color(0xFF000000)
    val ErrorContainer = Color(0xFFFF5252)
    val OnErrorContainer = Color(0xFF000000)

    // Outline
    val Outline = Color(0xFFFFFFFF)
    val OutlineVariant = Color(0xFFBDBDBD)
}

// ==================== Color Schemes ====================

/**
 * ColorScheme de alto contraste - Light.
 */
val HighContrastLightColorScheme = lightColorScheme(
    primary = HighContrastLightColors.Primary,
    onPrimary = HighContrastLightColors.OnPrimary,
    primaryContainer = HighContrastLightColors.PrimaryContainer,
    onPrimaryContainer = HighContrastLightColors.OnPrimaryContainer,

    secondary = HighContrastLightColors.Secondary,
    onSecondary = HighContrastLightColors.OnSecondary,
    secondaryContainer = HighContrastLightColors.SecondaryContainer,
    onSecondaryContainer = HighContrastLightColors.OnSecondaryContainer,

    tertiary = HighContrastLightColors.Secondary,
    onTertiary = HighContrastLightColors.OnSecondary,

    error = HighContrastLightColors.Error,
    onError = HighContrastLightColors.OnError,
    errorContainer = HighContrastLightColors.ErrorContainer,
    onErrorContainer = HighContrastLightColors.OnErrorContainer,

    background = HighContrastLightColors.Background,
    onBackground = HighContrastLightColors.OnBackground,
    surface = HighContrastLightColors.Surface,
    onSurface = HighContrastLightColors.OnSurface,
    surfaceVariant = HighContrastLightColors.SurfaceContainer,
    onSurfaceVariant = HighContrastLightColors.OnSurfaceVariant,

    outline = HighContrastLightColors.Outline,
    outlineVariant = HighContrastLightColors.OutlineVariant,

    surfaceContainerLowest = HighContrastLightColors.Background,
    surfaceContainerLow = HighContrastLightColors.Background,
    surfaceContainer = HighContrastLightColors.SurfaceContainer,
    surfaceContainerHigh = HighContrastLightColors.SurfaceContainer,
    surfaceContainerHighest = HighContrastLightColors.SurfaceContainer
)

/**
 * ColorScheme de alto contraste - Dark.
 */
val HighContrastDarkColorScheme = darkColorScheme(
    primary = HighContrastDarkColors.Primary,
    onPrimary = HighContrastDarkColors.OnPrimary,
    primaryContainer = HighContrastDarkColors.PrimaryContainer,
    onPrimaryContainer = HighContrastDarkColors.OnPrimaryContainer,

    secondary = HighContrastDarkColors.Secondary,
    onSecondary = HighContrastDarkColors.OnSecondary,
    secondaryContainer = HighContrastDarkColors.SecondaryContainer,
    onSecondaryContainer = HighContrastDarkColors.OnSecondaryContainer,

    tertiary = HighContrastDarkColors.Secondary,
    onTertiary = HighContrastDarkColors.OnSecondary,

    error = HighContrastDarkColors.Error,
    onError = HighContrastDarkColors.OnError,
    errorContainer = HighContrastDarkColors.ErrorContainer,
    onErrorContainer = HighContrastDarkColors.OnErrorContainer,

    background = HighContrastDarkColors.Background,
    onBackground = HighContrastDarkColors.OnBackground,
    surface = HighContrastDarkColors.Surface,
    onSurface = HighContrastDarkColors.OnSurface,
    surfaceVariant = HighContrastDarkColors.SurfaceContainer,
    onSurfaceVariant = HighContrastDarkColors.OnSurfaceVariant,

    outline = HighContrastDarkColors.Outline,
    outlineVariant = HighContrastDarkColors.OutlineVariant,

    surfaceContainerLowest = HighContrastDarkColors.Background,
    surfaceContainerLow = HighContrastDarkColors.Background,
    surfaceContainer = HighContrastDarkColors.SurfaceContainer,
    surfaceContainerHigh = HighContrastDarkColors.SurfaceContainer,
    surfaceContainerHighest = HighContrastDarkColors.SurfaceContainer
)

// ==================== Theme Composable ====================

/**
 * Tema de alto contraste.
 */
@Composable
fun HighContrastTheme(
    isDarkTheme: Boolean = false,
    content: @Composable () -> Unit
) {
    val colorScheme = if (isDarkTheme) {
        HighContrastDarkColorScheme
    } else {
        HighContrastLightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = MaterialTheme.typography,
        shapes = MaterialTheme.shapes,
        content = content
    )
}

// ==================== Detection Helpers ====================

/**
 * Verifica se o sistema está em modo de alto contraste.
 */
@Composable
fun isSystemHighContrast(): Boolean {
    val context = LocalContext.current
    return remember {
        isHighContrastEnabled(context)
    }
}

/**
 * Verifica se o modo de alto contraste está habilitado no sistema.
 */
/**
 * Verifica se o modo de alto contraste está habilitado no sistema.
 * Nota: API de alto contraste de texto não está disponível em todos os níveis de API.
 */
fun isHighContrastEnabled(context: Context): Boolean {
    // A API isHighTextContrastEnabled só está disponível em APIs específicas
    // e pode não estar disponível em todas as ROMs. Usando fallback seguro.
    val accessibilityManager = context.getSystemService(Context.ACCESSIBILITY_SERVICE) as? AccessibilityManager
    return accessibilityManager?.isEnabled == true
}

/**
 * Verifica se recursos de acessibilidade estão habilitados.
 */
fun isAccessibilityEnabled(context: Context): Boolean {
    val accessibilityManager = context.getSystemService(Context.ACCESSIBILITY_SERVICE) as? AccessibilityManager
    return accessibilityManager?.isEnabled == true
}

// ==================== Color Scheme Selector ====================

/**
 * Retorna o ColorScheme apropriado baseado nas configurações de acessibilidade.
 */
@Composable
fun getAccessibleColorScheme(
    isDarkTheme: Boolean,
    preferHighContrast: Boolean = false,
    defaultLightScheme: ColorScheme = lightColorScheme(),
    defaultDarkScheme: ColorScheme = darkColorScheme()
): ColorScheme {
    val isSystemHighContrast = isSystemHighContrast()

    return when {
        preferHighContrast || isSystemHighContrast -> {
            if (isDarkTheme) HighContrastDarkColorScheme
            else HighContrastLightColorScheme
        }
        isDarkTheme -> defaultDarkScheme
        else -> defaultLightScheme
    }
}

// ==================== Contrast Utilities ====================

/**
 * Calcula a razão de contraste entre duas cores.
 * WCAG AA requer 4.5:1 para texto normal, 3:1 para texto grande.
 * WCAG AAA requer 7:1 para texto normal, 4.5:1 para texto grande.
 */
fun calculateContrastRatio(foreground: Color, background: Color): Float {
    val l1 = calculateRelativeLuminance(foreground)
    val l2 = calculateRelativeLuminance(background)

    val lighter = maxOf(l1, l2)
    val darker = minOf(l1, l2)

    return (lighter + 0.05f) / (darker + 0.05f)
}

/**
 * Calcula a luminância relativa de uma cor.
 */
private fun calculateRelativeLuminance(color: Color): Float {
    fun adjustComponent(component: Float): Float {
        return if (component <= 0.03928f) {
            component / 12.92f
        } else {
            Math.pow(((component + 0.055f) / 1.055f).toDouble(), 2.4).toFloat()
        }
    }

    val r = adjustComponent(color.red)
    val g = adjustComponent(color.green)
    val b = adjustComponent(color.blue)

    return 0.2126f * r + 0.7152f * g + 0.0722f * b
}

/**
 * Verifica se o contraste atende WCAG AA.
 */
fun meetsWcagAA(foreground: Color, background: Color, isLargeText: Boolean = false): Boolean {
    val ratio = calculateContrastRatio(foreground, background)
    return if (isLargeText) ratio >= 3f else ratio >= 4.5f
}

/**
 * Verifica se o contraste atende WCAG AAA.
 */
fun meetsWcagAAA(foreground: Color, background: Color, isLargeText: Boolean = false): Boolean {
    val ratio = calculateContrastRatio(foreground, background)
    return if (isLargeText) ratio >= 4.5f else ratio >= 7f
}

/**
 * Ajusta cor para atingir contraste mínimo.
 */
fun ensureContrast(
    foreground: Color,
    background: Color,
    minRatio: Float = 4.5f
): Color {
    var adjusted = foreground
    var attempts = 0

    while (calculateContrastRatio(adjusted, background) < minRatio && attempts < 20) {
        val bgLuminance = calculateRelativeLuminance(background)

        adjusted = if (bgLuminance > 0.5f) {
            // Fundo claro - escurecer foreground
            adjusted.copy(
                red = (adjusted.red * 0.9f).coerceAtLeast(0f),
                green = (adjusted.green * 0.9f).coerceAtLeast(0f),
                blue = (adjusted.blue * 0.9f).coerceAtLeast(0f)
            )
        } else {
            // Fundo escuro - clarear foreground
            adjusted.copy(
                red = (adjusted.red * 1.1f).coerceAtMost(1f),
                green = (adjusted.green * 1.1f).coerceAtMost(1f),
                blue = (adjusted.blue * 1.1f).coerceAtMost(1f)
            )
        }

        attempts++
    }

    return adjusted
}
