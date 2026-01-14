package com.futebadosparcas.ui.components.design

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.SearchOff
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import com.futebadosparcas.ui.components.EmptyStateType
import com.futebadosparcas.ui.theme.AppDimensions

/**
 * Estado unificado da aplicação para representar diferentes cenários de UI.
 *
 * Esta sealed class consolida os estados de Loading, Empty, Error e NoConnection
 * em uma única hierarquia, facilitando o gerenciamento de estados em ViewModels
 * e telas Compose.
 *
 * Uso típico:
 * ```kotlin
 * sealed class FeatureUiState {
 *     data class Success(val data: Data) : FeatureUiState()
 *     data class StateWrapper(val state: AppUiState) : FeatureUiState()
 * }
 *
 * // Ou diretamente no ViewModel:
 * val uiState: StateFlow<AppUiState> = ...
 * ```
 *
 * @see AppStateContainer para renderização automática do estado
 */
sealed class AppUiState {

    /**
     * Estado de carregamento.
     *
     * Exibe um indicador de progresso circular com mensagem opcional.
     *
     * @param message Mensagem opcional exibida abaixo do indicador (ex: "Carregando jogos...")
     */
    data class Loading(
        val message: String? = null
    ) : AppUiState()

    /**
     * Estado vazio - nenhum dado disponível.
     *
     * Exibe ícone, título, descrição e ação opcional.
     * Compatível com [EmptyStateType] existente para migração gradual.
     *
     * @param type Tipo do estado vazio (NoData, NoResults, etc.)
     * @param title Título principal
     * @param description Descrição detalhada
     * @param icon Ícone representativo
     * @param actionLabel Texto do botão de ação (opcional)
     * @param onAction Callback da ação (opcional)
     */
    data class Empty(
        val type: EmptyType = EmptyType.NO_DATA,
        val title: String,
        val description: String,
        val icon: ImageVector = Icons.Default.Inbox,
        val actionLabel: String? = null,
        val onAction: (() -> Unit)? = null
    ) : AppUiState() {

        /**
         * Tipos de estado vazio para diferenciação visual.
         */
        enum class EmptyType {
            /** Lista vazia, sem dados */
            NO_DATA,
            /** Busca sem resultados */
            NO_RESULTS,
            /** Filtro aplicado sem correspondências */
            NO_FILTER_MATCH,
            /** Conteúdo indisponível */
            UNAVAILABLE
        }

        companion object {
            /**
             * Cria um estado Empty a partir de um [EmptyStateType] existente.
             * Útil para migração gradual do código legado.
             */
            fun fromLegacy(legacyType: EmptyStateType): Empty {
                return when (legacyType) {
                    is EmptyStateType.NoData -> Empty(
                        type = EmptyType.NO_DATA,
                        title = legacyType.title,
                        description = legacyType.description,
                        icon = legacyType.icon,
                        actionLabel = legacyType.actionLabel,
                        onAction = legacyType.onAction
                    )
                    is EmptyStateType.NoResults -> Empty(
                        type = EmptyType.NO_RESULTS,
                        title = legacyType.title,
                        description = legacyType.description,
                        icon = legacyType.icon,
                        actionLabel = legacyType.actionLabel,
                        onAction = legacyType.onAction
                    )
                    is EmptyStateType.Error -> Empty(
                        type = EmptyType.UNAVAILABLE,
                        title = legacyType.title,
                        description = legacyType.description,
                        icon = legacyType.icon,
                        actionLabel = legacyType.actionLabel,
                        onAction = legacyType.onRetry
                    )
                    is EmptyStateType.NoConnection -> Empty(
                        type = EmptyType.UNAVAILABLE,
                        title = legacyType.title,
                        description = legacyType.description,
                        icon = legacyType.icon,
                        actionLabel = legacyType.actionLabel,
                        onAction = legacyType.onRetry
                    )
                }
            }
        }
    }

    /**
     * Estado de erro.
     *
     * Exibe mensagem de erro com opção de retry.
     *
     * @param message Mensagem de erro para o usuário
     * @param title Título do erro (padrão: "Erro")
     * @param icon Ícone de erro
     * @param retryLabel Texto do botão de retry
     * @param onRetry Callback para tentar novamente
     */
    data class Error(
        val message: String,
        val title: String = "Erro",
        val icon: ImageVector = Icons.Default.Error,
        val retryLabel: String = "Tentar Novamente",
        val onRetry: (() -> Unit)? = null
    ) : AppUiState()

    /**
     * Estado sem conexão com internet.
     *
     * Estado especializado para falhas de rede.
     *
     * @param title Título (padrão: "Sem conexão")
     * @param message Mensagem explicativa
     * @param retryLabel Texto do botão de retry
     * @param onRetry Callback para tentar novamente
     */
    data class NoConnection(
        val title: String = "Sem conexão",
        val message: String = "Verifique sua conexão com a internet e tente novamente",
        val retryLabel: String = "Tentar Novamente",
        val onRetry: (() -> Unit)? = null
    ) : AppUiState()
}

// ==========================================
// DURAÇÃO DAS ANIMAÇÕES
// ==========================================
private const val ANIMATION_DURATION_MS = 300

/**
 * Container que renderiza automaticamente o estado apropriado.
 *
 * Este composable recebe um [AppUiState] e exibe o conteúdo visual
 * correspondente com animações suaves de entrada e saída.
 *
 * Uso:
 * ```kotlin
 * val uiState by viewModel.uiState.collectAsStateWithLifecycle()
 *
 * AppStateContainer(
 *     state = uiState,
 *     modifier = Modifier.fillMaxSize()
 * )
 * ```
 *
 * @param state Estado atual da UI
 * @param modifier Modificador opcional
 * @param visible Controla a visibilidade com animação (padrão: true)
 */
@Composable
fun AppStateContainer(
    state: AppUiState,
    modifier: Modifier = Modifier,
    visible: Boolean = true
) {
    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(animationSpec = tween(ANIMATION_DURATION_MS)) +
                scaleIn(initialScale = 0.92f, animationSpec = tween(ANIMATION_DURATION_MS)),
        exit = fadeOut(animationSpec = tween(ANIMATION_DURATION_MS)) +
               scaleOut(targetScale = 0.92f, animationSpec = tween(ANIMATION_DURATION_MS)),
        modifier = modifier
    ) {
        when (state) {
            is AppUiState.Loading -> LoadingContent(
                message = state.message
            )

            is AppUiState.Empty -> EmptyContent(
                type = state.type,
                icon = state.icon,
                title = state.title,
                description = state.description,
                actionLabel = state.actionLabel,
                onAction = state.onAction
            )

            is AppUiState.Error -> ErrorContent(
                icon = state.icon,
                title = state.title,
                message = state.message,
                actionLabel = state.retryLabel,
                onAction = state.onRetry
            )

            is AppUiState.NoConnection -> NoConnectionContent(
                title = state.title,
                message = state.message,
                actionLabel = state.retryLabel,
                onAction = state.onRetry
            )
        }
    }
}

/**
 * Conteúdo interno do estado de Loading.
 */
@Composable
private fun LoadingContent(
    message: String?,
    modifier: Modifier = Modifier
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
            color = MaterialTheme.colorScheme.primary,
            strokeWidth = AppDimensions.progress_height
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
 * Conteúdo interno do estado Empty.
 */
@Composable
private fun EmptyContent(
    type: AppUiState.Empty.EmptyType,
    icon: ImageVector,
    title: String,
    description: String,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null
) {
    // Cor baseada no tipo de estado vazio
    val iconTint = when (type) {
        AppUiState.Empty.EmptyType.NO_DATA -> MaterialTheme.colorScheme.primary
        AppUiState.Empty.EmptyType.NO_RESULTS -> MaterialTheme.colorScheme.secondary
        AppUiState.Empty.EmptyType.NO_FILTER_MATCH -> MaterialTheme.colorScheme.tertiary
        AppUiState.Empty.EmptyType.UNAVAILABLE -> MaterialTheme.colorScheme.outline
    }

    StateContentLayout(
        icon = icon,
        iconTint = iconTint,
        title = title,
        description = description,
        actionLabel = actionLabel,
        onAction = onAction,
        modifier = modifier
    )
}

/**
 * Conteúdo interno do estado de Error.
 */
@Composable
private fun ErrorContent(
    icon: ImageVector,
    title: String,
    message: String,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null
) {
    StateContentLayout(
        icon = icon,
        iconTint = MaterialTheme.colorScheme.error,
        title = title,
        description = message,
        actionLabel = actionLabel,
        onAction = onAction,
        modifier = modifier
    )
}

/**
 * Conteúdo interno do estado NoConnection.
 */
@Composable
private fun NoConnectionContent(
    title: String,
    message: String,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null
) {
    StateContentLayout(
        icon = Icons.Default.WifiOff,
        iconTint = MaterialTheme.colorScheme.tertiary,
        title = title,
        description = message,
        actionLabel = actionLabel,
        onAction = onAction,
        modifier = modifier
    )
}

/**
 * Layout base reutilizável para estados com ícone, título, descrição e ação.
 *
 * Componente interno que implementa o layout comum a Empty, Error e NoConnection.
 */
@Composable
private fun StateContentLayout(
    icon: ImageVector,
    iconTint: Color,
    title: String,
    description: String,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(AppDimensions.spacing_xxl),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Ícone grande
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(AppDimensions.spacing_massive * 2.5f), // ~120dp
            tint = iconTint.copy(alpha = 0.7f)
        )

        Spacer(modifier = Modifier.height(AppDimensions.spacing_large))

        // Título
        Text(
            text = title,
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(AppDimensions.spacing_small))

        // Descrição
        Text(
            text = description,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(0.8f)
        )

        // Botão de ação (se disponível)
        if (actionLabel != null && onAction != null) {
            Spacer(modifier = Modifier.height(AppDimensions.spacing_xl))

            PrimaryButton(
                text = actionLabel,
                onClick = onAction
            )
        }
    }
}

// ==========================================
// COMPOSABLES DE CONVENIÊNCIA
// ==========================================

/**
 * Estado de Loading simplificado.
 *
 * @param modifier Modificador opcional
 * @param message Mensagem opcional
 */
@Composable
fun UnifiedLoadingState(
    modifier: Modifier = Modifier,
    message: String? = null
) {
    AppStateContainer(
        state = AppUiState.Loading(message),
        modifier = modifier
    )
}

/**
 * Estado de Error simplificado.
 *
 * @param message Mensagem de erro
 * @param onRetry Callback de retry
 * @param modifier Modificador opcional
 */
@Composable
fun UnifiedErrorState(
    message: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier
) {
    AppStateContainer(
        state = AppUiState.Error(
            message = message,
            onRetry = onRetry
        ),
        modifier = modifier
    )
}

/**
 * Estado de Empty simplificado.
 *
 * @param title Título
 * @param description Descrição
 * @param modifier Modificador opcional
 * @param icon Ícone opcional
 * @param actionLabel Texto da ação (opcional)
 * @param onAction Callback da ação (opcional)
 */
@Composable
fun UnifiedEmptyState(
    title: String,
    description: String,
    modifier: Modifier = Modifier,
    icon: ImageVector = Icons.Default.Inbox,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null
) {
    AppStateContainer(
        state = AppUiState.Empty(
            title = title,
            description = description,
            icon = icon,
            actionLabel = actionLabel,
            onAction = onAction
        ),
        modifier = modifier
    )
}

/**
 * Estado de NoConnection simplificado.
 *
 * @param onRetry Callback de retry
 * @param modifier Modificador opcional
 */
@Composable
fun UnifiedNoConnectionState(
    onRetry: () -> Unit,
    modifier: Modifier = Modifier
) {
    AppStateContainer(
        state = AppUiState.NoConnection(onRetry = onRetry),
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
fun UnifiedNoResultsState(
    query: String,
    onClear: () -> Unit,
    modifier: Modifier = Modifier
) {
    AppStateContainer(
        state = AppUiState.Empty(
            type = AppUiState.Empty.EmptyType.NO_RESULTS,
            title = "Nenhum resultado encontrado",
            description = "Nenhum resultado para \"$query\"",
            icon = Icons.Default.SearchOff,
            actionLabel = "Limpar Busca",
            onAction = onClear
        ),
        modifier = modifier
    )
}

/**
 * Wrapper que exibe conteúdo ou estado baseado em condições.
 *
 * Facilita o padrão comum de mostrar loading/error/empty/content.
 *
 * Uso:
 * ```kotlin
 * ContentOrState(
 *     isLoading = uiState.isLoading,
 *     error = uiState.error,
 *     isEmpty = items.isEmpty(),
 *     emptyState = AppUiState.Empty(...),
 *     onRetry = { viewModel.retry() }
 * ) {
 *     // Conteúdo principal
 *     LazyColumn { ... }
 * }
 * ```
 *
 * @param isLoading Se está carregando
 * @param error Mensagem de erro (null se não houver)
 * @param isEmpty Se a lista está vazia
 * @param loadingMessage Mensagem de loading opcional
 * @param emptyState Estado vazio customizado
 * @param onRetry Callback de retry para erros
 * @param modifier Modificador opcional
 * @param content Conteúdo a exibir quando não está em estado especial
 */
@Composable
fun ContentOrState(
    isLoading: Boolean,
    error: String?,
    isEmpty: Boolean,
    emptyState: AppUiState.Empty,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    loadingMessage: String? = null,
    content: @Composable () -> Unit
) {
    Box(modifier = modifier.fillMaxSize()) {
        when {
            isLoading -> {
                AppStateContainer(
                    state = AppUiState.Loading(loadingMessage),
                    modifier = Modifier.fillMaxSize()
                )
            }
            error != null -> {
                AppStateContainer(
                    state = AppUiState.Error(
                        message = error,
                        onRetry = onRetry
                    ),
                    modifier = Modifier.fillMaxSize()
                )
            }
            isEmpty -> {
                AppStateContainer(
                    state = emptyState,
                    modifier = Modifier.fillMaxSize()
                )
            }
            else -> {
                content()
            }
        }
    }
}
