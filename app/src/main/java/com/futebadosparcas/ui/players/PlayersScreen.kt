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
import com.futebadosparcas.data.model.FieldType
import com.futebadosparcas.data.model.PlayerRatingRole
import com.futebadosparcas.data.model.User
import com.futebadosparcas.ui.components.EmptyPlayersState
import com.futebadosparcas.ui.components.EmptySearchState
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateType
import com.futebadosparcas.ui.components.ShimmerPlayerCard
import com.futebadosparcas.ui.theme.bottomBarPadding
import com.futebadosparcas.ui.theme.GamificationColors
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.delay
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
@OptIn(FlowPreview::class, ExperimentalFoundationApi::class)
@Composable
fun PlayersScreen(
    viewModel: PlayersViewModel,
    onPlayerClick: (User) -> Unit,
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

    // Debounce manual da busca (300ms)
    LaunchedEffect(searchQuery) {
        delay(300)
        viewModel.searchPlayers(searchQuery)
    }

    Box(
        modifier = modifier.fillMaxSize()
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
        ) {
            // SearchBar e Filtros
            PlayersSearchAndFilters(
                searchQuery = searchQuery,
                onSearchQueryChange = { searchQuery = it },
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
                                onPlayerClick(user)
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
                            title = "Erro ao carregar jogadores",
                            description = state.message,
                            onRetry = { viewModel.loadPlayers(searchQuery) }
                        ),
                        modifier = Modifier.fillMaxSize()
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
            placeholder = { Text("Buscar jogadores...") },
            leadingIcon = {
                Icon(
                    imageVector = Icons.Default.Search,
                    contentDescription = "Buscar"
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
                            contentDescription = if (isComparisonMode) "Cancelar comparação" else "Comparar jogadores"
                        )
                    }

                    // Limpar busca
                    if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { onSearchQueryChange("") }) {
                            Icon(
                                imageVector = Icons.Default.Clear,
                                contentDescription = "Limpar busca"
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
                    text = "Selecione 2 jogadores para comparar",
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
                label = { Text("Todos") },
                leadingIcon = if (selectedFieldType == null) {
                    { Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(18.dp)) }
                } else null
            )

            FilterChip(
                selected = selectedFieldType == FieldType.SOCIETY,
                onClick = { onFieldTypeChange(FieldType.SOCIETY) },
                label = { Text("Society") },
                leadingIcon = if (selectedFieldType == FieldType.SOCIETY) {
                    { Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(18.dp)) }
                } else null
            )

            FilterChip(
                selected = selectedFieldType == FieldType.FUTSAL,
                onClick = { onFieldTypeChange(FieldType.FUTSAL) },
                label = { Text("Futsal") },
                leadingIcon = if (selectedFieldType == FieldType.FUTSAL) {
                    { Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(18.dp)) }
                } else null
            )

            FilterChip(
                selected = selectedFieldType == FieldType.CAMPO,
                onClick = { onFieldTypeChange(FieldType.CAMPO) },
                label = { Text("Campo") },
                leadingIcon = if (selectedFieldType == FieldType.CAMPO) {
                    { Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(18.dp)) }
                } else null
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
                label = { Text("Nome") },
                leadingIcon = if (selectedSortOption == PlayersViewModel.SortOption.NAME) {
                    { Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(18.dp)) }
                } else null
            )

            FilterChip(
                selected = selectedSortOption == PlayersViewModel.SortOption.BEST_STRIKER,
                onClick = { onSortOptionChange(PlayersViewModel.SortOption.BEST_STRIKER) },
                label = { Text("Melhor Atacante") },
                leadingIcon = if (selectedSortOption == PlayersViewModel.SortOption.BEST_STRIKER) {
                    { Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(18.dp)) }
                } else null
            )

            FilterChip(
                selected = selectedSortOption == PlayersViewModel.SortOption.BEST_GK,
                onClick = { onSortOptionChange(PlayersViewModel.SortOption.BEST_GK) },
                label = { Text("Melhor Goleiro") },
                leadingIcon = if (selectedSortOption == PlayersViewModel.SortOption.BEST_GK) {
                    { Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(18.dp)) }
                } else null
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
                modifier = Modifier.animateItemPlacement()
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
            .height(100.dp)
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
            Box(
                modifier = Modifier
                    .size(64.dp)
                    .clip(CircleShape)
            ) {
                AsyncImage(
                    model = player.photoUrl?.ifEmpty { null },
                    contentDescription = player.getDisplayName(),
                    modifier = Modifier.fillMaxSize(),
                    contentScale = ContentScale.Crop
                )

                // Fallback se não houver foto
                if (player.photoUrl.isNullOrEmpty()) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(
                                color = MaterialTheme.colorScheme.primaryContainer,
                                shape = CircleShape
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = player.getDisplayName().take(1).uppercase(),
                            style = MaterialTheme.typography.headlineMedium,
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }

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
                        label = "ATK",
                        rating = player.getEffectiveRating(PlayerRatingRole.STRIKER),
                        color = MaterialTheme.colorScheme.tertiary
                    )

                    PlayerRatingBadge(
                        label = "GK",
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
                        text = "Nv ${player.level}",
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
                            contentDescription = "Convidar",
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
