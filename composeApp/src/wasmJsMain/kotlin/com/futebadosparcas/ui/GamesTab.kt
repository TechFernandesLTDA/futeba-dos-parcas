package com.futebadosparcas.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.futebadosparcas.firebase.FirebaseManager
import kotlinx.coroutines.launch

enum class GameFilter(val label: String, val emoji: String) {
    TODAY("Hoje", "📅"),
    WEEK("Semana", "📆"),
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
    onGameClick: ((String) -> Unit)? = null
) {
    var games by remember { mutableStateOf<List<WebGame>>(emptyList()) }
    var uiState by remember { mutableStateOf<UiState<List<WebGame>>>(UiState.Loading) }
    var selectedFilter by remember { mutableStateOf(GameFilter.ALL) }
    var showCreateDialog by remember { mutableStateOf(false) }
    var selectedGame by remember { mutableStateOf<WebGame?>(null) }
    val scope = rememberCoroutineScope()

    fun loadGames() {
        scope.launch {
            uiState = UiState.Loading
            try {
                val rawGames = FirebaseManager.getCollection("games")
                games = rawGames.map { mapToWebGame(it) }
                uiState = if (games.isEmpty()) UiState.Empty else UiState.Success(games)
            } catch (e: Exception) {
                uiState = UiState.Error(e.message ?: "Erro ao carregar jogos")
            }
        }
    }

    LaunchedEffect(Unit) {
        loadGames()
    }

    val filteredGames = remember(games, selectedFilter) {
        filterGames(games, selectedFilter)
    }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showCreateDialog = true },
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
                .padding(16.dp)
        ) {
            Text(
                text = "⚽ Jogos",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 12.dp)
            )

            GamesFilterChips(
                selectedFilter = selectedFilter,
                onFilterChange = { selectedFilter = it }
            )

            Spacer(modifier = Modifier.height(12.dp))

            when (val state = uiState) {
                is UiState.Loading -> GamesLoadingState()
                is UiState.Empty -> GamesEmptyState(onCreateClick = { showCreateDialog = true })
                is UiState.Error -> GamesErrorState(message = state.message, onRetry = { loadGames() })
                is UiState.Success -> {
                    if (filteredGames.isEmpty()) {
                        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            Text("Nenhum jogo encontrado", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    } else {
                        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            items(filteredGames, key = { it.id }) { game ->
                                GameCard(game = game, onClick = {
                                    if (onGameClick != null) onGameClick(game.id) else selectedGame = game
                                })
                            }
                        }
                    }
                }
            }
        }
    }

    if (showCreateDialog) {
        CreateGameDialog(onDismiss = { showCreateDialog = false }, onCreate = { showCreateDialog = false })
    }

    selectedGame?.let { game ->
        GameDetailDialog(game = game, onDismiss = { selectedGame = null })
    }
}

@Composable
private fun GamesFilterChips(selectedFilter: GameFilter, onFilterChange: (GameFilter) -> Unit) {
    Row(
        modifier = Modifier.horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        GameFilter.entries.forEach { filter ->
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
private fun GamesLoadingState() {
    Column(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        repeat(4) {
            Card(
                modifier = Modifier.fillMaxWidth().height(100.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
            ) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
                }
            }
        }
    }
}

@Composable
private fun GamesEmptyState(onCreateClick: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("📅", style = MaterialTheme.typography.displayLarge)
        Spacer(modifier = Modifier.height(16.dp))
        Text("Nenhum jogo agendado", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Spacer(modifier = Modifier.height(8.dp))
        Text("Seja o primeiro a criar uma pelada!", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(modifier = Modifier.height(24.dp))
        FilledTonalButton(onClick = onCreateClick) { Text("+ Criar Jogo") }
    }
}

@Composable
private fun GamesErrorState(message: String, onRetry: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("❌", style = MaterialTheme.typography.displayLarge)
        Spacer(modifier = Modifier.height(16.dp))
        Text("Erro ao carregar jogos", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.error)
        Spacer(modifier = Modifier.height(8.dp))
        Text(message, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(modifier = Modifier.height(16.dp))
        Button(onClick = onRetry) { Text("🔄 Tentar novamente") }
    }
}

@Composable
private fun GameCard(game: WebGame, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = game.locationName.ifEmpty { "Jogo sem local" },
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (game.locationAddress.isNotEmpty()) {
                        Text(
                            text = "📍 ${game.locationAddress}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
                StatusChip(status = game.status)
            }

            Text(
                text = "📅 ${game.date}${if (game.time.isNotEmpty()) " ⏰ ${game.time}" else ""}",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Surface(shape = RoundedCornerShape(4.dp), color = getFieldTypeColor(game.gameType)) {
                        Text(
                            text = game.gameType,
                            style = MaterialTheme.typography.labelSmall,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            color = Color.White
                        )
                    }
                    Text(
                        text = "👥 ${game.playersCount}/${game.maxPlayers}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
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

@Composable
private fun StatusChip(status: String) {
    val (color, text, emoji) = when (status.uppercase()) {
        "SCHEDULED" -> Triple(MaterialTheme.colorScheme.primary, "Aberto", "🟢")
        "CONFIRMED" -> Triple(MaterialTheme.colorScheme.secondary, "Fechado", "🟡")
        "LIVE" -> Triple(MaterialTheme.colorScheme.error, "Ao Vivo", "🔴")
        "FINISHED" -> Triple(MaterialTheme.colorScheme.tertiary, "Finalizado", "✅")
        "CANCELLED" -> Triple(MaterialTheme.colorScheme.outline, "Cancelado", "❌")
        else -> Triple(MaterialTheme.colorScheme.outline, status, "⚪")
    }

    Surface(shape = RoundedCornerShape(12.dp), color = color) {
        Text(
            text = "$emoji $text",
            style = MaterialTheme.typography.labelSmall,
            color = Color.White,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            fontWeight = FontWeight.Bold
        )
    }
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
                    TextButton(onClick = onDismiss) { Text("✕") }
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
            title = { Text("Confirmar Presença") },
            text = { Text("Deseja ${if (isConfirmed) "cancelar" else "confirmar"} presença?") },
            confirmButton = {
                Button(onClick = { isConfirmed = !isConfirmed; showConfirmDialog = false }) { Text("Confirmar") }
            },
            dismissButton = {
                TextButton(onClick = { showConfirmDialog = false }) { Text("Cancelar") }
            }
        )
    }
}

@Composable
private fun GameDetailHeader(game: WebGame) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("📅 ${game.date}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(if (game.time.isNotEmpty()) "⏰ ${game.time}" else "⏰ --:--", style = MaterialTheme.typography.titleMedium)
            }
            Text("📍 ${game.locationName.ifEmpty { "Local não definido" }}", style = MaterialTheme.typography.bodyLarge)
            if (game.locationAddress.isNotEmpty()) {
                Text(game.locationAddress, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
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
                StatusChip(status = game.status)
            }
            if (game.dailyPrice > 0) {
                Text("💰 Valor: R$ ${formatPrice(game.dailyPrice)}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
            }
            if (game.ownerName.isNotEmpty()) {
                Text("👤 Organizador: ${game.ownerName}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun TeamsSection(game: WebGame) {
    Column {
        Text("⚽ Times", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 8.dp, bottom = 8.dp))
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
            Text("⚽ $score", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            if (players.isNotEmpty()) {
                HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
                players.forEach { Text(it, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis) }
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
            Text("👥 Confirmados", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 8.dp))
            Text("${confirmations.count { it.status == "CONFIRMED" }}/$maxPlayers", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
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

private fun filterGames(games: List<WebGame>, filter: GameFilter): List<WebGame> {
    val todayStr = jsGetCurrentDate()
    return when (filter) {
        GameFilter.TODAY -> games.filter { it.date == todayStr }
        GameFilter.WEEK -> {
            val weekEndStr = jsGetDatePlusDays(7)
            games.filter { it.date >= todayStr && it.date <= weekEndStr }
        }
        GameFilter.ALL -> games
    }.sortedWith(compareBy({ it.date }, { it.time }))
}
