package com.futebadosparcas.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.material3.MaterialTheme

/**
 * Gradientes sutis para a aplicação.
 * Adiciona profundidade visual sem distrair do conteúdo.
 */

// ==================== Gradient Colors ====================

object GradientColors {
    // Gradientes primários
    val PrimaryStart = Color(0xFF1E88E5)
    val PrimaryEnd = Color(0xFF1565C0)

    // Gradientes secundários
    val SecondaryStart = Color(0xFF26A69A)
    val SecondaryEnd = Color(0xFF00897B)

    // Gradientes de gamificação
    val GoldStart = Color(0xFFFFD700)
    val GoldMid = Color(0xFFFFA500)
    val GoldEnd = Color(0xFFFF8C00)

    val SilverStart = Color(0xFFF5F5F5)
    val SilverMid = Color(0xFFE0E0E0)
    val SilverEnd = Color(0xFFBDBDBD)

    val BronzeStart = Color(0xFFCD7F32)
    val BronzeMid = Color(0xFFB87333)
    val BronzeEnd = Color(0xFF8B4513)

    val DiamondStart = Color(0xFFE0F7FA)
    val DiamondMid = Color(0xFFB2EBF2)
    val DiamondEnd = Color(0xFF80DEEA)

    // Gradientes de status
    val SuccessStart = Color(0xFF81C784)
    val SuccessEnd = Color(0xFF4CAF50)

    val WarningStart = Color(0xFFFFD54F)
    val WarningEnd = Color(0xFFFFC107)

    val ErrorStart = Color(0xFFE57373)
    val ErrorEnd = Color(0xFFF44336)

    // Gradientes para XP/Level
    val XpStart = Color(0xFF7C4DFF)
    val XpMid = Color(0xFF651FFF)
    val XpEnd = Color(0xFF6200EA)

    // Gradientes de fundo sutis
    val SurfaceLight = Color(0xFFFAFAFA)
    val SurfaceMedium = Color(0xFFF5F5F5)

    // Dark mode gradients
    val DarkSurfaceStart = Color(0xFF1A1A2E)
    val DarkSurfaceEnd = Color(0xFF16213E)
}

// ==================== Predefined Gradients ====================

/**
 * Gradientes predefinidos para uso comum.
 */
object AppGradients {

    // ==================== Linear Gradients ====================

    /**
     * Gradiente primário horizontal.
     */
    val primaryHorizontal: Brush
        get() = Brush.horizontalGradient(
            colors = listOf(GradientColors.PrimaryStart, GradientColors.PrimaryEnd)
        )

    /**
     * Gradiente primário vertical.
     */
    val primaryVertical: Brush
        get() = Brush.verticalGradient(
            colors = listOf(GradientColors.PrimaryStart, GradientColors.PrimaryEnd)
        )

    /**
     * Gradiente secundário.
     */
    val secondaryGradient: Brush
        get() = Brush.linearGradient(
            colors = listOf(GradientColors.SecondaryStart, GradientColors.SecondaryEnd)
        )

    /**
     * Gradiente de XP/Level.
     */
    val xpGradient: Brush
        get() = Brush.linearGradient(
            colors = listOf(GradientColors.XpStart, GradientColors.XpMid, GradientColors.XpEnd)
        )

    /**
     * Gradiente de sucesso.
     */
    val successGradient: Brush
        get() = Brush.horizontalGradient(
            colors = listOf(GradientColors.SuccessStart, GradientColors.SuccessEnd)
        )

    /**
     * Gradiente de erro.
     */
    val errorGradient: Brush
        get() = Brush.horizontalGradient(
            colors = listOf(GradientColors.ErrorStart, GradientColors.ErrorEnd)
        )

    // ==================== Medal Gradients ====================

    /**
     * Gradiente dourado (1º lugar).
     */
    val goldGradient: Brush
        get() = Brush.linearGradient(
            colors = listOf(
                GradientColors.GoldStart,
                GradientColors.GoldMid,
                GradientColors.GoldEnd
            )
        )

    /**
     * Gradiente prateado (2º lugar).
     */
    val silverGradient: Brush
        get() = Brush.linearGradient(
            colors = listOf(
                GradientColors.SilverStart,
                GradientColors.SilverMid,
                GradientColors.SilverEnd
            )
        )

    /**
     * Gradiente bronze (3º lugar).
     */
    val bronzeGradient: Brush
        get() = Brush.linearGradient(
            colors = listOf(
                GradientColors.BronzeStart,
                GradientColors.BronzeMid,
                GradientColors.BronzeEnd
            )
        )

    /**
     * Gradiente diamante (divisão especial).
     */
    val diamondGradient: Brush
        get() = Brush.linearGradient(
            colors = listOf(
                GradientColors.DiamondStart,
                GradientColors.DiamondMid,
                GradientColors.DiamondEnd
            )
        )

    // ==================== Surface Gradients ====================

    /**
     * Gradiente sutil para fundos (light mode).
     */
    val surfaceGradientLight: Brush
        get() = Brush.verticalGradient(
            colors = listOf(
                GradientColors.SurfaceLight,
                GradientColors.SurfaceMedium
            )
        )

    /**
     * Gradiente sutil para fundos (dark mode).
     */
    val surfaceGradientDark: Brush
        get() = Brush.verticalGradient(
            colors = listOf(
                GradientColors.DarkSurfaceStart,
                GradientColors.DarkSurfaceEnd
            )
        )

    // ==================== Radial Gradients ====================

    /**
     * Gradiente radial para destaque central.
     */
    fun spotlightGradient(color: Color): Brush {
        return Brush.radialGradient(
            colors = listOf(
                color.copy(alpha = 0.3f),
                color.copy(alpha = 0.1f),
                Color.Transparent
            )
        )
    }

    /**
     * Gradiente radial de foco.
     */
    fun focusGradient(centerColor: Color): Brush {
        return Brush.radialGradient(
            colors = listOf(
                centerColor,
                centerColor.copy(alpha = 0.7f),
                centerColor.copy(alpha = 0.3f),
                Color.Transparent
            ),
            radius = 300f
        )
    }

    // ==================== Custom Gradients ====================

    /**
     * Cria gradiente diagonal customizado.
     */
    fun diagonalGradient(
        startColor: Color,
        endColor: Color,
        angle: Float = 45f
    ): Brush {
        return Brush.linearGradient(
            colors = listOf(startColor, endColor),
            start = Offset.Zero,
            end = Offset(
                x = kotlin.math.cos(Math.toRadians(angle.toDouble())).toFloat() * 1000f,
                y = kotlin.math.sin(Math.toRadians(angle.toDouble())).toFloat() * 1000f
            )
        )
    }

    /**
     * Gradiente com múltiplos stops.
     */
    fun multiStopGradient(
        colors: List<Color>,
        stops: List<Float>? = null
    ): Brush {
        return if (stops != null && stops.size == colors.size) {
            Brush.horizontalGradient(
                colorStops = stops.zip(colors).toTypedArray()
            )
        } else {
            Brush.horizontalGradient(colors = colors)
        }
    }
}

// ==================== Composable Helpers ====================

/**
 * Retorna gradiente de medalha baseado na posição.
 */
@Composable
fun getMedalGradient(position: Int): Brush {
    return when (position) {
        1 -> AppGradients.goldGradient
        2 -> AppGradients.silverGradient
        3 -> AppGradients.bronzeGradient
        else -> Brush.linearGradient(listOf(MaterialTheme.colorScheme.surfaceVariant, MaterialTheme.colorScheme.surfaceVariant))
    }
}

/**
 * Retorna gradiente de divisão de liga.
 */
@Composable
fun getLeagueDivisionGradient(division: String): Brush {
    return when (division.lowercase()) {
        "diamond", "diamante" -> AppGradients.diamondGradient
        "gold", "ouro" -> AppGradients.goldGradient
        "silver", "prata" -> AppGradients.silverGradient
        "bronze" -> AppGradients.bronzeGradient
        else -> Brush.linearGradient(listOf(MaterialTheme.colorScheme.surfaceVariant, MaterialTheme.colorScheme.surfaceVariant))
    }
}

/**
 * Retorna gradiente de surface baseado no tema.
 */
@Composable
fun getSurfaceGradient(isDarkTheme: Boolean): Brush {
    return if (isDarkTheme) {
        AppGradients.surfaceGradientDark
    } else {
        AppGradients.surfaceGradientLight
    }
}

// ==================== Extension Functions ====================

/**
 * Cria gradiente a partir de uma cor única.
 */
fun Color.toGradient(lightenAmount: Float = 0.1f): Brush {
    val lightened = this.copy(
        red = (red + lightenAmount).coerceAtMost(1f),
        green = (green + lightenAmount).coerceAtMost(1f),
        blue = (blue + lightenAmount).coerceAtMost(1f)
    )
    return Brush.verticalGradient(
        colors = listOf(lightened, this)
    )
}

/**
 * Cria gradiente shimmer para loading.
 */
fun shimmerGradient(
    baseColor: Color = Color.LightGray,
    highlightColor: Color = Color.White
): Brush {
    return Brush.linearGradient(
        colors = listOf(
            baseColor,
            highlightColor.copy(alpha = 0.6f),
            baseColor
        )
    )
}
