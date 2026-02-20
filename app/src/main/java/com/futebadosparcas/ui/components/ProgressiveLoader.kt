package com.futebadosparcas.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.flow.distinctUntilChanged
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource

/**
 * Componentes de Lazy Loading Progressivo.
 * Carrega dados em lotes conforme o usuário faz scroll.
 */

// ==================== Models ====================

/**
 * Estado do carregamento progressivo.
 */
data class ProgressiveLoadingState<T>(
    val items: List<T> = emptyList(),
    val isLoadingMore: Boolean = false,
    val hasMoreItems: Boolean = true,
    val error: String? = null,
    val currentPage: Int = 0,
    val totalPages: Int? = null
) {
    val progress: Float
        get() = if (totalPages != null && totalPages > 0) {
            currentPage.toFloat() / totalPages
        } else {
            0f
        }

    val isEmpty: Boolean get() = items.isEmpty() && !isLoadingMore
}

/**
 * Configuração do loader progressivo.
 */
data class ProgressiveLoaderConfig(
    val pageSize: Int = 20,
    val prefetchDistance: Int = 5,       // Quantos itens antes do fim para carregar mais
    val initialLoadSize: Int = 30,       // Tamanho do primeiro carregamento
    val showLoadingIndicator: Boolean = true,
    val enablePullToRefresh: Boolean = true
)

// ==================== Main Composables ====================

/**
 * Lista com carregamento progressivo.
 */
@Composable
fun <T> ProgressiveLazyColumn(
    state: ProgressiveLoadingState<T>,
    onLoadMore: () -> Unit,
    modifier: Modifier = Modifier,
    config: ProgressiveLoaderConfig = ProgressiveLoaderConfig(),
    listState: LazyListState = rememberLazyListState(),
    contentPadding: PaddingValues = PaddingValues(0.dp),
    verticalArrangement: Arrangement.Vertical = Arrangement.Top,
    itemKey: ((T) -> Any)? = null,
    emptyContent: @Composable () -> Unit = { DefaultEmptyContent() },
    loadingContent: @Composable () -> Unit = { DefaultLoadingContent() },
    errorContent: @Composable (String) -> Unit = { DefaultErrorContent(it) },
    itemContent: @Composable (T) -> Unit
) {
    // Detecta quando deve carregar mais
    val shouldLoadMore by remember {
        derivedStateOf {
            val layoutInfo = listState.layoutInfo
            val totalItems = layoutInfo.totalItemsCount
            val lastVisibleIndex = layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0

            state.hasMoreItems &&
            !state.isLoadingMore &&
            state.error == null &&
            totalItems > 0 &&
            lastVisibleIndex >= totalItems - config.prefetchDistance
        }
    }

    LaunchedEffect(shouldLoadMore) {
        if (shouldLoadMore) {
            onLoadMore()
        }
    }

    when {
        state.isEmpty && state.error == null -> {
            emptyContent()
        }
        state.error != null && state.items.isEmpty() -> {
            errorContent(state.error)
        }
        else -> {
            LazyColumn(
                state = listState,
                modifier = modifier,
                contentPadding = contentPadding,
                verticalArrangement = verticalArrangement
            ) {
                items(
                    items = state.items,
                    key = itemKey
                ) { item ->
                    itemContent(item)
                }

                // Loading indicator no final
                if (state.isLoadingMore && config.showLoadingIndicator) {
                    item {
                        LoadMoreIndicator()
                    }
                }

                // Erro ao carregar mais
                if (state.error != null && state.items.isNotEmpty()) {
                    item {
                        LoadMoreError(
                            error = state.error,
                            onRetry = onLoadMore
                        )
                    }
                }
            }
        }
    }
}

/**
 * Indicador de progresso do carregamento total.
 */
@Composable
fun LoadingProgressBar(
    progress: Float,
    modifier: Modifier = Modifier,
    showPercentage: Boolean = true
) {
    val animatedProgress by animateFloatAsState(
        targetValue = progress,
        animationSpec = tween(300),
        label = "progress"
    )

    Column(
        modifier = modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        LinearProgressIndicator(
            progress = { animatedProgress },
            modifier = Modifier.fillMaxWidth(),
            color = MaterialTheme.colorScheme.primary,
            trackColor = MaterialTheme.colorScheme.surfaceContainerHighest
        )

        if (showPercentage) {
            Text(
                text = "${(animatedProgress * 100).toInt()}%",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp)
            )
        }
    }
}

// ==================== Internal Components ====================

@Composable
private fun LoadMoreIndicator() {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator(
            color = MaterialTheme.colorScheme.primary
        )
    }
}

@Composable
private fun LoadMoreError(
    error: String,
    onRetry: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = error,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.error
        )
    }
}

@Composable
private fun DefaultEmptyContent() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = stringResource(R.string.no_data_available),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun DefaultLoadingContent() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator()
    }
}

@Composable
private fun DefaultErrorContent(error: String) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = error,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.error
        )
    }
}

// ==================== Scroll Detection Helper ====================

/**
 * Detecta eventos de scroll para carregamento progressivo.
 */
@Composable
fun ScrollLoadTrigger(
    listState: LazyListState,
    prefetchDistance: Int = 5,
    onLoadMore: () -> Unit
) {
    LaunchedEffect(listState) {
        snapshotFlow {
            val layoutInfo = listState.layoutInfo
            val totalItems = layoutInfo.totalItemsCount
            val lastVisibleIndex = layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            totalItems > 0 && lastVisibleIndex >= totalItems - prefetchDistance
        }
            .distinctUntilChanged()
            .collect { shouldLoad ->
                if (shouldLoad) {
                    onLoadMore()
                }
            }
    }
}

// ==================== Loading State Manager ====================

/**
 * Helper para gerenciar estado de carregamento progressivo.
 */
class ProgressiveLoadingManager<T>(
    private val config: ProgressiveLoaderConfig = ProgressiveLoaderConfig()
) {
    private var _state = mutableStateOf(ProgressiveLoadingState<T>())
    val state: ProgressiveLoadingState<T> get() = _state.value

    fun setItems(items: List<T>, hasMore: Boolean = true) {
        _state.value = _state.value.copy(
            items = items,
            hasMoreItems = hasMore,
            isLoadingMore = false,
            error = null
        )
    }

    fun appendItems(newItems: List<T>, hasMore: Boolean = true) {
        _state.value = _state.value.copy(
            items = _state.value.items + newItems,
            hasMoreItems = hasMore,
            isLoadingMore = false,
            currentPage = _state.value.currentPage + 1,
            error = null
        )
    }

    fun setLoading(isLoading: Boolean) {
        _state.value = _state.value.copy(isLoadingMore = isLoading)
    }

    fun setError(error: String?) {
        _state.value = _state.value.copy(
            error = error,
            isLoadingMore = false
        )
    }

    fun reset() {
        _state.value = ProgressiveLoadingState()
    }
}
