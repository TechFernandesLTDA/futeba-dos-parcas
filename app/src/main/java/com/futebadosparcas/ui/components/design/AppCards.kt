package com.futebadosparcas.ui.components.design

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.futebadosparcas.ui.theme.AppDimensions
import com.futebadosparcas.ui.components.animation.pressScale

/**
 * Card padrão do aplicativo.
 *
 * Usa elevação TONAL (cor via surfaceContainer*) em vez de shadowElevation,
 * garantindo profundidade visível tanto no modo claro quanto no escuro
 * (no dark mode sombras desaparecem; tonal elevation funciona em ambos).
 * Uma borda hairline opcional de outlineVariant melhora legibilidade no dark.
 *
 * @param modifier Modificador opcional
 * @param onClick Callback ao clicar (se não nulo, card se torna clicável)
 * @param enabled Se o card está habilitado (para cards clicáveis)
 * @param shape Forma do card
 * @param backgroundColor Cor de fundo (padrão: surfaceContainerLow = nível 1 da hierarquia tonal)
 * @param border Borda opcional (padrão: hairline outlineVariant para legibilidade no dark)
 * @param elevation Elevação de sombra — reservada para chrome flutuante (FAB/modal/menu).
 *                  Para cards de conteúdo prefira o tier tonal via [backgroundColor].
 * @param content Conteúdo do card
 */
@Composable
fun AppCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    enabled: Boolean = true,
    shape: Shape = MaterialTheme.shapes.large,
    backgroundColor: Color = MaterialTheme.colorScheme.surfaceContainerLow,
    border: BorderStroke? = BorderStroke(
        width = AppDimensions.divider_thickness,
        color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f)
    ),
    elevation: Dp = AppDimensions.elevation_none,
    content: @Composable ColumnScope.() -> Unit
) {
    if (onClick != null) {
        Card(
            onClick = onClick,
            modifier = modifier.pressScale(),
            enabled = enabled,
            shape = shape,
            colors = CardDefaults.cardColors(containerColor = backgroundColor),
            border = border,
            elevation = CardDefaults.cardElevation(defaultElevation = elevation)
        ) {
            Column(
                modifier = Modifier.padding(AppDimensions.padding_card),
                content = content
            )
        }
    } else {
        Card(
            modifier = modifier,
            shape = shape,
            colors = CardDefaults.cardColors(containerColor = backgroundColor),
            border = border,
            elevation = CardDefaults.cardElevation(defaultElevation = elevation)
        ) {
            Column(
                modifier = Modifier.padding(AppDimensions.padding_card),
                content = content
            )
        }
    }
}

/**
 * Card com destaque primário.
 *
 * Usa a cor primária para destacar informações importantes.
 *
 * @param modifier Modificador opcional
 * @param onClick Callback ao clicar (opcional)
 * @param content Conteúdo do card
 */
@Composable
fun PrimaryCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    AppCard(
        modifier = modifier,
        onClick = onClick,
        backgroundColor = MaterialTheme.colorScheme.primaryContainer,
        shape = MaterialTheme.shapes.large,
        elevation = AppDimensions.elevation_medium,
        content = content
    )
}

/**
 * Card com destaque secundário.
 *
 * Usa a cor secundária para informações de destaque médio.
 *
 * @param modifier Modificador opcional
 * @param onClick Callback ao clicar (opcional)
 * @param content Conteúdo do card
 */
@Composable
fun SecondaryCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    AppCard(
        modifier = modifier,
        onClick = onClick,
        backgroundColor = MaterialTheme.colorScheme.secondaryContainer,
        shape = MaterialTheme.shapes.large,
        elevation = AppDimensions.elevation_small,
        content = content
    )
}

/**
 * Card com borda (outlined).
 *
 * @param modifier Modificador opcional
 * @param onClick Callback ao clicar (opcional)
 * @param borderColor Cor da borda
 * @param content Conteúdo do card
 */
@Composable
fun OutlinedAppCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    borderColor: Color = MaterialTheme.colorScheme.outline.copy(alpha = 0.3f),
    content: @Composable ColumnScope.() -> Unit
) {
    AppCard(
        modifier = modifier,
        onClick = onClick,
        backgroundColor = Color.Transparent,
        border = BorderStroke(1.dp, borderColor),
        elevation = AppDimensions.elevation_none,
        shape = MaterialTheme.shapes.large,
        content = content
    )
}

/**
 * Card horizontal para listas.
 *
 * Usa elevação tonal (surfaceContainerLow) sem shadowElevation,
 * garantindo distinção visual em light e dark mode.
 *
 * @param modifier Modificador opcional
 * @param onClick Callback ao clicar (opcional)
 * @param verticalAlignment Alinhamento vertical do conteúdo
 * @param content Conteúdo do card (RowScope)
 */
@Composable
fun HorizontalAppCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    verticalAlignment: Alignment.Vertical = Alignment.CenterVertically,
    content: @Composable RowScope.() -> Unit
) {
    // Elevação tonal: surfaceContainerLow (nível 1) em vez de surface + shadow
    val containerColor = MaterialTheme.colorScheme.surfaceContainerLow

    if (onClick != null) {
        Card(
            onClick = onClick,
            modifier = modifier.pressScale(),
            shape = MaterialTheme.shapes.medium,
            colors = CardDefaults.cardColors(containerColor = containerColor),
            elevation = CardDefaults.cardElevation(defaultElevation = AppDimensions.elevation_none)
        ) {
            Row(
                modifier = Modifier.padding(AppDimensions.padding_medium),
                verticalAlignment = verticalAlignment,
                content = content
            )
        }
    } else {
        Card(
            modifier = modifier,
            shape = MaterialTheme.shapes.medium,
            colors = CardDefaults.cardColors(containerColor = containerColor),
            elevation = CardDefaults.cardElevation(defaultElevation = AppDimensions.elevation_none)
        ) {
            Row(
                modifier = Modifier.padding(AppDimensions.padding_medium),
                verticalAlignment = verticalAlignment,
                content = content
            )
        }
    }
}

/**
 * Card compacto para informações rápidas.
 *
 * Usa surfaceContainerLowest (nível 0 da hierarquia tonal) — o mais sutil,
 * ideal para elementos secundários que precisam de separação mínima do fundo.
 *
 * @param modifier Modificador opcional
 * @param onClick Callback ao clicar (opcional)
 * @param content Conteúdo do card
 */
@Composable
fun CompactCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    // surfaceContainerLowest = nível 0 da hierarquia tonal (mais sutil que surfaceVariant)
    val containerColor = MaterialTheme.colorScheme.surfaceContainerLowest

    if (onClick != null) {
        Card(
            onClick = onClick,
            modifier = modifier.pressScale(),
            shape = MaterialTheme.shapes.medium,
            colors = CardDefaults.cardColors(containerColor = containerColor),
            elevation = CardDefaults.cardElevation(defaultElevation = AppDimensions.elevation_none)
        ) {
            Column(
                modifier = Modifier.padding(AppDimensions.spacing_medium),
                content = content
            )
        }
    } else {
        Card(
            modifier = modifier,
            shape = MaterialTheme.shapes.medium,
            colors = CardDefaults.cardColors(containerColor = containerColor),
            elevation = CardDefaults.cardElevation(defaultElevation = AppDimensions.elevation_none)
        ) {
            Column(
                modifier = Modifier.padding(AppDimensions.spacing_medium),
                content = content
            )
        }
    }
}

/**
 * Surface com elevação dinâmica baseada em estado de hover.
 *
 * @param modifier Modificador opcional
 * @param onClick Callback ao clicar
 * @param shape Forma do surface
 * @param backgroundColor Cor de fundo
 * @param content Conteúdo do surface
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ClickableSurface(
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
    shape: Shape = MaterialTheme.shapes.medium,
    backgroundColor: Color = MaterialTheme.colorScheme.surfaceContainer,
    content: @Composable () -> Unit
) {
    Surface(
        onClick = onClick,
        modifier = modifier,
        shape = shape,
        color = backgroundColor,
        tonalElevation = AppDimensions.elevation_small
    ) {
        Box(modifier = Modifier.padding(AppDimensions.padding_medium)) {
            content()
        }
    }
}

/**
 * Box alinhável para uso interno dos cards
 */
@Composable
private fun Box(
    modifier: Modifier = Modifier,
    contentAlign: Alignment = Alignment.CenterStart,
    content: @Composable () -> Unit
) {
    androidx.compose.foundation.layout.Box(
        modifier = modifier,
        contentAlignment = contentAlign
    ) {
        content()
    }
}
