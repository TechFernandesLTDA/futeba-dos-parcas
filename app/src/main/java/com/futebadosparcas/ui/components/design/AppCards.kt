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

/**
 * Card padrão do aplicativo.
 *
 * Usa as dimensões e cores do tema Material 3.
 *
 * @param modifier Modificador opcional
 * @param onClick Callback ao clicar (se não nulo, card se torna clicável)
 * @param enabled Se o card está habilitado (para cards clicáveis)
 * @param shape Forma do card
 * @param backgroundColor Cor de fundo
 * @param borderColor Cor da borda (se não nula)
 * @param elevation Elevação do card
 * @param content Conteúdo do card
 */
@Composable
fun AppCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    enabled: Boolean = true,
    shape: Shape = MaterialTheme.shapes.large,
    backgroundColor: Color = MaterialTheme.colorScheme.surface,
    border: BorderStroke? = null,
    elevation: Dp = AppDimensions.elevation_small,
    content: @Composable ColumnScope.() -> Unit
) {
    if (onClick != null) {
        Card(
            onClick = onClick,
            modifier = modifier,
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
    val surfaceColor = MaterialTheme.colorScheme.surface

    if (onClick != null) {
        Card(
            onClick = onClick,
            modifier = modifier,
            shape = MaterialTheme.shapes.medium,
            colors = CardDefaults.cardColors(containerColor = surfaceColor),
            elevation = CardDefaults.cardElevation(defaultElevation = AppDimensions.elevation_small)
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
            colors = CardDefaults.cardColors(containerColor = surfaceColor),
            elevation = CardDefaults.cardElevation(defaultElevation = AppDimensions.elevation_small)
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
    if (onClick != null) {
        Card(
            onClick = onClick,
            modifier = modifier,
            shape = MaterialTheme.shapes.medium,
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
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
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
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
    backgroundColor: Color = MaterialTheme.colorScheme.surface,
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
