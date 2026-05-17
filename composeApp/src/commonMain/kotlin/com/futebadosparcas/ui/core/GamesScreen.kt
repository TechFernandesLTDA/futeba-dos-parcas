package com.futebadosparcas.ui.core

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.automirrored.filled.EventNote
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.koin.compose.viewmodel.koinViewModel
import com.futebadosparcas.domain.model.GameWithConfirmations

/**
 * GamesScreen – Tela principal de listagem de jogos do Futeba dos Parças.
 *
 * Exibe uma lista vertical com cards de jogo, estados de loading/empty/error
 * e um FAB para criar novo jogo.
 * ViewModel obtido via koinViewModel().
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GamesScreen(
    viewModel: GamesViewModel = koinViewModel(),
    onGameClick: (String) -> Unit = {},
    onCreateGameClick: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        topBar = {
            TopAppBar(
                title = { Text("Jogos") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = onCreateGameClick,
                containerColor = MaterialTheme.colorScheme.primary
            ) {
                Icon(Icons.Default.Add, contentDescription = "Criar jogo")
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(MaterialTheme.colorScheme.background)
        ) {
            when (val state = uiState) {
                is GamesUiState.Loading -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                }
                is GamesUiState.Success -> {
                    GamesList(
                        games = state.games,
                        onGameClick = onGameClick
                    )
                }
                is GamesUiState.Empty -> {
                    GamesEmptyState(onCreateGameClick = onCreateGameClick)
                }
                is GamesUiState.Error -> {
                    GamesErrorState(
                        message = state.message,
                        onRetry = { viewModel.loadGames() }
                    )
                }
            }
        }
    }
}

// =============================================================================
// Componentes internos da tela
// =============================================================================

/**
 * Lista de cards de jogos
 */
@Composable
private fun GamesList(
    games: List<GameWithConfirmations>,
    onGameClick: (String) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(games, key = { it.game.id }) { game ->
            GameCard(
                game = game,
                onClick = { onGameClick(game.game.id) },
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

/**
 * Card individual de jogo
 */
@Composable
private fun GameCard(
    game: GameWithConfirmations,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        onClick = onClick,
        modifier = modifier.heightIn(min = 120.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Linha superior: local + badge tipo
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = game.game.locationName,
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (game.game.locationAddress.isNotEmpty()) {
                        Text(
                            text = game.game.locationAddress,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
                // Badge de tipo de campo
                Surface(
                    shape = RoundedCornerShape(4.dp),
                    color = gameFieldTypeColor(game.game.gameType),
                    modifier = Modifier.padding(start = 8.dp)
                ) {
                    Text(
                        text = game.game.gameType,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onPrimary,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }

            // Data e hora
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Schedule,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = buildString {
                        append(game.game.date)
                        if (game.game.time.isNotEmpty()) {
                            append(" ${game.game.time}")
                        } else {
                            append(" (--:--)")
                        }
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = if (game.game.time.isEmpty()) {
                        MaterialTheme.colorScheme.error
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    }
                )
            }

            // Confirmações e status
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Person,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = "${game.game.playersCount} confirmados",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.weight(1f))

                if (game.game.status.isNotEmpty()) {
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = gameStatusColor(game.game.status),
                        modifier = Modifier.padding(end = 4.dp)
                    ) {
                        Text(
                            text = gameStatusText(game.game.status),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onPrimary,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
                        )
                    }
                }
            }
        }
    }
}

/**
 * Estado vazio – nenhum jogo agendado com CTA para criar jogo
 */
@Composable
private fun GamesEmptyState(
    onCreateGameClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.AutoMirrored.Filled.EventNote,
            contentDescription = null,
            modifier = Modifier.size(96.dp),
            tint = MaterialTheme.colorScheme.primary.copy(alpha = 0.6f)
        )
        Spacer(modifier = Modifier.height(24.dp))
        Text(
            text = "Nenhum jogo encontrado",
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurface,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            text = "Você ainda não tem jogos agendados. Crie um novo jogo!",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier
                .fillMaxWidth(0.8f)
                .padding(bottom = 24.dp)
        )
        FilledTonalButton(
            onClick = onCreateGameClick,
            modifier = Modifier
                .fillMaxWidth(0.6f)
                .height(48.dp)
        ) {
            Icon(Icons.Default.Add, contentDescription = "Criar jogo", modifier = Modifier.size(20.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text("Criar novo jogo")
        }
    }
}

/**
 * Estado de erro com botão de retry
 */
@Composable
private fun GamesErrorState(
    message: String,
    onRetry: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = Icons.Default.ErrorOutline,
            contentDescription = null,
            modifier = Modifier.size(64.dp),
            tint = MaterialTheme.colorScheme.error
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Erro",
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.error
        )
        Text(
            text = message,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(vertical = 16.dp),
            textAlign = TextAlign.Center
        )
        Button(onClick = onRetry) {
            Text("Tentar novamente")
        }
    }
}

// =============================================================================
// Funções auxiliares de cor e texto (precisam ser @Composable para acessar
// MaterialTheme.colorScheme)
// =============================================================================

/**
 * Retorna a cor associada ao tipo de campo
 */
@Composable
private fun gameFieldTypeColor(fieldType: String) = when (fieldType.lowercase()) {
    "society" -> MaterialTheme.colorScheme.tertiary
    "futsal"  -> MaterialTheme.colorScheme.secondary
    "grama", "campo" -> MaterialTheme.colorScheme.primary
    "areia"   -> MaterialTheme.colorScheme.error
    else      -> MaterialTheme.colorScheme.outline
}

/**
 * Retorna a cor associada ao status do jogo
 */
@Composable
private fun gameStatusColor(status: String) = when (status.uppercase()) {
    "OPEN"      -> MaterialTheme.colorScheme.tertiary
    "CONFIRMED" -> MaterialTheme.colorScheme.secondary
    "SCHEDULED" -> MaterialTheme.colorScheme.primary
    "LIVE"      -> MaterialTheme.colorScheme.primary
    "FINISHED"  -> MaterialTheme.colorScheme.outline
    "CANCELLED" -> MaterialTheme.colorScheme.error
    else        -> MaterialTheme.colorScheme.outline
}

/**
 * Traduz o status do jogo para texto legível
 */
@Composable
private fun gameStatusText(status: String): String = when (status.uppercase()) {
    "OPEN"      -> "Aberto"
    "CONFIRMED" -> "Confirmado"
    "SCHEDULED" -> "Agendado"
    "LIVE"      -> "Ao vivo"
    "FINISHED"  -> "Finalizado"
    "CANCELLED" -> "Cancelado"
    else        -> status
}