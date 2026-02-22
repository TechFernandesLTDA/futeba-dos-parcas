package com.futebadosparcas.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.futebadosparcas.firebase.FirebaseManager
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.random.Random

private fun formatRating(rating: Double): String {
    return ((rating * 10).toInt() / 10.0).toString()
}

private data class TeamPlayer(
    val id: String,
    val name: String,
    val position: String,
    val rating: Double = 3.5,
    val isGoalkeeper: Boolean = false
)

private sealed class TeamFormationUiState {
    object Loading : TeamFormationUiState()
    data class Ready(
        val availablePlayers: List<TeamPlayer> = emptyList(),
        val teamAPlayers: List<TeamPlayer> = emptyList(),
        val teamBPlayers: List<TeamPlayer> = emptyList(),
        val teamAColor: Color = Color(0xFF4CAF50),
        val teamBColor: Color = Color(0xFF2196F3),
        val isBalanced: Boolean = true,
        val teamARating: Double = 0.0,
        val teamBRating: Double = 0.0
    ) : TeamFormationUiState()
    data class Error(val message: String) : TeamFormationUiState()
}

private val teamColors = listOf(
    Color(0xFF4CAF50) to "Verde",
    Color(0xFF2196F3) to "Azul",
    Color(0xFFF44336) to "Vermelho",
    Color(0xFFFFEB3B) to "Amarelo",
    Color(0xFF9C27B0) to "Roxo",
    Color(0xFFFF9800) to "Laranja",
    Color(0xFF00BCD4) to "Ciano",
    Color(0xFF795548) to "Marrom",
    Color(0xFFE91E63) to "Rosa",
    Color(0xFF000000) to "Preto"
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TeamFormationScreen(
    gameId: String,
    onBackClick: () -> Unit
) {
    var uiState by remember { mutableStateOf<TeamFormationUiState>(TeamFormationUiState.Loading) }
    var showColorPicker by remember { mutableStateOf<Int?>(null) }
    var showConfirmDialog by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    fun loadGame() {
        scope.launch {
            uiState = TeamFormationUiState.Loading
            try {
                val games = FirebaseManager.getCollection("games")
                val gameMap = games.find { it["id"] as? String == gameId }
                if (gameMap != null) {
                    val players = mapToTeamPlayers(gameMap)
                    uiState = TeamFormationUiState.Ready(
                        availablePlayers = players,
                        teamAPlayers = emptyList(),
                        teamBPlayers = emptyList()
                    )
                } else {
                    uiState = TeamFormationUiState.Error("Jogo não encontrado")
                }
            } catch (e: Exception) {
                uiState = TeamFormationUiState.Error(e.message ?: "Erro ao carregar jogo")
            }
        }
    }

    fun movePlayerToTeam(player: TeamPlayer, teamIndex: Int) {
        val state = uiState as? TeamFormationUiState.Ready ?: return
        val newAvailable = state.availablePlayers.filter { it.id != player.id }
        val newTeamA = state.teamAPlayers.filter { it.id != player.id }
        val newTeamB = state.teamBPlayers.filter { it.id != player.id }

        if (teamIndex == 0) {
            val updatedTeamA = newTeamA + player
            val (ratingA, ratingB) = calculateRatings(updatedTeamA, newTeamB)
            uiState = state.copy(
                availablePlayers = newAvailable,
                teamAPlayers = updatedTeamA,
                teamARating = ratingA,
                teamBRating = ratingB,
                isBalanced = abs(ratingA - ratingB) < 1.0
            )
        } else {
            val updatedTeamB = newTeamB + player
            val (ratingA, ratingB) = calculateRatings(newTeamA, updatedTeamB)
            uiState = state.copy(
                availablePlayers = newAvailable,
                teamBPlayers = updatedTeamB,
                teamARating = ratingA,
                teamBRating = ratingB,
                isBalanced = abs(ratingA - ratingB) < 1.0
            )
        }
    }

    fun movePlayerToAvailable(player: TeamPlayer, fromTeamIndex: Int) {
        val state = uiState as? TeamFormationUiState.Ready ?: return
        val newTeamA = state.teamAPlayers.filter { it.id != player.id }
        val newTeamB = state.teamBPlayers.filter { it.id != player.id }
        val (ratingA, ratingB) = calculateRatings(newTeamA, newTeamB)
        uiState = state.copy(
            availablePlayers = state.availablePlayers + player,
            teamAPlayers = newTeamA,
            teamBPlayers = newTeamB,
            teamARating = ratingA,
            teamBRating = ratingB,
            isBalanced = kotlin.math.abs(ratingA - ratingB) < 1.0
        )
    }

    fun shuffleTeams() {
        val state = uiState as? TeamFormationUiState.Ready ?: return
        val allPlayers = state.availablePlayers + state.teamAPlayers + state.teamBPlayers
        val shuffled = allPlayers.shuffled(Random.Default)
        val midpoint = shuffled.size / 2
        val teamA = shuffled.take(midpoint)
        val teamB = shuffled.drop(midpoint)
        val (ratingA, ratingB) = calculateRatings(teamA, teamB)
        uiState = state.copy(
            availablePlayers = emptyList(),
            teamAPlayers = teamA,
            teamBPlayers = teamB,
            teamARating = ratingA,
            teamBRating = ratingB,
            isBalanced = abs(ratingA - ratingB) < 1.0
        )
    }

    fun resetTeams() {
        val state = uiState as? TeamFormationUiState.Ready ?: return
        val allPlayers = state.availablePlayers + state.teamAPlayers + state.teamBPlayers
        uiState = state.copy(
            availablePlayers = allPlayers,
            teamAPlayers = emptyList(),
            teamBPlayers = emptyList(),
            teamARating = 0.0,
            teamBRating = 0.0,
            isBalanced = true
        )
    }

    fun updateTeamColor(teamIndex: Int, color: Color) {
        val state = uiState as? TeamFormationUiState.Ready ?: return
        if (teamIndex == 0) {
            uiState = state.copy(teamAColor = color)
        } else {
            uiState = state.copy(teamBColor = color)
        }
    }

    LaunchedEffect(gameId) {
        loadGame()
    }

    Scaffold(
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text("⚽ Formação de Times") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Text("←", style = MaterialTheme.typography.titleLarge)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        }
    ) { paddingValues ->
        when (val state = uiState) {
            is TeamFormationUiState.Loading -> {
                Box(
                    modifier = Modifier.fillMaxSize().padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }

            is TeamFormationUiState.Error -> {
                Column(
                    modifier = Modifier.fillMaxSize().padding(paddingValues).padding(32.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text("❌", style = MaterialTheme.typography.displayLarge)
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Erro ao carregar", style = MaterialTheme.typography.titleMedium)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(state.message, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(onClick = { loadGame() }) { Text("🔄 Tentar novamente") }
                }
            }

            is TeamFormationUiState.Ready -> {
                Column(
                    modifier = Modifier.fillMaxSize().padding(paddingValues).padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    if (state.availablePlayers.isNotEmpty()) {
                        AvailablePlayersSection(
                            players = state.availablePlayers,
                            onMoveToTeam = { player, teamIndex -> movePlayerToTeam(player, teamIndex) }
                        )
                    }

                    TeamsDisplaySection(
                        teamAPlayers = state.teamAPlayers,
                        teamBPlayers = state.teamBPlayers,
                        teamAColor = state.teamAColor,
                        teamBColor = state.teamBColor,
                        teamARating = state.teamARating,
                        teamBRating = state.teamBRating,
                        isBalanced = state.isBalanced,
                        onMoveToAvailable = { player, fromTeam -> movePlayerToAvailable(player, fromTeam) },
                        onColorClick = { teamIndex -> showColorPicker = teamIndex }
                    )

                    ActionButtonsSection(
                        hasPlayers = state.availablePlayers.isNotEmpty() || state.teamAPlayers.isNotEmpty(),
                        canShuffle = state.availablePlayers.isNotEmpty(),
                        onShuffle = { shuffleTeams() },
                        onReset = { resetTeams() },
                        onConfirm = { showConfirmDialog = true }
                    )
                }
            }
        }
    }

    showColorPicker?.let { teamIndex ->
        ColorPickerDialog(
            currentColor = if (teamIndex == 0) 
                (uiState as? TeamFormationUiState.Ready)?.teamAColor ?: Color(0xFF4CAF50)
            else 
                (uiState as? TeamFormationUiState.Ready)?.teamBColor ?: Color(0xFF2196F3),
            onDismiss = { showColorPicker = null },
            onSelectColor = { color ->
                updateTeamColor(teamIndex, color)
                showColorPicker = null
            }
        )
    }

    if (showConfirmDialog && uiState is TeamFormationUiState.Ready) {
        val state = uiState as TeamFormationUiState.Ready
        AlertDialog(
            onDismissRequest = { showConfirmDialog = false },
            title = { Text("✅ Confirmar Formação") },
            text = {
                Column {
                    Text("Deseja confirmar a formação dos times?")
                    Spacer(modifier = Modifier.height(12.dp))
                    Text("🟢 Time A: ${state.teamAPlayers.size} jogadores", fontWeight = FontWeight.Medium)
                    Text("🔵 Time B: ${state.teamBPlayers.size} jogadores", fontWeight = FontWeight.Medium)
                    if (state.availablePlayers.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            "⚠️ ${state.availablePlayers.size} jogador(es) sem time",
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall
                        )
                    }
                }
            },
            confirmButton = {
                Button(onClick = {
                    showConfirmDialog = false
                    scope.launch {
                        snackbarHostState.showSnackbar("Formação confirmada com sucesso!")
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
private fun AvailablePlayersSection(
    players: List<TeamPlayer>,
    onMoveToTeam: (TeamPlayer, Int) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                "👥 Jogadores Disponíveis (${players.size})",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(12.dp))
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(players, key = { it.id }) { player ->
                    PlayerCard(
                        player = player,
                        showMoveButtons = true,
                        onMoveToTeamA = { onMoveToTeam(player, 0) },
                        onMoveToTeamB = { onMoveToTeam(player, 1) }
                    )
                }
            }
        }
    }
}

@Composable
private fun PlayerCard(
    player: TeamPlayer,
    showMoveButtons: Boolean = false,
    teamColor: Color? = null,
    onMoveToTeamA: () -> Unit = {},
    onMoveToTeamB: () -> Unit = {},
    onRemove: () -> Unit = {}
) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = teamColor?.copy(alpha = 0.1f) ?: MaterialTheme.colorScheme.surface
        ),
        modifier = Modifier.width(120.dp)
    ) {
        Column(
            modifier = Modifier.padding(8.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(teamColor ?: MaterialTheme.colorScheme.primary.copy(alpha = 0.2f)),
                contentAlignment = Alignment.Center
            ) {
                if (player.isGoalkeeper) {
                    Text("🧤", style = MaterialTheme.typography.titleMedium)
                } else {
                    Text(
                        player.name.firstOrNull()?.uppercase() ?: "?",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = teamColor ?: MaterialTheme.colorScheme.primary
                    )
                }
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                player.name.split(" ").firstOrNull() ?: player.name,
                style = MaterialTheme.typography.labelSmall,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                fontWeight = FontWeight.Medium
            )
            Text(
                formatRating(player.rating),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary
            )
            if (player.isGoalkeeper) {
                Text(
                    "🧤 Goleiro",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.tertiary
                )
            }
            if (showMoveButtons) {
                Spacer(modifier = Modifier.height(4.dp))
                Row(
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    SmallIconButton(
                        emoji = "🟢",
                        onClick = onMoveToTeamA,
                        contentDescription = "Mover para Time A"
                    )
                    SmallIconButton(
                        emoji = "🔵",
                        onClick = onMoveToTeamB,
                        contentDescription = "Mover para Time B"
                    )
                }
            } else if (teamColor != null) {
                Spacer(modifier = Modifier.height(4.dp))
                SmallIconButton(
                    emoji = "↩️",
                    onClick = onRemove,
                    contentDescription = "Remover do time"
                )
            }
        }
    }
}

@Composable
private fun SmallIconButton(
    emoji: String,
    onClick: () -> Unit,
    contentDescription: String
) {
    Surface(
        shape = CircleShape,
        color = MaterialTheme.colorScheme.surfaceVariant,
        modifier = Modifier.size(28.dp)
    ) {
        Box(
            modifier = Modifier.clickable(onClick = onClick),
            contentAlignment = Alignment.Center
        ) {
            Text(emoji, style = MaterialTheme.typography.labelSmall)
        }
    }
}

@Composable
private fun TeamsDisplaySection(
    teamAPlayers: List<TeamPlayer>,
    teamBPlayers: List<TeamPlayer>,
    teamAColor: Color,
    teamBColor: Color,
    teamARating: Double,
    teamBRating: Double,
    isBalanced: Boolean,
    onMoveToAvailable: (TeamPlayer, Int) -> Unit,
    onColorClick: (Int) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        TeamCard(
            modifier = Modifier.weight(1f),
            teamName = "Time A",
            teamColor = teamAColor,
            players = teamAPlayers,
            teamRating = teamARating,
            hasGoalkeeper = teamAPlayers.any { it.isGoalkeeper },
            onColorClick = { onColorClick(0) },
            onRemovePlayer = { player -> onMoveToAvailable(player, 0) }
        )
        TeamCard(
            modifier = Modifier.weight(1f),
            teamName = "Time B",
            teamColor = teamBColor,
            players = teamBPlayers,
            teamRating = teamBRating,
            hasGoalkeeper = teamBPlayers.any { it.isGoalkeeper },
            onColorClick = { onColorClick(1) },
            onRemovePlayer = { player -> onMoveToAvailable(player, 1) }
        )
    }

    if (teamARating > 0 || teamBRating > 0) {
        TeamComparisonCard(
            teamARating = teamARating,
            teamBRating = teamBRating,
            teamAColor = teamAColor,
            teamBColor = teamBColor,
            isBalanced = isBalanced
        )
    }
}

@Composable
private fun TeamCard(
    modifier: Modifier = Modifier,
    teamName: String,
    teamColor: Color,
    players: List<TeamPlayer>,
    teamRating: Double,
    hasGoalkeeper: Boolean,
    onColorClick: () -> Unit,
    onRemovePlayer: (TeamPlayer) -> Unit
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = androidx.compose.foundation.BorderStroke(2.dp, teamColor)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.clickable(onClick = onColorClick)
                ) {
                    Box(
                        modifier = Modifier
                            .size(24.dp)
                            .clip(CircleShape)
                            .background(teamColor)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        teamName,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )
                }
                if (teamRating > 0) {
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = MaterialTheme.colorScheme.primaryContainer
                    ) {
                        Text(
                            formatRating(teamRating),
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            if (players.isEmpty()) {
                Text(
                    "Arraste jogadores aqui",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp),
                    textAlign = TextAlign.Center
                )
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.heightIn(max = 300.dp)
                ) {
                    items(players, key = { it.id }) { player ->
                        PlayerRow(
                            player = player,
                            teamColor = teamColor,
                            onRemove = { onRemovePlayer(player) }
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    if (hasGoalkeeper) "🧤 Com goleiro" else "⚠️ Sem goleiro",
                    style = MaterialTheme.typography.labelSmall,
                    color = if (hasGoalkeeper) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
                )
            }
        }
    }
}

@Composable
private fun PlayerRow(
    player: TeamPlayer,
    teamColor: Color,
    onRemove: () -> Unit
) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = teamColor.copy(alpha = 0.1f),
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(28.dp)
                    .clip(CircleShape)
                    .background(teamColor.copy(alpha = 0.3f)),
                contentAlignment = Alignment.Center
            ) {
                if (player.isGoalkeeper) {
                    Text("🧤", style = MaterialTheme.typography.labelSmall)
                } else {
                    Text(
                        player.name.firstOrNull()?.uppercase() ?: "?",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = teamColor
                    )
                }
            }
            Spacer(modifier = Modifier.width(8.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    player.name,
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    player.position,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Text(
                formatRating(player.rating),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.width(4.dp))
            IconButton(
                onClick = onRemove,
                modifier = Modifier.size(32.dp)
            ) {
                Text("✕", style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}

@Composable
private fun TeamComparisonCard(
    teamARating: Double,
    teamBRating: Double,
    teamAColor: Color,
    teamBColor: Color,
    isBalanced: Boolean
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f))
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                "📊 Comparação de Times",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(12.dp))

            val totalRating = teamARating + teamBRating
            val teamAPercent = (if (totalRating > 0) teamARating / totalRating else 0.5).toFloat()

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    formatRating(teamARating),
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.width(8.dp))
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(12.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(MaterialTheme.colorScheme.surfaceContainerHigh)
                ) {
                    Row(modifier = Modifier.fillMaxSize()) {
                        Box(
                            modifier = Modifier
                                .weight(teamAPercent)
                                .fillMaxHeight()
                                .background(teamAColor)
                        )
                        Box(
                            modifier = Modifier
                                .weight(1f - teamAPercent)
                                .fillMaxHeight()
                                .background(teamBColor)
                        )
                    }
                }
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    formatRating(teamBRating),
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    if (isBalanced) "✅ Times equilibrados" else "⚠️ Times desequilibrados",
                    style = MaterialTheme.typography.labelSmall,
                    color = if (isBalanced) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
                )
            }
        }
    }
}

@Composable
private fun ActionButtonsSection(
    hasPlayers: Boolean,
    canShuffle: Boolean,
    onShuffle: () -> Unit,
    onReset: () -> Unit,
    onConfirm: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        OutlinedButton(
            onClick = onReset,
            modifier = Modifier.weight(1f),
            enabled = hasPlayers
        ) {
            Text("🔄 Resetar")
        }
        Button(
            onClick = onShuffle,
            modifier = Modifier.weight(1f),
            enabled = canShuffle
        ) {
            Text("🎲 Sortear")
        }
        Button(
            onClick = onConfirm,
            modifier = Modifier.weight(1f),
            enabled = hasPlayers,
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.primary
            )
        ) {
            Text("✅ Confirmar")
        }
    }
}

@Composable
private fun ColorPickerDialog(
    currentColor: Color,
    onDismiss: () -> Unit,
    onSelectColor: (Color) -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("🎨 Escolher Cor") },
        text = {
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(teamColors.chunked(5)) { rowColors ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        rowColors.forEach { (color, name) ->
                            Box(
                                modifier = Modifier
                                    .size(48.dp)
                                    .clip(CircleShape)
                                    .background(color)
                                    .border(
                                        width = if (currentColor == color) 3.dp else 1.dp,
                                        color = if (currentColor == color) 
                                            MaterialTheme.colorScheme.primary 
                                        else 
                                            MaterialTheme.colorScheme.outline,
                                        shape = CircleShape
                                    )
                                    .clickable { onSelectColor(color) },
                                contentAlignment = Alignment.Center
                            ) {
                                if (currentColor == color) {
                                    Text("✓", color = Color.White, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Fechar")
            }
        }
    )
}

private fun mapToTeamPlayers(gameMap: Map<String, Any?>): List<TeamPlayer> {
    @Suppress("UNCHECKED_CAST")
    val confirmations = gameMap["confirmations"] as? List<Map<String, Any?>> ?: emptyList()
    
    return confirmations
        .filter { it["status"] == "CONFIRMED" }
        .mapIndexed { index, c ->
            val position = c["position"] as? String ?: "Linheiro"
            TeamPlayer(
                id = c["userId"] as? String ?: "player_$index",
                name = c["userName"] as? String ?: "Jogador ${index + 1}",
                position = position,
                rating = 3.0 + Random.nextDouble() * 2.0,
                isGoalkeeper = position.contains("Goleiro", ignoreCase = true)
            )
        }
}

private fun calculateRatings(teamA: List<TeamPlayer>, teamB: List<TeamPlayer>): Pair<Double, Double> {
    val ratingA = teamA.sumOf { it.rating }
    val ratingB = teamB.sumOf { it.rating }
    return Pair(ratingA, ratingB)
}
