package com.futebadosparcas.ui.search

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.SportsScore
import androidx.compose.material.icons.filled.TrendingUp
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R

/**
 * Tela de Busca Global do Futeba dos Parças.
 * Permite buscar jogos, jogadores, grupos e locais em uma única interface.
 */

// ==================== Models ====================

/**
 * Categoria de busca.
 */
enum class SearchCategory(val labelResId: Int, val icon: ImageVector) {
    ALL(R.string.search_all, Icons.Default.Search),
    GAMES(R.string.search_games, Icons.Default.SportsScore),
    PLAYERS(R.string.search_players, Icons.Default.Person),
    GROUPS(R.string.search_groups, Icons.Default.Groups),
    LOCATIONS(R.string.search_locations, Icons.Default.LocationOn)
}

/**
 * Resultado de busca genérico.
 */
sealed class SearchResult {
    abstract val id: String
    abstract val title: String
    abstract val subtitle: String?

    data class GameResult(
        override val id: String,
        override val title: String,
        override val subtitle: String?,
        val date: String,
        val location: String
    ) : SearchResult()

    data class PlayerResult(
        override val id: String,
        override val title: String,
        override val subtitle: String?,
        val photoUrl: String?,
        val level: Int
    ) : SearchResult()

    data class GroupResult(
        override val id: String,
        override val title: String,
        override val subtitle: String?,
        val memberCount: Int,
        val photoUrl: String?
    ) : SearchResult()

    data class LocationResult(
        override val id: String,
        override val title: String,
        override val subtitle: String?,
        val address: String,
        val fieldCount: Int
    ) : SearchResult()
}

/**
 * Estado da UI de busca.
 */
sealed class SearchUiState {
    data object Initial : SearchUiState()
    data object Loading : SearchUiState()
    data class Success(
        val results: List<SearchResult>,
        val query: String,
        val category: SearchCategory
    ) : SearchUiState()
    data class Empty(val query: String) : SearchUiState()
    data class Error(val message: String) : SearchUiState()
}

/**
 * Item de histórico de busca.
 */
data class SearchHistoryItem(
    val query: String,
    val category: SearchCategory,
    val timestamp: Long
)

// ==================== Main Screen ====================

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun GlobalSearchScreen(
    onNavigateBack: () -> Unit,
    onResultClick: (SearchResult) -> Unit,
    onFilterClick: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    var query by remember { mutableStateOf("") }
    var selectedCategory by remember { mutableStateOf(SearchCategory.ALL) }
    var uiState by remember { mutableStateOf<SearchUiState>(SearchUiState.Initial) }
    var showFilters by remember { mutableStateOf(false) }

    val focusRequester = remember { FocusRequester() }
    val keyboardController = LocalSoftwareKeyboardController.current

    // Histórico de buscas recentes (em produção, vem do Room)
    val recentSearches = remember {
        listOf(
            SearchHistoryItem("pelada sexta", SearchCategory.GAMES, System.currentTimeMillis()),
            SearchHistoryItem("João Silva", SearchCategory.PLAYERS, System.currentTimeMillis() - 86400000),
            SearchHistoryItem("Arena Futeba", SearchCategory.LOCATIONS, System.currentTimeMillis() - 172800000)
        )
    }

    // Sugestões populares
    val popularSearches = remember {
        listOf("Próximos jogos", "Jogadores disponíveis", "Quadras perto de mim")
    }

    LaunchedEffect(Unit) {
        focusRequester.requestFocus()
    }

    Scaffold(
        topBar = {
            SearchTopBar(
                query = query,
                onQueryChange = { query = it },
                onSearch = {
                    if (query.isNotBlank()) {
                        uiState = SearchUiState.Loading
                        // Em produção, chamar ViewModel para buscar
                    }
                },
                onClear = {
                    query = ""
                    uiState = SearchUiState.Initial
                },
                onNavigateBack = onNavigateBack,
                onFilterClick = { showFilters = !showFilters },
                focusRequester = focusRequester,
                keyboardController = keyboardController
            )
        },
        modifier = modifier
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Chips de categoria
            CategoryChips(
                selectedCategory = selectedCategory,
                onCategorySelected = { selectedCategory = it }
            )

            // Filtros avançados (colapsável)
            AnimatedVisibility(visible = showFilters) {
                AdvancedFiltersSection(
                    onApplyFilters = { showFilters = false }
                )
            }

            // Conteúdo principal
            AnimatedContent(
                targetState = uiState,
                label = "search_content"
            ) { state ->
                when (state) {
                    is SearchUiState.Initial -> {
                        InitialSearchContent(
                            recentSearches = recentSearches,
                            popularSearches = popularSearches,
                            onRecentSearchClick = { item ->
                                query = item.query
                                selectedCategory = item.category
                            },
                            onPopularSearchClick = { searchTerm ->
                                query = searchTerm
                            },
                            onClearHistory = { }
                        )
                    }
                    is SearchUiState.Loading -> {
                        LoadingSearchContent()
                    }
                    is SearchUiState.Success -> {
                        SearchResultsList(
                            results = state.results,
                            onResultClick = onResultClick
                        )
                    }
                    is SearchUiState.Empty -> {
                        EmptySearchContent(query = state.query)
                    }
                    is SearchUiState.Error -> {
                        ErrorSearchContent(
                            message = state.message,
                            onRetry = { uiState = SearchUiState.Loading }
                        )
                    }
                }
            }
        }
    }
}

// ==================== Components ====================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SearchTopBar(
    query: String,
    onQueryChange: (String) -> Unit,
    onSearch: () -> Unit,
    onClear: () -> Unit,
    onNavigateBack: () -> Unit,
    onFilterClick: () -> Unit,
    focusRequester: FocusRequester,
    keyboardController: androidx.compose.ui.platform.SoftwareKeyboardController?
) {
    TopAppBar(
        title = {
            OutlinedTextField(
                value = query,
                onValueChange = onQueryChange,
                placeholder = {
                    Text(
                        text = stringResource(R.string.search_hint),
                        style = MaterialTheme.typography.bodyLarge
                    )
                },
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = {
                    keyboardController?.hide()
                    onSearch()
                }),
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                },
                trailingIcon = {
                    if (query.isNotEmpty()) {
                        IconButton(onClick = onClear) {
                            Icon(
                                imageVector = Icons.Default.Clear,
                                contentDescription = stringResource(R.string.clear)
                            )
                        }
                    }
                },
                colors = OutlinedTextFieldDefaults.colors(
                    focusedContainerColor = MaterialTheme.colorScheme.surfaceContainerHigh,
                    unfocusedContainerColor = MaterialTheme.colorScheme.surfaceContainerHigh,
                    focusedBorderColor = MaterialTheme.colorScheme.primary,
                    unfocusedBorderColor = MaterialTheme.colorScheme.outline
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .focusRequester(focusRequester)
            )
        },
        navigationIcon = {
            IconButton(onClick = onNavigateBack) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(R.string.back)
                )
            }
        },
        actions = {
            IconButton(onClick = onFilterClick) {
                Icon(
                    imageVector = Icons.Default.FilterList,
                    contentDescription = stringResource(R.string.filters)
                )
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CategoryChips(
    selectedCategory: SearchCategory,
    onCategorySelected: (SearchCategory) -> Unit
) {
    FlowRow(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        SearchCategory.entries.forEach { category ->
            AssistChip(
                onClick = { onCategorySelected(category) },
                label = { Text(stringResource(category.labelResId)) },
                leadingIcon = {
                    Icon(
                        imageVector = category.icon,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                },
                border = AssistChipDefaults.assistChipBorder(
                    enabled = true,
                    borderColor = if (selectedCategory == category) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.outline
                    }
                )
            )
        }
    }
}

@Composable
private fun AdvancedFiltersSection(
    onApplyFilters: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = stringResource(R.string.advanced_filters),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Filtros avançados disponíveis via AdvancedFiltersBottomSheet",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun InitialSearchContent(
    recentSearches: List<SearchHistoryItem>,
    popularSearches: List<String>,
    onRecentSearchClick: (SearchHistoryItem) -> Unit,
    onPopularSearchClick: (String) -> Unit,
    onClearHistory: () -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp)
    ) {
        if (recentSearches.isNotEmpty()) {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = stringResource(R.string.recent_searches),
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = stringResource(R.string.clear_all),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.clickable { onClearHistory() }
                    )
                }
                Spacer(modifier = Modifier.height(8.dp))
            }

            items(recentSearches) { item ->
                RecentSearchItem(
                    item = item,
                    onClick = { onRecentSearchClick(item) }
                )
            }

            item { Spacer(modifier = Modifier.height(24.dp)) }
        }

        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.TrendingUp,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = stringResource(R.string.popular_searches),
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
        }

        items(popularSearches) { searchTerm ->
            ListItem(
                headlineContent = {
                    Text(text = searchTerm, style = MaterialTheme.typography.bodyLarge)
                },
                leadingContent = {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                },
                colors = ListItemDefaults.colors(containerColor = MaterialTheme.colorScheme.surface),
                modifier = Modifier.clickable { onPopularSearchClick(searchTerm) }
            )
        }
    }
}

@Composable
private fun RecentSearchItem(
    item: SearchHistoryItem,
    onClick: () -> Unit
) {
    ListItem(
        headlineContent = {
            Text(text = item.query, style = MaterialTheme.typography.bodyLarge)
        },
        leadingContent = {
            Icon(
                imageVector = Icons.Default.History,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
        },
        trailingContent = {
            Icon(
                imageVector = item.category.icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.size(20.dp)
            )
        },
        colors = ListItemDefaults.colors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = Modifier.clickable(onClick = onClick)
    )
}

@Composable
private fun LoadingSearchContent() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator()
    }
}

@Composable
private fun SearchResultsList(
    results: List<SearchResult>,
    onResultClick: (SearchResult) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(results, key = { it.id }) { result ->
            SearchResultCard(result = result, onClick = { onResultClick(result) })
        }
    }
}

@Composable
private fun SearchResultCard(
    result: SearchResult,
    onClick: () -> Unit
) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = when (result) {
                        is SearchResult.GameResult -> Icons.Default.SportsScore
                        is SearchResult.PlayerResult -> Icons.Default.Person
                        is SearchResult.GroupResult -> Icons.Default.Groups
                        is SearchResult.LocationResult -> Icons.Default.LocationOn
                    },
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }

            Spacer(modifier = Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = result.title,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                result.subtitle?.let { subtitle ->
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }
}

@Composable
private fun EmptySearchContent(query: String) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(
                imageVector = Icons.Default.Search,
                contentDescription = null,
                modifier = Modifier.size(64.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = stringResource(R.string.no_results_for, query),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = stringResource(R.string.try_different_search),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun ErrorSearchContent(
    message: String,
    onRetry: () -> Unit
) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = stringResource(R.string.search_error),
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.error
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
