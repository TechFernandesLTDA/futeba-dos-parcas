package com.futebadosparcas.ui.adaptive

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Define os espaçamentos adaptativos para diferentes tamanhos de tela.
 * Segue as diretrizes do Material Design 3 para layout responsivo.
 */
@Immutable
data class AdaptiveSpacing(
    /** Espaçamento extra pequeno */
    val xs: Dp = 4.dp,
    /** Espaçamento pequeno */
    val sm: Dp = 8.dp,
    /** Espaçamento médio */
    val md: Dp = 16.dp,
    /** Espaçamento grande */
    val lg: Dp = 24.dp,
    /** Espaçamento extra grande */
    val xl: Dp = 32.dp,
    /** Espaçamento extra extra grande */
    val xxl: Dp = 48.dp,

    /** Padding horizontal do conteúdo */
    val contentPaddingHorizontal: Dp = 16.dp,
    /** Padding vertical do conteúdo */
    val contentPaddingVertical: Dp = 16.dp,

    /** Espaçamento entre cards */
    val cardSpacing: Dp = 12.dp,
    /** Espaçamento entre itens de lista */
    val listItemSpacing: Dp = 8.dp,
    /** Espaçamento entre itens de grid */
    val gridItemSpacing: Dp = 12.dp,

    /** Largura máxima do conteúdo (para tablets) */
    val contentMaxWidth: Dp = Dp.Unspecified,
    /** Largura do rail de navegação */
    val navigationRailWidth: Dp = 80.dp,
    /** Largura do drawer de navegação */
    val navigationDrawerWidth: Dp = 360.dp
) {
    /** Retorna o PaddingValues para o conteúdo */
    val contentPadding: PaddingValues
        get() = PaddingValues(
            horizontal = contentPaddingHorizontal,
            vertical = contentPaddingVertical
        )

    companion object {
        /** Espaçamentos para tela compacta (telefone portrait) */
        val Compact = AdaptiveSpacing(
            xs = 4.dp,
            sm = 8.dp,
            md = 16.dp,
            lg = 24.dp,
            xl = 32.dp,
            xxl = 48.dp,
            contentPaddingHorizontal = 16.dp,
            contentPaddingVertical = 16.dp,
            cardSpacing = 12.dp,
            listItemSpacing = 8.dp,
            gridItemSpacing = 8.dp,
            contentMaxWidth = Dp.Unspecified,
            navigationRailWidth = 0.dp,
            navigationDrawerWidth = 0.dp
        )

        /** Espaçamentos para tela média (telefone landscape ou tablet pequeno) */
        val Medium = AdaptiveSpacing(
            xs = 4.dp,
            sm = 8.dp,
            md = 16.dp,
            lg = 24.dp,
            xl = 32.dp,
            xxl = 56.dp,
            contentPaddingHorizontal = 24.dp,
            contentPaddingVertical = 20.dp,
            cardSpacing = 16.dp,
            listItemSpacing = 12.dp,
            gridItemSpacing = 12.dp,
            contentMaxWidth = 840.dp,
            navigationRailWidth = 80.dp,
            navigationDrawerWidth = 0.dp
        )

        /** Espaçamentos para tela expandida (tablet grande) */
        val Expanded = AdaptiveSpacing(
            xs = 4.dp,
            sm = 8.dp,
            md = 16.dp,
            lg = 24.dp,
            xl = 40.dp,
            xxl = 64.dp,
            contentPaddingHorizontal = 32.dp,
            contentPaddingVertical = 24.dp,
            cardSpacing = 20.dp,
            listItemSpacing = 16.dp,
            gridItemSpacing = 16.dp,
            contentMaxWidth = 1040.dp,
            navigationRailWidth = 80.dp,
            navigationDrawerWidth = 360.dp
        )

        /**
         * Retorna o espaçamento apropriado para o tamanho de janela.
         */
        fun forWindowSize(windowSizeClass: WindowSizeClass): AdaptiveSpacing {
            return when (windowSizeClass.widthSizeClass) {
                WindowWidthSizeClass.COMPACT -> Compact
                WindowWidthSizeClass.MEDIUM -> Medium
                WindowWidthSizeClass.EXPANDED -> Expanded
            }
        }
    }
}

/**
 * CompositionLocal para acessar o espaçamento adaptativo em qualquer lugar.
 */
val LocalAdaptiveSpacing = staticCompositionLocalOf { AdaptiveSpacing.Compact }

/**
 * Retorna o espaçamento adaptativo baseado no tamanho da janela atual.
 */
@Composable
fun rememberAdaptiveSpacing(): AdaptiveSpacing {
    val windowSizeClass = rememberWindowSizeClass()
    return AdaptiveSpacing.forWindowSize(windowSizeClass)
}
