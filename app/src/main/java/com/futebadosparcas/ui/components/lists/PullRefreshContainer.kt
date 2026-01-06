package com.futebadosparcas.ui.components.lists

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/**
 * Container com pull-to-refresh integrado seguindo Material Design 3.
 * Envolve o conteúdo (geralmente uma LazyColumn/LazyVerticalGrid) com suporte a swipe-down para refresh.
 *
 * @param isRefreshing Estado de carregamento
 * @param onRefresh Callback executado quando o usuário puxa para atualizar
 * @param modifier Modificador opcional
 * @param content Conteúdo da lista (LazyColumn, LazyVerticalGrid, etc)
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PullRefreshContainer(
    isRefreshing: Boolean,
    onRefresh: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    PullToRefreshBox(
        isRefreshing = isRefreshing,
        onRefresh = onRefresh,
        modifier = modifier.fillMaxSize()
    ) {
        content()
    }
}
