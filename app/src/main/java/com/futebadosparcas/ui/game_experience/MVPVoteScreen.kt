package com.futebadosparcas.ui.game_experience

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.futebadosparcas.R
import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.data.model.PlayerPosition
import com.futebadosparcas.data.model.VoteCategory
import com.futebadosparcas.ui.components.CachedProfileImage

/**
 * MVPVoteScreen - Tela de Votação MVP/Melhor Goleiro/Bola Murcha
 *
 * Permite:
 * - Votar em 3 categorias sequencialmente (MVP, Melhor Goleiro, Bola Murcha)
 * - Ver estado de já votado
 * - Ver tela de sucesso com animação Lottie
 * - Owner pode finalizar votação manualmente
 *
 * Features:
 * - LazyVerticalGrid com 2 colunas para candidatos
 * - Navegação automática entre categorias
 * - Estados: Loading, Voting, AlreadyVoted, Finished, Error
 * - Animação Lottie de sucesso
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MVPVoteScreen(
    viewModel: MVPVoteViewModel,
    gameId: String,
    onNavigateBack: () -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.loadCandidates(gameId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        when (uiState) {
                            is MVPVoteUiState.Voting -> {
                                val category = (uiState as MVPVoteUiState.Voting).currentCategory
                                when (category) {
                                    VoteCategory.MVP -> "Votação (1/3)"
                                    VoteCategory.BEST_GOALKEEPER -> "Votação (2/3)"
                                    VoteCategory.WORST -> "Votação (3/3)"
                                }
                            }
                            else -> "Votação"
                        }
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Voltar"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (val state = uiState) {
                is MVPVoteUiState.Loading -> {
                    CircularProgressIndicator(
                        modifier = Modifier.align(Alignment.Center)
                    )
                }

                is MVPVoteUiState.Voting -> {
                    VotingContent(
                        category = state.currentCategory,
                        candidates = state.candidates,
                        onCandidateClick = { candidate ->
                            viewModel.submitVote(gameId, candidate.userId, state.currentCategory)
                        }
                    )
                }

                is MVPVoteUiState.AlreadyVoted -> {
                    FinishedContent(
                        isOwner = state.isOwner,
                        showAnimation = false,
                        onFinishClick = {
                            viewModel.finalizeVoting(gameId)
                        },
                        onCloseClick = onNavigateBack
                    )
                }

                is MVPVoteUiState.Finished -> {
                    FinishedContent(
                        isOwner = state.isOwner,
                        showAnimation = true,
                        onFinishClick = {
                            viewModel.finalizeVoting(gameId)
                        },
                        onCloseClick = onNavigateBack
                    )

                    // Auto-navigate back after animation
                    LaunchedEffect(Unit) {
                        kotlinx.coroutines.delay(2500)
                        onNavigateBack()
                    }
                }

                is MVPVoteUiState.Error -> {
                    ErrorContent(
                        message = state.message,
                        onCloseClick = onNavigateBack
                    )
                }
            }
        }
    }
}

/**
 * Conteúdo da votação
 */
@Composable
private fun VotingContent(
    category: VoteCategory,
    candidates: List<GameConfirmation>,
    onCandidateClick: (GameConfirmation) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        // Category Header
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
                    .padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = when (category) {
                        VoteCategory.MVP -> "Quem foi o CRAQUE?"
                        VoteCategory.BEST_GOALKEEPER -> "Melhor Goleiro?"
                        VoteCategory.WORST -> "Bola Murcha?"
                    },
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = when (category) {
                        VoteCategory.MVP -> "O melhor jogador da partida"
                        VoteCategory.BEST_GOALKEEPER -> "Quem fechou o gol?"
                        VoteCategory.WORST -> "Quem não jogou nada hoje?"
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f)
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Candidates Grid
        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(
                items = candidates,
                key = { it.id }
            ) { candidate ->
                CandidateCard(
                    candidate = candidate,
                    onClick = { onCandidateClick(candidate) }
                )
            }
        }
    }
}

/**
 * Card de candidato
 */
@Composable
private fun CandidateCard(
    candidate: GameConfirmation,
    onClick: () -> Unit
) {
    Card(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(0.85f),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Avatar
            CachedProfileImage(
                photoUrl = candidate.userPhoto,
                userName = candidate.getDisplayName(),
                size = 80.dp
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Player Name
            Text(
                text = candidate.getDisplayName(),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center,
                maxLines = 2
            )

            Spacer(modifier = Modifier.height(4.dp))

            // Position
            val posEnum = try {
                PlayerPosition.valueOf(candidate.position)
            } catch (e: Exception) {
                PlayerPosition.FIELD
            }

            Text(
                text = if (posEnum == PlayerPosition.GOALKEEPER) "Goleiro" else "Linha",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * Conteúdo de finalizado/já votado
 */
@Composable
private fun FinishedContent(
    isOwner: Boolean,
    showAnimation: Boolean,
    onFinishClick: () -> Unit,
    onCloseClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        if (showAnimation) {
            // Success Icon with animation
            Icon(
                imageVector = Icons.Default.CheckCircle,
                contentDescription = null,
                modifier = Modifier.size(120.dp),
                tint = MaterialTheme.colorScheme.primary
            )

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "Voto Registrado!",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
        } else {
            Icon(
                imageVector = Icons.Default.CheckCircle,
                contentDescription = null,
                modifier = Modifier.size(80.dp),
                tint = MaterialTheme.colorScheme.primary
            )

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = "Você já votou!",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "Aguarde todos os jogadores votarem",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(24.dp))

        if (isOwner) {
            Button(
                onClick = onFinishClick,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary
                )
            ) {
                Icon(
                    imageVector = Icons.Default.Check,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("Finalizar Votação (Owner)")
            }

            Spacer(modifier = Modifier.height(12.dp))
        }

        OutlinedButton(
            onClick = onCloseClick,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Fechar")
        }
    }
}

/**
 * Conteúdo de erro
 */
@Composable
private fun ErrorContent(
    message: String,
    onCloseClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
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

        Spacer(modifier = Modifier.height(24.dp))

        Button(
            onClick = onCloseClick,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Fechar")
        }
    }
}
