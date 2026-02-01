package com.futebadosparcas.ui.components.modern

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

/**
 * Container Pull-to-Refresh moderno (Material 3)
 *
 * Substitui o deprecated SwipeRefresh com a API moderna PullToRefreshBox
 *
 * @param isRefreshing Se está em estado de refresh
 * @param onRefresh Callback ao puxar para refresh
 * @param content Conteúdo scrollável (LazyColumn, LazyVerticalGrid, etc.)
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PullToRefreshContainer(
    isRefreshing: Boolean,
    onRefresh: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    val state = rememberPullToRefreshState()

    PullToRefreshBox(
        isRefreshing = isRefreshing,
        onRefresh = onRefresh,
        state = state,
        modifier = modifier.fillMaxSize(),
        indicator = {
            Indicator(
                state = state,
                isRefreshing = isRefreshing,
                modifier = Modifier.align(Alignment.TopCenter),
                containerColor = MaterialTheme.colorScheme.surfaceContainerHighest,
                color = MaterialTheme.colorScheme.primary
            )
        }
    ) {
        content()
    }
}

/**
 * Exemplo de uso com LazyColumn
 */
@Composable
fun PullToRefreshExample(
    isRefreshing: Boolean,
    onRefresh: () -> Unit,
    content: @Composable () -> Unit
) {
    PullToRefreshContainer(
        isRefreshing = isRefreshing,
        onRefresh = onRefresh
    ) {
        content()
    }
}
