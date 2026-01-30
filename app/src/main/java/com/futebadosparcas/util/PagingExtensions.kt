package com.futebadosparcas.util

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.paging.LoadState
import androidx.paging.compose.LazyPagingItems

/**
 * Paging 3 - Extension Functions
 *
 * Provides convenient helpers for handling Paging 3 states in Compose.
 */

/**
 * Adds loading/error items to a LazyColumn/LazyRow for Paging states
 *
 * Usage:
 * ```kotlin
 * LazyColumn {
 *     items(usersPagingItems) { user ->
 *         UserCard(user)
 *     }
 *     loadStateItems(usersPagingItems)
 * }
 * ```
 */
fun <T : Any> LazyListScope.loadStateItems(
    pagingItems: LazyPagingItems<T>,
    onRetry: () -> Unit = { pagingItems.retry() }
) {
    // Append loading indicator
    item {
        when {
            pagingItems.loadState.append is LoadState.Loading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
            pagingItems.loadState.append is LoadState.Error -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Erro ao carregar mais itens",
                        color = MaterialTheme.colorScheme.error
                    )
                }
            }
        }
    }
}

/**
 * Renders Paging loading state (for initial load)
 */
@Composable
fun <T : Any> LoadingState(
    pagingItems: LazyPagingItems<T>,
    emptyContent: @Composable () -> Unit = {},
    errorContent: @Composable (error: LoadState.Error) -> Unit = { error ->
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "Erro: ${error.error.localizedMessage}",
                color = MaterialTheme.colorScheme.error
            )
        }
    },
    loadingContent: @Composable () -> Unit = {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator()
        }
    },
    content: @Composable () -> Unit
) {
    when {
        pagingItems.loadState.refresh is LoadState.Loading -> {
            loadingContent()
        }
        pagingItems.loadState.refresh is LoadState.Error -> {
            errorContent(pagingItems.loadState.refresh as LoadState.Error)
        }
        pagingItems.itemCount == 0 -> {
            emptyContent()
        }
        else -> {
            content()
        }
    }
}
