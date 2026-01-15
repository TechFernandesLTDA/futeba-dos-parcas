package com.futebadosparcas.ui.components.design

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.RowScope
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import com.futebadosparcas.ui.theme.AppDimensions

/**
 * Scaffold padrão do aplicativo.
 *
 * Wrapper em torno do Material 3 Scaffold com configurações
 * padronizadas para o Futeba dos Parças.
 *
 * @param modifier Modificador opcional
 * @param topBar Barra superior (opcional)
 * @param bottomBar Barra inferior (opcional)
 * @param snackbarHost Host para Snackbar
 * @param floatingActionButton FAB (opcional)
 * @param containerColor Cor de fundo do container
 * @param contentColor Cor do conteúdo
 * @param content Conteúdo principal da tela
 */
@Composable
fun AppScaffold(
    modifier: Modifier = Modifier,
    topBar: (@Composable () -> Unit)? = null,
    bottomBar: (@Composable () -> Unit)? = null,
    snackbarHost: @Composable (SnackbarHostState) -> Unit = { SnackbarHost(it) },
    floatingActionButton: (@Composable () -> Unit)? = null,
    containerColor: Color = MaterialTheme.colorScheme.background,
    contentColor: Color = MaterialTheme.colorScheme.onBackground,
    content: @Composable (PaddingValues) -> Unit
) {
    Scaffold(
        modifier = modifier,
        topBar = if (topBar != null) {
            { topBar() }
        } else {
            {}
        },
        bottomBar = if (bottomBar != null) {
            { bottomBar() }
        } else {
            {}
        },
        snackbarHost = {
            val hostState = remember { SnackbarHostState() }
            snackbarHost(hostState)
        },
        floatingActionButton = if (floatingActionButton != null) {
            { floatingActionButton() }
        } else {
            {}
        },
        containerColor = containerColor,
        contentColor = contentColor,
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        content = content
    )
}

/**
 * TopBar padrão do aplicativo.
 *
 * @param title Título da tela
 * @param modifier Modificador opcional
 * @param navigationIcon Ícone de navegação (botão voltar, menu, etc)
 * @param actions Ações da top bar (ícones à direita)
 * @param colors Cores da top bar
 * @param scrollBehavior Comportamento ao rolar
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppTopBar(
    title: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    navigationIcon: (@Composable () -> Unit)? = null,
    actions: @Composable (RowScope.() -> Unit)? = null,
    colors: TopAppBarColors = TopAppBarDefaults.centerAlignedTopAppBarColors(),
    scrollBehavior: TopAppBarScrollBehavior? = null
) {
    CenterAlignedTopAppBar(
        title = title,
        modifier = modifier,
        navigationIcon = { navigationIcon?.invoke() },
        actions = actions ?: {},
        colors = colors,
        scrollBehavior = scrollBehavior
    )
}

/**
 * TopBar com altura média.
 *
 * @param title Título da tela
 * @param modifier Modificador opcional
 * @param navigationIcon Ícone de navegação
 * @param actions Ações da top bar
 * @param colors Cores da top bar
 * @param scrollBehavior Comportamento ao rolar
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppMediumTopBar(
    title: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    navigationIcon: (@Composable () -> Unit)? = null,
    actions: @Composable (RowScope.() -> Unit)? = null,
    colors: TopAppBarColors = TopAppBarDefaults.mediumTopAppBarColors(),
    scrollBehavior: TopAppBarScrollBehavior? = null
) {
    MediumTopAppBar(
        title = title,
        modifier = modifier,
        navigationIcon = { navigationIcon?.invoke() },
        actions = actions ?: {},
        colors = colors,
        scrollBehavior = scrollBehavior
    )
}

/**
 * TopBar grande (para destaque).
 *
 * @param title Título da tela
 * @param modifier Modificador opcional
 * @param navigationIcon Ícone de navegação
 * @param actions Ações da top bar
 * @param colors Cores da top bar
 * @param scrollBehavior Comportamento ao rolar
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppLargeTopBar(
    title: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    navigationIcon: (@Composable () -> Unit)? = null,
    actions: @Composable (RowScope.() -> Unit)? = null,
    colors: TopAppBarColors = TopAppBarDefaults.largeTopAppBarColors(),
    scrollBehavior: TopAppBarScrollBehavior? = null
) {
    LargeTopAppBar(
        title = title,
        modifier = modifier,
        navigationIcon = { navigationIcon?.invoke() },
        actions = actions ?: {},
        colors = colors,
        scrollBehavior = scrollBehavior
    )
}
