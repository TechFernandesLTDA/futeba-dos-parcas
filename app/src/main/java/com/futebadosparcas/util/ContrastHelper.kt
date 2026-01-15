package com.futebadosparcas.util

import androidx.compose.ui.graphics.Color
import kotlin.math.pow

/**
 * Utilitário para calcular cor de texto com contraste adequado conforme WCAG 2.1 AA
 *
 * Material Design 3 recomenda:
 * - Contraste mínimo 4.5:1 para texto normal
 * - Contraste mínimo 3:1 para texto grande (18pt+)
 *
 * Este helper calcula automaticamente a melhor cor de texto (claro ou escuro)
 * baseado na luminância relativa do background.
 */
object ContrastHelper {
    /**
     * Retorna cor de texto (claro ou escuro) baseado no background
     *
     * @param backgroundColor Cor de fundo
     * @return Cor de texto com contraste adequado (WCAG AA)
     *
     * Exemplo:
     * ```kotlin
     * val textColor = ContrastHelper.getContrastingTextColor(GamificationColors.Gold)
     * Text(text = "1º", color = textColor)
     * ```
     */
    fun getContrastingTextColor(backgroundColor: Color): Color {
        val luminance = backgroundColor.luminance()
        return if (luminance > 0.5f) {
            Color(0xFF1A1A1A)  // Texto escuro para fundos claros
        } else {
            Color(0xFFFFFFFF)  // Texto claro para fundos escuros
        }
    }

    /**
     * Calcula a luminância relativa de uma cor (0.0 a 1.0)
     * Conforme especificação WCAG 2.1
     *
     * @see <a href="https://www.w3.org/TR/WCAG21/#dfn-relative-luminance">WCAG 2.1 Relative Luminance</a>
     */
    private fun Color.luminance(): Float {
        val r = red.toSRGB()
        val g = green.toSRGB()
        val b = blue.toSRGB()
        return 0.2126f * r + 0.7152f * g + 0.0722f * b
    }

    /**
     * Converte valor de cor para espaço sRGB linearizado
     */
    private fun Float.toSRGB(): Float {
        return if (this <= 0.03928f) {
            this / 12.92f
        } else {
            ((this + 0.055f) / 1.055f).pow(2.4f)
        }
    }

    /**
     * Calcula o ratio de contraste entre duas cores
     *
     * @param foreground Cor do texto/foreground
     * @param background Cor do fundo
     * @return Contrast ratio (1.0 a 21.0)
     *
     * Valores de referência WCAG 2.1:
     * - 4.5:1 - Mínimo para texto normal (AA)
     * - 3.0:1 - Mínimo para texto grande (AA)
     * - 7.0:1 - Mínimo para texto normal (AAA)
     */
    fun getContrastRatio(foreground: Color, background: Color): Float {
        val l1 = foreground.luminance() + 0.05f
        val l2 = background.luminance() + 0.05f
        return if (l1 > l2) l1 / l2 else l2 / l1
    }

    /**
     * Verifica se o contraste entre duas cores atende WCAG AA
     *
     * @param foreground Cor do texto/foreground
     * @param background Cor do fundo
     * @param largeText True se o texto é grande (18pt+ ou 14pt+ bold)
     * @return True se o contraste é adequado
     */
    fun meetsWCAGAA(
        foreground: Color,
        background: Color,
        largeText: Boolean = false
    ): Boolean {
        val ratio = getContrastRatio(foreground, background)
        val minRatio = if (largeText) 3.0f else 4.5f
        return ratio >= minRatio
    }
}
