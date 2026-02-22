package com.futebadosparcas.ui

import androidx.compose.animation.core.*
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.background
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.horizontalScroll
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.layout.*
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.lazy.LazyColumn
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.lazy.items
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.ui.geometry.Offset
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.graphics.Brush
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.graphics.Color
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.text.font.FontWeight
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.text.style.TextAlign
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.text.style.TextOverflow
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.unit.dp
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.window.Dialog
import com.futebadosparcas.ui.components.states.ErrorState
import com.futebadosparcas.firebase.FirebaseManager
import com.futebadosparcas.ui.components.states.ErrorState
import com.futebadosparcas.ui.theme.FieldTypeColors
import com.futebadosparcas.ui.components.states.ErrorState
import com.futebadosparcas.ui.theme.GameStatusColors
import com.futebadosparcas.ui.components.states.ErrorState
import kotlinx.coroutines.delay
import com.futebadosparcas.ui.components.states.ErrorState
import kotlinx.coroutines.launch
import com.futebadosparcas.ui.components.states.ErrorState

enum class StatusFilter(val label: String, val emoji: String, val status: String?) {
    ALL("Todos", "📅", null),
    SCHEDULED("Agendados", "🟢", "SCHEDULED"),
    CONFIRMED("Fechados", "🟡", "CONFIRMED"),
    LIVE("Ao Vivo", "🔴", "LIVE"),
    FINISHED("Finalizados", "✅", "FINISHED")
}

enum class DateFilter(val label: String, val emoji: String) {
    TODAY("Hoje", "📅"),
    WEEK("Semana", "📆"),
    MONTH("Mes", "🗓️"),
    ALL("Todos", "📋")
}

sealed class UiState<out T> {
    object Loading : UiState<Nothing>()
    data class Success<T>(val data: T) : UiState<T>()
    data class Error(val message: String) : UiState<Nothing>()
    object Empty : UiState<Nothing>()
}

data class WebGame(
    val id: String,
    val title: String,
    val date: String,
    val time: String,
    val locationName: String,
    val locationAddress: String,
    val status: String,
    val playersCount: Int,
    val maxPlayers: Int,
    val gameType: String,
    val dailyPrice: Double,
    val ownerName: String,
    val groupId: String?,
    val groupName: String?,
    val confirmations: List<WebConfirmation> = emptyList(),
    val team1Name: String = "Time A",
    val team2Name: String = "Time B",
    val team1Score: Int = 0,
    val team2Score: Int = 0,
    val team1Players: List<String> = emptyList(),
    val team2Players: List<String> = emptyList()
)

data class WebConfirmation(
    val userId: String,
    val userName: String,
    val userPhoto: String?,
    val position: String,
    val status: String,
    val paymentStatus: String
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GamesTab(
    onGameClick: ((String) -> Unit)? = null,
    onCreateGameClick: (() -> Unit)? = null
) {
    var games by remember { mutableStateOf<List<WebGame>>(emptyList()) }
    var uiState by remember { mutableStateOf<UiState<List<WebGame>>>(UiState.Loading) }
    var selectedStatusFilter by remember { mutableStateOf(StatusFilter.ALL) }
    var selectedDateFilter by remember { mutableStateOf(DateFilter.ALL) }
    var selectedGame by remember { mutableStateOf<WebGame?>(null) }
    var isRefreshing by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    fun loadGames() {
        scope.launch {
            uiState = UiState.Loading
            try {
                delay(500)
                val rawGames = FirebaseManager.getCollection("games")
                games = rawGames.map { mapToWebGame(it) }
                uiState = if (games.isEmpty()) UiState.Empty else UiState.Success(games)
            } catch (e: Exception) {
                uiState = UiState.Error(e.message ?: "Erro ao carregar jogos")
            }
        }
    }

    fun refresh() {
        scope.launch {
            isRefreshing = true
            delay(800)
            loadGames()
            isRefreshing = false
        }
    }

    LaunchedEffect(Unit) {
        loadGames()
    }

    val filteredGames = remember(games, selectedStatusFilter, selectedDateFilter) {
        filterGames(games, selectedStatusFilter, selectedDateFilter)
    }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(
                onClick = { onCreateGameClick?.invoke() },
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary
            ) {
                Text("+", style = MaterialTheme.typography.headlineMedium)
            }
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            Column(modifier = Modifier.padding(horizontal = 16.dp)) {
                Text(
                    text = "Jogos",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 16.dp, bottom = 12.dp)
                )

                StatusFilterChips(
                    selectedFilter = selectedStatusFilter,
                    onFilterChange = { selectedStatusFilter = it }
                )

                Spacer(modifier = Modifier.height(8.dp))

                DateFilterChips(
                    selectedFilter = selectedDateFilter,
                    onFilterChange = { selectedDateFilter = it }
                )

                Spacer(modifier = Modifier.height(12.dp))
            }

            when (val state = uiState) {
                is UiState.Loading -> GamesLoadingState()
                is UiState.Empty -> GamesEmptyState(onCreateClick = { onCreateGameClick?.invoke() })
                is UiState.Error -> GamesErrorState(message = state.message, onRetry = { loadGames() })
                is UiState.Success -> {
                    if (filteredGames.isEmpty()) {
                        GamesFilteredEmptyState(
                            hasFilters = selectedStatusFilter != StatusFilter.ALL || selectedDateFilter != DateFilter.ALL,
                            onClearFilters = {
                                selectedStatusFilter = StatusFilter.ALL
                                selectedDateFilter = DateFilter.ALL
                            }
                        )
                    } else {
                        GamesSuccessContent(
                            games = filteredGames,
                            isRefreshing = isRefreshing,
                            onRefresh = { refresh() },
                            onGameClick = { game ->
                                if (onGameClick != null) onGameClick(game.id) else selectedGame = game
                            }
                        )
                    }
                }
            }
        }
    }

    selectedGame?.let { game ->
        GameDetailDialog(game = game, onDismiss = { selectedGame = null })
    }
}

@Composable
private fun StatusFilterChips(
    selectedFilter: StatusFilter,
    onFilterChange: (StatusFilter) -> Unit
) {
    Row(
        modifier = Modifier.horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        StatusFilter.entries.forEach { filter ->
            FilterChip(
                selected = selectedFilter == filter,
                onClick = { onFilterChange(filter) },
                label = { Text("${filter.emoji} ${filter.label}") },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
                    selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        }
    }
}

@Composable
private fun DateFilterChips(
    selectedFilter: DateFilter,
    onFilterChange: (DateFilter) -> Unit
) {
    Row(
        modifier = Modifier.horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        DateFilter.entries.forEach { filter ->
            FilterChip(
                selected = selectedFilter == filter,
                onClick = { onFilterChange(filter) },
                label = { Text("${filter.emoji} ${filter.label}") },
                colors = FilterChipDefaults.filterChipColors(
                    selectedContainerColor = MaterialTheme.colorScheme.secondaryContainer,
                    selectedLabelColor = MaterialTheme.colorScheme.onSecondaryContainer
                )
            )
        }
    }
}

@Composable
private fun GamesSuccessContent(
    games: List<WebGame>,
    isRefreshing: Boolean,
    onRefresh: () -> Unit,
    onGameClick: (WebGame) -> Unit
) {
    Box(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(games, key = { it.id }) { game ->
                GameCard(game = game, onClick = { onGameClick(game) })
            }

            item {
                Spacer(modifier = Modifier.height(80.dp))
            }
        }

        if (isRefreshing) {
            LinearProgressIndicator(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.TopCenter)
            )
        }
    }
}

@Composable
private fun GamesLoadingState() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        repeat(5) {
            ShimmerGameCard()
        }
    }
}

@Composable
private fun ShimmerGameCard(modifier: Modifier = Modifier) {
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
        start = Offset(translateAnim.value - 1000f, translateAnim.value - 1000f),
        end = Offset(translateAnim.value, translateAnim.value)
    )

    Card(
        modifier = modifier.fillMaxWidth().height(140.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh)
    ) {
        Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .width(140.dp)
                        .height(20.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(brush)
                )
                Box(
                    modifier = Modifier
                        .width(60.dp)
                        .height(24.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(brush)
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(16.dp)
                        .clip(CircleShape)
                        .background(brush)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Box(
                    modifier = Modifier
                        .width(180.dp)
                        .height(16.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(brush)
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(16.dp)
                            .clip(CircleShape)
                            .background(brush)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Box(
                        modifier = Modifier
                            .width(80.dp)
                            .height(16.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(brush)
                    )
                }
                Box(
                    modifier = Modifier
                        .width(60.dp)
                        .height(24.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(brush)
                )
            }
        }
    }
}

@Composable
private fun GamesEmptyState(onCreateClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "📅",
            style = MaterialTheme.typography.displayLarge
        )

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "Nenhum jogo agendado",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(12.dp))

        Text(
            text = "Seja o primeiro a organizar uma pelada e chame os parcass!",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(0.8f)
        )

        Spacer(modifier = Modifier.height(24.dp))

        FilledTonalButton(
            onClick = onCreateClick,
            modifier = Modifier.fillMaxWidth(0.6f).height(48.dp)
        ) {
            Text("+ Criar Jogo")
        }
    }
}

@Composable
private fun GamesFilteredEmptyState(
    hasFilters: Boolean,
    onClearFilters: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "🔍",
            style = MaterialTheme.typography.displayLarge
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Nenhum jogo encontrado",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Tente ajustar os filtros para ver mais jogos",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        if (hasFilters) {
            Spacer(modifier = Modifier.height(16.dp))
            OutlinedButton(onClick = onClearFilters) {
                Text("✖ Limpar Filtros")
            }
        }
    }
}

@Composable
private fun GamesErrorState(message: String, onRetry: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "❌",
            style = MaterialTheme.typography.displayLarge
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Erro ao carregar jogos",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.error
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(16.dp))

        Button(onClick = onRetry) {
            Text("🔄 Tentar novamente")
        }
    }
}

@Composable
private fun GameCard(game: WebGame, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth().heightIn(min = 120.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = game.locationName.ifEmpty { "Local nao definido" },
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )

                    if (game.locationAddress.isNotEmpty()) {
                        Text(
                            text = "📍 ${game.locationAddress}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }

                Surface(
                    shape = RoundedCornerShape(6.dp),
                    color = getFieldTypeColor(game.gameType),
                    modifier = Modifier.padding(start = 8.dp)
                ) {
                    Text(
                        text = game.gameType,
                        style = MaterialTheme.typography.labelSmall,
                        color = Color.White,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = "⏰",
                    style = MaterialTheme.typography.bodySmall
                )
                Text(
                    text = buildString {
                        append(game.date)
                        if (game.time.isNotEmpty()) {
                            append(" ${game.time}")
                        } else {
                            append(" (--:--)")
                        }
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = if (game.time.isEmpty()) {
                        MaterialTheme.colorScheme.error
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    }
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "👥 ${game.playersCount} confirmados",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(modifier = Modifier.weight(1f))

                if (game.status.isNotEmpty()) {
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = getStatusColor(game.status),
                        modifier = Modifier.padding(end = 4.dp)
                    ) {
                        Text(
                            text = getStatusText(game.status),
                            style = MaterialTheme.typography.labelSmall,
                            color = Color.White,
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                        )
                    }
                }

                if (game.dailyPrice > 0) {
                    Text(
                        text = "R$ ${formatPrice(game.dailyPrice)}",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

private fun getStatusColor(status: String): Color = when (status.uppercase()) {
    "OPEN" -> GameStatusColors.Scheduled
    "CONFIRMED" -> GameStatusColors.InProgress
    "SCHEDULED" -> GameStatusColors.Scheduled
    "LIVE" -> GameStatusColors.Full
    "FINISHED" -> GameStatusColors.Finished
    "CANCELLED" -> GameStatusColors.Cancelled
    else -> GameStatusColors.Finished
}

private fun getStatusText(status: String): String = when (status.uppercase()) {
    "OPEN" -> "🟢 Aberto"
    "CONFIRMED" -> "🟡 Fechado"
    "SCHEDULED" -> "🟢 Agendado"
    "LIVE" -> "🔴 Ao Vivo"
    "FINISHED" -> "✅ Finalizado"
    "CANCELLED" -> "❌ Cancelado"
    else -> status
}

private external fun jsGetCurrentDate(): String
private external fun jsGetDatePlusDays(days: Int): String
external fun jsGetTimestamp(): Double

@Composable
private fun GameDetailDialog(game: WebGame, onDismiss: () -> Unit) {
    var showConfirmDialog by remember { mutableStateOf(false) }
    var isConfirmed by remember { mutableStateOf(false) }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier.fillMaxWidth().heightIn(max = 600.dp),
            shape = RoundedCornerShape(16.dp)
        ) {
            Column(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("⚽ Detalhes do Jogo", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    TextButton(onClick = onDismiss) {
                        Text("✕", style = MaterialTheme.typography.titleMedium)
                    }
                }

                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))

                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.weight(1f, fill = false)
                ) {
                    item { GameDetailHeader(game = game) }
                    if (game.team1Players.isNotEmpty() || game.team2Players.isNotEmpty()) {
                        item { TeamsSection(game = game) }
                    }
                    item { ConfirmationsSection(confirmations = game.confirmations, maxPlayers = game.maxPlayers) }
                }

                Spacer(modifier = Modifier.height(12.dp))

                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = { showConfirmDialog = true },
                        modifier = Modifier.weight(1f),
                        colors = if (isConfirmed) ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)
                        else ButtonDefaults.outlinedButtonColors()
                    ) {
                        Text(if (isConfirmed) "❌ Cancelar" else "✅ Confirmar")
                    }
                    Button(onClick = { }, modifier = Modifier.weight(1f)) {
                        Text("🗺️ Mapa")
                    }
                }
            }
        }
    }

    if (showConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showConfirmDialog = false },
            title = { Text("Confirmar Presenca") },
            text = { Text("Deseja ${if (isConfirmed) "cancelar" else "confirmar"} presenca?") },
            confirmButton = {
                Button(onClick = { isConfirmed = !isConfirmed; showConfirmDialog = false }) {
                    Text("Confirmar")
                }
            },
            dismissButton = {
                TextButton(onClick = { showConfirmDialog = false }) {
                    Text("Cancelar")
                }
            }
        )
    }
}

@Composable
private fun GameDetailHeader(game: WebGame) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("📅 ${game.date}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(if (game.time.isNotEmpty()) "⏰ ${game.time}" else "⏰ --:--", style = MaterialTheme.typography.titleMedium)
            }

            Text("📍 ${game.locationName.ifEmpty { "Local nao definido" }}", style = MaterialTheme.typography.bodyLarge)

            if (game.locationAddress.isNotEmpty()) {
                Text(
                    text = game.locationAddress,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(start = 24.dp)
                )
            }

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Surface(shape = RoundedCornerShape(4.dp), color = getFieldTypeColor(game.gameType)) {
                    Text(
                        text = game.gameType,
                        style = MaterialTheme.typography.labelSmall,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        color = Color.White
                    )
                }
                Surface(
                    shape = RoundedCornerShape(4.dp),
                    color = getStatusColor(game.status)
                ) {
                    Text(
                        text = getStatusText(game.status),
                        style = MaterialTheme.typography.labelSmall,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        color = Color.White
                    )
                }
            }

            if (game.dailyPrice > 0) {
                Text(
                    "💰 Valor: R$ ${formatPrice(game.dailyPrice)}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.Bold
                )
            }

            if (game.ownerName.isNotEmpty()) {
                Text(
                    "👤 Organizador: ${game.ownerName}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun TeamsSection(game: WebGame) {
    Column {
        Text(
            "⚽ Times",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(top = 8.dp, bottom = 8.dp)
        )
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TeamCard(name = game.team1Name, score = game.team1Score, players = game.team1Players, modifier = Modifier.weight(1f))
            TeamCard(name = game.team2Name, score = game.team2Score, players = game.team2Players, modifier = Modifier.weight(1f))
        }
    }
}

@Composable
private fun TeamCard(name: String, score: Int, players: List<String>, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f))
    ) {
        Column(modifier = Modifier.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
            Text(
                "⚽ $score",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
            if (players.isNotEmpty()) {
                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                players.forEach {
                    Text(it, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }
    }
}

@Composable
private fun ConfirmationsSection(confirmations: List<WebConfirmation>, maxPlayers: Int) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                "👥 Confirmados",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(top = 8.dp)
            )
            Text(
                "${confirmations.count { it.status == "CONFIRMED" }}/$maxPlayers",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Spacer(modifier = Modifier.height(8.dp))
        if (confirmations.isEmpty()) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
            ) {
                Text(
                    "Nenhum jogador confirmado ainda",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(16.dp),
                    textAlign = TextAlign.Center
                )
            }
        } else {
            confirmations.forEach { confirmation -> ConfirmationItem(confirmation = confirmation) }
        }
    }
}

@Composable
private fun ConfirmationItem(confirmation: WebConfirmation) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        colors = CardDefaults.cardColors(
            containerColor = when (confirmation.status) {
                "CONFIRMED" -> MaterialTheme.colorScheme.surface
                "PENDING" -> MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.3f)
                else -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
            }
        )
    ) {
        Row(modifier = Modifier.fillMaxWidth().padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Surface(
                shape = RoundedCornerShape(50),
                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f),
                modifier = Modifier.size(36.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        text = confirmation.userName.firstOrNull()?.uppercase() ?: "?",
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }
            Spacer(modifier = Modifier.width(8.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(confirmation.userName, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                Text(confirmation.position, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            when (confirmation.status) {
                "CONFIRMED" -> Text("✅", style = MaterialTheme.typography.bodyMedium)
                "PENDING" -> Text("⏳", style = MaterialTheme.typography.bodyMedium)
            }
            if (confirmation.paymentStatus == "PAID") {
                Spacer(modifier = Modifier.width(4.dp))
                Text("💰", style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

internal fun mapToWebGame(map: Map<String, Any?>): WebGame {
    @Suppress("UNCHECKED_CAST")
    val confirmationsMap = map["confirmations"] as? List<Map<String, Any?>> ?: emptyList()
    val confirmations = confirmationsMap.map { c ->
        WebConfirmation(
            userId = c["userId"] as? String ?: "",
            userName = c["userName"] as? String ?: "Jogador",
            userPhoto = c["userPhoto"] as? String,
            position = c["position"] as? String ?: "Linheiro",
            status = c["status"] as? String ?: "PENDING",
            paymentStatus = c["paymentStatus"] as? String ?: "PENDING"
        )
    }

    return WebGame(
        id = map["id"] as? String ?: "",
        title = map["title"] as? String ?: "",
        date = map["date"] as? String ?: "",
        time = map["time"] as? String ?: "",
        locationName = map["locationName"] as? String ?: map["location"] as? String ?: "",
        locationAddress = map["locationAddress"] as? String ?: "",
        status = map["status"] as? String ?: "SCHEDULED",
        playersCount = (map["playersCount"] as? Number)?.toInt() ?: (map["players"] as? Number)?.toInt() ?: 0,
        maxPlayers = (map["maxPlayers"] as? Number)?.toInt() ?: 14,
        gameType = map["gameType"] as? String ?: "Society",
        dailyPrice = (map["dailyPrice"] as? Number)?.toDouble() ?: 0.0,
        ownerName = map["ownerName"] as? String ?: "",
        groupId = map["groupId"] as? String,
        groupName = map["groupName"] as? String,
        confirmations = confirmations,
        team1Name = map["team1Name"] as? String ?: "Time A",
        team2Name = map["team2Name"] as? String ?: "Time B",
        team1Score = (map["team1Score"] as? Number)?.toInt() ?: 0,
        team2Score = (map["team2Score"] as? Number)?.toInt() ?: 0,
        team1Players = (map["team1Players"] as? List<String>) ?: emptyList(),
        team2Players = (map["team2Players"] as? List<String>) ?: emptyList()
    )
}

private fun filterGames(
    games: List<WebGame>,
    statusFilter: StatusFilter,
    dateFilter: DateFilter
): List<WebGame> {
    val todayStr = jsGetCurrentDate()

    val dateFiltered = when (dateFilter) {
        DateFilter.TODAY -> games.filter { it.date == todayStr }
        DateFilter.WEEK -> {
            val weekEndStr = jsGetDatePlusDays(7)
            games.filter { it.date >= todayStr && it.date <= weekEndStr }
        }
        DateFilter.MONTH -> {
            val monthEndStr = jsGetDatePlusDays(30)
            games.filter { it.date >= todayStr && it.date <= monthEndStr }
        }
        DateFilter.ALL -> games
    }

    val statusFiltered = if (statusFilter != StatusFilter.ALL) {
        dateFiltered.filter { it.status.equals(statusFilter.status, ignoreCase = true) }
    } else {
        dateFiltered
    }

    return statusFiltered.sortedWith(compareBy({ it.date }, { it.time }))
}
