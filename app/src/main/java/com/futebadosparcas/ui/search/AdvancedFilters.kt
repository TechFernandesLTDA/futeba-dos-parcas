package com.futebadosparcas.ui.search
import org.jetbrains.compose.resources.stringResource
import com.futebadosparcas.compose.resources.Res

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Done
import androidx.compose.material.icons.filled.FilterList
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.RangeSlider
import androidx.compose.material3.SheetState
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import org.jetbrains.compose.resources.stringResource
import androidx.compose.ui.unit.dp
/**
 * Componentes de filtros avançados para busca.
 * Permite filtrar por data, horário, distância, número de jogadores, etc.
 */

// ==================== Models ====================

/**
 * Filtro de data/período.
 */
enum class DateFilter(val labelResId: Int) {
    TODAY(Res.string.filter_today),
    TOMORROW(Res.string.filter_tomorrow),
    THIS_WEEK(Res.string.filter_this_week),
    THIS_MONTH(Res.string.filter_this_month),
    CUSTOM(Res.string.filter_custom_date)
}

/**
 * Filtro de horário.
 */
enum class TimeFilter(val labelResId: Int) {
    MORNING(Res.string.filter_morning),      // 06:00 - 12:00
    AFTERNOON(Res.string.filter_afternoon),  // 12:00 - 18:00
    EVENING(Res.string.filter_evening),      // 18:00 - 22:00
    NIGHT(Res.string.filter_night)           // 22:00 - 06:00
}

/**
 * Tipo de jogo.
 */
enum class GameTypeFilter(val labelResId: Int) {
    SOCIETY(Res.string.filter_society),
    FUTSAL(Res.string.filter_futsal),
    CAMPO(Res.string.filter_campo),
    AREIA(Res.string.filter_areia)
}

/**
 * Estado completo dos filtros.
 */
data class SearchFiltersState(
    val dateFilters: List<DateFilter> = emptyList(),
    val timeFilters: List<TimeFilter> = emptyList(),
    val gameTypeFilters: List<GameTypeFilter> = emptyList(),
    val maxDistanceKm: Float = 50f,
    val minPlayers: Int = 0,
    val maxPlayers: Int = 30,
    val onlyWithVacancies: Boolean = false,
    val onlyFreeGames: Boolean = false
) {
    val hasActiveFilters: Boolean
        get() = dateFilters.isNotEmpty() ||
                timeFilters.isNotEmpty() ||
                gameTypeFilters.isNotEmpty() ||
                maxDistanceKm < 50f ||
                minPlayers > 0 ||
                maxPlayers < 30 ||
                onlyWithVacancies ||
                onlyFreeGames

    val activeFilterCount: Int
        get() = dateFilters.size +
                timeFilters.size +
                gameTypeFilters.size +
                (if (maxDistanceKm < 50f) 1 else 0) +
                (if (minPlayers > 0 || maxPlayers < 30) 1 else 0) +
                (if (onlyWithVacancies) 1 else 0) +
                (if (onlyFreeGames) 1 else 0)
}

// ==================== Main Component ====================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdvancedFiltersBottomSheet(
    isVisible: Boolean,
    currentFilters: SearchFiltersState,
    onDismiss: () -> Unit,
    onApplyFilters: (SearchFiltersState) -> Unit,
    onClearFilters: () -> Unit,
    modifier: Modifier = Modifier
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    if (isVisible) {
        ModalBottomSheet(
            onDismissRequest = onDismiss,
            sheetState = sheetState,
            containerColor = MaterialTheme.colorScheme.surface,
            modifier = modifier
        ) {
            AdvancedFiltersContent(
                currentFilters = currentFilters,
                onApplyFilters = onApplyFilters,
                onClearFilters = onClearFilters,
                onDismiss = onDismiss
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AdvancedFiltersContent(
    currentFilters: SearchFiltersState,
    onApplyFilters: (SearchFiltersState) -> Unit,
    onClearFilters: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    // Estado local dos filtros
    val selectedDateFilters = remember { mutableStateListOf(*currentFilters.dateFilters.toTypedArray()) }
    val selectedTimeFilters = remember { mutableStateListOf(*currentFilters.timeFilters.toTypedArray()) }
    val selectedGameTypes = remember { mutableStateListOf(*currentFilters.gameTypeFilters.toTypedArray()) }
    var maxDistance by remember { mutableFloatStateOf(currentFilters.maxDistanceKm) }
    var playerRange by remember { mutableStateOf(currentFilters.minPlayers.toFloat()..currentFilters.maxPlayers.toFloat()) }
    var onlyWithVacancies by remember { mutableStateOf(currentFilters.onlyWithVacancies) }
    var onlyFreeGames by remember { mutableStateOf(currentFilters.onlyFreeGames) }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp)
            .padding(bottom = 32.dp)
    ) {
        // Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.FilterList,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = stringResource(Res.string.advanced_filters),
                    style = MaterialTheme.typography.headlineSmall,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }
            IconButton(onClick = onDismiss) {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = stringResource(Res.string.close)
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Seção: Data
        FilterSection(
            icon = Icons.Default.CalendarMonth,
            title = stringResource(Res.string.filter_date)
        ) {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                DateFilter.entries.forEach { filter ->
                    FilterChip(
                        selected = filter in selectedDateFilters,
                        onClick = {
                            if (filter in selectedDateFilters) {
                                selectedDateFilters.remove(filter)
                            } else {
                                selectedDateFilters.add(filter)
                            }
                        },
                        label = { Text(stringResource(filter.labelResId)) },
                        leadingIcon = if (filter in selectedDateFilters) {
                            { Icon(Icons.Default.Done, contentDescription = null) }
                        } else null
                    )
                }
            }
        }

        HorizontalDivider(modifier = Modifier.padding(vertical = 16.dp))

        // Seção: Horário
        FilterSection(
            icon = Icons.Default.Schedule,
            title = stringResource(Res.string.filter_time)
        ) {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                TimeFilter.entries.forEach { filter ->
                    FilterChip(
                        selected = filter in selectedTimeFilters,
                        onClick = {
                            if (filter in selectedTimeFilters) {
                                selectedTimeFilters.remove(filter)
                            } else {
                                selectedTimeFilters.add(filter)
                            }
                        },
                        label = { Text(stringResource(filter.labelResId)) },
                        leadingIcon = if (filter in selectedTimeFilters) {
                            { Icon(Icons.Default.Done, contentDescription = null) }
                        } else null
                    )
                }
            }
        }

        HorizontalDivider(modifier = Modifier.padding(vertical = 16.dp))

        // Seção: Tipo de Jogo
        FilterSection(
            icon = Icons.Default.People,
            title = stringResource(Res.string.filter_game_type)
        ) {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                GameTypeFilter.entries.forEach { filter ->
                    FilterChip(
                        selected = filter in selectedGameTypes,
                        onClick = {
                            if (filter in selectedGameTypes) {
                                selectedGameTypes.remove(filter)
                            } else {
                                selectedGameTypes.add(filter)
                            }
                        },
                        label = { Text(stringResource(filter.labelResId)) },
                        leadingIcon = if (filter in selectedGameTypes) {
                            { Icon(Icons.Default.Done, contentDescription = null) }
                        } else null
                    )
                }
            }
        }

        HorizontalDivider(modifier = Modifier.padding(vertical = 16.dp))

        // Seção: Distância
        FilterSection(
            icon = Icons.Default.LocationOn,
            title = stringResource(Res.string.filter_distance)
        ) {
            Column {
                Text(
                    text = stringResource(Res.string.filter_max_distance_km, maxDistance.toInt()),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Slider(
                    value = maxDistance,
                    onValueChange = { maxDistance = it },
                    valueRange = 1f..100f,
                    steps = 19
                )
            }
        }

        HorizontalDivider(modifier = Modifier.padding(vertical = 16.dp))

        // Seção: Número de Jogadores
        FilterSection(
            icon = Icons.Default.People,
            title = stringResource(Res.string.filter_players)
        ) {
            Column {
                Text(
                    text = stringResource(
                        Res.string.filter_player_range,
                        playerRange.start.toInt(),
                        playerRange.endInclusive.toInt()
                    ),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                RangeSlider(
                    value = playerRange,
                    onValueChange = { playerRange = it },
                    valueRange = 0f..50f,
                    steps = 9
                )
            }
        }

        HorizontalDivider(modifier = Modifier.padding(vertical = 16.dp))

        // Filtros rápidos
        Text(
            text = stringResource(Res.string.quick_filters),
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface
        )
        Spacer(modifier = Modifier.height(8.dp))

        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FilterChip(
                selected = onlyWithVacancies,
                onClick = { onlyWithVacancies = !onlyWithVacancies },
                label = { Text(stringResource(Res.string.filter_with_vacancies)) },
                leadingIcon = if (onlyWithVacancies) {
                    { Icon(Icons.Default.Done, contentDescription = null) }
                } else null
            )
            FilterChip(
                selected = onlyFreeGames,
                onClick = { onlyFreeGames = !onlyFreeGames },
                label = { Text(stringResource(Res.string.filter_free_games)) },
                leadingIcon = if (onlyFreeGames) {
                    { Icon(Icons.Default.Done, contentDescription = null) }
                } else null
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Botões de ação
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedButton(
                onClick = {
                    selectedDateFilters.clear()
                    selectedTimeFilters.clear()
                    selectedGameTypes.clear()
                    maxDistance = 50f
                    playerRange = 0f..30f
                    onlyWithVacancies = false
                    onlyFreeGames = false
                    onClearFilters()
                },
                modifier = Modifier.weight(1f)
            ) {
                Text(stringResource(Res.string.clear_filters))
            }

            Button(
                onClick = {
                    val newFilters = SearchFiltersState(
                        dateFilters = selectedDateFilters.toList(),
                        timeFilters = selectedTimeFilters.toList(),
                        gameTypeFilters = selectedGameTypes.toList(),
                        maxDistanceKm = maxDistance,
                        minPlayers = playerRange.start.toInt(),
                        maxPlayers = playerRange.endInclusive.toInt(),
                        onlyWithVacancies = onlyWithVacancies,
                        onlyFreeGames = onlyFreeGames
                    )
                    onApplyFilters(newFilters)
                },
                modifier = Modifier.weight(1f)
            ) {
                Text(stringResource(Res.string.apply_filters))
            }
        }
    }
}

@Composable
private fun FilterSection(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    content: @Composable () -> Unit
) {
    Column {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(bottom = 12.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(end = 8.dp)
            )
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface
            )
        }
        content()
    }
}

// ==================== Filter Badge ====================

/**
 * Badge que mostra o número de filtros ativos.
 */
@Composable
fun ActiveFiltersBadge(
    filterCount: Int,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    AnimatedVisibility(visible = filterCount > 0) {
        Card(
            onClick = onClick,
            modifier = modifier,
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.primaryContainer
            )
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.FilterList,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onPrimaryContainer
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = filterCount.toString(),
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }
        }
    }
}
