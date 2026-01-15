package com.futebadosparcas.ui.components.design

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.dp
import com.futebadosparcas.ui.theme.AppDimensions

/**
 * Botão primário do aplicativo.
 *
 * Usa as cores e dimensões padronizadas do tema.
 *
 * @param text Texto do botão
 * @param onClick Callback ao clicar
 * @param modifier Modificador opcional
 * @param enabled Se o botão está habilitado
 * @param icon Ícone opcional à esquerda do texto
 */
@Composable
fun PrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    icon: (@Composable () -> Unit)? = null
) {
    Button(
        onClick = onClick,
        modifier = modifier,
        enabled = enabled,
        shape = MaterialTheme.shapes.medium,
        colors = ButtonDefaults.buttonColors(
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = MaterialTheme.colorScheme.onPrimary,
            disabledContainerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.5f),
            disabledContentColor = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.5f)
        ),
        contentPadding = PaddingValues(
            horizontal = AppDimensions.padding_button,
            vertical = AppDimensions.padding_chip
        )
    ) {
        if (icon != null) {
            icon()
            Spacer(modifier = Modifier.width(AppDimensions.spacing_small))
        }
        Text(
            text = text,
            style = MaterialTheme.typography.labelLarge
        )
    }
}

/**
 * Botão secundário do aplicativo.
 *
 * Versão tonal para ações menos destacadas.
 *
 * @param text Texto do botão
 * @param onClick Callback ao clicar
 * @param modifier Modificador opcional
 * @param enabled Se o botão está habilitado
 * @param icon Ícone opcional à esquerda do texto
 */
@Composable
fun SecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    icon: (@Composable () -> Unit)? = null
) {
    FilledTonalButton(
        onClick = onClick,
        modifier = modifier,
        enabled = enabled,
        shape = MaterialTheme.shapes.medium,
        colors = ButtonDefaults.filledTonalButtonColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer,
            contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
            disabledContainerColor = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.5f),
            disabledContentColor = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.5f)
        ),
        contentPadding = PaddingValues(
            horizontal = AppDimensions.padding_button,
            vertical = AppDimensions.padding_chip
        )
    ) {
        if (icon != null) {
            icon()
            Spacer(modifier = Modifier.width(AppDimensions.spacing_small))
        }
        Text(
            text = text,
            style = MaterialTheme.typography.labelLarge
        )
    }
}

/**
 * Botão de texto (outlined) para ações terciárias.
 *
 * @param text Texto do botão
 * @param onClick Callback ao clicar
 * @param modifier Modificador opcional
 * @param enabled Se o botão está habilitado
 * @param icon Ícone opcional à esquerda do texto
 */
@Composable
fun OutlinedAppButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    icon: (@Composable () -> Unit)? = null
) {
    OutlinedButton(
        onClick = onClick,
        modifier = modifier,
        enabled = enabled,
        shape = MaterialTheme.shapes.medium,
        colors = ButtonDefaults.outlinedButtonColors(
            contentColor = MaterialTheme.colorScheme.primary,
            disabledContentColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f)
        ),
        border = BorderStroke(
            width = 1.dp,
            color = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f)
        ),
        contentPadding = PaddingValues(
            horizontal = AppDimensions.padding_button,
            vertical = AppDimensions.padding_chip
        )
    ) {
        if (icon != null) {
            icon()
            Spacer(modifier = Modifier.width(AppDimensions.spacing_small))
        }
        Text(
            text = text,
            style = MaterialTheme.typography.labelLarge
        )
    }
}

/**
 * Botão de texto puro para ações sutis.
 *
 * @param text Texto do botão
 * @param onClick Callback ao clicar
 * @param modifier Modificador opcional
 * @param enabled Se o botão está habilitado
 * @param icon Ícone opcional à esquerda do texto
 */
@Composable
fun TextAppButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    icon: (@Composable () -> Unit)? = null
) {
    TextButton(
        onClick = onClick,
        modifier = modifier,
        enabled = enabled,
        shape = MaterialTheme.shapes.medium,
        colors = ButtonDefaults.textButtonColors(
            contentColor = MaterialTheme.colorScheme.primary,
            disabledContentColor = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.38f)
        ),
        contentPadding = PaddingValues(
            horizontal = AppDimensions.spacing_medium,
            vertical = AppDimensions.spacing_small
        )
    ) {
        if (icon != null) {
            icon()
            Spacer(modifier = Modifier.width(AppDimensions.spacing_small))
        }
        Text(
            text = text,
            style = MaterialTheme.typography.labelLarge
        )
    }
}

/**
 * Botão de ícone sem texto.
 *
 * @param onClick Callback ao clicar
 * @param modifier Modificador opcional
 * @param enabled Se o botão está habilitado
 * @param icon Ícone do botão
 * @param contentDescription Descrição do conteúdo para acessibilidade
 */
@Composable
fun IconButtonApp(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    icon: @Composable () -> Unit,
    contentDescription: String? = null
) {
    IconButton(
        onClick = onClick,
        modifier = modifier.size(AppDimensions.icon_large),
        enabled = enabled
    ) {
        icon()
    }
}

/**
 * Botão com ícone flutuante (FAB) padrão.
 *
 * @param onClick Callback ao clicar
 * @param modifier Modificador opcional
 * @param icon Ícone do botão
 * @param contentDescription Descrição do conteúdo para acessibilidade
 * @param containerColor Cor de fundo customizada
 */
@Composable
fun FabButton(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: @Composable () -> Unit,
    contentDescription: String? = null,
    containerColor: Color = MaterialTheme.colorScheme.primaryContainer
) {
    FloatingActionButton(
        onClick = onClick,
        modifier = modifier,
        containerColor = containerColor,
        contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
        shape = MaterialTheme.shapes.large
    ) {
        icon()
    }
}
