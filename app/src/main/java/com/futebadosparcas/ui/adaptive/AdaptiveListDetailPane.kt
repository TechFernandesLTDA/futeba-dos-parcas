package com.futebadosparcas.ui.adaptive

import android.os.Parcelable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.adaptive.ExperimentalMaterial3AdaptiveApi
import androidx.compose.material3.adaptive.layout.AnimatedPane
import androidx.compose.material3.adaptive.layout.ListDetailPaneScaffoldRole
import androidx.compose.material3.adaptive.navigation.NavigableListDetailPaneScaffold
import androidx.compose.material3.adaptive.navigation.rememberListDetailPaneScaffoldNavigator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import kotlinx.coroutines.launch
import kotlinx.parcelize.Parcelize

@Parcelize
private data class AdaptivePaneKey(val id: String) : Parcelable

/**
 * Expanded-only Material3 list-detail scaffold.
 *
 * Compact and medium widths keep existing route-based behavior; expanded widths
 * keep selection local and render list + detail side by side.
 */
@OptIn(ExperimentalMaterial3AdaptiveApi::class)
@Composable
fun ExpandedListDetailPane(
    selectedId: String?,
    onSelectId: (String) -> Unit,
    compactContent: @Composable () -> Unit,
    listPane: @Composable (onItemSelected: (String) -> Unit) -> Unit,
    detailPane: @Composable (selectedId: String?) -> Unit,
    modifier: Modifier = Modifier
) {
    if (!rememberWindowSizeClass().isExpanded) {
        compactContent()
        return
    }

    val navigator = rememberListDetailPaneScaffoldNavigator<AdaptivePaneKey>()
    val scope = rememberCoroutineScope()

    LaunchedEffect(selectedId) {
        selectedId?.let { id ->
            navigator.navigateTo(ListDetailPaneScaffoldRole.Detail, AdaptivePaneKey(id))
        }
    }

    NavigableListDetailPaneScaffold(
        modifier = modifier.fillMaxSize(),
        navigator = navigator,
        listPane = {
            AnimatedPane {
                listPane { id ->
                    onSelectId(id)
                    scope.launch {
                        navigator.navigateTo(ListDetailPaneScaffoldRole.Detail, AdaptivePaneKey(id))
                    }
                }
            }
        },
        detailPane = {
            AnimatedPane {
                Box(modifier = Modifier.fillMaxSize()) {
                    detailPane(selectedId)
                }
            }
        }
    )
}
