package com.futebadosparcas.ui.components.design

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.futebadosparcas.ui.theme.AppDimensions

/**
 * Cabeçalho de seção padronizado.
 *
 * @param title Título da seção
 * @param modifier Modificador opcional
 * @param subtitle Subtítulo opcional
 * @param action Ação opcional (botão à direita)
 * @param icon Ícone opcional à esquerda do título
 */
@Composable
fun SectionHeader(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    action: (@Composable () -> Unit)? = null,
    icon: ImageVector? = null
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(
                horizontal = AppDimensions.padding_screen,
                vertical = AppDimensions.spacing_small
            ),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.weight(1f),
            horizontalArrangement = Arrangement.spacedBy(AppDimensions.spacing_small)
        ) {
            if (icon != null) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(AppDimensions.icon_medium)
                )
            }

            Column {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
                if (subtitle != null) {
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        if (action != null) {
            action()
        }
    }
}

/**
 * Chip de estatística para valores numéricos.
 *
 * @param label Rótulo do valor
 * @param value Valor a exibir
 * @param modifier Modificador opcional
 * @param icon Ícone opcional
 * @param backgroundColor Cor de fundo
 * @param contentColor Cor do conteúdo
 * @param shape Forma do chip
 */
@Composable
fun StatChip(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    backgroundColor: Color = MaterialTheme.colorScheme.secondaryContainer,
    contentColor: Color = MaterialTheme.colorScheme.onSecondaryContainer,
    shape: Shape = MaterialTheme.shapes.small
) {
    Surface(
        modifier = modifier,
        color = backgroundColor,
        contentColor = contentColor,
        shape = shape
    ) {
        Row(
            modifier = Modifier.padding(
                horizontal = AppDimensions.spacing_medium,
                vertical = AppDimensions.spacing_small
            ),
            horizontalArrangement = Arrangement.spacedBy(AppDimensions.spacing_small),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (icon != null) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    modifier = Modifier.size(AppDimensions.icon_small)
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = value,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = label,
                    style = MaterialTheme.typography.labelSmall
                )
            }
        }
    }
}

/**
 * Chip compacto para labels.
 *
 * @param text Texto do chip
 * @param modifier Modificador opcional
 * @param leadingIcon Ícone opcional à esquerda
 * @param trailingIcon Ícone opcional à direita
 * @param selected Se está selecionado
 * @param onClick Callback ao clicar
 * @param containerColor Cor de fundo customizada
 */
@Composable
fun LabelChip(
    text: String,
    modifier: Modifier = Modifier,
    leadingIcon: ImageVector? = null,
    trailingIcon: ImageVector? = null,
    selected: Boolean = false,
    onClick: (() -> Unit)? = null,
    containerColor: Color = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.6f)
) {
    if (onClick != null) {
        FilterChip(
            selected = selected,
            onClick = onClick,
            label = {
                Text(
                    text = text,
                    style = MaterialTheme.typography.labelMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            },
            leadingIcon = if (leadingIcon != null) {
                {
                    Icon(
                        imageVector = leadingIcon,
                        contentDescription = null,
                        modifier = Modifier.size(AppDimensions.icon_small)
                    )
                }
            } else null,
            trailingIcon = if (trailingIcon != null) {
                {
                    Icon(
                        imageVector = trailingIcon,
                        contentDescription = null,
                        modifier = Modifier.size(AppDimensions.icon_small)
                    )
                }
            } else null,
            modifier = modifier,
            shape = MaterialTheme.shapes.small,
            colors = FilterChipDefaults.filterChipColors(
                selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer,
                containerColor = containerColor,
                labelColor = MaterialTheme.colorScheme.onSurfaceVariant
            )
        )
    } else {
        InputChip(
            selected = false,
            onClick = {},
            label = {
                Text(
                    text = text,
                    style = MaterialTheme.typography.labelMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            },
            leadingIcon = if (leadingIcon != null) {
                {
                    Icon(
                        imageVector = leadingIcon,
                        contentDescription = null,
                        modifier = Modifier.size(AppDimensions.icon_small)
                    )
                }
            } else null,
            trailingIcon = if (trailingIcon != null) {
                {
                    Icon(
                        imageVector = trailingIcon,
                        contentDescription = null,
                        modifier = Modifier.size(AppDimensions.icon_small)
                    )
                }
            } else null,
            modifier = modifier,
            shape = MaterialTheme.shapes.small,
            enabled = false,
            colors = InputChipDefaults.inputChipColors(
                containerColor = containerColor,
                disabledContainerColor = containerColor,
                disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant
            )
        )
    }
}

/**
 * Avatar padrão do aplicativo.
 *
 * @param text Texto do avatar (iniciais)
 * @param modifier Modificador opcional
 * @param size Tamanho do avatar
 * @param backgroundColor Cor de fundo
 * @param contentColor Cor do conteúdo
 */
@Composable
fun Avatar(
    text: String,
    modifier: Modifier = Modifier,
    size: androidx.compose.ui.unit.Dp = AppDimensions.avatar_medium,
    backgroundColor: Color = MaterialTheme.colorScheme.primaryContainer,
    contentColor: Color = MaterialTheme.colorScheme.onPrimaryContainer
) {
    Box(
        modifier = modifier
            .size(size)
            .clip(CircleShape)
            .background(backgroundColor),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text.take(2).uppercase(),
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            color = contentColor,
            textAlign = TextAlign.Center
        )
    }
}

/**
 * Separador de seção com texto centralizado.
 *
 * @param text Texto do separador
 * @param modifier Modificador opcional
 */
@Composable
fun SectionSeparator(
    text: String,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = AppDimensions.spacing_medium),
        verticalAlignment = Alignment.CenterVertically
    ) {
        HorizontalDivider(
            modifier = Modifier.weight(1f),
            color = MaterialTheme.colorScheme.outlineVariant
        )
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = AppDimensions.spacing_medium),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        HorizontalDivider(
            modifier = Modifier.weight(1f),
            color = MaterialTheme.colorScheme.outlineVariant
        )
    }
}
