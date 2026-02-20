package com.futebadosparcas.ui.adaptive
import org.jetbrains.compose.resources.stringResource
import com.futebadosparcas.compose.resources.Res

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.VerticalDivider
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.unit.dp
/**
 * Sistema de List-Detail adaptativo para diferentes tamanhos de tela.
 * Versão simplificada que não depende de bibliotecas Material3 Adaptive.
 *
 * - Em telas pequenas: navega entre lista e detalhes
 * - Em telas grandes: mostra lista e detalhes lado a lado
 */

// ==================== Models ====================

/**
 * Item genérico para a lista.
 */
data class ListDetailItem(
    val id: String,
    val title: String,
    val subtitle: String? = null
)

/**
 * Estado do layout List-Detail.
 */
data class ListDetailState<T>(
    val items: List<T>,
    val selectedItem: T? = null,
    val isLoading: Boolean = false
)

// ==================== Helper Functions ====================

/**
 * Determina se deve usar layout de duas colunas.
 */
@Composable
fun shouldUseTwoPaneLayout(): Boolean {
    val configuration = LocalConfiguration.current
    return configuration.screenWidthDp >= 600
}

// ==================== Main Composables ====================

/**
 * Layout List-Detail adaptativo simplificado.
 */
@Composable
fun <T> AdaptiveListDetailLayout(
    items: List<T>,
    selectedItem: T?,
    onItemSelected: (T) -> Unit,
    onBackFromDetail: () -> Unit,
    modifier: Modifier = Modifier,
    itemKey: (T) -> Any = { it.hashCode() },
    listItemContent: @Composable (T, Boolean) -> Unit,
    detailContent: @Composable (T) -> Unit,
    emptyDetailContent: @Composable () -> Unit = {
        EmptyDetailPlaceholder()
    }
) {
    val useTwoPane = shouldUseTwoPaneLayout()

    if (useTwoPane) {
        // Tablet: duas colunas
        TwoPaneListDetailLayout(
            items = items,
            selectedItem = selectedItem,
            onItemSelected = onItemSelected,
            modifier = modifier,
            itemKey = itemKey,
            listItemContent = listItemContent,
            detailContent = detailContent,
            emptyDetailContent = emptyDetailContent
        )
    } else {
        // Celular: navegação entre telas
        SinglePaneListDetailLayout(
            items = items,
            selectedItem = selectedItem,
            onItemSelected = onItemSelected,
            onBackFromDetail = onBackFromDetail,
            modifier = modifier,
            itemKey = itemKey,
            listItemContent = listItemContent,
            detailContent = detailContent
        )
    }
}

/**
 * Layout de duas colunas para tablets.
 */
@Composable
fun <T> TwoPaneListDetailLayout(
    items: List<T>,
    selectedItem: T?,
    onItemSelected: (T) -> Unit,
    modifier: Modifier = Modifier,
    listWeight: Float = 0.35f,
    itemKey: (T) -> Any = { it.hashCode() },
    listItemContent: @Composable (T, Boolean) -> Unit,
    detailContent: @Composable (T) -> Unit,
    emptyDetailContent: @Composable () -> Unit
) {
    Row(modifier = modifier.fillMaxSize()) {
        // Painel da lista
        Surface(
            modifier = Modifier
                .weight(listWeight)
                .fillMaxHeight(),
            color = MaterialTheme.colorScheme.surface
        ) {
            LazyColumn(modifier = Modifier.fillMaxSize()) {
                items(
                    items = items,
                    key = { itemKey(it) }
                ) { item ->
                    val isSelected = item == selectedItem
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onItemSelected(item) }
                            .background(
                                if (isSelected) {
                                    MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
                                } else {
                                    MaterialTheme.colorScheme.surface
                                }
                            )
                    ) {
                        listItemContent(item, isSelected)
                    }
                    HorizontalDivider()
                }
            }
        }

        // Divisor vertical
        VerticalDivider(
            modifier = Modifier.fillMaxHeight(),
            color = MaterialTheme.colorScheme.outlineVariant
        )

        // Painel de detalhes
        Surface(
            modifier = Modifier
                .weight(1f - listWeight)
                .fillMaxHeight(),
            color = MaterialTheme.colorScheme.surfaceContainerLow
        ) {
            AnimatedContent(
                targetState = selectedItem,
                transitionSpec = {
                    fadeIn() togetherWith fadeOut()
                },
                label = "detail_content"
            ) { item ->
                if (item != null) {
                    detailContent(item)
                } else {
                    emptyDetailContent()
                }
            }
        }
    }
}

/**
 * Layout de painel único para celulares.
 */
@Composable
fun <T> SinglePaneListDetailLayout(
    items: List<T>,
    selectedItem: T?,
    onItemSelected: (T) -> Unit,
    onBackFromDetail: () -> Unit,
    modifier: Modifier = Modifier,
    itemKey: (T) -> Any = { it.hashCode() },
    listItemContent: @Composable (T, Boolean) -> Unit,
    detailContent: @Composable (T) -> Unit
) {
    AnimatedContent(
        targetState = selectedItem != null,
        transitionSpec = {
            if (targetState) {
                // Entrando nos detalhes
                slideInHorizontally { it } togetherWith slideOutHorizontally { -it }
            } else {
                // Voltando para lista
                slideInHorizontally { -it } togetherWith slideOutHorizontally { it }
            }
        },
        label = "list_detail_navigation",
        modifier = modifier.fillMaxSize()
    ) { showingDetail ->
        if (showingDetail && selectedItem != null) {
            // Mostra detalhes
            Column(modifier = Modifier.fillMaxSize()) {
                // Back button
                Surface(
                    color = MaterialTheme.colorScheme.surface,
                    shadowElevation = 2.dp
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = onBackFromDetail) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = stringResource(Res.string.back)
                            )
                        }
                    }
                }

                // Conteúdo dos detalhes
                Box(modifier = Modifier.fillMaxSize()) {
                    detailContent(selectedItem)
                }
            }
        } else {
            // Mostra lista
            LazyColumn(modifier = Modifier.fillMaxSize()) {
                items(
                    items = items,
                    key = { itemKey(it) }
                ) { item ->
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onItemSelected(item) }
                    ) {
                        listItemContent(item, false)
                    }
                    HorizontalDivider()
                }
            }
        }
    }
}

/**
 * Placeholder para quando nenhum item está selecionado.
 */
@Composable
fun EmptyDetailPlaceholder(
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = stringResource(Res.string.select_game_to_view),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * Helper composable para usar o layout com estado interno.
 */
@Composable
fun <T> rememberListDetailState(
    items: List<T>,
    initialSelected: T? = null
): ListDetailController<T> {
    var selectedItem by remember { mutableStateOf(initialSelected) }

    return remember(items) {
        ListDetailController(
            items = items,
            selectedItem = selectedItem,
            onItemSelected = { selectedItem = it },
            onClearSelection = { selectedItem = null }
        )
    }
}

/**
 * Controller para o estado List-Detail.
 */
data class ListDetailController<T>(
    val items: List<T>,
    val selectedItem: T?,
    val onItemSelected: (T) -> Unit,
    val onClearSelection: () -> Unit
) {
    val hasSelection: Boolean get() = selectedItem != null
}
