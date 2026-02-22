package com.futebadosparcas.ui.voting

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

sealed class VotingState {
    object Loading : VotingState()
    data class Voting(val players: List<Map<String, Any?>>, val selectedMvp: String?, val selectedBolaMurcha: String?) : VotingState()
    data class Finished(val mvpWinner: Map<String, Any?>, val bolaMurchaWinner: Map<String, Any?>?, val mvpVotes: Map<String, Int>, val bolaMurchaVotes: Map<String, Int>) : VotingState()
    data class Error(val message: String) : VotingState()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MvpVotingScreen(
    gameId: String,
    onBack: () -> Unit
) {
    var state by remember { mutableStateOf<VotingState>(VotingState.Loading) }
    var selectedTab by remember { mutableStateOf(0) }
    var selectedMvp by remember { mutableStateOf<String?>(null) }
    var selectedBolaMurcha by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(gameId) {
        scope.launch {
            state = VotingState.Loading
            val players = getMockPlayersForVoting()
            state = VotingState.Voting(
                players = players,
                selectedMvp = null,
                selectedBolaMurcha = null
            )
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Votação Pós-Jogo") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Text("←")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    titleContentColor = MaterialTheme.colorScheme.onPrimaryContainer
                )
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (val currentState = state) {
                is VotingState.Loading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = androidx.compose.ui.Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                }
                is VotingState.Voting -> {
                    Column(modifier = Modifier.fillMaxSize()) {
                        TabRow(selectedTabIndex = selectedTab) {
                            Tab(
                                selected = selectedTab == 0,
                                onClick = { selectedTab = 0 },
                                text = { Text("🏆 MVP") },
                                icon = { Text("⭐") }
                            )
                            Tab(
                                selected = selectedTab == 1,
                                onClick = { selectedTab = 1 },
                                text = { Text("💩 Bola Murcha") },
                                icon = { Text("😅") }
                            )
                        }

                        when (selectedTab) {
                            0 -> MvpVotingTab(
                                players = currentState.players,
                                selectedId = selectedMvp,
                                onPlayerSelected = { selectedMvp = it }
                            )
                            1 -> BolaMurchaVotingTab(
                                players = currentState.players,
                                selectedId = selectedBolaMurcha,
                                onPlayerSelected = { selectedBolaMurcha = it }
                            )
                        }

                        if (selectedMvp != null) {
                            Button(
                                onClick = {
                                    val mvpWinner = currentState.players.find { it["id"] == selectedMvp } ?: currentState.players.first()
                                    val bolaMurchaWinner = currentState.players.find { it["id"] == selectedBolaMurcha }
                                    state = VotingState.Finished(
                                        mvpWinner = mvpWinner,
                                        bolaMurchaWinner = bolaMurchaWinner,
                                        mvpVotes = mapOf(selectedMvp!! to 5, "outro1" to 2, "outro2" to 1),
                                        bolaMurchaVotes = selectedBolaMurcha?.let { mapOf(it to 3, "outro3" to 2) } ?: emptyMap()
                                    )
                                },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = if (selectedBolaMurcha == null) 
                                        MaterialTheme.colorScheme.primaryContainer 
                                    else 
                                        MaterialTheme.colorScheme.primary
                                )
                            ) {
                                Text(if (selectedBolaMurcha == null) "Confirmar MVP" else "Confirmar Votos")
                            }
                        }
                    }
                }
                is VotingState.Finished -> {
                    VotingResultCard(
                        mvpWinner = currentState.mvpWinner,
                        bolaMurchaWinner = currentState.bolaMurchaWinner,
                        mvpVotes = currentState.mvpVotes,
                        bolaMurchaVotes = currentState.bolaMurchaVotes,
                        onClose = onBack
                    )
                }
                is VotingState.Error -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = androidx.compose.ui.Alignment.Center
                    ) {
                        Column(horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally) {
                            Text("❌ ${currentState.message}", color = MaterialTheme.colorScheme.error)
                            Spacer(modifier = Modifier.height(16.dp))
                            Button(onClick = onBack) {
                                Text("Voltar")
                            }
                        }
                    }
                }
            }
        }
    }
}

private suspend fun getMockPlayersForVoting(): List<Map<String, Any?>> {
    return listOf(
        mapOf("id" to "p1", "name" to "João Silva", "nickname" to "Joãozinho", "photoUrl" to "", "position" to "ATA", "goals" to 3),
        mapOf("id" to "p2", "name" to "Pedro Santos", "nickname" to "Pedrão", "photoUrl" to "", "position" to "MEI", "assists" to 2),
        mapOf("id" to "p3", "name" to "Lucas Oliveira", "nickname" to "Luquinhas", "photoUrl" to "", "position" to "VOL"),
        mapOf("id" to "p4", "name" to "Carlos Gomes", "nickname" to "Carlinhos", "photoUrl" to "", "position" to "ZAG"),
        mapOf("id" to "p5", "name" to "Rafael Costa", "nickname" to "Rafa", "photoUrl" to "", "position" to "LE"),
        mapOf("id" to "p6", "name" to "Bruno Lima", "nickname" to "Bruninho", "photoUrl" to "", "position" to "GOL", "saves" to 8),
        mapOf("id" to "p7", "name" to "Diego Souza", "nickname" to "Diegão", "photoUrl" to "", "position" to "LD"),
        mapOf("id" to "p8", "name" to "Thiago Ferreira", "nickname" to "Thiaguinho", "photoUrl" to "", "position" to "ATA", "goals" to 2)
    )
}
