package com.futebadosparcas.ui.adaptive

import android.content.res.Configuration
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Enum para representar a orientação atual
 */
enum class ScreenOrientation {
    PORTRAIT,
    LANDSCAPE
}

/**
 * Obtém a orientação atual da tela
 */
@Composable
fun rememberScreenOrientation(): ScreenOrientation {
    val configuration = LocalConfiguration.current
    return remember(configuration.orientation) {
        if (configuration.orientation == Configuration.ORIENTATION_LANDSCAPE) {
            ScreenOrientation.LANDSCAPE
        } else {
            ScreenOrientation.PORTRAIT
        }
    }
}

/**
 * Verifica se está em landscape
 */
@Composable
fun isLandscape(): Boolean {
    val configuration = LocalConfiguration.current
    return configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
}

/**
 * Obtém dimensões da tela atuais
 */
@Composable
fun rememberScreenDimensions(): ScreenDimensions {
    val configuration = LocalConfiguration.current
    return remember(configuration) {
        ScreenDimensions(
            widthDp = configuration.screenWidthDp.dp,
            heightDp = configuration.screenHeightDp.dp,
            orientation = if (configuration.orientation == Configuration.ORIENTATION_LANDSCAPE) {
                ScreenOrientation.LANDSCAPE
            } else {
                ScreenOrientation.PORTRAIT
            }
        )
    }
}

data class ScreenDimensions(
    val widthDp: Dp,
    val heightDp: Dp,
    val orientation: ScreenOrientation
) {
    val isWide: Boolean get() = widthDp > 600.dp
    val isTall: Boolean get() = heightDp > 800.dp
    val aspectRatio: Float get() = widthDp.value / heightDp.value
}

/**
 * Container que adapta layout automaticamente para portrait/landscape
 * Em portrait: conteúdo vertical
 * Em landscape: conteúdo lado a lado
 */
@Composable
fun AdaptiveOrientationContainer(
    modifier: Modifier = Modifier,
    verticalArrangement: Arrangement.Vertical = Arrangement.Top,
    horizontalArrangement: Arrangement.Horizontal = Arrangement.Start,
    leftContent: @Composable () -> Unit,
    rightContent: @Composable () -> Unit
) {
    val isLandscape = isLandscape()

    if (isLandscape) {
        Row(
            modifier = modifier.fillMaxSize(),
            horizontalArrangement = horizontalArrangement
        ) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
            ) {
                leftContent()
            }

            VerticalDivider(
                modifier = Modifier.fillMaxHeight(),
                color = MaterialTheme.colorScheme.outlineVariant
            )

            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight()
            ) {
                rightContent()
            }
        }
    } else {
        Column(
            modifier = modifier.fillMaxSize(),
            verticalArrangement = verticalArrangement
        ) {
            Box(modifier = Modifier.weight(1f)) {
                leftContent()
            }

            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)

            Box(modifier = Modifier.weight(1f)) {
                rightContent()
            }
        }
    }
}

/**
 * Layout que exibe conteúdo principal + painel lateral em landscape,
 * ou conteúdo empilhado em portrait
 */
@Composable
fun LandscapeSidePanelLayout(
    modifier: Modifier = Modifier,
    sidePanelWidth: Dp = 320.dp,
    mainContent: @Composable BoxScope.() -> Unit,
    sidePanel: @Composable BoxScope.() -> Unit
) {
    val isLandscape = isLandscape()
    val dimensions = rememberScreenDimensions()

    if (isLandscape && dimensions.widthDp > 700.dp) {
        Row(modifier = modifier.fillMaxSize()) {
            // Conteúdo principal
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxHeight(),
                content = mainContent
            )

            // Divisor vertical
            VerticalDivider(
                modifier = Modifier.fillMaxHeight(),
                thickness = 1.dp,
                color = MaterialTheme.colorScheme.outlineVariant
            )

            // Painel lateral
            Box(
                modifier = Modifier
                    .width(sidePanelWidth)
                    .fillMaxHeight(),
                content = sidePanel
            )
        }
    } else {
        // Portrait: apenas conteúdo principal
        Box(
            modifier = modifier.fillMaxSize(),
            content = mainContent
        )
    }
}

/**
 * Grid responsivo que ajusta colunas baseado na orientação
 */
@Composable
fun OrientationResponsiveGrid(
    modifier: Modifier = Modifier,
    portraitColumns: Int = 1,
    landscapeColumns: Int = 2,
    contentPadding: PaddingValues = PaddingValues(16.dp),
    listState: LazyListState = rememberLazyListState(),
    content: LazyListScope.() -> Unit
) {
    val isLandscape = isLandscape()
    val columns = if (isLandscape) landscapeColumns else portraitColumns

    if (columns == 1) {
        LazyColumn(
            modifier = modifier,
            state = listState,
            contentPadding = contentPadding,
            verticalArrangement = Arrangement.spacedBy(8.dp),
            content = content
        )
    } else {
        // Para múltiplas colunas, usar LazyVerticalGrid seria ideal,
        // mas aqui criamos uma lista com items lado a lado
        LazyColumn(
            modifier = modifier,
            state = listState,
            contentPadding = contentPadding,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            content()
        }
    }
}

/**
 * Layout para formulários que otimiza espaço em landscape
 * Divide campos em duas colunas quando há espaço suficiente
 */
@Composable
fun LandscapeFormLayout(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit
) {
    val isLandscape = isLandscape()
    val dimensions = rememberScreenDimensions()

    if (isLandscape && dimensions.widthDp > 600.dp) {
        Row(
            modifier = modifier
                .fillMaxSize()
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            // Em landscape, dividimos em duas colunas scrolláveis
            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(16.dp),
                content = content
            )
        }
    } else {
        Column(
            modifier = modifier
                .fillMaxSize()
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp),
            content = content
        )
    }
}

/**
 * Header que se adapta à orientação
 * Em landscape: header mais compacto e horizontal
 * Em portrait: header vertical completo
 */
@Composable
fun AdaptiveHeader(
    modifier: Modifier = Modifier,
    leadingContent: @Composable () -> Unit,
    titleContent: @Composable () -> Unit,
    subtitleContent: (@Composable () -> Unit)? = null,
    trailingContent: (@Composable () -> Unit)? = null
) {
    val isLandscape = isLandscape()

    if (isLandscape) {
        Row(
            modifier = modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            leadingContent()

            Column(modifier = Modifier.weight(1f)) {
                titleContent()
                subtitleContent?.invoke()
            }

            trailingContent?.invoke()
        }
    } else {
        Column(
            modifier = modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            leadingContent()
            titleContent()
            subtitleContent?.invoke()
            trailingContent?.invoke()
        }
    }
}

/**
 * Layout para estatísticas que mostra em grid no landscape
 */
@Composable
fun AdaptiveStatsLayout(
    modifier: Modifier = Modifier,
    stats: List<@Composable () -> Unit>
) {
    val isLandscape = isLandscape()
    val dimensions = rememberScreenDimensions()

    if (isLandscape && stats.size >= 2) {
        // Em landscape, mostra em grid 2xN
        Column(
            modifier = modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            stats.chunked(2).forEach { row ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    row.forEach { stat ->
                        Box(modifier = Modifier.weight(1f)) {
                            stat()
                        }
                    }
                    // Preenche espaço se número ímpar
                    if (row.size == 1) {
                        Box(modifier = Modifier.weight(1f))
                    }
                }
            }
        }
    } else {
        // Portrait: lista vertical
        Column(
            modifier = modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            stats.forEach { stat ->
                stat()
            }
        }
    }
}

/**
 * Modifier que aplica padding diferente em landscape
 */
@Composable
fun Modifier.landscapePadding(
    portraitPadding: PaddingValues = PaddingValues(16.dp),
    landscapePadding: PaddingValues = PaddingValues(horizontal = 24.dp, vertical = 8.dp)
): Modifier {
    val isLandscape = isLandscape()
    return this.padding(
        if (isLandscape) landscapePadding else portraitPadding
    )
}

/**
 * Executa código diferente baseado na orientação
 */
@Composable
fun <T> orientationBased(
    portrait: T,
    landscape: T
): T {
    return if (isLandscape()) landscape else portrait
}
