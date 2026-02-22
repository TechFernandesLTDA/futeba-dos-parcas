package com.futebadosparcas.ui.tactical

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TacticalBoardScreen(
    team1Name: String = "Time A",
    team2Name: String = "Time B",
    playersTeam1: List<String> = emptyList(),
    playersTeam2: List<String> = emptyList(),
    onBackClick: () -> Unit
) {
    var selectedFormation by remember { mutableStateOf(Formations.getById("4-4-2")) }
    var team1Players by remember {
        mutableStateOf(
            generateInitialPlayers(
                teamId = 1,
                playerNames = playersTeam1.ifEmpty { getDefaultTeam1Names() },
                formation = selectedFormation
            )
        )
    }
    var team2Players by remember {
        mutableStateOf(
            generateInitialPlayers(
                teamId = 2,
                playerNames = playersTeam2.ifEmpty { getDefaultTeam2Names() },
                formation = selectedFormation
            )
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Quadro Tático",
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Text(
                            text = "←",
                            style = MaterialTheme.typography.titleLarge
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant
                ),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "Configuração",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        FormationSelector(
                            selectedFormation = selectedFormation,
                            onFormationSelected = { newFormation ->
                                selectedFormation = newFormation
                                team1Players = redistributePlayers(
                                    team1Players,
                                    newFormation,
                                    1
                                )
                                team2Players = redistributePlayers(
                                    team2Players,
                                    newFormation,
                                    2
                                )
                            },
                            modifier = Modifier.weight(1f)
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        TeamColorIndicator(
                            name = team1Name,
                            color = Color(0xFF2196F3),
                            modifier = Modifier.weight(1f)
                        )
                        TeamColorIndicator(
                            name = team2Name,
                            color = Color(0xFFF44336),
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }

            FieldCanvas(
                team1Players = team1Players,
                team2Players = team2Players,
                team1Name = team1Name,
                team2Name = team2Name,
                onPlayerMoved = { playerId, newPosition ->
                    val playerIndex = team1Players.indexOfFirst { it.id == playerId }
                    if (playerIndex >= 0) {
                        team1Players = team1Players.toMutableList().apply {
                            this[playerIndex] = this[playerIndex].copy(
                                position = FormationPosition(
                                    x = newPosition.x,
                                    y = newPosition.y,
                                    role = this[playerIndex].position.role
                                )
                            )
                        }
                    } else {
                        val p2Index = team2Players.indexOfFirst { it.id == playerId }
                        if (p2Index >= 0) {
                            team2Players = team2Players.toMutableList().apply {
                                this[p2Index] = this[p2Index].copy(
                                    position = FormationPosition(
                                        x = newPosition.x,
                                        y = newPosition.y,
                                        role = this[p2Index].position.role
                                    )
                                )
                            }
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth()
            )

            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
                ),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "Dica",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = "Arraste os jogadores para reposicioná-los no campo. A formação escolhida determina as posições iniciais.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
private fun TeamColorIndicator(
    name: String,
    color: Color,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(8.dp),
        color = color.copy(alpha = 0.15f)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(16.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(color)
            )
            Text(
                text = name,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
                color = color
            )
        }
    }
}

private fun generateInitialPlayers(
    teamId: Int,
    playerNames: List<String>,
    formation: Formation
): List<FieldPlayer> {
    return formation.positions.mapIndexed { index, pos ->
        FieldPlayer(
            id = "team${teamId}_player_$index",
            name = playerNames.getOrElse(index) { "Jogador ${index + 1}" },
            position = if (teamId == 1) {
                pos
            } else {
                FormationPosition(
                    x = 1f - pos.x,
                    y = pos.y,
                    role = pos.role
                )
            },
            teamId = teamId,
            number = index + 1
        )
    }
}

private fun redistributePlayers(
    currentPlayers: List<FieldPlayer>,
    newFormation: Formation,
    teamId: Int
): List<FieldPlayer> {
    return newFormation.positions.mapIndexed { index, pos ->
        val existingPlayer = currentPlayers.getOrNull(index)
        FieldPlayer(
            id = "team${teamId}_player_$index",
            name = existingPlayer?.name ?: "Jogador ${index + 1}",
            position = if (teamId == 1) {
                pos
            } else {
                FormationPosition(
                    x = 1f - pos.x,
                    y = pos.y,
                    role = pos.role
                )
            },
            teamId = teamId,
            number = index + 1
        )
    }
}

private fun getDefaultTeam1Names(): List<String> = listOf(
    "Goleiro",
    "Zagueiro 1",
    "Zagueiro 2",
    "Zagueiro 3",
    "Zagueiro 4",
    "Meia 1",
    "Volante",
    "Meia 2",
    "Meia 3",
    "Atacante 1",
    "Atacante 2"
)

private fun getDefaultTeam2Names(): List<String> = listOf(
    "Goleiro",
    "Defensor 1",
    "Defensor 2",
    "Defensor 3",
    "Defensor 4",
    "Meio 1",
    "Meio 2",
    "Meio 3",
    "Meio 4",
    "Atacante 1",
    "Atacante 2"
)
