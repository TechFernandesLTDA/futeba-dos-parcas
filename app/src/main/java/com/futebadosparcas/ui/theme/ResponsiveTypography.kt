package com.futebadosparcas.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Sistema de tipografia responsiva que adapta tamanhos de fonte
 * baseado no tamanho da tela e preferências do usuário
 */

/**
 * Escala de tipografia baseada no tamanho da tela
 */
enum class TypographyScale {
    COMPACT,    // Telas pequenas (celulares compactos)
    MEDIUM,     // Telas médias (celulares normais)
    EXPANDED    // Telas grandes (tablets, desktops)
}

/**
 * Dimensões responsivas para textos
 */
data class ResponsiveTextDimens(
    // Display
    val displayLarge: TextUnit,
    val displayMedium: TextUnit,
    val displaySmall: TextUnit,

    // Headline
    val headlineLarge: TextUnit,
    val headlineMedium: TextUnit,
    val headlineSmall: TextUnit,

    // Title
    val titleLarge: TextUnit,
    val titleMedium: TextUnit,
    val titleSmall: TextUnit,

    // Body
    val bodyLarge: TextUnit,
    val bodyMedium: TextUnit,
    val bodySmall: TextUnit,

    // Label
    val labelLarge: TextUnit,
    val labelMedium: TextUnit,
    val labelSmall: TextUnit
)

/**
 * Dimensões para telas compactas (width < 360dp)
 */
val CompactTextDimens = ResponsiveTextDimens(
    displayLarge = 52.sp,
    displayMedium = 40.sp,
    displaySmall = 32.sp,
    headlineLarge = 28.sp,
    headlineMedium = 24.sp,
    headlineSmall = 20.sp,
    titleLarge = 18.sp,
    titleMedium = 14.sp,
    titleSmall = 12.sp,
    bodyLarge = 14.sp,
    bodyMedium = 12.sp,
    bodySmall = 11.sp,
    labelLarge = 12.sp,
    labelMedium = 11.sp,
    labelSmall = 10.sp
)

/**
 * Dimensões para telas médias (360dp - 600dp)
 */
val MediumTextDimens = ResponsiveTextDimens(
    displayLarge = 57.sp,
    displayMedium = 45.sp,
    displaySmall = 36.sp,
    headlineLarge = 32.sp,
    headlineMedium = 28.sp,
    headlineSmall = 24.sp,
    titleLarge = 22.sp,
    titleMedium = 16.sp,
    titleSmall = 14.sp,
    bodyLarge = 16.sp,
    bodyMedium = 14.sp,
    bodySmall = 12.sp,
    labelLarge = 14.sp,
    labelMedium = 12.sp,
    labelSmall = 11.sp
)

/**
 * Dimensões para telas expandidas (width >= 600dp)
 */
val ExpandedTextDimens = ResponsiveTextDimens(
    displayLarge = 64.sp,
    displayMedium = 52.sp,
    displaySmall = 44.sp,
    headlineLarge = 40.sp,
    headlineMedium = 36.sp,
    headlineSmall = 32.sp,
    titleLarge = 28.sp,
    titleMedium = 20.sp,
    titleSmall = 18.sp,
    bodyLarge = 18.sp,
    bodyMedium = 16.sp,
    bodySmall = 14.sp,
    labelLarge = 16.sp,
    labelMedium = 14.sp,
    labelSmall = 12.sp
)

/**
 * CompositionLocal para acessar dimensões responsivas
 */
val LocalResponsiveTextDimens = staticCompositionLocalOf {
    MediumTextDimens
}

/**
 * Determina a escala de tipografia baseada na largura da tela
 */
@Composable
fun rememberTypographyScale(): TypographyScale {
    val configuration = LocalConfiguration.current
    val screenWidthDp = configuration.screenWidthDp

    return when {
        screenWidthDp < 360 -> TypographyScale.COMPACT
        screenWidthDp >= 600 -> TypographyScale.EXPANDED
        else -> TypographyScale.MEDIUM
    }
}

/**
 * Obtém dimensões de texto apropriadas para a escala
 */
fun getResponsiveTextDimens(scale: TypographyScale): ResponsiveTextDimens {
    return when (scale) {
        TypographyScale.COMPACT -> CompactTextDimens
        TypographyScale.MEDIUM -> MediumTextDimens
        TypographyScale.EXPANDED -> ExpandedTextDimens
    }
}

/**
 * Cria Typography responsiva baseada nas dimensões
 */
fun createResponsiveTypography(dimens: ResponsiveTextDimens): Typography {
    return Typography(
        displayLarge = TextStyle(
            fontWeight = FontWeight.Normal,
            fontSize = dimens.displayLarge,
            lineHeight = dimens.displayLarge * 1.12f,
            letterSpacing = (-0.25).sp
        ),
        displayMedium = TextStyle(
            fontWeight = FontWeight.Normal,
            fontSize = dimens.displayMedium,
            lineHeight = dimens.displayMedium * 1.16f,
            letterSpacing = 0.sp
        ),
        displaySmall = TextStyle(
            fontWeight = FontWeight.Normal,
            fontSize = dimens.displaySmall,
            lineHeight = dimens.displaySmall * 1.22f,
            letterSpacing = 0.sp
        ),
        headlineLarge = TextStyle(
            fontWeight = FontWeight.SemiBold,
            fontSize = dimens.headlineLarge,
            lineHeight = dimens.headlineLarge * 1.25f,
            letterSpacing = 0.sp
        ),
        headlineMedium = TextStyle(
            fontWeight = FontWeight.SemiBold,
            fontSize = dimens.headlineMedium,
            lineHeight = dimens.headlineMedium * 1.29f,
            letterSpacing = 0.sp
        ),
        headlineSmall = TextStyle(
            fontWeight = FontWeight.SemiBold,
            fontSize = dimens.headlineSmall,
            lineHeight = dimens.headlineSmall * 1.33f,
            letterSpacing = 0.sp
        ),
        titleLarge = TextStyle(
            fontWeight = FontWeight.SemiBold,
            fontSize = dimens.titleLarge,
            lineHeight = dimens.titleLarge * 1.27f,
            letterSpacing = 0.sp
        ),
        titleMedium = TextStyle(
            fontWeight = FontWeight.SemiBold,
            fontSize = dimens.titleMedium,
            lineHeight = dimens.titleMedium * 1.5f,
            letterSpacing = 0.15.sp
        ),
        titleSmall = TextStyle(
            fontWeight = FontWeight.Bold,
            fontSize = dimens.titleSmall,
            lineHeight = dimens.titleSmall * 1.43f,
            letterSpacing = 0.1.sp
        ),
        bodyLarge = TextStyle(
            fontWeight = FontWeight.Normal,
            fontSize = dimens.bodyLarge,
            lineHeight = dimens.bodyLarge * 1.5f,
            letterSpacing = 0.15.sp
        ),
        bodyMedium = TextStyle(
            fontWeight = FontWeight.Normal,
            fontSize = dimens.bodyMedium,
            lineHeight = dimens.bodyMedium * 1.43f,
            letterSpacing = 0.25.sp
        ),
        bodySmall = TextStyle(
            fontWeight = FontWeight.Normal,
            fontSize = dimens.bodySmall,
            lineHeight = dimens.bodySmall * 1.33f,
            letterSpacing = 0.4.sp
        ),
        labelLarge = TextStyle(
            fontWeight = FontWeight.SemiBold,
            fontSize = dimens.labelLarge,
            lineHeight = dimens.labelLarge * 1.43f,
            letterSpacing = 0.1.sp
        ),
        labelMedium = TextStyle(
            fontWeight = FontWeight.SemiBold,
            fontSize = dimens.labelMedium,
            lineHeight = dimens.labelMedium * 1.33f,
            letterSpacing = 0.5.sp
        ),
        labelSmall = TextStyle(
            fontWeight = FontWeight.SemiBold,
            fontSize = dimens.labelSmall,
            lineHeight = dimens.labelSmall * 1.45f,
            letterSpacing = 0.5.sp
        )
    )
}

/**
 * Provider para tipografia responsiva
 */
@Composable
fun ResponsiveTypographyProvider(
    content: @Composable () -> Unit
) {
    val scale = rememberTypographyScale()
    val dimens = getResponsiveTextDimens(scale)

    CompositionLocalProvider(
        LocalResponsiveTextDimens provides dimens,
        content = content
    )
}

/**
 * Extensões para obter tamanhos de texto responsivos
 */
object ResponsiveText {

    /**
     * Obtém dimensões responsivas atuais
     */
    val dimens: ResponsiveTextDimens
        @Composable
        @ReadOnlyComposable
        get() = LocalResponsiveTextDimens.current

    /**
     * Calcula tamanho de texto adaptativo baseado na densidade
     */
    @Composable
    fun adaptiveTextSize(
        baseSize: TextUnit,
        minSize: TextUnit = (baseSize.value * 0.8f).sp,
        maxSize: TextUnit = (baseSize.value * 1.2f).sp
    ): TextUnit {
        val density = LocalDensity.current
        val configuration = LocalConfiguration.current

        // Fator de escala baseado no fontScale do sistema
        val fontScale = configuration.fontScale

        // Calcula tamanho ajustado
        val scaledSize = baseSize.value * fontScale

        // Aplica limites
        return scaledSize.coerceIn(minSize.value, maxSize.value).sp
    }
}

/**
 * Helpers para tamanhos específicos de gamificação
 */
object GamificationTextSizes {

    /**
     * Tamanho grande para XP/pontuação em destaque
     */
    @Composable
    fun xpLarge(): TextUnit {
        val scale = rememberTypographyScale()
        return when (scale) {
            TypographyScale.COMPACT -> 28.sp
            TypographyScale.MEDIUM -> 32.sp
            TypographyScale.EXPANDED -> 40.sp
        }
    }

    /**
     * Tamanho para rankings/posições
     */
    @Composable
    fun rankingPosition(): TextUnit {
        val scale = rememberTypographyScale()
        return when (scale) {
            TypographyScale.COMPACT -> 20.sp
            TypographyScale.MEDIUM -> 24.sp
            TypographyScale.EXPANDED -> 28.sp
        }
    }

    /**
     * Tamanho para estatísticas
     */
    @Composable
    fun statValue(): TextUnit {
        val scale = rememberTypographyScale()
        return when (scale) {
            TypographyScale.COMPACT -> 18.sp
            TypographyScale.MEDIUM -> 22.sp
            TypographyScale.EXPANDED -> 26.sp
        }
    }

    /**
     * Tamanho para badges
     */
    @Composable
    fun badgeText(): TextUnit {
        val scale = rememberTypographyScale()
        return when (scale) {
            TypographyScale.COMPACT -> 10.sp
            TypographyScale.MEDIUM -> 11.sp
            TypographyScale.EXPANDED -> 12.sp
        }
    }

    /**
     * Tamanho para placar ao vivo
     */
    @Composable
    fun liveScore(): TextUnit {
        val scale = rememberTypographyScale()
        return when (scale) {
            TypographyScale.COMPACT -> 48.sp
            TypographyScale.MEDIUM -> 64.sp
            TypographyScale.EXPANDED -> 80.sp
        }
    }

    /**
     * Tamanho para timer de jogo
     */
    @Composable
    fun gameTimer(): TextUnit {
        val scale = rememberTypographyScale()
        return when (scale) {
            TypographyScale.COMPACT -> 24.sp
            TypographyScale.MEDIUM -> 28.sp
            TypographyScale.EXPANDED -> 36.sp
        }
    }
}
