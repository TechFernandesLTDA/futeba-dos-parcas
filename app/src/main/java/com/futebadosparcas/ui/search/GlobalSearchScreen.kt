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
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import com.futebadosparcas.ui.components.states.LoadingState
import com.futebadosparcas.ui.components.states.LoadingItemType
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
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.ui.adaptive.adaptiveContentWidth
import org.koin.compose.viewmodel.koinViewModel
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
 * Item de histórico de busca.
 */
data class SearchHistoryItem(
    val query: String,
    val category: SearchCategory
)

// ==================== Main Screen ====================

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun GlobalSearchScreen(
    onNavigateBack: () -> Unit,
    onResultClick: (SearchResult) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: GlobalSearchViewModel = koinViewModel(),
    onFilterClick: () -> Unit = {}
) {
    var showFilters by remember { mutableStateOf(false) }
    val query by viewModel.query.collectAsStateWithLifecycle()
    val selectedFilter by viewModel.selectedCategory.collectAsStateWithLifecycle()
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val storedSearches by viewModel.recentSearches.collectAsStateWithLifecycle()
    val selectedCategory = selectedFilter.toSearchCategory()
    val recentSearches = remember(storedSearches) {
        storedSearches.map { search ->
            SearchHistoryItem(
                query = search,
                category = SearchCategory.ALL
            )
        }
    }

    val focusRequester = remember { FocusRequester() }
    val keyboardController = LocalSoftwareKeyboardController.current

    LaunchedEffect(Unit) {
        focusRequester.requestFocus()
    }

    Scaffold(
        topBar = {
            SearchTopBar(
                query = query,
                onQueryChange = viewModel::onQueryChange,
                onSearch = {
                    if (query.isNotBlank()) {
                        viewModel.search()
                    }
                },
                onClear = viewModel::clearQuery,
                onNavigateBack = onNavigateBack,
                onFilterClick = {
                    showFilters = !showFilters
                    onFilterClick()
                },
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
                onCategorySelected = { viewModel.onFilterSelected(it.toSearchFilter()) }
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
                    is GlobalSearchUiState.Idle -> {
                        InitialSearchContent(
                            recentSearches = recentSearches,
                            onRecentSearchClick = { item ->
                                viewModel.onFilterSelected(item.category.toSearchFilter())
                                viewModel.onQueryChange(item.query)
                            },
                            onClearHistory = viewModel::clearHistory
                        )
                    }
                    is GlobalSearchUiState.Loading -> {
                        LoadingSearchContent()
                    }
                    is GlobalSearchUiState.Success -> {
                        if (state.results.isEmpty()) {
                            EmptySearchContent(query = query)
                        } else {
                            SearchResultsList(
                                results = state.results.map(GlobalSearchResult::toSearchResult),
                                onResultClick = onResultClick
                            )
                        }
                    }
                    is GlobalSearchUiState.Error -> {
                        ErrorSearchContent(
                            message = state.message,
                            onRetry = viewModel::search
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
                text = stringResource(R.string.search_advanced_filters_hint),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun InitialSearchContent(
    recentSearches: List<SearchHistoryItem>,
    onRecentSearchClick: (SearchHistoryItem) -> Unit,
    onClearHistory: () -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().adaptiveContentWidth(),
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
                        modifier = Modifier
                            .clickable { onClearHistory() }
                            .padding(8.dp)
                    )
                }
                Spacer(modifier = Modifier.height(8.dp))
            }

            items(recentSearches, key = { it }) { item ->
                RecentSearchItem(
                    item = item,
                    onClick = { onRecentSearchClick(item) }
                )
            }

            item { Spacer(modifier = Modifier.height(24.dp)) }
        }

        if (recentSearches.isEmpty()) {
            item {
                Text(
                    text = stringResource(R.string.no_recent_searches),
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(vertical = 24.dp)
                )
            }
        }
    }
}

private fun SearchCategory.toSearchFilter(): SearchFilter = when (this) {
    SearchCategory.ALL -> SearchFilter.ALL
    SearchCategory.GAMES -> SearchFilter.GAMES
    SearchCategory.PLAYERS -> SearchFilter.PLAYERS
    SearchCategory.GROUPS -> SearchFilter.GROUPS
    SearchCategory.LOCATIONS -> SearchFilter.LOCATIONS
}

private fun SearchFilter.toSearchCategory(): SearchCategory = when (this) {
    SearchFilter.ALL -> SearchCategory.ALL
    SearchFilter.GAMES -> SearchCategory.GAMES
    SearchFilter.PLAYERS -> SearchCategory.PLAYERS
    SearchFilter.GROUPS -> SearchCategory.GROUPS
    SearchFilter.LOCATIONS -> SearchCategory.LOCATIONS
}

private fun GlobalSearchResult.toSearchResult(): SearchResult = when (type) {
    SearchResultType.GAME -> SearchResult.GameResult(
        id = id,
        title = title,
        subtitle = subtitle,
        date = "",
        location = subtitle.orEmpty()
    )
    SearchResultType.PLAYER -> SearchResult.PlayerResult(
        id = id,
        title = title,
        subtitle = subtitle,
        photoUrl = imageUrl,
        level = 0
    )
    SearchResultType.GROUP -> SearchResult.GroupResult(
        id = id,
        title = title,
        subtitle = subtitle,
        memberCount = 0,
        photoUrl = imageUrl
    )
    SearchResultType.LOCATION -> SearchResult.LocationResult(
        id = id,
        title = title,
        subtitle = subtitle,
        address = subtitle.orEmpty(),
        fieldCount = 0
    )
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
    LoadingState(shimmerCount = 8, itemType = LoadingItemType.CARD)
}

@Composable
private fun SearchResultsList(
    results: List<SearchResult>,
    onResultClick: (SearchResult) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize().adaptiveContentWidth(),
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
