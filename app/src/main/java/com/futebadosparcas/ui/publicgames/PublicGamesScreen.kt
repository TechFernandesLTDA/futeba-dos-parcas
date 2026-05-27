package com.futebadosparcas.ui.publicgames

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.R
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateType
import com.futebadosparcas.ui.components.states.ErrorState
import com.futebadosparcas.ui.components.states.LoadingState
import com.google.firebase.auth.FirebaseAuth
import org.koin.compose.viewmodel.koinViewModel
import org.koin.compose.koinInject

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PublicGamesScreen(
    viewModel: PublicGamesViewModel = koinViewModel(),
    onBackClick: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val joinState by viewModel.joinState.collectAsStateWithLifecycle()
    val auth = koinInject<FirebaseAuth>()
    val userId = auth.currentUser?.uid ?: ""

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.public_games)) },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Voltar")
                    }
                }
            )
        }
    ) { padding ->
        when (val state = uiState) {
            is PublicGamesUiState.Loading -> LoadingState()
            is PublicGamesUiState.Error -> ErrorState(
                message = state.message,
                onRetry = { viewModel.load() }
            )
            is PublicGamesUiState.Empty -> EmptyState(
                type = EmptyStateType.NoData(
                    title = stringResource(R.string.public_games_empty),
                    description = "Volte mais tarde ou crie sua própria pelada!"
                )
            )
            is PublicGamesUiState.Success -> {
                LazyColumn(
                    modifier = Modifier.padding(padding),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(state.games, key = { it.id }) { game ->
                        Card(modifier = Modifier.fillMaxWidth()) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = game.locationName.ifEmpty { "Pelada" },
                                        style = MaterialTheme.typography.titleSmall,
                                        fontWeight = FontWeight.Bold
                                    )
                                    if (game.locationAddress.isNotEmpty()) {
                                        Text(
                                            text = game.locationAddress,
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                    Row(
                                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                                        modifier = Modifier.padding(top = 4.dp)
                                    ) {
                                        AssistChip(
                                            onClick = {},
                                            label = { Text(game.date) },
                                            leadingIcon = { Icon(Icons.Filled.CalendarMonth, null, Modifier.size(16.dp)) }
                                        )
                                        AssistChip(
                                            onClick = {},
                                            label = { Text(game.time) },
                                            leadingIcon = { Icon(Icons.Filled.Schedule, null, Modifier.size(16.dp)) }
                                        )
                                        AssistChip(
                                            onClick = {},
                                            label = {
                                                Text(
                                                    "${game.playersCount}/${game.maxPlayers}",
                                                    color = if (game.playersCount >= game.maxPlayers)
                                                        MaterialTheme.colorScheme.error
                                                    else MaterialTheme.colorScheme.primary
                                                )
                                            },
                                            leadingIcon = { Icon(Icons.Filled.People, null, Modifier.size(16.dp)) }
                                        )
                                    }
                                }
                                if (game.playersCount >= game.maxPlayers) {
                                    Text(
                                        text = stringResource(R.string.public_games_lotado),
                                        style = MaterialTheme.typography.labelMedium,
                                        color = MaterialTheme.colorScheme.error
                                    )
                                } else {
                                    Button(
                                        onClick = { viewModel.joinGame(game.id, userId) },
                                        enabled = joinState !is JoinGameState.Loading
                                    ) {
                                        Text(stringResource(R.string.quero_jogar))
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
