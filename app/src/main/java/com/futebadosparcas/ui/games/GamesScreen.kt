package com.futebadosparcas.ui.games

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.EventNote
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.ui.components.AnimatedStateContainer
import com.futebadosparcas.ui.components.StateType
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.data.repository.GameFilterType
import com.futebadosparcas.ui.components.design.AppTopBar
import com.futebadosparcas.ui.components.ShimmerGameCard
import com.futebadosparcas.ui.theme.GamificationColors
import com.futebadosparcas.ui.theme.Spacing
import com.futebadosparcas.ui.adaptive.adaptiveContentWidth
import com.futebadosparcas.ui.adaptive.rememberWindowSizeClass
import com.futebadosparcas.ui.adaptive.WindowWidthSizeClass
import com.futebadosparcas.R
import com.futebadosparcas.ui.theme.AppDimensions
import androidx.compose.ui.res.stringResource

/**
 * GamesScreen - Tela de listagem de jogos em Jetpack Compose
 *
 * Features:
 * - Listagem responsiva (grid ou lista)
 * - Filtros por tipo (Todos, Abertos, Meus Jogos)
 * - Cards com informações do jogo
 * - Estados de loading, success, error
 * - Pull-to-refresh (via Fragment)
 * - Navegação via callbacks
 */
@Composable
fun GamesScreen(
    viewModel: GamesViewModel,
    onGameClick: (gameId: String) -> Unit = {},
    onCreateGameClick: () -> Unit = {},
    onNotificationsClick: () -> Unit = {},
    onGroupsClick: () -> Unit = {},
    onMapClick: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val unreadCount by viewModel.unreadCount.collectAsStateWithLifecycle()

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        topBar = {
            AppTopBar.Root(
                unreadCount = unreadCount,
                onNavigateNotifications = onNotificationsClick,
                onNavigateGroups = onGroupsClick,
                onNavigateMap = onMapClick
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = onCreateGameClick,
                containerColor = MaterialTheme.colorScheme.primary
            ) {
                Icon(Icons.Default.Add, contentDescription = stringResource(R.string.create_game))
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(MaterialTheme.colorScheme.background)
        ) {
            // Transições animadas entre estados (fade + slide)
            AnimatedStateContainer(
                targetState = uiState,
                stateMapper = { state ->
                    when (state) {
                        is GamesUiState.Loading -> StateType.LOADING
                        is GamesUiState.Success -> StateType.SUCCESS
                        is GamesUiState.Empty -> StateType.EMPTY
                        is GamesUiState.Error -> StateType.ERROR
                    }
                },
                modifier = Modifier.fillMaxSize(),
                label = "gamesStateTransition"
            ) { currentState ->
                when (currentState) {
                    is GamesUiState.Loading -> {
                        GamesLoadingState()
                    }
                    is GamesUiState.Success -> {
                        GamesSuccessContent(
                            games = currentState.games,
                            onGameClick = onGameClick,
                            viewModel = viewModel,
                            onFilterChange = { filterType ->
                                viewModel.loadGames(filterType)
                            }
                        )
                    }
                    is GamesUiState.Empty -> {
                        GamesEmptyState(
                            onCreateGameClick = onCreateGameClick
                        )
                    }
                    is GamesUiState.Error -> {
                        GamesErrorState(
                            message = currentState.message,
                            onRetry = {
                                viewModel.loadGames()
                            }
                        )
                    }
                }
            }
        }
    }
}

/**
 * Conteúdo quando temos jogos para exibir.
 *
 * Compact: lista de coluna única.
 * Medium/Expanded: grid de 2 colunas para melhor uso do espaço.
 */
@Composable
private fun GamesSuccessContent(
    games: List<GameWithConfirmations>,
    onGameClick: (gameId: String) -> Unit,
    onFilterChange: (GameFilterType) -> Unit,
    viewModel: GamesViewModel
) {
    var selectedFilter by remember { mutableStateOf(GameFilterType.ALL) }
    val windowSizeClass = rememberWindowSizeClass()

    // Prefetch detalhes dos primeiros 5 jogos quando a lista é carregada.
    // List não é estável no Compose; usamos chave derivada estável (ids dos jogos)
    // para evitar re-execução do efeito a cada recomposição.
    val gamesKey = remember(games) { games.joinToString(",") { it.game.id } }
    LaunchedEffect(gamesKey) {
        if (games.isNotEmpty()) {
            viewModel.prefetchGameDetails(games)
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        // Filtros
        GamesFilters(
            selectedFilter = selectedFilter,
            onFilterChange = { newFilter ->
                selectedFilter = newFilter
                onFilterChange(newFilter)
            },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = windowSizeClass.horizontalPadding, vertical = AppDimensions.spacing_medium)
        )

        if (windowSizeClass.widthSizeClass == WindowWidthSizeClass.COMPACT) {
            // Compact: lista vertical simples
            LazyColumn(
                // SECFIX #489: adaptiveContentWidth() centraliza em tablets/desktop
                modifier = Modifier
                    .fillMaxSize()
                    .adaptiveContentWidth(),
                contentPadding = PaddingValues(
                    horizontal = windowSizeClass.horizontalPadding,
                    vertical = AppDimensions.spacing_small
                ),
                verticalArrangement = Arrangement.spacedBy(AppDimensions.spacing_small)
            ) {
                items(games, key = { it.game.id }) { game ->
                    GameCard(
                        game = game,
                        onClick = { onGameClick(game.game.id) },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        } else {
            // Medium/Expanded: grid de 2 colunas
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                // SECFIX #489: adaptiveContentWidth() limita 840/1040dp + centraliza
                modifier = Modifier
                    .fillMaxSize()
                    .adaptiveContentWidth(),
                contentPadding = PaddingValues(
                    horizontal = windowSizeClass.horizontalPadding,
                    vertical = AppDimensions.spacing_small
                ),
                horizontalArrangement = Arrangement.spacedBy(windowSizeClass.gridSpacing),
                verticalArrangement = Arrangement.spacedBy(windowSizeClass.gridSpacing)
            ) {
                items(games, key = { it.game.id }) { game ->
                    GameCard(
                        game = game,
                        onClick = { onGameClick(game.game.id) },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }
    }
}

/**
 * Filtros para tipos de jogos
 */
@Composable
private fun GamesFilters(
    selectedFilter: GameFilterType,
    onFilterChange: (GameFilterType) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(AppDimensions.spacing_small)
    ) {
        FilterChip(
            selected = selectedFilter == GameFilterType.ALL,
            onClick = { onFilterChange(GameFilterType.ALL) },
            label = { Text(stringResource(R.string.all_games)) },
            leadingIcon = {
                Icon(
                    imageVector = if (selectedFilter == GameFilterType.ALL) Icons.Default.Check else Icons.Default.FilterList,
                    contentDescription = stringResource(R.string.all_games),
                    modifier = Modifier.size(FilterChipDefaults.IconSize)
                )
            }
        )

        FilterChip(
            selected = selectedFilter == GameFilterType.OPEN,
            onClick = { onFilterChange(GameFilterType.OPEN) },
            label = { Text(stringResource(R.string.open_games)) },
            leadingIcon = {
                Icon(
                    imageVector = if (selectedFilter == GameFilterType.OPEN) Icons.Default.Check else Icons.Default.LockOpen,
                    contentDescription = stringResource(R.string.open_games),
                    modifier = Modifier.size(FilterChipDefaults.IconSize)
                )
            }
        )

        FilterChip(
            selected = selectedFilter == GameFilterType.MY_GAMES,
            onClick = { onFilterChange(GameFilterType.MY_GAMES) },
            label = { Text(stringResource(R.string.my_games)) },
            leadingIcon = {
                Icon(
                    imageVector = if (selectedFilter == GameFilterType.MY_GAMES) Icons.Default.Check else Icons.Default.Person,
                    contentDescription = stringResource(R.string.my_games),
                    modifier = Modifier.size(FilterChipDefaults.IconSize)
                )
            }
        )
    }
}

/**
 * Card individual de jogo
 */
@Composable
private fun GameCard(
    game: GameWithConfirmations,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val dateTime = buildString {
        append(game.game.date)
        if (game.game.time.isNotEmpty()) append(" ${game.game.time}")
    }
    val players = "${game.game.playersCount} ${stringResource(R.string.confirmed_players)}"
    val cardCd = stringResource(R.string.cd_game_card, game.game.locationName, dateTime, players)

    Card(
        onClick = onClick,
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = AppDimensions.card_min_height)
            .semantics(mergeDescendants = true) { contentDescription = cardCd },
        shape = RoundedCornerShape(AppDimensions.radius_medium),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(AppDimensions.spacing_medium),
            verticalArrangement = Arrangement.spacedBy(AppDimensions.spacing_small)
        ) {
            // Header com local e tipo de campo
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = game.game.locationName,
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )

                    if (game.game.locationAddress.isNotEmpty()) {
                        Text(
                            text = game.game.locationAddress,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }

                // Badge de tipo de campo
                Surface(
                    shape = RoundedCornerShape(Spacing.sm),
                    color = getFieldTypeColor(game.game.gameType),
                    modifier = Modifier.padding(start = AppDimensions.spacing_small)
                ) {
                    Text(
                        text = game.game.gameType,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.padding(horizontal = AppDimensions.spacing_small, vertical = AppDimensions.spacing_extraSmall)
                    )
                }
            }

            // Data e hora
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(AppDimensions.spacing_extraSmall)
            ) {
                Icon(
                    imageVector = Icons.Default.Schedule,
                    contentDescription = null,
                    modifier = Modifier.size(AppDimensions.icon_small),
                    tint = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = buildString {
                        append(game.game.date)
                        if (game.game.time.isNotEmpty()) {
                            append(" ${game.game.time}")
                        } else {
                            append(" (--:--)")
                        }
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = if (game.game.time.isEmpty()) {
                        MaterialTheme.colorScheme.error
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    }
                )
            }

            // Confirmações
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(AppDimensions.spacing_small)
            ) {
                Icon(
                    imageVector = Icons.Default.Person,
                    contentDescription = null,
                    modifier = Modifier.size(AppDimensions.icon_small),
                    tint = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = "${game.game.playersCount} ${stringResource(R.string.confirmed_players)}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(modifier = Modifier.weight(1f))

                // Status badge
                if (game.game.status.isNotEmpty()) {
                    Surface(
                        shape = RoundedCornerShape(AppDimensions.spacing_extraSmall),
                        color = getStatusColor(game.game.status),
                        modifier = Modifier.padding(end = AppDimensions.spacing_extraSmall)
                    ) {
                        Text(
                            text = getStatusText(game.game.status),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onPrimary,
                            modifier = Modifier.padding(horizontal = Spacing.sm, vertical = 2.dp)
                        )
                    }
                }
            }
        }
    }
}

/**
 * Estado de loading
 */
@Composable
private fun GamesLoadingState() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(AppDimensions.spacing_medium),
        verticalArrangement = Arrangement.spacedBy(AppDimensions.spacing_medium)
    ) {
        repeat(6) {
            ShimmerGameCard()
        }
    }
}

/**
 * Estado vazio - Nenhum jogo agendado com CTA para criar jogo
 */
@Composable
private fun GamesEmptyState(
    onCreateGameClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(AppDimensions.spacing_extraLarge),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.AutoMirrored.Filled.EventNote,
            contentDescription = null,
            modifier = Modifier.size(AppDimensions.avatar_extraLarge),
            tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.6f)
        )

        Spacer(modifier = Modifier.height(AppDimensions.spacing_extraLarge))

        Text(
            text = stringResource(R.string.empty_state_no_games_title_generic),
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(AppDimensions.spacing_medium))

        Text(
            text = stringResource(R.string.empty_state_no_games_desc_generic),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier
                .fillMaxWidth(0.8f)
                .padding(bottom = AppDimensions.spacing_extraLarge)
        )

        FilledTonalButton(
            onClick = onCreateGameClick,
            modifier = Modifier
                .fillMaxWidth(0.6f)
                .height(AppDimensions.height_button_large)
        ) {
            Icon(Icons.Default.Add, contentDescription = stringResource(R.string.create_game), modifier = Modifier.size(Spacing.md))
            Spacer(modifier = Modifier.width(AppDimensions.spacing_small))
            Text(stringResource(R.string.empty_state_no_games_action))
        }
    }
}

/**
 * Estado de erro
 */
@Composable
private fun GamesErrorState(
    message: String,
    onRetry: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(AppDimensions.spacing_large),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.Default.ErrorOutline,
            contentDescription = null,
            modifier = Modifier.size(AppDimensions.avatar_large),
            tint = MaterialTheme.colorScheme.error
        )

        Spacer(modifier = Modifier.height(AppDimensions.spacing_large))

        Text(
            text = stringResource(R.string.error),
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.error
        )

        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(vertical = AppDimensions.spacing_large),
            textAlign = TextAlign.Center
        )

        // Protege contra double-tap: desabilita o botão e mostra loading durante o retry
        var isRetrying by remember { mutableStateOf(false) }
        Button(
            onClick = {
                isRetrying = true
                onRetry()
            },
            enabled = !isRetrying
        ) {
            if (isRetrying) {
                CircularProgressIndicator(
                    modifier = Modifier.size(Spacing.md),
                    strokeWidth = 2.dp,
                    color = MaterialTheme.colorScheme.onPrimary
                )
            } else {
                Icon(Icons.Default.Refresh, contentDescription = stringResource(R.string.retry), modifier = Modifier.size(Spacing.md))
                Spacer(modifier = Modifier.width(AppDimensions.spacing_small))
                Text(stringResource(R.string.retry))
            }
        }
    }
}

/**
 * Obtém cor baseada no tipo de campo
 */
private fun getFieldTypeColor(fieldType: String) = when (fieldType.lowercase()) {
    "society" -> com.futebadosparcas.ui.theme.FieldTypeColors.Society
    "futsal" -> com.futebadosparcas.ui.theme.FieldTypeColors.Futsal
    "grama", "campo" -> com.futebadosparcas.ui.theme.FieldTypeColors.Campo
    "areia" -> com.futebadosparcas.ui.theme.FieldTypeColors.Areia
    else -> com.futebadosparcas.ui.theme.FieldTypeColors.Outros
}

/**
 * Obtém cor baseada no status do jogo
 */
private fun getStatusColor(status: String) = when (status.uppercase()) {
    "OPEN" -> com.futebadosparcas.ui.theme.GameStatusColors.Scheduled
    "CONFIRMED" -> com.futebadosparcas.ui.theme.GameStatusColors.InProgress
    "SCHEDULED" -> com.futebadosparcas.ui.theme.GameStatusColors.Scheduled
    "LIVE" -> com.futebadosparcas.ui.theme.GameStatusColors.Full
    "FINISHED" -> com.futebadosparcas.ui.theme.GameStatusColors.Finished
    "CANCELLED" -> com.futebadosparcas.ui.theme.GameStatusColors.Cancelled
    else -> com.futebadosparcas.ui.theme.GameStatusColors.Finished
}

/**
 * Traduz o status do jogo para texto legível
 */
@Composable
private fun getStatusText(status: String): String = when (status.uppercase()) {
    "OPEN" -> stringResource(R.string.status_display_open)
    "CONFIRMED" -> stringResource(R.string.status_display_confirmed)
    "SCHEDULED" -> stringResource(R.string.status_display_scheduled)
    "LIVE" -> stringResource(R.string.status_display_live)
    "FINISHED" -> stringResource(R.string.status_display_finished)
    "CANCELLED" -> stringResource(R.string.status_display_cancelled)
    else -> status
}

/**
 * Formata data/hora do jogo
 */
private fun formatGameDateTime(timestamp: Long): String {
    val sdf = java.text.SimpleDateFormat("dd/MM HH:mm", java.util.Locale.getDefault())
    return sdf.format(java.util.Date(timestamp))
}
