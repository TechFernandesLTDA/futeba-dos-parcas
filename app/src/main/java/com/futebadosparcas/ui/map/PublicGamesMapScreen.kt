package com.futebadosparcas.ui.map

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.SportsScore
import androidx.compose.material3.BottomSheetScaffold
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SheetValue
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberBottomSheetScaffoldState
import androidx.compose.material3.rememberStandardBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource
/**
 * Tela de Mapa de Jogos Públicos.
 */

data class MapGameMarker(
    val gameId: String,
    val title: String,
    val locationName: String,
    val latitude: Double,
    val longitude: Double,
    val dateTime: String,
    val confirmedPlayers: Int,
    val maxPlayers: Int,
    val price: Double,
    val gameType: String,
    val hasVacancies: Boolean
)

data class MapUiState(
    val games: List<MapGameMarker> = emptyList(),
    val selectedGame: MapGameMarker? = null,
    val userLocation: Pair<Double, Double>? = null,
    val isLoading: Boolean = false,
    val error: String? = null
)

data class MapFilters(
    val showOnlyWithVacancies: Boolean = true,
    val showOnlyFree: Boolean = false,
    val maxDistanceKm: Float = 20f,
    val gameTypes: Set<String> = emptySet()
)

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun PublicGamesMapScreen(
    onNavigateBack: () -> Unit,
    onGameClick: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    var uiState by remember { mutableStateOf(MapUiState()) }
    var filters by remember { mutableStateOf(MapFilters()) }
    var showFilters by remember { mutableStateOf(false) }

    val scaffoldState = rememberBottomSheetScaffoldState(
        bottomSheetState = rememberStandardBottomSheetState(initialValue = SheetValue.PartiallyExpanded)
    )

    val sampleGames = remember {
        listOf(
            MapGameMarker("1", "Pelada de Sexta", "Arena Futeba", -23.550520, -46.633309,
                "Sex, 20:00", 12, 14, 25.0, "SOCIETY", true),
            MapGameMarker("2", "Futsal Domingo", "Ginásio Municipal", -23.561414, -46.655881,
                "Dom, 10:00", 8, 10, 0.0, "FUTSAL", true)
        )
    }

    BottomSheetScaffold(
        scaffoldState = scaffoldState,
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.public_games_map)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.back))
                    }
                },
                actions = {
                    IconButton(onClick = { showFilters = !showFilters }) {
                        Icon(Icons.Default.FilterList, contentDescription = stringResource(R.string.filters))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )
        },
        sheetContent = {
            GameListSheet(sampleGames, uiState.selectedGame,
                onGameSelect = { uiState = uiState.copy(selectedGame = it) },
                onGameClick = onGameClick)
        },
        sheetPeekHeight = 200.dp,
        modifier = modifier
    ) { paddingValues ->
        Box(modifier = Modifier.fillMaxSize().padding(paddingValues)) {
            MapPlaceholder(sampleGames, uiState.selectedGame) { uiState = uiState.copy(selectedGame = it) }

            if (showFilters) {
                MapFiltersOverlay(filters, { filters = it }, { showFilters = false },
                    Modifier.align(Alignment.TopCenter).padding(16.dp))
            }

            FloatingActionButton(
                onClick = { },
                modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp).padding(bottom = 200.dp),
                containerColor = MaterialTheme.colorScheme.primaryContainer
            ) {
                Icon(Icons.Default.MyLocation, contentDescription = stringResource(R.string.my_location),
                    tint = MaterialTheme.colorScheme.onPrimaryContainer)
            }
        }
    }
}

@Composable
private fun MapPlaceholder(games: List<MapGameMarker>, selectedGame: MapGameMarker?, onMarkerClick: (MapGameMarker) -> Unit) {
    Box(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surfaceContainerLow),
        contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(Icons.Default.Map, contentDescription = null, Modifier.size(96.dp),
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f))
            Spacer(Modifier.height(16.dp))
            Text(stringResource(R.string.map_placeholder), style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(8.dp))
            Text(stringResource(R.string.map_games_found, games.size), style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.primary)
        }
    }
}

@Composable
private fun GameListSheet(games: List<MapGameMarker>, selectedGame: MapGameMarker?,
                          onGameSelect: (MapGameMarker) -> Unit, onGameClick: (String) -> Unit) {
    Column(Modifier.fillMaxWidth().padding(16.dp)) {
        Text(stringResource(R.string.nearby_games), style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface)
        Spacer(Modifier.height(12.dp))
        games.forEach { game ->
            MapGameCard(game, game == selectedGame, { onGameSelect(game) }, { onGameClick(game.gameId) })
            Spacer(Modifier.height(8.dp))
        }
    }
}

@Composable
private fun MapGameCard(game: MapGameMarker, isSelected: Boolean, onClick: () -> Unit, onJoinClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
            else MaterialTheme.colorScheme.surfaceContainerHigh
        ),
        border = if (isSelected) BorderStroke(2.dp, MaterialTheme.colorScheme.primary) else null
    ) {
        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(48.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center) {
                Icon(Icons.Default.SportsScore, contentDescription = null, tint = MaterialTheme.colorScheme.onPrimaryContainer)
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(game.title, style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(game.locationName, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
                    Icon(Icons.Default.Schedule, contentDescription = null, Modifier.size(14.dp), MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.width(4.dp))
                    Text(game.dateTime, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.width(12.dp))
                    Icon(Icons.Default.Person, contentDescription = null, Modifier.size(14.dp), MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.width(4.dp))
                    Text("${game.confirmedPlayers}/${game.maxPlayers}", style = MaterialTheme.typography.labelSmall,
                        color = if (game.hasVacancies) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error)
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(if (game.price > 0) "R$ ${game.price.toInt()}" else stringResource(R.string.free),
                    style = MaterialTheme.typography.labelLarge,
                    color = if (game.price > 0) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.primary)
                if (game.hasVacancies) {
                    Spacer(Modifier.height(4.dp))
                    Button(onClick = onJoinClick, Modifier.defaultMinSize(minHeight = 48.dp)) {
                        Text(stringResource(R.string.join), style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MapFiltersOverlay(filters: MapFilters, onFiltersChange: (MapFilters) -> Unit,
                              onDismiss: () -> Unit, modifier: Modifier = Modifier) {
    Card(modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(16.dp)) {
            Text(stringResource(R.string.quick_filters), style = MaterialTheme.typography.titleSmall)
            Spacer(Modifier.height(8.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(filters.showOnlyWithVacancies,
                    { onFiltersChange(filters.copy(showOnlyWithVacancies = !filters.showOnlyWithVacancies)) },
                    label = { Text(stringResource(R.string.filter_with_vacancies)) })
                FilterChip(filters.showOnlyFree,
                    { onFiltersChange(filters.copy(showOnlyFree = !filters.showOnlyFree)) },
                    label = { Text(stringResource(R.string.filter_free_games)) })
            }
        }
    }
}
