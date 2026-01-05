package com.futebadosparcas.ui.adaptive

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R

/**
 * Item de navegação para o scaffold adaptativo.
 */
data class AdaptiveNavItem(
    val route: String,
    val labelResId: Int,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector,
    val badgeCount: Int = 0
)

/**
 * Scaffold adaptativo que alterna entre BottomNavigation, NavigationRail e PermanentDrawer
 * baseado no tamanho da tela.
 *
 * - Compact (< 600dp): BottomNavigationBar
 * - Medium (600-839dp): NavigationRail
 * - Expanded (>= 840dp): NavigationRail ou PermanentDrawer (se >= 1200dp)
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdaptiveScaffold(
    navItems: List<AdaptiveNavItem>,
    selectedRoute: String,
    onNavigate: (String) -> Unit,
    modifier: Modifier = Modifier,
    topBar: @Composable () -> Unit = {},
    floatingActionButton: @Composable () -> Unit = {},
    content: @Composable (PaddingValues) -> Unit
) {
    val windowSizeClass = rememberWindowSizeClass()
    val spacing = rememberAdaptiveSpacing()

    when {
        // Compact: BottomNavigationBar
        windowSizeClass.isCompact -> {
            Scaffold(
                modifier = modifier,
                topBar = topBar,
                bottomBar = {
                    AdaptiveBottomBar(
                        navItems = navItems,
                        selectedRoute = selectedRoute,
                        onNavigate = onNavigate
                    )
                },
                floatingActionButton = floatingActionButton,
                content = content
            )
        }

        // Medium/Expanded: NavigationRail
        else -> {
            Row(modifier = modifier.fillMaxSize()) {
                AdaptiveNavigationRail(
                    navItems = navItems,
                    selectedRoute = selectedRoute,
                    onNavigate = onNavigate,
                    isExpanded = windowSizeClass.isExpanded
                )

                Scaffold(
                    modifier = Modifier.weight(1f),
                    topBar = topBar,
                    floatingActionButton = floatingActionButton,
                    content = content
                )
            }
        }
    }
}

/**
 * Bottom Navigation Bar para telas compactas.
 */
@Composable
private fun AdaptiveBottomBar(
    navItems: List<AdaptiveNavItem>,
    selectedRoute: String,
    onNavigate: (String) -> Unit
) {
    NavigationBar {
        navItems.forEach { item ->
            val selected = item.route == selectedRoute
            NavigationBarItem(
                selected = selected,
                onClick = { onNavigate(item.route) },
                icon = {
                    BadgedBox(
                        badge = {
                            if (item.badgeCount > 0) {
                                Badge { Text(item.badgeCount.toString()) }
                            }
                        }
                    ) {
                        Icon(
                            imageVector = if (selected) item.selectedIcon else item.unselectedIcon,
                            contentDescription = stringResource(item.labelResId)
                        )
                    }
                },
                label = { Text(stringResource(item.labelResId)) }
            )
        }
    }
}

/**
 * Navigation Rail para telas médias e expandidas.
 */
@Composable
private fun AdaptiveNavigationRail(
    navItems: List<AdaptiveNavItem>,
    selectedRoute: String,
    onNavigate: (String) -> Unit,
    isExpanded: Boolean
) {
    NavigationRail(
        modifier = Modifier.fillMaxHeight(),
        containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
    ) {
        Spacer(Modifier.height(12.dp))

        navItems.forEach { item ->
            val selected = item.route == selectedRoute
            NavigationRailItem(
                selected = selected,
                onClick = { onNavigate(item.route) },
                icon = {
                    BadgedBox(
                        badge = {
                            if (item.badgeCount > 0) {
                                Badge { Text(item.badgeCount.toString()) }
                            }
                        }
                    ) {
                        Icon(
                            imageVector = if (selected) item.selectedIcon else item.unselectedIcon,
                            contentDescription = stringResource(item.labelResId)
                        )
                    }
                },
                label = if (isExpanded) {
                    { Text(stringResource(item.labelResId)) }
                } else null
            )
        }
    }
}

/**
 * Container de conteúdo com largura máxima para tablets.
 * Centraliza o conteúdo e aplica padding adequado.
 */
@Composable
fun AdaptiveContentContainer(
    modifier: Modifier = Modifier,
    maxWidth: Dp = Dp.Unspecified,
    horizontalPadding: Dp = 16.dp,
    content: @Composable ColumnScope.() -> Unit
) {
    val windowSizeClass = rememberWindowSizeClass()
    val effectiveMaxWidth = if (maxWidth == Dp.Unspecified) {
        windowSizeClass.contentMaxWidth
    } else {
        maxWidth
    }

    Box(
        modifier = modifier.fillMaxWidth(),
        contentAlignment = Alignment.TopCenter
    ) {
        Column(
            modifier = Modifier
                .then(
                    if (effectiveMaxWidth != Dp.Unspecified) {
                        Modifier.widthIn(max = effectiveMaxWidth)
                    } else {
                        Modifier.fillMaxWidth()
                    }
                )
                .padding(horizontal = horizontalPadding),
            content = content
        )
    }
}

/**
 * Layout de duas colunas adaptativo.
 * Em telas compactas, mostra apenas uma coluna.
 * Em telas maiores, mostra duas colunas lado a lado.
 */
@Composable
fun AdaptiveTwoPane(
    modifier: Modifier = Modifier,
    primaryPane: @Composable () -> Unit,
    secondaryPane: @Composable () -> Unit,
    primaryWeight: Float = 0.5f,
    showSecondary: Boolean = true
) {
    val windowSizeClass = rememberWindowSizeClass()
    val spacing = rememberAdaptiveSpacing()

    if (windowSizeClass.useTwoColumns && showSecondary) {
        Row(
            modifier = modifier.fillMaxSize(),
            horizontalArrangement = Arrangement.spacedBy(spacing.md)
        ) {
            Box(modifier = Modifier.weight(primaryWeight)) {
                primaryPane()
            }
            Box(modifier = Modifier.weight(1f - primaryWeight)) {
                secondaryPane()
            }
        }
    } else {
        Box(modifier = modifier.fillMaxSize()) {
            primaryPane()
        }
    }
}

/**
 * Layout de lista-detalhe adaptativo.
 * Em telas compactas, mostra apenas a lista ou o detalhe.
 * Em telas maiores, mostra ambos lado a lado.
 */
@Composable
fun AdaptiveListDetail(
    modifier: Modifier = Modifier,
    listPane: @Composable () -> Unit,
    detailPane: @Composable () -> Unit,
    showDetail: Boolean,
    onBackToList: () -> Unit,
    listWeight: Float = 0.35f
) {
    val windowSizeClass = rememberWindowSizeClass()
    val spacing = rememberAdaptiveSpacing()

    if (windowSizeClass.useTwoColumns) {
        // Tablet/Landscape: mostra ambos os painéis
        Row(
            modifier = modifier.fillMaxSize(),
            horizontalArrangement = Arrangement.spacedBy(spacing.sm)
        ) {
            Box(modifier = Modifier.weight(listWeight)) {
                listPane()
            }
            Box(modifier = Modifier.weight(1f - listWeight)) {
                if (showDetail) {
                    detailPane()
                } else {
                    // Placeholder quando nenhum item está selecionado
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = stringResource(R.string.select_item_to_view_details),
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    } else {
        // Telefone: mostra um ou outro com animação
        Box(modifier = modifier.fillMaxSize()) {
            AnimatedVisibility(
                visible = !showDetail,
                enter = slideInHorizontally { -it },
                exit = slideOutHorizontally { -it }
            ) {
                listPane()
            }

            AnimatedVisibility(
                visible = showDetail,
                enter = slideInHorizontally { it },
                exit = slideOutHorizontally { it }
            ) {
                detailPane()
            }
        }
    }
}
