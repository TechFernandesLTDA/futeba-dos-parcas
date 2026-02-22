package com.futebadosparcas.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.futebadosparcas.firebase.FirebaseManager
import com.futebadosparcas.ui.components.CalendarComponent
import com.futebadosparcas.ui.components.GameListItem
import com.futebadosparcas.ui.components.GameListItemData
import com.futebadosparcas.ui.components.getCurrentDateFormatted
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SchedulesTab(
    onGameClick: ((String) -> Unit)? = null
) {
    var games by remember { mutableStateOf<List<WebGame>>(emptyList()) }
    var uiState by remember { mutableStateOf<SchedulesUiState>(SchedulesUiState.Loading) }
    var selectedDate by remember { mutableStateOf(getCurrentDateFormatted()) }
    val scope = rememberCoroutineScope()

    fun loadGames() {
        scope.launch {
            uiState = SchedulesUiState.Loading
            try {
                val rawGames = FirebaseManager.getCollection("games")
                games = rawGames.map { mapToWebGame(it) }
                uiState = if (games.isEmpty()) SchedulesUiState.Empty else SchedulesUiState.Success(games)
            } catch (e: Exception) {
                uiState = SchedulesUiState.Error(e.message ?: "Erro ao carregar jogos")
            }
        }
    }

    LaunchedEffect(Unit) {
        loadGames()
    }

    val datesWithGames = remember(games) {
        games.map { it.date }.toSet()
    }

    val selectedDayGames = remember(games, selectedDate) {
        games.filter { it.date == selectedDate }
            .sortedBy { it.time }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text(
            text = "📅 Agenda",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(bottom = 16.dp)
        )

        CalendarComponent(
            selectedDate = selectedDate,
            onDateSelected = { selectedDate = it },
            datesWithGames = datesWithGames,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(16.dp))

        SelectedDateHeader(
            selectedDate = selectedDate,
            gamesCount = selectedDayGames.size
        )

        Spacer(modifier = Modifier.height(12.dp))

        Box(modifier = Modifier.fillMaxWidth().weight(1f)) {
            when (val state = uiState) {
                is SchedulesUiState.Loading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                }

                is SchedulesUiState.Empty -> {
                    EmptyGamesStateContent()
                }

                is SchedulesUiState.Error -> {
                    ErrorStateContent(message = state.message, onRetry = { loadGames() })
                }

                is SchedulesUiState.Success -> {
                    if (selectedDayGames.isEmpty()) {
                        NoGamesForDateContent(selectedDate = selectedDate)
                    } else {
                        LazyColumn(
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            items(selectedDayGames, key = { it.id }) { game ->
                                GameListItem(
                                    game = game.toGameListItemData(),
                                    onClick = {
                                        if (onGameClick != null) {
                                            onGameClick(game.id)
                                        }
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SelectedDateHeader(selectedDate: String, gamesCount: Int) {
    val parts = selectedDate.split("-")
    val year = parts.getOrNull(0)?.toIntOrNull() ?: 0
    val month = parts.getOrNull(1)?.toIntOrNull() ?: 0
    val day = parts.getOrNull(2)?.toIntOrNull() ?: 0

    val monthNames = listOf(
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    )

    val monthName = monthNames.getOrElse(month - 1) { "" }

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column {
            Text(
                text = "$day de $monthName",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "$year",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        Surface(
            shape = MaterialTheme.shapes.small,
            color = if (gamesCount > 0) MaterialTheme.colorScheme.primaryContainer
            else MaterialTheme.colorScheme.surfaceVariant
        ) {
            Text(
                text = if (gamesCount == 0) "Nenhum jogo"
                else if (gamesCount == 1) "1 jogo"
                else "$gamesCount jogos",
                style = MaterialTheme.typography.labelMedium,
                color = if (gamesCount > 0) MaterialTheme.colorScheme.onPrimaryContainer
                else MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
            )
        }
    }
}

@Composable
private fun NoGamesForDateContent(selectedDate: String) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "⚽",
            style = MaterialTheme.typography.displayLarge
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Nenhum jogo neste dia",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Selecione outro dia ou crie um novo jogo",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun EmptyGamesStateContent() {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "📅",
            style = MaterialTheme.typography.displayLarge
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Nenhum jogo agendado",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Seja o primeiro a criar uma pelada!",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun ErrorStateContent(message: String, onRetry: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "❌",
            style = MaterialTheme.typography.displayLarge
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Erro ao carregar jogos",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.error
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = message,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(16.dp))
        Button(onClick = onRetry) {
            Text("🔄 Tentar novamente")
        }
    }
}

private sealed class SchedulesUiState {
    object Loading : SchedulesUiState()
    data class Success(val data: List<WebGame>) : SchedulesUiState()
    data class Error(val message: String) : SchedulesUiState()
    object Empty : SchedulesUiState()
}

private fun WebGame.toGameListItemData() = GameListItemData(
    id = id,
    title = title,
    time = time,
    locationName = locationName,
    locationAddress = locationAddress,
    status = status,
    playersCount = playersCount,
    maxPlayers = maxPlayers,
    gameType = gameType
)
