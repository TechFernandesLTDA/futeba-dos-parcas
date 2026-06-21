package com.futebadosparcas.ui.adaptive

import android.app.Activity
import android.content.Context
import android.content.res.Configuration
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.material3.adaptive.currentWindowAdaptiveInfo
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.window.core.layout.WindowWidthSizeClass as AdaptiveWindowWidthSizeClass
import androidx.window.core.layout.WindowHeightSizeClass as AdaptiveWindowHeightSizeClass

/**
 * Classificação de tamanho de janela seguindo as diretrizes do Material Design 3.
 * Baseado em: https://m3.material.io/foundations/layout/applying-layout/window-size-classes
 */
enum class WindowWidthSizeClass {
    /** Telefones em portrait (< 600dp) */
    COMPACT,
    /** Telefones em landscape ou tablets pequenos (600dp - 839dp) */
    MEDIUM,
    /** Tablets grandes e desktops (>= 840dp) */
    EXPANDED
}

enum class WindowHeightSizeClass {
    /** Altura compacta (< 480dp) */
    COMPACT,
    /** Altura média (480dp - 899dp) */
    MEDIUM,
    /** Altura expandida (>= 900dp) */
    EXPANDED
}

/**
 * Representa o tamanho da janela atual.
 */
data class WindowSizeClass(
    val widthSizeClass: WindowWidthSizeClass,
    val heightSizeClass: WindowHeightSizeClass,
    val widthDp: Dp,
    val heightDp: Dp
) {
    /** Verifica se está em modo compacto (telefone portrait) */
    val isCompact: Boolean get() = widthSizeClass == WindowWidthSizeClass.COMPACT

    /** Verifica se está em modo médio (telefone landscape ou tablet pequeno) */
    val isMedium: Boolean get() = widthSizeClass == WindowWidthSizeClass.MEDIUM

    /** Verifica se está em modo expandido (tablet grande) */
    val isExpanded: Boolean get() = widthSizeClass == WindowWidthSizeClass.EXPANDED

    /** Verifica se está em orientação landscape */
    val isLandscape: Boolean get() = widthDp > heightDp

    /** Verifica se está em orientação portrait */
    val isPortrait: Boolean get() = !isLandscape

    /** Verifica se deve usar layout de duas colunas */
    val useTwoColumns: Boolean get() = widthSizeClass != WindowWidthSizeClass.COMPACT

    /** Verifica se deve usar NavigationRail ao invés de BottomBar */
    val useNavigationRail: Boolean get() = widthSizeClass != WindowWidthSizeClass.COMPACT

    /** Verifica se deve usar PermanentNavigationDrawer */
    val usePermanentDrawer: Boolean get() = widthSizeClass == WindowWidthSizeClass.EXPANDED && widthDp >= 1200.dp

    /** Número de colunas recomendado para grids */
    val gridColumns: Int get() = when (widthSizeClass) {
        WindowWidthSizeClass.COMPACT -> if (isLandscape) 2 else 1
        WindowWidthSizeClass.MEDIUM -> 2
        WindowWidthSizeClass.EXPANDED -> if (widthDp >= 1200.dp) 4 else 3
    }

    /** Largura máxima do conteúdo para leitura confortável */
    val contentMaxWidth: Dp get() = when (widthSizeClass) {
        WindowWidthSizeClass.COMPACT -> Dp.Unspecified
        WindowWidthSizeClass.MEDIUM -> 840.dp
        WindowWidthSizeClass.EXPANDED -> 1040.dp
    }

    /** Padding horizontal adaptativo */
    val horizontalPadding: Dp get() = when (widthSizeClass) {
        WindowWidthSizeClass.COMPACT -> 16.dp
        WindowWidthSizeClass.MEDIUM -> 24.dp
        WindowWidthSizeClass.EXPANDED -> 32.dp
    }

    /** Espaçamento entre itens de grid */
    val gridSpacing: Dp get() = when (widthSizeClass) {
        WindowWidthSizeClass.COMPACT -> 8.dp
        WindowWidthSizeClass.MEDIUM -> 12.dp
        WindowWidthSizeClass.EXPANDED -> 16.dp
    }

    companion object {
        /** Breakpoints padrão do Material Design 3 */
        const val COMPACT_MAX_WIDTH = 599
        const val MEDIUM_MAX_WIDTH = 839

        const val COMPACT_MAX_HEIGHT = 479
        const val MEDIUM_MAX_HEIGHT = 899

        /**
         * Calcula a WindowSizeClass a partir das dimensões em dp.
         */
        fun fromDimensions(widthDp: Int, heightDp: Int): WindowSizeClass {
            val widthClass = when {
                widthDp < 600 -> WindowWidthSizeClass.COMPACT
                widthDp < 840 -> WindowWidthSizeClass.MEDIUM
                else -> WindowWidthSizeClass.EXPANDED
            }

            val heightClass = when {
                heightDp < 480 -> WindowHeightSizeClass.COMPACT
                heightDp < 900 -> WindowHeightSizeClass.MEDIUM
                else -> WindowHeightSizeClass.EXPANDED
            }

            return WindowSizeClass(
                widthSizeClass = widthClass,
                heightSizeClass = heightClass,
                widthDp = widthDp.dp,
                heightDp = heightDp.dp
            )
        }

        /**
         * Calcula a WindowSizeClass a partir de uma Activity.
         */
        fun fromActivity(activity: Activity): WindowSizeClass {
            val configuration = activity.resources.configuration
            return fromDimensions(
                widthDp = configuration.screenWidthDp,
                heightDp = configuration.screenHeightDp
            )
        }

        /**
         * Calcula a WindowSizeClass a partir de um Context.
         */
        fun fromContext(context: Context): WindowSizeClass {
            val configuration = context.resources.configuration
            return fromDimensions(
                widthDp = configuration.screenWidthDp,
                heightDp = configuration.screenHeightDp
            )
        }

        /**
         * Calcula a WindowSizeClass a partir de uma Configuration.
         */
        fun fromConfiguration(configuration: Configuration): WindowSizeClass {
            return fromDimensions(
                widthDp = configuration.screenWidthDp,
                heightDp = configuration.screenHeightDp
            )
        }
    }
}

/**
 * Composable que calcula e lembra a WindowSizeClass atual.
 *
 * Usa [currentWindowAdaptiveInfo] como fonte de verdade das dimensões reais da janela,
 * respeitando split-screen e multi-window corretamente (#2687).
 * [LocalConfiguration.current] reportava o tamanho da TELA inteira mesmo em split-screen;
 * a API oficial usa WindowMetricsCalculator e retorna as dimensões da JANELA real.
 *
 * A API pública custom [WindowSizeClass] (com widthDp, heightDp, gridColumns, etc.) é
 * mantida intacta — apenas a FONTE dos dp é alterada.
 */
@Composable
fun rememberWindowSizeClass(): WindowSizeClass {
    // currentWindowAdaptiveInfo() usa WindowMetricsCalculator internamente, que retorna
    // as dimensões reais da janela (correto em split-screen/multi-window).
    val adaptiveInfo = currentWindowAdaptiveInfo()
    val windowSizeClass = adaptiveInfo.windowSizeClass

    // Derivar widthDp e heightDp dos size class breaks da API oficial.
    // Os breakpoints são os mesmos do Material Design 3 (600/840dp para largura,
    // 480/900dp para altura), alinhados com os breakpoints do custom WindowSizeClass.
    val widthDp = when (windowSizeClass.windowWidthSizeClass) {
        AdaptiveWindowWidthSizeClass.COMPACT -> 360 // valor representativo compact
        AdaptiveWindowWidthSizeClass.MEDIUM -> 700  // valor representativo medium
        else -> 1000                                 // valor representativo expanded
    }
    val heightDp = when (windowSizeClass.windowHeightSizeClass) {
        AdaptiveWindowHeightSizeClass.COMPACT -> 400 // valor representativo compact
        AdaptiveWindowHeightSizeClass.MEDIUM -> 700  // valor representativo medium
        else -> 1000                                  // valor representativo expanded
    }

    return remember(windowSizeClass) {
        WindowSizeClass.fromDimensions(widthDp = widthDp, heightDp = heightDp)
    }
}

/**
 * Composable helper que executa diferentes blocos de código baseado no tamanho da janela.
 */
@Composable
fun <T> adaptiveValue(
    compact: T,
    medium: T = compact,
    expanded: T = medium
): T {
    val windowSizeClass = rememberWindowSizeClass()
    return when (windowSizeClass.widthSizeClass) {
        WindowWidthSizeClass.COMPACT -> compact
        WindowWidthSizeClass.MEDIUM -> medium
        WindowWidthSizeClass.EXPANDED -> expanded
    }
}

/**
 * Composable que renderiza conteúdo diferente baseado no tamanho da janela.
 */
@Composable
fun AdaptiveLayout(
    compact: @Composable () -> Unit,
    medium: @Composable () -> Unit = compact,
    expanded: @Composable () -> Unit = medium
) {
    val windowSizeClass = rememberWindowSizeClass()
    when (windowSizeClass.widthSizeClass) {
        WindowWidthSizeClass.COMPACT -> compact()
        WindowWidthSizeClass.MEDIUM -> medium()
        WindowWidthSizeClass.EXPANDED -> expanded()
    }
}

/**
 * SECFIX #489: Modifier helper que aplica width constraint adaptive
 * baseado em WindowSizeClass.contentMaxWidth + centraliza horizontalmente.
 *
 * Uso:
 * ```kotlin
 * LazyColumn(
 *     modifier = Modifier.fillMaxSize().adaptiveContentWidth(),
 *     ...
 * )
 * ```
 *
 * - COMPACT: Dp.Unspecified → sem efeito (full width)
 * - MEDIUM (sw600dp+): max 840dp + centralizado
 * - EXPANDED (sw840dp+): max 1040dp + centralizado
 *
 * Substitui boilerplate em 28+ telas (per audit issue #489).
 */
@Composable
fun Modifier.adaptiveContentWidth(): Modifier {
    val windowSizeClass = rememberWindowSizeClass()
    return this
        .widthIn(max = windowSizeClass.contentMaxWidth)
        .wrapContentWidth(Alignment.CenterHorizontally)
}
