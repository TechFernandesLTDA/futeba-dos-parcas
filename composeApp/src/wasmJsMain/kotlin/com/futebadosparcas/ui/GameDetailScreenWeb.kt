package com.futebadosparcas.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.futebadosparcas.firebase.FirebaseManager
import kotlinx.coroutines.launch

private sealed class GameDetailUiState {
    object Loading : GameDetailUiState()
    data class Success(val game: WebGame) : GameDetailUiState()
    data class Error(val message: String) : GameDetailUiState()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GameDetailScreenWeb(
    gameId: String,
    onBackClick: () -> Unit
) {
    var uiState by remember { mutableStateOf<GameDetailUiState>(GameDetailUiState.Loading) }
    var isConfirmed by remember { mutableStateOf(false) }
    var showConfirmDialog by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    fun loadGame() {
        scope.launch {
            uiState = GameDetailUiState.Loading
            try {
                val games = FirebaseManager.getCollection("games")
                val gameMap = games.find { it["id"] as? String == gameId }
                if (gameMap != null) {
                    uiState = GameDetailUiState.Success(mapToWebGameDetail(gameMap))
                } else {
                    uiState = GameDetailUiState.Error("Jogo não encontrado")
                }
            } catch (e: Exception) {
                uiState = GameDetailUiState.Error(e.message ?: "Erro ao carregar jogo")
            }
        }
    }

    LaunchedEffect(gameId) {
        loadGame()
    }

    Scaffold(
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) }
    ) { paddingValues ->
        when (val state = uiState) {
            is GameDetailUiState.Loading -> {
                Box(
                    modifier = Modifier.fillMaxSize().padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }

            is GameDetailUiState.Error -> {
                Column(
                    modifier = Modifier.fillMaxSize().padding(paddingValues).padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text("❌", style = MaterialTheme.typography.displayLarge)
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Erro ao carregar jogo", style = MaterialTheme.typography.titleMedium)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(state.message, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(onClick = { loadGame() }) { Text("🔄 Tentar novamente") }
                }
            }

            is GameDetailUiState.Success -> {
                val game = state.game
                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(paddingValues),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
                        ) {
                            Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text("📅 ${game.date}", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                                    Text(if (game.time.isNotEmpty()) "⏰ ${game.time}" else "⏰ --:--", style = MaterialTheme.typography.titleLarge)
                                }

                                HorizontalDivider()

                                Text("📍 ${game.locationName.ifEmpty { "Local não definido" }}", style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
                                if (game.locationAddress.isNotEmpty()) {
                                    Text(game.locationAddress, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                                ) {
                                    Surface(
                                        shape = RoundedCornerShape(8.dp),
                                        color = getFieldTypeColor(game.gameType)
                                    ) {
                                        Text(
                                            text = game.gameType,
                                            style = MaterialTheme.typography.labelMedium,
                                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                                            color = Color.White
                                        )
                                    }
                                    GameStatusChip(status = game.status)
                                }

                                if (game.dailyPrice > 0) {
                                    Text(
                                        "💰 Valor: R$ ${formatPrice(game.dailyPrice)}",
                                        style = MaterialTheme.typography.titleMedium,
                                        color = MaterialTheme.colorScheme.primary,
                                        fontWeight = FontWeight.Bold
                                    )
                                }

                                if (game.ownerName.isNotEmpty()) {
                                    Text(
                                        "👤 Organizador: ${game.ownerName}",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }

                                if (game.groupName != null) {
                                    Text(
                                        "👥 Grupo: ${game.groupName}",
                                        style = MaterialTheme.typography.bodyMedium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                            }
                        }
                    }

                    if (game.team1Players.isNotEmpty() || game.team2Players.isNotEmpty()) {
                        item {
                            Text("⚽ Times", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                TeamCardWeb(
                                    name = game.team1Name,
                                    score = game.team1Score,
                                    players = game.team1Players,
                                    modifier = Modifier.weight(1f)
                                )
                                TeamCardWeb(
                                    name = game.team2Name,
                                    score = game.team2Score,
                                    players = game.team2Players,
                                    modifier = Modifier.weight(1f)
                                )
                            }
                        }
                    }

                    item {
                        Text("👥 Confirmados (${game.confirmations.count { it.status == "CONFIRMED" }}/${game.maxPlayers})", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)

                        if (game.confirmations.isEmpty()) {
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
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                game.confirmations.forEach { confirmation ->
                                    ConfirmationItemWeb(confirmation = confirmation)
                                }
                            }
                        }
                    }

                    item {
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            OutlinedButton(
                                onClick = { showConfirmDialog = true },
                                modifier = Modifier.weight(1f),
                                colors = if (isConfirmed) ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error)
                                else ButtonDefaults.outlinedButtonColors()
                            ) {
                                Text(if (isConfirmed) "❌ Cancelar Presença" else "✅ Confirmar Presença")
                            }
                            Button(
                                onClick = { },
                                modifier = Modifier.weight(1f)
                            ) {
                                Text("🗺️ Ver no Mapa")
                            }
                        }
                    }
                }
            }
        }
    }

    if (showConfirmDialog && uiState is GameDetailUiState.Success) {
        AlertDialog(
            onDismissRequest = { showConfirmDialog = false },
            title = { Text("Confirmar Presença") },
            text = { Text("Deseja ${if (isConfirmed) "cancelar" else "confirmar"} presença neste jogo?") },
            confirmButton = {
                Button(onClick = {
                    isConfirmed = !isConfirmed
                    showConfirmDialog = false
                    scope.launch {
                        snackbarHostState.showSnackbar(
                            if (isConfirmed) "Presença confirmada!" else "Presença cancelada"
                        )
                    }
                }) {
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
private fun GameStatusChip(status: String) {
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
            style = MaterialTheme.typography.labelMedium,
            color = Color.White,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
private fun TeamCardWeb(
    name: String,
    score: Int,
    players: List<String>,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f))
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text("⚽ $score", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
            if (players.isNotEmpty()) {
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                players.forEach { player ->
                    Text(player, style = MaterialTheme.typography.bodySmall, maxLines = 1)
                }
            }
        }
    }
}

@Composable
private fun ConfirmationItemWeb(confirmation: WebConfirmation) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = when (confirmation.status) {
                "CONFIRMED" -> MaterialTheme.colorScheme.surface
                "PENDING" -> MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.3f)
                else -> MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
            }
        )
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                shape = RoundedCornerShape(50),
                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f),
                modifier = Modifier.size(40.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        text = confirmation.userName.firstOrNull()?.uppercase() ?: "?",
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(confirmation.userName, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                Text(confirmation.position, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            when (confirmation.status) {
                "CONFIRMED" -> Text("✅", style = MaterialTheme.typography.titleMedium)
                "PENDING" -> Text("⏳", style = MaterialTheme.typography.titleMedium)
            }
            if (confirmation.paymentStatus == "PAID") {
                Spacer(modifier = Modifier.width(4.dp))
                Text("💰", style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

private fun mapToWebGameDetail(map: Map<String, Any?>): WebGame {
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
