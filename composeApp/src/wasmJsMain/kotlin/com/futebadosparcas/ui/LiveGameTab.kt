package com.futebadosparcas.ui

import androidx.compose.animation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.futebadosparcas.firebase.FirebaseManager
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

sealed class LiveGameUiState {
    object Loading : LiveGameUiState()
    data class Success(
        val game: Map<String, Any?>,
        val team1: TeamData,
        val team2: TeamData,
        val score: ScoreData,
        val isOwner: Boolean,
        val events: List<EventData>
    ) : LiveGameUiState()
    data class Error(val message: String) : LiveGameUiState()
}

data class TeamData(
    val id: String,
    val name: String,
    val color: String,
    val players: List<PlayerData>
)

data class PlayerData(
    val id: String,
    val name: String,
    val position: String,
    val goals: Int = 0,
    val assists: Int = 0,
    val saves: Int = 0,
    val yellowCards: Int = 0,
    val redCards: Int = 0
)

data class ScoreData(
    val team1Score: Int,
    val team2Score: Int,
    val startedAt: Long?,
    val finishedAt: Long?,
    val isLive: Boolean
)

data class EventData(
    val id: String,
    val type: String,
    val playerName: String,
    val teamName: String,
    val minute: Int,
    val assistName: String? = null
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LiveGameTab(
    gameId: String = "live-game-1"
) {
    var uiState by remember { mutableStateOf<LiveGameUiState>(LiveGameUiState.Loading) }
    var showAddEventDialog by remember { mutableStateOf(false) }
    var showFinishDialog by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(gameId) {
        scope.launch {
            uiState = LiveGameUiState.Loading
            delay(500)
            
            val mockState = loadMockLiveGame(gameId)
            uiState = mockState
        }
    }

    Column(
        modifier = Modifier.fillMaxSize()
    ) {
        when (val state = uiState) {
            is LiveGameUiState.Loading -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
            is LiveGameUiState.Success -> {
                LiveGameContent(
                    state = state,
                    onAddEvent = { showAddEventDialog = true },
                    onFinishGame = { showFinishDialog = true }
                )
            }
            is LiveGameUiState.Error -> {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Text(
                            text = "❌ ${state.message}",
                            color = MaterialTheme.colorScheme.error
                        )
                        Button(onClick = {
                            scope.launch {
                                uiState = LiveGameUiState.Loading
                                delay(500)
                                uiState = loadMockLiveGame(gameId)
                            }
                        }) {
                            Text("Tentar novamente")
                        }
                    }
                }
            }
        }
    }

    if (showAddEventDialog && uiState is LiveGameUiState.Success) {
        val successState = uiState as LiveGameUiState.Success
        AddEventDialog(
            team1 = successState.team1,
            team2 = successState.team2,
            onDismiss = { showAddEventDialog = false },
            onConfirm = { eventType, playerId, playerName, teamId, assistId, assistName, minute ->
                scope.launch {
                    println("Event added: $eventType by $playerName at $minute min")
                    showAddEventDialog = false
                }
            }
        )
    }

    if (showFinishDialog) {
        FinishGameDialog(
            onDismiss = { showFinishDialog = false },
            onConfirm = {
                scope.launch {
                    println("Game finished!")
                    showFinishDialog = false
                }
            }
        )
    }
}

@Composable
private fun LiveGameContent(
    state: LiveGameUiState.Success,
    onAddEvent: () -> Unit,
    onFinishGame: () -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            LiveGameHeader(
                score = state.score,
                team1Name = state.team1.name,
                team2Name = state.team2.name,
                team1Color = state.team1.color,
                team2Color = state.team2.color
            )
        }

        item {
            EventButton(
                enabled = state.score.isLive,
                onClick = onAddEvent
            )
        }

        item {
            Text(
                text = "👥 Jogadores em Campo",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
        }

        item {
            TeamFormationCard(
                team1 = state.team1,
                team2 = state.team2
            )
        }

        if (state.events.isNotEmpty()) {
            item {
                Text(
                    text = "📋 Eventos do Jogo",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            item {
                EventsList(events = state.events)
            }
        }

        if (state.isOwner && state.score.isLive) {
            item {
                Button(
                    onClick = onFinishGame,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Text("✅ Finalizar Jogo")
                }
            }
        }
    }
}

@Composable
private fun LiveGameHeader(
    score: ScoreData,
    team1Name: String,
    team2Name: String,
    team1Color: String,
    team2Color: String
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            GameTimer(
                startedAt = score.startedAt,
                finishedAt = score.finishedAt,
                isLive = score.isLive
            )

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                TeamScoreDisplay(
                    teamName = team1Name,
                    score = score.team1Score,
                    color = parseColor(team1Color, MaterialTheme.colorScheme.primary)
                )

                Text(
                    text = "VS",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )

                TeamScoreDisplay(
                    teamName = team2Name,
                    score = score.team2Score,
                    color = parseColor(team2Color, MaterialTheme.colorScheme.secondary)
                )
            }
        }
    }
}

@Composable
private fun GameTimer(
    startedAt: Long?,
    finishedAt: Long?,
    isLive: Boolean
) {
    var elapsedSeconds by remember { mutableStateOf(0L) }

    LaunchedEffect(startedAt, isLive) {
        if (startedAt != null && isLive) {
            elapsedSeconds = 1500
            while (true) {
                delay(1000L)
                elapsedSeconds++
            }
        }
    }

    val minutes = (elapsedSeconds / 60).toInt()
    val seconds = (elapsedSeconds % 60).toInt()

    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        if (isLive) {
            Surface(
                shape = RoundedCornerShape(4.dp),
                color = Color.Red
            ) {
                Text(
                    text = " LIVE ",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    modifier = Modifier.padding(2.dp)
                )
            }
        }

        Text(
            text = if (!isLive && finishedAt != null) "FIM" else formatTime(minutes, seconds),
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.Black,
            fontSize = 48.sp,
            color = MaterialTheme.colorScheme.onPrimaryContainer
        )
    }
}

private fun formatTime(minutes: Int, seconds: Int): String {
    val minStr = if (minutes < 10) "0$minutes" else minutes.toString()
    val secStr = if (seconds < 10) "0$seconds" else seconds.toString()
    return "$minStr:$secStr"
}

@Composable
private fun TeamScoreDisplay(
    teamName: String,
    score: Int,
    color: Color
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = teamName,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            color = MaterialTheme.colorScheme.onPrimaryContainer
        )

        Spacer(modifier = Modifier.height(8.dp))

        Surface(
            shape = CircleShape,
            color = color.copy(alpha = 0.2f),
            modifier = Modifier.size(72.dp)
        ) {
            Box(
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = score.toString(),
                    style = MaterialTheme.typography.headlineLarge,
                    fontWeight = FontWeight.Black,
                    fontSize = 36.sp,
                    color = color
                )
            }
        }
    }
}

@Composable
private fun EventsList(
    events: List<EventData>
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        events.forEach { event ->
            EventCard(event = event)
        }
    }
}

@Composable
private fun EventCard(
    event: EventData
) {
    val (emoji, bgColor) = when (event.type) {
        "GOAL" -> "⚽" to Color(0xFF4CAF50).copy(alpha = 0.1f)
        "SAVE" -> "🧤" to Color(0xFF2196F3).copy(alpha = 0.1f)
        "YELLOW_CARD" -> "🟨" to Color(0xFFFFEB3B).copy(alpha = 0.2f)
        "RED_CARD" -> "🟥" to Color(0xFFF44336).copy(alpha = 0.1f)
        else -> "📝" to MaterialTheme.colorScheme.surfaceVariant
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = bgColor)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = emoji,
                style = MaterialTheme.typography.headlineMedium
            )

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = event.playerName,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = event.teamName,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                if (event.assistName != null) {
                    Text(
                        text = "🎯 Assist: ${event.assistName}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            }

            Text(
                text = "${event.minute}'",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun FinishGameDialog(
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Finalizar Jogo") },
        text = { Text("Tem certeza que deseja finalizar o jogo? Esta ação não pode ser desfeita.") },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error
                )
            ) {
                Text("Finalizar")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancelar")
            }
        }
    )
}

private fun parseColor(colorHex: String, fallback: Color): Color {
    return try {
        val hex = colorHex.removePrefix("#")
        val color = hex.toLong(16)
        Color(color)
    } catch (e: Exception) {
        fallback
    }
}

private fun loadMockLiveGame(gameId: String): LiveGameUiState {
    val currentUserId = FirebaseManager.getCurrentUserId()

    val team1 = TeamData(
        id = "team1",
        name = "Time Azul",
        color = "#2196F3",
        players = listOf(
            PlayerData("p1", "João Silva", "GK", saves = 3),
            PlayerData("p2", "Pedro Santos", "DEF"),
            PlayerData("p3", "Lucas Oliveira", "DEF"),
            PlayerData("p4", "Mateus Costa", "MID", goals = 1, assists = 1),
            PlayerData("p5", "Rafael Lima", "MID"),
            PlayerData("p6", "Diego Souza", "ATK", goals = 2)
        )
    )

    val team2 = TeamData(
        id = "team2",
        name = "Time Vermelho",
        color = "#F44336",
        players = listOf(
            PlayerData("p7", "Bruno Alves", "GK", saves = 2),
            PlayerData("p8", "Carlos Eduardo", "DEF", yellowCards = 1),
            PlayerData("p9", "Felipe Rocha", "DEF"),
            PlayerData("p10", "Gustavo Pereira", "MID", goals = 1),
            PlayerData("p11", "André Martins", "MID", assists = 1),
            PlayerData("p12", "Thiago Fernandes", "ATK")
        )
    )

    val score = ScoreData(
        team1Score = 3,
        team2Score = 1,
        startedAt = 1L,
        finishedAt = null,
        isLive = true
    )

    val events = listOf(
        EventData("e1", "GOAL", "Diego Souza", "Time Azul", 12),
        EventData("e2", "GOAL", "Gustavo Pereira", "Time Vermelho", 18, "André Martins"),
        EventData("e3", "YELLOW_CARD", "Carlos Eduardo", "Time Vermelho", 22),
        EventData("e4", "SAVE", "João Silva", "Time Azul", 25),
        EventData("e5", "GOAL", "Mateus Costa", "Time Azul", 28, "Diego Souza"),
        EventData("e6", "GOAL", "Diego Souza", "Time Azul", 35)
    )

    return LiveGameUiState.Success(
        game = mapOf("id" to gameId, "status" to "LIVE"),
        team1 = team1,
        team2 = team2,
        score = score,
        isOwner = true,
        events = events
    )
}
