package com.futebadosparcas.ui

import androidx.compose.animation.core.*
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.background
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.clickable
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.layout.*
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.lazy.LazyColumn
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.lazy.LazyRow
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.lazy.items
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.shape.CircleShape
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.shape.RoundedCornerShape
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.material3.*
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.runtime.*
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.Alignment
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.Modifier
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.draw.clip
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.graphics.Brush
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.graphics.Color
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.text.font.FontWeight
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.text.style.TextOverflow
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.unit.dp
import com.futebadosparcas.ui.components.states.ErrorState
import com.futebadosparcas.firebase.FirebaseManager
import com.futebadosparcas.ui.components.states.ErrorState
import kotlinx.coroutines.launch
import com.futebadosparcas.ui.components.states.ErrorState

private sealed class PlayersUiState {
    object Loading : PlayersUiState()
    object Empty : PlayersUiState()
    data class Success(val players: List<Map<String, Any?>>) : PlayersUiState()
    data class Error(val message: String) : PlayersUiState()
}

private data class PlayerFilters(
    val position: String? = null,
    val minLevel: Int? = null,
    val maxLevel: Int? = null,
    val groupId: String? = null
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlayersTab(
    onPlayerClick: (String) -> Unit = {}
) {
    var uiState by remember { mutableStateOf<PlayersUiState>(PlayersUiState.Loading) }
    var searchQuery by remember { mutableStateOf("") }
    var showFilters by remember { mutableStateOf(false) }
    var filters by remember { mutableStateOf(PlayerFilters()) }
    val scope = rememberCoroutineScope()

    fun loadPlayers() {
        scope.launch {
            uiState = PlayersUiState.Loading
            try {
                val players = FirebaseManager.searchPlayers(searchQuery)
                uiState = if (players.isEmpty() && searchQuery.isEmpty()) {
                    PlayersUiState.Empty
                } else {
                    PlayersUiState.Success(players)
                }
            } catch (e: Exception) {
                uiState = PlayersUiState.Error(e.message ?: "Erro ao carregar jogadores")
            }
        }
    }

    LaunchedEffect(Unit) {
        loadPlayers()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp)
    ) {
        Text(
            text = "👤 Jogadores",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(vertical = 16.dp)
        )

        SearchBarWithFilters(
            query = searchQuery,
            onQueryChange = { 
                searchQuery = it
                loadPlayers()
            },
            showFilters = showFilters,
            onToggleFilters = { showFilters = !showFilters },
            modifier = Modifier.padding(bottom = 12.dp)
        )

        if (showFilters) {
            FiltersSection(
                filters = filters,
                onFiltersChange = { filters = it },
                onApply = {
                    showFilters = false
                    loadPlayers()
                },
                onClear = {
                    filters = PlayerFilters()
                    showFilters = false
                    loadPlayers()
                }
            )
            Spacer(modifier = Modifier.height(12.dp))
        }

        when (val state = uiState) {
            is PlayersUiState.Loading -> PlayersLoadingContent()

            is PlayersUiState.Empty -> EmptyPlayersState()

            is PlayersUiState.Success -> {
                val filteredPlayers = applyFilters(state.players, filters)

                if (filteredPlayers.isEmpty() && state.players.isNotEmpty()) {
                    EmptyFilterResultState(
                        onClearFilters = {
                            filters = PlayerFilters()
                            loadPlayers()
                        }
                    )
                } else if (filteredPlayers.isEmpty()) {
                    EmptySearchState(
                        query = searchQuery,
                        onClearSearch = { 
                            searchQuery = ""
                            loadPlayers()
                        }
                    )
                } else {
                    PlayersList(
                        players = filteredPlayers,
                        onPlayerClick = onPlayerClick
                    )
                }
            }

            is PlayersUiState.Error -> ErrorState(
                message = state.message,
                onRetry = { loadPlayers() }
            )
        }
    }
}

private fun applyFilters(players: List<Map<String, Any?>>, filters: PlayerFilters): List<Map<String, Any?>> {
    return players.filter { player ->
        val position = filters.position
        val playerPosition = player["preferredPosition"] as? String
        val positionMatch = position == null || playerPosition == position

        val level = (player["level"] as? Number)?.toInt() ?: 1
        val minLevelMatch = filters.minLevel == null || level >= filters.minLevel
        val maxLevelMatch = filters.maxLevel == null || level <= filters.maxLevel

        val groupId = filters.groupId
        val playerGroups = (player["groups"] as? List<*>) ?: emptyList<String>()
        val groupMatch = groupId == null || playerGroups.contains(groupId)

        positionMatch && minLevelMatch && maxLevelMatch && groupMatch
    }
}

@Composable
private fun SearchBarWithFilters(
    query: String,
    onQueryChange: (String) -> Unit,
    showFilters: Boolean,
    onToggleFilters: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        OutlinedTextField(
            value = query,
            onValueChange = onQueryChange,
            modifier = Modifier.weight(1f),
            placeholder = { Text("🔍 Buscar jogador...") },
            singleLine = true,
            shape = RoundedCornerShape(28.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = MaterialTheme.colorScheme.primary,
                unfocusedBorderColor = MaterialTheme.colorScheme.outline
            ),
            trailingIcon = {
                if (query.isNotEmpty()) {
                    TextButton(onClick = { onQueryChange("") }) {
                        Text("✕")
                    }
                }
            }
        )

        FilterChip(
            selected = showFilters,
            onClick = onToggleFilters,
            label = { Text("⚙️") },
            colors = FilterChipDefaults.filterChipColors(
                selectedContainerColor = MaterialTheme.colorScheme.primaryContainer
            )
        )
    }
}

@Composable
private fun FiltersSection(
    filters: PlayerFilters,
    onFiltersChange: (PlayerFilters) -> Unit,
    onApply: () -> Unit,
    onClear: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = "Filtros",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = "⚽ Posição",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(8.dp))
            PositionFilterChips(
                selectedPosition = filters.position,
                onPositionSelected = { onFiltersChange(filters.copy(position = it)) }
            )

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "⭐ Nível",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(8.dp))
            LevelFilterChips(
                minLevel = filters.minLevel,
                maxLevel = filters.maxLevel,
                onLevelRangeSelected = { min, max ->
                    onFiltersChange(filters.copy(minLevel = min, maxLevel = max))
                }
            )

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = onClear,
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Limpar")
                }
                Button(
                    onClick = onApply,
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Aplicar")
                }
            }
        }
    }
}

@Composable
private fun PositionFilterChips(
    selectedPosition: String?,
    onPositionSelected: (String?) -> Unit
) {
    val positions = listOf(
        null to "Todos",
        "Atacante" to "⚽ Atacante",
        "Meia" to "🏃 Meia",
        "Zagueiro" to "🛡️ Zagueiro",
        "Goleiro" to "🧤 Goleiro"
    )

    LazyRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(positions) { (value, label) ->
            FilterChip(
                selected = selectedPosition == value,
                onClick = { onPositionSelected(value) },
                label = { Text(label) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = MaterialTheme.colorScheme.primaryContainer
                )
            )
        }
    }
}

@Composable
private fun LevelFilterChips(
    minLevel: Int?,
    maxLevel: Int?,
    onLevelRangeSelected: (Int?, Int?) -> Unit
) {
    val levelRanges = listOf(
        Pair(null, null) to "Todos",
        Pair(1, 9) to "🌱 Iniciante (1-9)",
        Pair(10, 19) to "✨ Experiente (10-19)",
        Pair(20, 29) to "⭐ Veterano (20-29)",
        Pair(30, 100) to "🏆 Mestre (30+)"
    )

    LazyRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(levelRanges) { (range, label) ->
            val (min, max) = range
            val isSelected = minLevel == min && maxLevel == max
            FilterChip(
                selected = isSelected,
                onClick = { onLevelRangeSelected(min, max) },
                label = { Text(label) },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = MaterialTheme.colorScheme.primaryContainer
                )
            )
        }
    }
}

@Composable
private fun PlayersList(
    players: List<Map<String, Any?>>,
    onPlayerClick: (String) -> Unit
) {
    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(8.dp),
        contentPadding = PaddingValues(bottom = 80.dp)
    ) {
        items(players, key = { it["userId"] as? String ?: it.hashCode() }) { player ->
            PlayerCard(
                player = player,
                onClick = { onPlayerClick(player["userId"] as? String ?: "") }
            )
        }
    }
}

@Composable
private fun PlayerCard(
    player: Map<String, Any?>,
    onClick: () -> Unit
) {
    val name = player["userName"] as? String ?: "Jogador"
    val nickname = player["nickname"] as? String
    val level = (player["level"] as? Number)?.toInt() ?: 1
    val position = player["preferredPosition"] as? String
    val xp = (player["experiencePoints"] as? Long)?.toInt() ?: 0
    val isCurrentUser = player["isCurrentUser"] as? Boolean ?: false

    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isCurrentUser) {
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f)
            } else {
                MaterialTheme.colorScheme.surface
            }
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            PlayerAvatar(
                name = name,
                level = level,
                modifier = Modifier.size(56.dp)
            )

            Spacer(modifier = Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = nickname ?: name,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (isCurrentUser) {
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = MaterialTheme.colorScheme.primary
                        ) {
                            Text(
                                text = " VOCÊ ",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onPrimary,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                if (nickname != null) {
                    Text(
                        text = name,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "⭐ Nv. $level",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.primary
                    )

                    if (position != null) {
                        Text(
                            text = "⚽ $position",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "$xp XP",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = "›",
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
fun PlayerAvatar(
    name: String,
    level: Int,
    modifier: Modifier = Modifier
) {
    val initial = name.firstOrNull()?.uppercase() ?: "?"
    val gradientColors = listOf(
        MaterialTheme.colorScheme.primary,
        MaterialTheme.colorScheme.tertiary
    )

    Box(
        modifier = modifier,
        contentAlignment = Alignment.Center
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .clip(CircleShape)
                .background(Brush.linearGradient(gradientColors)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = initial,
                style = MaterialTheme.typography.headlineMedium,
                color = Color.White,
                fontWeight = FontWeight.Bold
            )
        }

        Surface(
            modifier = Modifier.align(Alignment.BottomEnd),
            shape = CircleShape,
            color = getLevelColor(level),
            contentColor = Color.White
        ) {
            Text(
                text = level.toString(),
                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun getLevelColor(level: Int): Color {
    return when {
        level >= 50 -> Color(0xFFFFD700)
        level >= 30 -> Color(0xFF9C27B0)
        level >= 20 -> Color(0xFF2196F3)
        level >= 10 -> Color(0xFF4CAF50)
        else -> MaterialTheme.colorScheme.primary
    }
}

@Composable
private fun PlayersLoadingContent() {
    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(5) {
            ShimmerPlayerCard()
        }
    }
}

@Composable
private fun ShimmerPlayerCard() {
    val shimmerColors = listOf(
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f)
    )

    val transition = rememberInfiniteTransition(label = "shimmer")
    val translateAnim = transition.animateFloat(
        initialValue = 0f,
        targetValue = 1000f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmer_translate"
    )

    val brush = Brush.linearGradient(
        colors = shimmerColors,
        start = androidx.compose.ui.geometry.Offset(translateAnim.value - 1000f, 0f),
        end = androidx.compose.ui.geometry.Offset(translateAnim.value, 0f)
    )

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .clip(CircleShape)
                    .background(brush)
            )
            Spacer(modifier = Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Box(
                    modifier = Modifier
                        .width(150.dp)
                        .height(20.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(brush)
                )
                Spacer(modifier = Modifier.height(8.dp))
                Box(
                    modifier = Modifier
                        .width(100.dp)
                        .height(16.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(brush)
                )
            }
            Box(
                modifier = Modifier
                    .width(50.dp)
                    .height(24.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(brush)
            )
        }
    }
}

@Composable
private fun EmptyPlayersState() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "👤",
            style = MaterialTheme.typography.displayLarge
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Nenhum jogador encontrado",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Jogue algumas partidas para ver outros jogadores!",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun EmptySearchState(
    query: String,
    onClearSearch: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "🔍",
            style = MaterialTheme.typography.displayLarge
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Nenhum resultado",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Não encontramos jogadores com \"$query\"",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(16.dp))
        TextButton(onClick = onClearSearch) {
            Text("Limpar busca")
        }
    }
}

@Composable
private fun EmptyFilterResultState(
    onClearFilters: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "🔍",
            style = MaterialTheme.typography.displayLarge
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Nenhum jogador com esses filtros",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Tente ajustar os filtros de busca",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(16.dp))
        TextButton(onClick = onClearFilters) {
            Text("Limpar filtros")
        }
    }
}
