package com.futebadosparcas.ui.players

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.staggeredgrid.LazyVerticalStaggeredGrid
import androidx.compose.foundation.lazy.staggeredgrid.StaggeredGridCells
import androidx.compose.foundation.lazy.staggeredgrid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material.icons.automirrored.filled.TrendingUp
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.futebadosparcas.R
import com.futebadosparcas.domain.model.FieldType
import com.futebadosparcas.domain.model.PlayerRatingRole
import com.futebadosparcas.ui.components.CachedProfileImage
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.ui.components.EmptyPlayersState
import com.futebadosparcas.ui.components.EmptySearchState
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateType
import com.futebadosparcas.ui.components.PlayerCardShareHelper
import com.futebadosparcas.ui.components.ShimmerPlayerCard
import com.futebadosparcas.ui.theme.bottomBarPadding
import com.futebadosparcas.ui.theme.GamificationColors
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged

/**
 * Tela de listagem de jogadores com Jetpack Compose
 *
 * Features:
 * - SearchBar com debounce automático
 * - Filtros por tipo de campo (Society, Futsal, Campo)
 * - Ordenação (Nome, Melhor Atacante, Melhor Goleiro)
 * - Pull-to-refresh
 * - Loading com Shimmer
 * - Empty states diferenciados
 * - Grid adaptativo (responsivo para tablets)
 * - Modo comparação de jogadores
 * - Material Design 3
 */
@OptIn(FlowPreview::class, ExperimentalFoundationApi::class, ExperimentalMaterial3Api::class)
@Composable
fun PlayersScreen(
    viewModel: PlayersViewModel,
    onPlayerClick: (User) -> Unit,
    onNavigateNotifications: () -> Unit,
    onNavigateGroups: () -> Unit,
    onNavigateMap: () -> Unit,
    modifier: Modifier = Modifier
) {
    // Estados do ViewModel
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val unreadCount by viewModel.unreadCount.collectAsStateWithLifecycle()

    // Estados locais
    var searchQuery by remember { mutableStateOf(viewModel.currentQuery) }
    var selectedFieldType by remember { mutableStateOf(viewModel.currentFieldType) }
    var selectedSortOption by remember { mutableStateOf(viewModel.currentSortOption) }
    var isComparisonMode by remember { mutableStateOf(false) }
    var selectedPlayers by remember { mutableStateOf(setOf<String>()) }

    // Estado para PlayerCard BottomSheet
    var selectedPlayerForCard by remember { mutableStateOf<User?>(null) }
    val playerCardSheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    // Context para compartilhamento
    val context = androidx.compose.ui.platform.LocalContext.current

    Scaffold(
        topBar = {
            com.futebadosparcas.ui.components.FutebaTopBar(
                unreadCount = unreadCount,
                onNavigateNotifications = onNavigateNotifications,
                onNavigateGroups = onNavigateGroups,
                onNavigateMap = onNavigateMap
            )
        },
        modifier = modifier
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .background(MaterialTheme.colorScheme.background)
            ) {
                // SearchBar e Filtros
                PlayersSearchAndFilters(
                    searchQuery = searchQuery,
                    onSearchQueryChange = {
                        searchQuery = it
                        viewModel.searchPlayers(it)
                    },
                    selectedFieldType = selectedFieldType,
                    onFieldTypeChange = {
                        selectedFieldType = it
                        viewModel.setFieldTypeFilter(it)
                    },
                    selectedSortOption = selectedSortOption,
                    onSortOptionChange = {
                        selectedSortOption = it
                        viewModel.setSortOption(it)
                    },
                    isComparisonMode = isComparisonMode,
                    onToggleComparisonMode = {
                        isComparisonMode = !isComparisonMode
                        if (!isComparisonMode) {
                            selectedPlayers = emptySet()
                        }
                    }
                )

                // Conteúdo baseado no estado
                when (val state = uiState) {
                    is PlayersUiState.Loading -> {
                        // Shimmer loading
                        PlayersLoadingContent()
                    }

                    is PlayersUiState.Empty -> {
                        // Empty state
                        if (searchQuery.isNotBlank()) {
                            EmptySearchState(
                                query = searchQuery,
                                onClearSearch = {
                                    searchQuery = ""
                                },
                                modifier = Modifier.fillMaxSize()
                            )
                        } else {
                            EmptyPlayersState(
                                modifier = Modifier.fillMaxSize()
                            )
                        }
                    }

                    is PlayersUiState.Success -> {
                        // Lista de jogadores
                        PlayersListContent(
                            players = state.players,
                            isComparisonMode = isComparisonMode,
                            selectedPlayers = selectedPlayers,
                            onPlayerClick = { user ->
                                if (isComparisonMode) {
                                    selectedPlayers = if (selectedPlayers.contains(user.id)) {
                                        selectedPlayers - user.id
                                    } else if (selectedPlayers.size < 2) {
                                        selectedPlayers + user.id
                                    } else {
                                        selectedPlayers
                                    }

                                    // Se selecionou 2, carrega comparação
                                    if (selectedPlayers.size == 2) {
                                        val users = state.players.filter { it.id in selectedPlayers }
                                        if (users.size == 2) {
                                            viewModel.loadComparisonData(users[0], users[1])
                                        }
                                    }
                                } else {
                                    // Abre o PlayerCard BottomSheet ao clicar no jogador
                                    selectedPlayerForCard = user
                                }
                            },
                            onInviteClick = { user ->
                                viewModel.invitePlayer(user)
                            },
                            modifier = Modifier.fillMaxSize()
                        )
                    }

                    is PlayersUiState.Error -> {
                        // Error state
                        EmptyState(
                            type = EmptyStateType.Error(
                                title = stringResource(R.string.players_error_title),
                                description = state.message,
                                actionLabel = stringResource(R.string.retry),
                                onRetry = { viewModel.loadPlayers(searchQuery) }
                            ),
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                }
            }

            // Dialog de Comparação
            val comparisonState by viewModel.comparisonState.collectAsStateWithLifecycle()
            if (comparisonState is ComparisonUiState.Ready) {
                val readyState = comparisonState as ComparisonUiState.Ready
                ComparePlayersUiDialog(
                    user1 = readyState.user1,
                    stats1 = readyState.stats1,
                    user2 = readyState.user2,
                    stats2 = readyState.stats2,
                    onDismiss = {
                        viewModel.resetComparison()
                        selectedPlayers = emptySet()
                        isComparisonMode = false
                    }
                )
            }

            // PlayerCard BottomSheet
            selectedPlayerForCard?.let { player ->
                ModalBottomSheet(
                    onDismissRequest = { selectedPlayerForCard = null },
                    sheetState = playerCardSheetState,
                    containerColor = MaterialTheme.colorScheme.surface
                ) {
                    PlayerCardContent(
                        user = player,
                        stats = null,  // TODO: Buscar estatísticas do jogador se necessário
                        onClose = { selectedPlayerForCard = null },
                        onShare = {
                            PlayerCardShareHelper.shareAsImage(
                                context = context,
                                user = player,
                                stats = null,
                                generatedBy = "Futeba dos Parças"
                            )
                        },
                        modifier = Modifier.padding(bottom = 32.dp)
                    )
                }
            }
        }
    }
}


/**
 * Barra de busca e filtros
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PlayersSearchAndFilters(
    searchQuery: String,
    onSearchQueryChange: (String) -> Unit,
    selectedFieldType: FieldType?,
    onFieldTypeChange: (FieldType?) -> Unit,
    selectedSortOption: PlayersViewModel.SortOption,
    onSortOptionChange: (PlayersViewModel.SortOption) -> Unit,
    isComparisonMode: Boolean,
    onToggleComparisonMode: () -> Unit,
    modifier: Modifier = Modifier
) {
    val focusManager = LocalFocusManager.current

    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Barra de busca
        OutlinedTextField(
            value = searchQuery,
            onValueChange = onSearchQueryChange,
            modifier = Modifier.fillMaxWidth(),
            placeholder = { Text(stringResource(R.string.players_search_hint_players)) },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Default.Search,
                    contentDescription = stringResource(R.string.players_content_description_search)
                )
            },
            trailingIcon = {
                Row {
                    // Botão comparar
                    IconButton(
                        onClick = onToggleComparisonMode,
                        colors = IconButtonDefaults.iconButtonColors(
                            contentColor = if (isComparisonMode) {
                                MaterialTheme.colorScheme.error
                            } else {
                                MaterialTheme.colorScheme.onSurfaceVariant
                            }
                        )
                    ) {
                        Icon(
                            imageVector = if (isComparisonMode) Icons.Default.Close else Icons.Outlined.Compare,
                            contentDescription = if (isComparisonMode) stringResource(R.string.players_content_description_cancel_compare) else stringResource(R.string.players_content_description_compare)
                        )
                    }

                    // Limpar busca
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { onSearchQueryChange("") }) {
                            Icon(
                                imageVector = Icons.Default.Clear,
                                contentDescription = stringResource(R.string.players_content_description_clear_search)
                            )
                        }
                    }
                }
            },
            singleLine = true,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(
                onSearch = { focusManager.clearFocus() }
            ),
            shape = RoundedCornerShape(28.dp)
        )

        // Mensagem de modo comparação
        AnimatedVisibility(visible = isComparisonMode) {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(8.dp),
                color = MaterialTheme.colorScheme.errorContainer
            ) {
                Text(
                    text = stringResource(R.string.players_select_two),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onErrorContainer,
                    modifier = Modifier.padding(12.dp)
                )
            }
        }

        // Filtros por tipo de campo
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FilterChip(
                selected = selectedFieldType == null,
                onClick = { onFieldTypeChange(null) },
                label = { Text(stringResource(R.string.players_filter_all)) },
                leadingIcon = if (selectedFieldType == null) {
                    { Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(18.dp)) }
                } else null
            )

            FilterChip(
                selected = selectedFieldType == FieldType.SOCIETY,
                onClick = { onFieldTypeChange(FieldType.SOCIETY) },
                label = { Text(stringResource(R.string.players_filter_society)) },
                leadingIcon = {
                    Icon(
                        imageVector = if (selectedFieldType == FieldType.SOCIETY) Icons.Default.Check else Icons.Default.Sports,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                }
            )

            FilterChip(
                selected = selectedFieldType == FieldType.FUTSAL,
                onClick = { onFieldTypeChange(FieldType.FUTSAL) },
                label = { Text(stringResource(R.string.players_filter_futsal)) },
                leadingIcon = {
                    Icon(
                        imageVector = if (selectedFieldType == FieldType.FUTSAL) Icons.Default.Check else Icons.Default.SportsSoccer,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                }
            )

            FilterChip(
                selected = selectedFieldType == FieldType.CAMPO,
                onClick = { onFieldTypeChange(FieldType.CAMPO) },
                label = { Text(stringResource(R.string.players_filter_campo)) },
                leadingIcon = {
                    Icon(
                        imageVector = if (selectedFieldType == FieldType.CAMPO) Icons.Default.Check else Icons.Default.Grass,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                }
            )
        }

        // Ordenação
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FilterChip(
                selected = selectedSortOption == PlayersViewModel.SortOption.NAME,
                onClick = { onSortOptionChange(PlayersViewModel.SortOption.NAME) },
                label = { Text(stringResource(R.string.players_sort_name)) },
                leadingIcon = {
                    Icon(
                        imageVector = if (selectedSortOption == PlayersViewModel.SortOption.NAME) Icons.Default.Check else Icons.Default.SortByAlpha,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                }
            )

            FilterChip(
                selected = selectedSortOption == PlayersViewModel.SortOption.BEST_STRIKER,
                onClick = { onSortOptionChange(PlayersViewModel.SortOption.BEST_STRIKER) },
                label = { Text(stringResource(R.string.players_sort_striker)) },
                leadingIcon = {
                    Icon(
                        imageVector = if (selectedSortOption == PlayersViewModel.SortOption.BEST_STRIKER) Icons.Default.Check else Icons.AutoMirrored.Filled.TrendingUp,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                }
            )

            FilterChip(
                selected = selectedSortOption == PlayersViewModel.SortOption.BEST_GK,
                onClick = { onSortOptionChange(PlayersViewModel.SortOption.BEST_GK) },
                label = { Text(stringResource(R.string.players_sort_gk)) },
                leadingIcon = {
                    Icon(
                        imageVector = if (selectedSortOption == PlayersViewModel.SortOption.BEST_GK) Icons.Default.Check else Icons.Default.Shield,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                }
            )
        }
    }
}

/**
 * Conteúdo de loading com shimmer
 */
@Composable
private fun PlayersLoadingContent(
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        contentPadding = PaddingValues(vertical = 16.dp)
    ) {
        items(8) {
            ShimmerPlayerCard()
        }
    }
}

/**
 * Lista de jogadores
 */
@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
private fun PlayersListContent(
    players: List<User>,
    isComparisonMode: Boolean,
    selectedPlayers: Set<String>,
    onPlayerClick: (User) -> Unit,
    onInviteClick: (User) -> Unit,
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        contentPadding = PaddingValues(vertical = 16.dp)
    ) {
        items(
            items = players,
            key = { it.id }
        ) { player ->
            PlayerCard(
                player = player,
                isSelected = selectedPlayers.contains(player.id),
                isComparisonMode = isComparisonMode,
                onClick = { onPlayerClick(player) },
                onInviteClick = { onInviteClick(player) },
                modifier = Modifier.animateItem()
            )
        }
    }
}

/**
 * Card de jogador individual
 */
@Composable
private fun PlayerCard(
    player: User,
    isSelected: Boolean,
    isComparisonMode: Boolean,
    onClick: () -> Unit,
    onInviteClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 72.dp, max = 110.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) {
                MaterialTheme.colorScheme.primaryContainer
            } else {
                MaterialTheme.colorScheme.surface
            }
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Avatar
            CachedProfileImage(
                photoUrl = player.photoUrl,
                userName = player.getDisplayName(),
                size = 64.dp
            )

            Spacer(modifier = Modifier.width(12.dp))

            // Informações
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                // Nome
                Text(
                    text = player.getDisplayName(),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )

                // Ratings
                Row(
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    PlayerRatingBadge(
                        label = stringResource(R.string.players_rating_atk),
                        rating = player.getEffectiveRating(PlayerRatingRole.STRIKER),
                        color = MaterialTheme.colorScheme.tertiary
                    )

                    PlayerRatingBadge(
                        label = stringResource(R.string.players_rating_gk),
                        rating = player.getEffectiveRating(PlayerRatingRole.GOALKEEPER),
                        color = MaterialTheme.colorScheme.secondary
                    )
                }
            }

            // Nível/Badge e botão de convite
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                // Nível
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = GamificationColors.Gold.copy(alpha = 0.15f)
                ) {
                    Text(
                        text = stringResource(R.string.players_level_format, player.level),
                        style = MaterialTheme.typography.labelMedium,
                        color = GamificationColors.Gold,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }

                // Botão de convite (apenas se não estiver em modo comparação)
                if (!isComparisonMode) {
                    IconButton(
                        onClick = onInviteClick,
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.PersonAdd,
                            contentDescription = stringResource(R.string.players_content_description_invite),
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                }
            }

            // Checkbox de seleção (modo comparação)
            if (isComparisonMode) {
                Spacer(modifier = Modifier.width(8.dp))

                Checkbox(
                    checked = isSelected,
                    onCheckedChange = null // Handled by card click
                )
            }
        }
    }
}

/**
 * Badge de rating do jogador
 */
@Composable
private fun PlayerRatingBadge(
    label: String,
    rating: Double,
    color: Color,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            fontWeight = FontWeight.Medium
        )

        Surface(
            shape = RoundedCornerShape(4.dp),
            color = color.copy(alpha = 0.15f)
        ) {
            Text(
                text = String.format("%.1f", rating),
                style = MaterialTheme.typography.labelMedium,
                color = color,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
            )
        }
    }
}
