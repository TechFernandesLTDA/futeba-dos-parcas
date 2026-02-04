package com.futebadosparcas.ui.components.modern

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R

/**
 * Botão com estado de loading interno
 *
 * Mostra spinner circular dentro do botão enquanto processa,
 * sem desabilitar toda a tela
 *
 * @param onClick Ação ao clicar
 * @param isLoading Se está em estado de loading
 * @param text Texto do botão
 * @param icon Ícone opcional
 * @param enabled Se o botão está habilitado
 */
@Composable
fun LoadingButton(
    onClick: () -> Unit,
    isLoading: Boolean,
    text: String,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    enabled: Boolean = true
) {
    Button(
        onClick = onClick,
        enabled = enabled && !isLoading,
        modifier = modifier.height(48.dp)
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                color = MaterialTheme.colorScheme.onPrimary,
                strokeWidth = 2.dp
            )
            Spacer(modifier = Modifier.width(8.dp))
        } else if (icon != null) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
        }

        Text(
            text = if (isLoading) stringResource(R.string.loading) else text,
            style = MaterialTheme.typography.labelLarge
        )
    }
}

/**
 * Botão de texto com loading
 */
@Composable
fun LoadingTextButton(
    onClick: () -> Unit,
    isLoading: Boolean,
    text: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true
) {
    TextButton(
        onClick = onClick,
        enabled = enabled && !isLoading,
        modifier = modifier
    ) {
        AnimatedVisibility(
            visible = isLoading,
            enter = fadeIn(),
            exit = fadeOut()
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(
                    modifier = Modifier.size(16.dp),
                    strokeWidth = 2.dp
                )
                Spacer(modifier = Modifier.width(8.dp))
            }
        }

        Text(
            text = if (isLoading) stringResource(R.string.loading) else text,
            style = MaterialTheme.typography.labelLarge
        )
    }
}

/**
 * Botão tonal com loading
 */
@Composable
fun LoadingFilledTonalButton(
    onClick: () -> Unit,
    isLoading: Boolean,
    text: String,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    enabled: Boolean = true
) {
    FilledTonalButton(
        onClick = onClick,
        enabled = enabled && !isLoading,
        modifier = modifier.height(48.dp)
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                strokeWidth = 2.dp
            )
            Spacer(modifier = Modifier.width(8.dp))
        } else if (icon != null) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
        }

        Text(
            text = if (isLoading) stringResource(R.string.loading) else text,
            style = MaterialTheme.typography.labelLarge
        )
    }
}

/**
 * Botão outline com loading
 */
@Composable
fun LoadingOutlinedButton(
    onClick: () -> Unit,
    isLoading: Boolean,
    text: String,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    enabled: Boolean = true
) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled && !isLoading,
        modifier = modifier.height(48.dp)
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                strokeWidth = 2.dp
            )
            Spacer(modifier = Modifier.width(8.dp))
        } else if (icon != null) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
        }

        Text(
            text = if (isLoading) stringResource(R.string.loading) else text,
            style = MaterialTheme.typography.labelLarge
        )
    }
}

/**
 * FAB com loading
 */
@Composable
fun LoadingFloatingActionButton(
    onClick: () -> Unit,
    isLoading: Boolean,
    icon: ImageVector,
    contentDescription: String?,
    modifier: Modifier = Modifier
) {
    FloatingActionButton(
        onClick = onClick,
        modifier = modifier
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.size(24.dp),
                color = MaterialTheme.colorScheme.onPrimaryContainer,
                strokeWidth = 2.dp
            )
        } else {
            Icon(
                imageVector = icon,
                contentDescription = contentDescription
            )
        }
    }
}

/**
 * Extended FAB com loading
 */
@Composable
fun LoadingExtendedFloatingActionButton(
    onClick: () -> Unit,
    isLoading: Boolean,
    text: String,
    icon: ImageVector,
    modifier: Modifier = Modifier
) {
    ExtendedFloatingActionButton(
        onClick = onClick,
        modifier = modifier
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                color = MaterialTheme.colorScheme.onPrimaryContainer,
                strokeWidth = 2.dp
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(stringResource(R.string.loading))
        } else {
            Icon(
                imageVector = icon,
                contentDescription = null
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(text)
        }
    }
}
