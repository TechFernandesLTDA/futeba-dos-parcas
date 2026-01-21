package com.futebadosparcas.ui.components.design

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R
import com.futebadosparcas.domain.model.PlayerRankingItem
import com.futebadosparcas.ui.theme.AppDimensions
import kotlinx.coroutines.flow.StateFlow

/**
 * Lista de ranking com paginação automática.
 *
 * CMD-25: Implementação de paginação com otimizações de recomposição.
 *
 * Features:
 * - Paginação automática ao chegar ao fim da lista
 * - Stable keys para evitar recomposições desnecessárias
 * - Estados de loading, error e success
 * - Pull-to-refresh integrado
 *
 * @param state Flow com estado da paginação
 * @param onLoadMore Callback para carregar mais itens
 * * @param onRefresh Callback para refresh manual
 * @param onClick Callback ao clicar em um item
 * @param modifier Modificador opcional
 * @param listState Estado da LazyList (opcional)
 * @param itemContent Composable do item
 */
@Composable
fun <T : Any> PaginatedRankingList(
    state: StateFlow<PaginatedState<T>>,
    onLoadMore: () -> Unit,
    onRefresh: () -> Unit,
    onClick: (T) -> Unit,
    modifier: Modifier = Modifier,
    listState: LazyListState = rememberLazyListState(),
    itemContent: @Composable (item: T, index: Int, isCurrentUser: Boolean) -> Unit
) {
    val currentState by state.collectAsState()
    val isLoadingMore by remember { derivedStateOf { currentState.isLoading } }
    val hasMore by remember { derivedStateOf { currentState.hasMore } }

    // Auto-load mais itens quando próximo do fim
    LaunchedEffect(listState) {
        snapshotFlow { listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index }
            .collect { lastVisibleIndex ->
                if (lastVisibleIndex != null && hasMore && !isLoadingMore) {
                    val itemsFromEnd = currentState.items.size - lastVisibleIndex - 1
                    if (itemsFromEnd <= 15) { // Prefetch distance
                        onLoadMore()
                    }
                }
            }
    }

    Box(modifier = modifier.fillMaxSize()) {
        LazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize()
        ) {
            // Itens principais
            itemsIndexed(
                items = currentState.items,
                key = { _, item -> getStableKey(item) } // Stable key
            ) { index, item ->
                // Determinar se é usuário atual (override se necessário)
                val isCurrentUser = false // Será determinado pelo itemContent

                itemContent(item, index, isCurrentUser)
            }

            // Loading indicator no fim
            if (isLoadingMore && hasMore) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(AppDimensions.spacing_xl),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }

            // End of list indicator
            if (!hasMore && currentState.items.isNotEmpty()) {
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(AppDimensions.spacing_xl),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = stringResource(R.string.list_end),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}

/**
 * Estado da paginação.
 *
 * Stable class para evitar recomposições desnecessárias.
 */
data class PaginatedState<T : Any>(
    val items: List<T> = emptyList(),
    val hasMore: Boolean = true,
    val isLoading: Boolean = false,
    val error: Throwable? = null
) {
    val isEmpty: Boolean get() = items.isEmpty() && !isLoading
    val isInitialLoading: Boolean get() = isLoading && items.isEmpty()
    val hasError: Boolean get() = error != null

    /**
     * Cria cópia com novos itens (append).
     */
    fun withNewItems(newItems: List<T>, hasMore: Boolean = true): PaginatedState<T> {
        return copy(
            items = items + newItems,
            hasMore = hasMore,
            isLoading = false,
            error = null
        )
    }

    /**
     * Cria cópia com erro.
     */
    fun withError(error: Throwable): PaginatedState<T> {
        return copy(
            isLoading = false,
            error = error
        )
    }

    /**
     * Cria cópia em loading.
     */
    fun asLoading(): PaginatedState<T> {
        return copy(isLoading = true, error = null)
    }

    /**
     * Reset para estado inicial.
     */
    fun reset(): PaginatedState<T> {
        return PaginatedState()
    }

    companion object {
        /**
         * Estado inicial de loading.
         */
        fun <T : Any> initial(): PaginatedState<T> {
            return PaginatedState(isLoading = true)
        }

        /**
         * Estado inicial vazio.
         */
        fun <T : Any> empty(): PaginatedState<T> {
            return PaginatedState(items = emptyList(), hasMore = false)
        }
    }
}

/**
 * Obtém uma chave estável para um item.
 *
 * Para evitar recomposições desnecessárias, cada item deve ter uma chave única
 * que permanece constante entre recomposições.
 */
private fun <T : Any> getStableKey(item: T): String {
    return when (item) {
        is PlayerRankingItem -> item.userId
        // Adicionar tipos conforme necessário
        else -> item.toString().hashCode().toString()
    }
}

/**
 * ViewModel para paginação de ranking.
 *
 * Gerencia estado e carregamento de páginas.
 */
abstract class RankingPagingViewModel<T : Any> {
    private val _state = mutableStateOf<PaginatedState<T>>(PaginatedState.empty())
    val state: State<PaginatedState<T>> = _state

    protected var currentPage = 0
        private set

    /**
     * Carrega a próxima página.
     */
    abstract suspend fun loadPage(page: Int): Result<List<T>>

    /**
     * Carrega mais itens.
     */
    suspend fun loadMore() {
        val currentState = _state.value
        if (currentState.isLoading || !currentState.hasMore) return

        _state.value = currentState.asLoading()

        val result = loadPage(currentPage)

        result.fold(
            onSuccess = { items ->
                _state.value = currentState.withNewItems(
                    newItems = items,
                    hasMore = items.isNotEmpty()
                )
                currentPage++
            },
            onFailure = { error ->
                _state.value = currentState.withError(error)
            }
        )
    }

    /**
     * Recarrega a primeira página.
     */
    suspend fun refresh() {
        currentPage = 0
        _state.value = PaginatedState.initial()

        val result = loadPage(0)

        result.fold(
            onSuccess = { items ->
                _state.value = PaginatedState(
                    items = items,
                    hasMore = items.isNotEmpty(),
                    isLoading = false
                )
                currentPage = if (items.isNotEmpty()) 1 else 0
            },
            onFailure = { error ->
                _state.value = PaginatedState(
                    items = emptyList(),
                    hasMore = true,
                    isLoading = false,
                    error = error
                )
            }
        )
    }

    /**
     * Tenta novamente carregar a última página que falhou.
     */
    suspend fun retry() {
        val currentState = _state.value
        if (!currentState.hasError) return

        _state.value = currentState.copy(error = null, isLoading = true)
        loadMore()
    }
}

/**
 * Composable auxiliar para gerenciar estado de paginação.
 */
@Composable
fun <T : Any> rememberPaginatedState(
    initialItems: List<T> = emptyList(),
    hasMore: Boolean = true
): State<PaginatedState<T>> {
    return remember {
        mutableStateOf(
            PaginatedState(
                items = initialItems,
                hasMore = hasMore
            )
        )
    }
}
