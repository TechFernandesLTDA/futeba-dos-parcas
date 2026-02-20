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
import coil3.compose.AsyncImage
import coil3.request.ImageRequest
import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.domain.model.PlayerPosition
import com.futebadosparcas.domain.model.VoteCategory
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateType
import com.futebadosparcas.ui.components.ShimmerBox
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource

/**
 * MVPVoteScreen - Tela de Votação MVP/Melhor Goleiro/Bola Murcha
 *
 * Permite:
 * - Votar em 3 categorias sequencialmente (MVP, Melhor Goleiro, Bola Murcha)
 * - Ver estado de já votado
 * - Ver tela de sucesso
 * - Owner pode finalizar votação manualmente
 *
 * Features:
 * - LazyVerticalGrid com 2 colunas para candidatos
 * - Navegação automática entre categorias
 * - Estados: Loading, Voting, AlreadyVoted, Finished, Error
 * - ShimmerBox para loading
 * - EmptyState para erro
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
                                    VoteCategory.MVP -> stringResource(R.string.mvp_vote_1_3)
                                    VoteCategory.BEST_GOALKEEPER -> stringResource(R.string.mvp_vote_2_3)
                                    VoteCategory.WORST -> stringResource(R.string.mvp_vote_3_3)
                                    VoteCategory.CUSTOM -> stringResource(R.string.mvp_vote_title)
                                }
                            }
                            else -> stringResource(R.string.mvp_vote_title)
                        }
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.back)
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
                    MVPVoteLoadingState()
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
                    EmptyState(
                        type = EmptyStateType.Error(
                            title = stringResource(R.string.error),
                            description = state.message,
                            actionLabel = stringResource(R.string.retry),
                            onRetry = { viewModel.loadCandidates(gameId) }
                        )
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
                        VoteCategory.MVP -> stringResource(R.string.mvp_who_was_star)
                        VoteCategory.BEST_GOALKEEPER -> stringResource(R.string.mvp_best_goalkeeper)
                        VoteCategory.WORST -> stringResource(R.string.mvp_worst_player)
                        VoteCategory.CUSTOM -> stringResource(R.string.mvp_vote_title)
                    },
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = when (category) {
                        VoteCategory.MVP -> stringResource(R.string.mvp_best_player_desc)
                        VoteCategory.BEST_GOALKEEPER -> stringResource(R.string.mvp_goalkeeper_desc)
                        VoteCategory.WORST -> stringResource(R.string.mvp_worst_desc)
                        VoteCategory.CUSTOM -> stringResource(R.string.mvp_vote_title)
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f)
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Grid adaptativo: 2 colunas em telefone, 3 em tablet, 4 em landscape grande
        val configuration = androidx.compose.ui.platform.LocalConfiguration.current
        val columns = when {
            configuration.screenWidthDp >= 840 -> 4
            configuration.screenWidthDp >= 600 -> 3
            else -> 2
        }

        // Candidates Grid
        LazyVerticalGrid(
            columns = GridCells.Fixed(columns),
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
            AsyncImage(
                model = ImageRequest.Builder(LocalContext.current)
                    .data(candidate.userPhoto)
                    .placeholder(R.drawable.ic_person)
                    .error(R.drawable.ic_person)
                    .build(),
                contentDescription = stringResource(R.string.player_photo, candidate.getDisplayName()),
                modifier = Modifier
                    .size(80.dp)
                    .clip(CircleShape),
                contentScale = ContentScale.Crop
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
                text = stringResource(
                    if (posEnum == PlayerPosition.GOALKEEPER) R.string.goalkeeper else R.string.field_player
                ),
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
            // Ícone de sucesso com animação
            Icon(
                imageVector = Icons.Default.CheckCircle,
                contentDescription = stringResource(R.string.cd_success_check),
                modifier = Modifier.size(120.dp),
                tint = MaterialTheme.colorScheme.primary
            )

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = stringResource(R.string.mvp_vote_registered),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
        } else {
            Icon(
                imageVector = Icons.Default.CheckCircle,
                contentDescription = stringResource(R.string.cd_success_check),
                modifier = Modifier.size(80.dp),
                tint = MaterialTheme.colorScheme.primary
            )

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                text = stringResource(R.string.mvp_already_voted),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = stringResource(R.string.mvp_wait_all_votes),
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
                Text(stringResource(R.string.mvp_finish_voting_owner))
            }

            Spacer(modifier = Modifier.height(12.dp))
        }

        OutlinedButton(
            onClick = onCloseClick,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(stringResource(R.string.close))
        }
    }
}

/**
 * Estado de loading com Shimmer
 */
@Composable
private fun MVPVoteLoadingState() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Header shimmer
        ShimmerBox(
            modifier = Modifier
                .fillMaxWidth()
                .height(120.dp),
            cornerRadius = 16.dp
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Grid de shimmers para os cards de candidatos (adaptativo)
        val configuration = androidx.compose.ui.platform.LocalConfiguration.current
        val shimmerColumns = when {
            configuration.screenWidthDp >= 840 -> 4
            configuration.screenWidthDp >= 600 -> 3
            else -> 2
        }

        LazyVerticalGrid(
            columns = GridCells.Fixed(shimmerColumns),
            modifier = Modifier.fillMaxSize(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(6) {
                ShimmerBox(
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(0.85f),
                    cornerRadius = 16.dp
                )
            }
        }
    }
}
