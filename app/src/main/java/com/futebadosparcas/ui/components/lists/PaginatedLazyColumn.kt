package com.futebadosparcas.ui.components.lists

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/**
 * LazyColumn com paginação automática e pull-to-refresh integrados.
 * Detecta quando o usuário rola até o final e carrega mais itens automaticamente.
 *
 * @param modifier Modificador opcional
 * @param state Estado da LazyList para controle externo de scroll
 * @param isRefreshing Estado de refresh
 * @param onRefresh Callback para pull-to-refresh
 * @param hasMoreItems Indica se existem mais itens para carregar
 * @param isLoadingMore Indica se está carregando mais itens
 * @param onLoadMore Callback executado quando o usuário chega ao final da lista
 * @param contentPadding Padding do conteúdo
 * @param verticalArrangement Arranjo vertical dos itens
 * @param content Conteúdo da lista (items, etc)
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PaginatedLazyColumn(
    modifier: Modifier = Modifier,
    state: LazyListState = rememberLazyListState(),
    isRefreshing: Boolean = false,
    onRefresh: (() -> Unit)? = null,
    hasMoreItems: Boolean = true,
    isLoadingMore: Boolean = false,
    onLoadMore: () -> Unit = {},
    contentPadding: PaddingValues = PaddingValues(0.dp),
    verticalArrangement: Arrangement.Vertical = Arrangement.Top,
    content: LazyListScope.() -> Unit
) {
    // Detecta quando o usuário chegou próximo ao final da lista
    val shouldLoadMore by remember {
        derivedStateOf {
            val lastVisibleItem = state.layoutInfo.visibleItemsInfo.lastOrNull()
            val totalItems = state.layoutInfo.totalItemsCount

            // Carrega quando está nos últimos 3 itens
            lastVisibleItem != null &&
                lastVisibleItem.index >= totalItems - 3 &&
                hasMoreItems &&
                !isLoadingMore
        }
    }

    // Trigger de paginação
    LaunchedEffect(shouldLoadMore) {
        if (shouldLoadMore) {
            onLoadMore()
        }
    }

    if (onRefresh != null) {
        PullRefreshContainer(
            isRefreshing = isRefreshing,
            onRefresh = onRefresh,
            modifier = modifier
        ) {
            LazyColumnContent(
                state = state,
                contentPadding = contentPadding,
                verticalArrangement = verticalArrangement,
                isLoadingMore = isLoadingMore,
                content = content
            )
        }
    } else {
        LazyColumnContent(
            modifier = modifier,
            state = state,
            contentPadding = contentPadding,
            verticalArrangement = verticalArrangement,
            isLoadingMore = isLoadingMore,
            content = content
        )
    }
}

@Composable
private fun LazyColumnContent(
    modifier: Modifier = Modifier,
    state: LazyListState,
    contentPadding: PaddingValues,
    verticalArrangement: Arrangement.Vertical,
    isLoadingMore: Boolean,
    content: LazyListScope.() -> Unit
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        state = state,
        contentPadding = contentPadding,
        verticalArrangement = verticalArrangement
    ) {
        content()

        // Indicador de loading no final da lista
        if (isLoadingMore) {
            item(key = "loading_more_indicator") {
                LoadMoreIndicator(
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}
