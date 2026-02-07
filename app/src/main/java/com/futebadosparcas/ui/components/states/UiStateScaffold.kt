package com.futebadosparcas.ui.components.states

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.pulltorefresh.PullToRefreshDefaults.Indicator
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.futebadosparcas.ui.components.AnimatedStateContainer
import com.futebadosparcas.ui.components.StateType

/**
 * Scaffold unificado para gerenciamento de estados da UI.
 *
 * Combina [AnimatedStateContainer] para transições suaves entre estados
 * com [PullToRefreshBox] opcional para atualização por gesto.
 *
 * Suporta os 4 estados obrigatórios: Loading, Success, Empty e Error.
 *
 * Uso básico:
 * ```kotlin
 * val uiState by viewModel.uiState.collectAsStateWithLifecycle()
 *
 * UiStateScaffold(
 *     stateType = when (uiState) {
 *         is UiState.Loading -> StateType.LOADING
 *         is UiState.Success -> StateType.SUCCESS
 *         is UiState.Error -> StateType.ERROR
 *         is UiState.Empty -> StateType.EMPTY
 *     },
 *     loadingContent = { LoadingState(itemType = LoadingItemType.GAME_CARD) },
 *     errorContent = { ErrorState(message = errorMsg, onRetry = { viewModel.retry() }) },
 *     emptyContent = { EmptyGamesState(onCreateGame = { ... }) },
 * ) {
 *     // Conteúdo de sucesso
 *     LazyColumn { ... }
 * }
 * ```
 *
 * Com Pull-to-Refresh:
 * ```kotlin
 * UiStateScaffold(
 *     stateType = stateType,
 *     isRefreshing = uiState.isRefreshing,
 *     onRefresh = { viewModel.refresh() },
 *     loadingContent = { ... },
 *     errorContent = { ... },
 *     emptyContent = { ... },
 * ) {
 *     LazyColumn { ... }
 * }
 * ```
 *
 * @param stateType Tipo de estado atual (LOADING, SUCCESS, ERROR, EMPTY)
 * @param loadingContent Composable para estado de carregamento (shimmer)
 * @param errorContent Composable para estado de erro (com retry)
 * @param emptyContent Composable para estado vazio (com CTA)
 * @param modifier Modificador para o container
 * @param isRefreshing Se está em estado de refresh (para pull-to-refresh)
 * @param onRefresh Callback ao puxar para atualizar (ativa pull-to-refresh se fornecido)
 * @param successContent Composable para estado de sucesso (conteúdo principal)
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UiStateScaffold(
    stateType: StateType,
    loadingContent: @Composable () -> Unit,
    errorContent: @Composable () -> Unit,
    emptyContent: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    isRefreshing: Boolean = false,
    onRefresh: (() -> Unit)? = null,
    successContent: @Composable () -> Unit
) {
    // Wrapper com pull-to-refresh (apenas no estado SUCCESS ou EMPTY)
    val shouldEnablePullToRefresh = onRefresh != null &&
        (stateType == StateType.SUCCESS || stateType == StateType.EMPTY || stateType == StateType.ERROR)

    if (shouldEnablePullToRefresh && onRefresh != null) {
        val pullState = rememberPullToRefreshState()

        PullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh = onRefresh,
            state = pullState,
            modifier = modifier.fillMaxSize(),
            indicator = {
                Indicator(
                    state = pullState,
                    isRefreshing = isRefreshing,
                    modifier = Modifier.align(Alignment.TopCenter),
                    containerColor = MaterialTheme.colorScheme.surfaceContainerHighest,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        ) {
            StateContent(
                stateType = stateType,
                loadingContent = loadingContent,
                errorContent = errorContent,
                emptyContent = emptyContent,
                successContent = successContent
            )
        }
    } else {
        Box(modifier = modifier.fillMaxSize()) {
            StateContent(
                stateType = stateType,
                loadingContent = loadingContent,
                errorContent = errorContent,
                emptyContent = emptyContent,
                successContent = successContent
            )
        }
    }
}

/**
 * Conteúdo interno com animações de transição entre estados.
 */
@Composable
private fun StateContent(
    stateType: StateType,
    loadingContent: @Composable () -> Unit,
    errorContent: @Composable () -> Unit,
    emptyContent: @Composable () -> Unit,
    successContent: @Composable () -> Unit
) {
    AnimatedStateContainer(
        targetState = stateType,
        modifier = Modifier.fillMaxSize(),
        label = "uiStateScaffold"
    ) { currentState ->
        when (currentState) {
            StateType.LOADING -> loadingContent()
            StateType.SUCCESS -> successContent()
            StateType.ERROR -> errorContent()
            StateType.EMPTY -> emptyContent()
        }
    }
}

/**
 * Versão tipada do UiStateScaffold que aceita sealed classes customizadas.
 *
 * Usa [stateMapper] para determinar o tipo de estado e selecionar
 * o conteúdo apropriado.
 *
 * Uso:
 * ```kotlin
 * UiStateScaffold(
 *     state = uiState,
 *     stateMapper = { state ->
 *         when (state) {
 *             is HomeUiState.Loading -> StateType.LOADING
 *             is HomeUiState.Success -> StateType.SUCCESS
 *             is HomeUiState.Error -> StateType.ERROR
 *             is HomeUiState.Empty -> StateType.EMPTY
 *         }
 *     },
 *     isRefreshing = isRefreshing,
 *     onRefresh = { viewModel.refresh() }
 * ) { currentState ->
 *     when (currentState) {
 *         is HomeUiState.Loading -> LoadingState()
 *         is HomeUiState.Success -> HomeContent(currentState.data)
 *         is HomeUiState.Error -> ErrorState(currentState.message)
 *         is HomeUiState.Empty -> EmptyState()
 *     }
 * }
 * ```
 *
 * @param state Estado atual tipado
 * @param stateMapper Função que mapeia o estado tipado para [StateType]
 * @param modifier Modificador para o container
 * @param isRefreshing Se está em estado de refresh
 * @param onRefresh Callback ao puxar para atualizar
 * @param content Composable que recebe o estado tipado
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun <T> UiStateScaffold(
    state: T,
    stateMapper: (T) -> StateType,
    modifier: Modifier = Modifier,
    isRefreshing: Boolean = false,
    onRefresh: (() -> Unit)? = null,
    content: @Composable (T) -> Unit
) {
    val currentStateType = stateMapper(state)
    val shouldEnablePullToRefresh = onRefresh != null &&
        (currentStateType == StateType.SUCCESS || currentStateType == StateType.EMPTY || currentStateType == StateType.ERROR)

    if (shouldEnablePullToRefresh && onRefresh != null) {
        val pullState = rememberPullToRefreshState()

        PullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh = onRefresh,
            state = pullState,
            modifier = modifier.fillMaxSize(),
            indicator = {
                Indicator(
                    state = pullState,
                    isRefreshing = isRefreshing,
                    modifier = Modifier.align(Alignment.TopCenter),
                    containerColor = MaterialTheme.colorScheme.surfaceContainerHighest,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        ) {
            AnimatedStateContainer(
                targetState = state,
                stateMapper = stateMapper,
                modifier = Modifier.fillMaxSize(),
                label = "uiStateScaffoldTyped",
                content = content
            )
        }
    } else {
        Box(modifier = modifier.fillMaxSize()) {
            AnimatedStateContainer(
                targetState = state,
                stateMapper = stateMapper,
                modifier = Modifier.fillMaxSize(),
                label = "uiStateScaffoldTyped",
                content = content
            )
        }
    }
}
