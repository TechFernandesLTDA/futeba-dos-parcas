package com.futebadosparcas.ui.search

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.futebadosparcas.R
import com.futebadosparcas.ui.components.CachedAsyncImage
import com.futebadosparcas.ui.components.empty.NoResultsEmptyState
import com.futebadosparcas.ui.components.skeleton.SkeletonList
import com.futebadosparcas.ui.components.skeleton.SkeletonListConfig

/**
 * Tela de busca global.
 * Permite buscar jogos, grupos, jogadores e locais em uma única interface.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GlobalSearchScreen(
    viewModel: GlobalSearchViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit,
    onGameClick: (String) -> Unit,
    onGroupClick: (String) -> Unit,
    onPlayerClick: (String) -> Unit,
    onLocationClick: (String) -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val query by viewModel.query.collectAsState()
    val selectedFilter by viewModel.selectedFilter.collectAsState()
    val recentSearches by viewModel.recentSearches.collectAsState()

    val focusRequester = remember { FocusRequester() }
    val keyboardController = LocalSoftwareKeyboardController.current

    // Auto-focus no campo de busca
    LaunchedEffect(Unit) {
        focusRequester.requestFocus()
    }

    Scaffold(
        topBar = {
            SearchTopBar(
                query = query,
                onQueryChange = viewModel::onQueryChange,
                onClear = viewModel::clearQuery,
                onNavigateBack = onNavigateBack,
                focusRequester = focusRequester,
                onSearch = {
                    keyboardController?.hide()
                    viewModel.search()
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Filtros
            SearchFilters(
                selectedFilter = selectedFilter,
                onFilterSelected = viewModel::onFilterSelected
            )

            // Conteúdo
            when {
                query.isEmpty() -> {
                    // Histórico de buscas
                    RecentSearchesSection(
                        searches = recentSearches,
                        onSearchClick = viewModel::onQueryChange,
                        onClearHistory = viewModel::clearHistory
                    )
                }
                uiState is GlobalSearchUiState.Loading -> {
                    SkeletonList(
                        config = SkeletonListConfig(
                            itemCount = 8,
                            hasAvatar = true,
                            hasSubtitle = true
                        ),
                        modifier = Modifier.padding(16.dp)
                    )
                }
                uiState is GlobalSearchUiState.Success -> {
                    val results = (uiState as GlobalSearchUiState.Success).results
                    if (results.isEmpty()) {
                        NoResultsEmptyState(
                            searchQuery = query,
                            onClearSearch = viewModel::clearQuery
                        )
                    } else {
                        SearchResults(
                            results = results,
                            onGameClick = onGameClick,
                            onGroupClick = onGroupClick,
                            onPlayerClick = onPlayerClick,
                            onLocationClick = onLocationClick
                        )
                    }
                }
                uiState is GlobalSearchUiState.Error -> {
                    ErrorSection(
                        message = (uiState as GlobalSearchUiState.Error).message,
                        onRetry = viewModel::search
                    )
                }
                else -> {
                    // Idle - mostra sugestões ou dicas
                    SearchSuggestions(
                        onSuggestionClick = viewModel::onQueryChange
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SearchTopBar(
    query: String,
    onQueryChange: (String) -> Unit,
    onClear: () -> Unit,
    onNavigateBack: () -> Unit,
    focusRequester: FocusRequester,
    onSearch: () -> Unit
) {
    TopAppBar(
        title = {
            TextField(
                value = query,
                onValueChange = onQueryChange,
                placeholder = {
                    Text(
                        text = "Buscar jogos, grupos, jogadores...",
                        style = MaterialTheme.typography.bodyLarge
                    )
                },
                singleLine = true,
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = Color.Transparent,
                    unfocusedContainerColor = Color.Transparent,
                    focusedIndicatorColor = Color.Transparent,
                    unfocusedIndicatorColor = Color.Transparent
                ),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = { onSearch() }),
                modifier = Modifier
                    .fillMaxWidth()
                    .focusRequester(focusRequester)
            )
        },
        navigationIcon = {
            IconButton(onClick = onNavigateBack) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Voltar"
                )
            }
        },
        actions = {
            AnimatedVisibility(
                visible = query.isNotEmpty(),
                enter = fadeIn(),
                exit = fadeOut()
            ) {
                IconButton(onClick = onClear) {
                    Icon(
                        imageVector = Icons.Default.Clear,
                        contentDescription = "Limpar"
                    )
                }
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    )
}

@Composable
private fun SearchFilters(
    selectedFilter: SearchFilter,
    onFilterSelected: (SearchFilter) -> Unit
) {
    LazyRow(
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(SearchFilter.entries) { filter ->
            FilterChip(
                selected = selectedFilter == filter,
                onClick = { onFilterSelected(filter) },
                label = { Text(filter.displayName) },
                leadingIcon = if (selectedFilter == filter) {
                    {
                        Icon(
                            painter = painterResource(id = filter.iconRes),
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                } else null
            )
        }
    }
}

@Composable
private fun RecentSearchesSection(
    searches: List<String>,
    onSearchClick: (String) -> Unit,
    onClearHistory: () -> Unit
) {
    if (searches.isEmpty()) return

    Column(modifier = Modifier.padding(16.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Buscas recentes",
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = "Limpar",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.clickable { onClearHistory() }
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        searches.forEach { search ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onSearchClick(search) }
                    .padding(vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    painter = painterResource(id = R.drawable.ic_history),
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(16.dp))
                Text(
                    text = search,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }
        }
    }
}

@Composable
private fun SearchSuggestions(
    onSuggestionClick: (String) -> Unit
) {
    val suggestions = listOf(
        "Pelada sábado",
        "Society",
        "Futsal",
        "Jogos perto de mim"
    )

    Column(modifier = Modifier.padding(16.dp)) {
        Text(
            text = "Sugestões",
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(12.dp))

        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(suggestions) { suggestion ->
                FilterChip(
                    selected = false,
                    onClick = { onSuggestionClick(suggestion) },
                    label = { Text(suggestion) }
                )
            }
        }
    }
}

@Composable
private fun SearchResults(
    results: List<SearchResult>,
    onGameClick: (String) -> Unit,
    onGroupClick: (String) -> Unit,
    onPlayerClick: (String) -> Unit,
    onLocationClick: (String) -> Unit
) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Agrupa por tipo
        val grouped = results.groupBy { it.type }

        grouped.forEach { (type, items) ->
            item {
                Text(
                    text = type.displayName,
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(vertical = 8.dp)
                )
            }

            items(items) { result ->
                SearchResultItem(
                    result = result,
                    onClick = {
                        when (result.type) {
                            SearchResultType.GAME -> onGameClick(result.id)
                            SearchResultType.GROUP -> onGroupClick(result.id)
                            SearchResultType.PLAYER -> onPlayerClick(result.id)
                            SearchResultType.LOCATION -> onLocationClick(result.id)
                        }
                    }
                )
            }

            item {
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            }
        }
    }
}

@Composable
private fun SearchResultItem(
    result: SearchResult,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Avatar/Ícone
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center
            ) {
                if (result.imageUrl != null) {
                    CachedAsyncImage(
                        imageUrl = result.imageUrl,
                        contentDescription = result.title,
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    Icon(
                        painter = painterResource(id = result.type.iconRes),
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onPrimaryContainer,
                        modifier = Modifier.size(24.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = result.title,
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                if (result.subtitle != null) {
                    Text(
                        text = result.subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            // Badge de tipo
            Text(
                text = result.type.shortName,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier
                    .background(
                        MaterialTheme.colorScheme.surfaceVariant,
                        RoundedCornerShape(4.dp)
                    )
                    .padding(horizontal = 6.dp, vertical = 2.dp)
            )
        }
    }
}

@Composable
private fun ErrorSection(
    message: String,
    onRetry: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            painter = painterResource(id = R.drawable.ic_warning),
            contentDescription = null,
            tint = MaterialTheme.colorScheme.error,
            modifier = Modifier.size(48.dp)
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(16.dp))
        androidx.compose.material3.TextButton(onClick = onRetry) {
            Text("Tentar novamente")
        }
    }
}

// ==================== Models ====================

/**
 * Filtros de busca.
 */
enum class SearchFilter(
    val displayName: String,
    val iconRes: Int
) {
    ALL("Todos", R.drawable.ic_search),
    GAMES("Jogos", R.drawable.ic_football),
    GROUPS("Grupos", R.drawable.ic_group),
    PLAYERS("Jogadores", R.drawable.ic_person),
    LOCATIONS("Locais", R.drawable.ic_location)
}

/**
 * Tipos de resultado de busca.
 */
enum class SearchResultType(
    val displayName: String,
    val shortName: String,
    val iconRes: Int
) {
    GAME("Jogos", "Jogo", R.drawable.ic_football),
    GROUP("Grupos", "Grupo", R.drawable.ic_group),
    PLAYER("Jogadores", "Jogador", R.drawable.ic_person),
    LOCATION("Locais", "Local", R.drawable.ic_location)
}

/**
 * Resultado de busca.
 */
data class SearchResult(
    val id: String,
    val type: SearchResultType,
    val title: String,
    val subtitle: String? = null,
    val imageUrl: String? = null,
    val relevanceScore: Float = 0f
)

/**
 * Estado da UI de busca.
 */
sealed class GlobalSearchUiState {
    data object Idle : GlobalSearchUiState()
    data object Loading : GlobalSearchUiState()
    data class Success(val results: List<SearchResult>) : GlobalSearchUiState()
    data class Error(val message: String) : GlobalSearchUiState()
}
