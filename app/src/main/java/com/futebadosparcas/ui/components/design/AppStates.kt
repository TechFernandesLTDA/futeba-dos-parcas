package com.futebadosparcas.ui.components.design

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.futebadosparcas.ui.theme.AppDimensions

/**
 * Estado de vazio (EmptyState) padronizado.
 *
 * Exibe um ícone, título e descrição quando não há dados.
 *
 * @param icon Ícone a exibir
 * @param title Título do estado vazio
 * @param description Descrição opcional
 * @param actionLabel Rótulo do botão de ação (opcional)
 * @param onAction Callback da ação (se houver)
 * @param modifier Modificador opcional
 */
@Composable
fun EmptyStateDesign(
    icon: ImageVector,
    title: String,
    description: String? = null,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val iconTint = MaterialTheme.colorScheme.primary.copy(alpha = 0.7f)

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(AppDimensions.spacing_xxl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Ícone
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(AppDimensions.spacing_massive),
            tint = iconTint
        )

        Spacer(modifier = Modifier.height(AppDimensions.spacing_large))

        // Título
        Text(
            text = title,
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center
        )

        // Descrição
        if (!description.isNullOrBlank()) {
            Spacer(modifier = Modifier.height(AppDimensions.spacing_small))

            Text(
                text = description,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
        }

        // Ação
        if (actionLabel != null && onAction != null) {
            Spacer(modifier = Modifier.height(AppDimensions.spacing_xl))

            PrimaryButton(text = actionLabel, onClick = onAction)
        }
    }
}

/**
 * Estado de erro padronizado.
 *
 * Exibe ícone de erro, mensagem e botão de retry.
 *
 * @param message Mensagem de erro
 * @param onRetry Callback de retry
 * @param modifier Modificador opcional
 * @param retryText Texto do botão de retry
 */
@Composable
fun ErrorStateDesign(
    message: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    retryText: String = "Tentar Novamente"
) {
    EmptyStateDesign(
        icon = Icons.Default.Error,
        title = "Erro",
        description = message,
        actionLabel = retryText,
        onAction = onRetry,
        modifier = modifier
    )
}

/**
 * Estado de loading padronizado.
 *
 * Exibe um indicador de progresso circular com mensagem opcional.
 *
 * @param modifier Modificador opcional
 * @param message Mensagem opcional
 */
@Composable
fun LoadingStateDesign(
    modifier: Modifier = Modifier,
    message: String? = null
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(AppDimensions.spacing_xxl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        CircularProgressIndicator(
            modifier = Modifier.size(AppDimensions.icon_extraLarge),
            color = MaterialTheme.colorScheme.primary
        )

        if (!message.isNullOrBlank()) {
            Spacer(modifier = Modifier.height(AppDimensions.spacing_large))

            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
        }
    }
}

/**
 * Estado de sem conexão.
 *
 * @param onRetry Callback de retry
 * @param modifier Modificador opcional
 */
@Composable
fun NoConnectionStateDesign(
    onRetry: () -> Unit,
    modifier: Modifier = Modifier
) {
    EmptyStateDesign(
        icon = Icons.Default.WifiOff,
        title = "Sem conexão",
        description = "Verifique sua conexão com a internet e tente novamente",
        actionLabel = "Tentar Novamente",
        onAction = onRetry,
        modifier = modifier
    )
}

/**
 * Estado de busca sem resultados.
 *
 * @param query Termo buscado
 * @param onClear Callback para limpar busca
 * @param modifier Modificador opcional
 */
@Composable
fun NoSearchResultsStateDesign(
    query: String,
    onClear: () -> Unit,
    modifier: Modifier = Modifier
) {
    EmptyStateDesign(
        icon = Icons.Default.SearchOff,
        title = "Nenhum resultado",
        description = "Nenhum resultado encontrado para \"$query\"",
        actionLabel = "Limpar Busca",
        onAction = onClear,
        modifier = modifier
    )
}
