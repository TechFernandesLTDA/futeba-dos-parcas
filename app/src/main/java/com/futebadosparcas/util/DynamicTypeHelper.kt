package com.futebadosparcas.util

import android.content.Context
import android.content.res.Configuration
import androidx.compose.material3.Typography
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp

/**
 * Helper para Tamanho de Fonte Dinâmico.
 * Respeita as configurações de acessibilidade do sistema e oferece
 * ajustes adicionais para a aplicação.
 */

// ==================== Models ====================

/**
 * Escala de fonte configurada pelo usuário.
 */
enum class FontScalePreference {
    SYSTEM,         // Usa escala do sistema
    SMALL,          // 0.85x
    NORMAL,         // 1.0x
    LARGE,          // 1.15x
    EXTRA_LARGE     // 1.3x
}

/**
 * Configuração de tipografia dinâmica.
 */
data class DynamicTypeConfig(
    val fontScalePreference: FontScalePreference = FontScalePreference.SYSTEM,
    val respectSystemScale: Boolean = true,
    val maxScale: Float = 2.0f,             // Limite máximo de escala
    val minScale: Float = 0.8f,             // Limite mínimo de escala
    val lineHeightMultiplier: Float = 1.2f  // Aumenta line height proporcionalmente
)

// ==================== Scale Calculator ====================

/**
 * Calcula a escala de fonte efetiva.
 */
object FontScaleCalculator {

    /**
     * Obtém a escala do sistema.
     */
    fun getSystemFontScale(context: Context): Float {
        return context.resources.configuration.fontScale
    }

    /**
     * Calcula escala efetiva baseada nas preferências.
     */
    fun calculateEffectiveScale(
        systemScale: Float,
        preference: FontScalePreference,
        config: DynamicTypeConfig
    ): Float {
        val baseScale = when (preference) {
            FontScalePreference.SYSTEM -> systemScale
            FontScalePreference.SMALL -> 0.85f
            FontScalePreference.NORMAL -> 1.0f
            FontScalePreference.LARGE -> 1.15f
            FontScalePreference.EXTRA_LARGE -> 1.3f
        }

        // Aplica escala do sistema se habilitado
        val finalScale = if (config.respectSystemScale && preference != FontScalePreference.SYSTEM) {
            baseScale * systemScale
        } else {
            baseScale
        }

        // Aplica limites
        return finalScale.coerceIn(config.minScale, config.maxScale)
    }
}

// ==================== Dynamic Type Helper ====================

/**
 * Helper principal para tipografia dinâmica.
 */
class DynamicTypeHelper(
    private val config: DynamicTypeConfig = DynamicTypeConfig()
) {
    /**
     * Escala um tamanho de texto.
     */
    fun scaleTextSize(baseSize: TextUnit, scale: Float): TextUnit {
        return (baseSize.value * scale).sp
    }

    /**
     * Calcula line height proporcional.
     */
    fun calculateLineHeight(fontSize: TextUnit, scale: Float): TextUnit {
        return (fontSize.value * config.lineHeightMultiplier * scale).sp
    }

    /**
     * Cria TextStyle escalado.
     */
    fun scaleTextStyle(style: TextStyle, scale: Float): TextStyle {
        return style.copy(
            fontSize = scaleTextSize(style.fontSize, scale),
            lineHeight = calculateLineHeight(style.fontSize, scale)
        )
    }

    /**
     * Cria Typography escalada.
     */
    fun createScaledTypography(baseTypography: Typography, scale: Float): Typography {
        return Typography(
            displayLarge = scaleTextStyle(baseTypography.displayLarge, scale),
            displayMedium = scaleTextStyle(baseTypography.displayMedium, scale),
            displaySmall = scaleTextStyle(baseTypography.displaySmall, scale),
            headlineLarge = scaleTextStyle(baseTypography.headlineLarge, scale),
            headlineMedium = scaleTextStyle(baseTypography.headlineMedium, scale),
            headlineSmall = scaleTextStyle(baseTypography.headlineSmall, scale),
            titleLarge = scaleTextStyle(baseTypography.titleLarge, scale),
            titleMedium = scaleTextStyle(baseTypography.titleMedium, scale),
            titleSmall = scaleTextStyle(baseTypography.titleSmall, scale),
            bodyLarge = scaleTextStyle(baseTypography.bodyLarge, scale),
            bodyMedium = scaleTextStyle(baseTypography.bodyMedium, scale),
            bodySmall = scaleTextStyle(baseTypography.bodySmall, scale),
            labelLarge = scaleTextStyle(baseTypography.labelLarge, scale),
            labelMedium = scaleTextStyle(baseTypography.labelMedium, scale),
            labelSmall = scaleTextStyle(baseTypography.labelSmall, scale)
        )
    }
}

// ==================== Composable Helpers ====================

/**
 * Remember da escala de fonte atual.
 */
@Composable
fun rememberFontScale(
    preference: FontScalePreference = FontScalePreference.SYSTEM,
    config: DynamicTypeConfig = DynamicTypeConfig()
): Float {
    val configuration = LocalConfiguration.current
    val systemScale = configuration.fontScale

    return remember(systemScale, preference, config) {
        FontScaleCalculator.calculateEffectiveScale(systemScale, preference, config)
    }
}

/**
 * Remember de Typography escalada.
 */
@Composable
fun rememberScaledTypography(
    baseTypography: Typography,
    preference: FontScalePreference = FontScalePreference.SYSTEM,
    config: DynamicTypeConfig = DynamicTypeConfig()
): Typography {
    val scale = rememberFontScale(preference, config)
    val helper = remember { DynamicTypeHelper(config) }

    return remember(scale, baseTypography) {
        helper.createScaledTypography(baseTypography, scale)
    }
}

/**
 * Escala um TextUnit baseado nas configurações atuais.
 */
@Composable
fun TextUnit.scaled(
    preference: FontScalePreference = FontScalePreference.SYSTEM
): TextUnit {
    val scale = rememberFontScale(preference)
    return (this.value * scale).sp
}

/**
 * Verifica se a fonte está em escala grande.
 */
@Composable
fun isLargeFontScale(): Boolean {
    val configuration = LocalConfiguration.current
    return configuration.fontScale > 1.2f
}

/**
 * Verifica se a fonte está em escala extra grande.
 */
@Composable
fun isExtraLargeFontScale(): Boolean {
    val configuration = LocalConfiguration.current
    return configuration.fontScale > 1.5f
}

// ==================== Accessibility Helpers ====================

/**
 * Retorna tamanho de fonte mínimo acessível baseado no contexto.
 */
@Composable
fun getAccessibleMinFontSize(): TextUnit {
    return if (isLargeFontScale()) 14.sp else 12.sp
}

/**
 * Retorna tamanho de fonte para texto de corpo acessível.
 */
@Composable
fun getAccessibleBodyFontSize(): TextUnit {
    val configuration = LocalConfiguration.current
    val scale = configuration.fontScale

    return when {
        scale >= 1.5f -> 18.sp
        scale >= 1.3f -> 17.sp
        scale >= 1.15f -> 16.sp
        else -> 14.sp
    }
}

/**
 * Ajusta padding/spacing baseado na escala de fonte.
 */
@Composable
fun getScaledSpacing(baseSpacing: Float): Float {
    val configuration = LocalConfiguration.current
    val scale = configuration.fontScale

    // Aumenta espaçamento proporcionalmente para fontes maiores
    return when {
        scale >= 1.5f -> baseSpacing * 1.4f
        scale >= 1.3f -> baseSpacing * 1.2f
        scale >= 1.15f -> baseSpacing * 1.1f
        else -> baseSpacing
    }
}

// ==================== Text Size Utilities ====================

/**
 * Tamanhos de texto predefinidos que respeitam escala.
 */
object ScalableTextSizes {

    @Composable
    fun tiny(): TextUnit = 10.sp.scaled()

    @Composable
    fun small(): TextUnit = 12.sp.scaled()

    @Composable
    fun normal(): TextUnit = 14.sp.scaled()

    @Composable
    fun medium(): TextUnit = 16.sp.scaled()

    @Composable
    fun large(): TextUnit = 18.sp.scaled()

    @Composable
    fun extraLarge(): TextUnit = 22.sp.scaled()

    @Composable
    fun huge(): TextUnit = 28.sp.scaled()
}
