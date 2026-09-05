package com.futebadosparcas.ui.game_experience

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material.icons.outlined.SkipNext
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material.icons.outlined.StarBorder
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.futebadosparcas.R
import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.data.model.MVPShareCardData
import com.futebadosparcas.data.model.PlayerPosition
import com.futebadosparcas.data.model.VoteCategory
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateType
import com.futebadosparcas.ui.components.ShimmerBox
import com.futebadosparcas.ui.theme.GamificationColors

/**
 * MVPVoteScreen - Tela de Votação MVP com melhorias (#51-60)
 *
 * Features:
 * - #51: Votação anônima
 * - #52: Categorias customizáveis
 * - #53: Avaliação de atributos (1-5 estrelas)
 * - #54: Timeout de votação com countdown
 * - #55: Reveal animado de resultados
 * - #56: Opção de pular voto
 * - #57: Top 3 (podium)
 * - #58: Compartilhar resultado
 * - #59: Badge MVP Streak
 * - #60: Votação separada goleiros/jogadores
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MVPVoteScreen(
    viewModel: MVPVoteViewModel,
    gameId: String,
    onNavigateBack: () -> Unit = {},
    onShareMVP: (MVPShareCardData) -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.loadCandidates(gameId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    when (val state = uiState) {
                        is MVPVoteUiState.Voting -> {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = stringResource(
                                        R.string.mvp_vote_progress,
                                        state.currentCategoryIndex + 1,
                                        state.totalCategories
                                    )
                                )

                                // Countdown timer (#54)
                                if (state.votingDeadlineMs > 0) {
                                    Spacer(modifier = Modifier.width(12.dp))
                                    TimerChip(remainingMs = state.votingDeadlineMs)
                                }
                            }
                        }
                        else -> Text(stringResource(R.string.mvp_vote_title))
                    }
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
                    AnimatedContent(
                        targetState = state.currentCategory,
                        transitionSpec = {
                            slideInHorizontally { it } + fadeIn() togetherWith
                                    slideOutHorizontally { -it } + fadeOut()
                        },
                        label = "category_transition"
                    ) { category ->
                        VotingContent(
                            category = category,
                            candidates = state.candidates,
                            currentCategoryIndex = state.currentCategoryIndex,
                            totalCategories = state.totalCategories,
                            allowSkipVote = state.allowSkipVote,
                            showAttributeRating = state.showAttributeRating,
                            onCandidateClick = { candidate ->
                                viewModel.submitVote(gameId, candidate.userId, category)
                            },
                            onSkipClick = {
                                viewModel.skipVote(gameId, category)
                            },
                            onAttributeRatingChange = { playerId, defense, attack, technique, hustle, fairPlay ->
                                viewModel.updateAttributeRating(playerId, defense, attack, technique, hustle, fairPlay)
                            }
                        )
                    }
                }

                is MVPVoteUiState.AlreadyVoted -> {
                    AlreadyVotedContent(
                        isOwner = state.isOwner,
                        votingDeadlineMs = state.votingDeadlineMs,
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

                is MVPVoteUiState.VotingExpired -> {
                    VotingExpiredContent(
                        isOwner = state.isOwner,
                        onCloseClick = onNavigateBack
                    )
                }

                is MVPVoteUiState.ShowResults -> {
                    VoteResultScreen(
                        results = state.results,
                        showTop3 = state.showTop3,
                        isAnonymous = state.isAnonymous,
                        onShareClick = onShareMVP,
                        onNavigateBack = onNavigateBack
                    )
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
 * Chip de timer para countdown (#54).
 */
@Composable
private fun TimerChip(remainingMs: Long) {
    val isUrgent = remainingMs < 5 * 60 * 1000 // Menos de 5 minutos

    Row(
        modifier = Modifier
            .background(
                if (isUrgent) MaterialTheme.colorScheme.errorContainer
                else MaterialTheme.colorScheme.secondaryContainer,
                RoundedCornerShape(16.dp)
            )
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = Icons.Default.Timer,
            contentDescription = null,
            modifier = Modifier.size(16.dp),
            tint = if (isUrgent) MaterialTheme.colorScheme.onErrorContainer
            else MaterialTheme.colorScheme.onSecondaryContainer
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = remainingMs.formatTimeRemaining(),
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            color = if (isUrgent) MaterialTheme.colorScheme.onErrorContainer
            else MaterialTheme.colorScheme.onSecondaryContainer
        )
    }
}

/**
 * Conteúdo da votação com melhorias.
 */
@Composable
private fun VotingContent(
    category: VoteCategory,
    candidates: List<GameConfirmation>,
    currentCategoryIndex: Int,
    totalCategories: Int,
    allowSkipVote: Boolean,
    showAttributeRating: Boolean,
    onCandidateClick: (GameConfirmation) -> Unit,
    onSkipClick: () -> Unit,
    onAttributeRatingChange: (String, Int, Int, Int, Int, Int) -> Unit
) {
    var selectedCandidate by remember { mutableStateOf<GameConfirmation?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        // Progress indicator
        LinearProgressIndicator(
            progress = { (currentCategoryIndex + 1f) / totalCategories },
            modifier = Modifier
                .fillMaxWidth()
                .height(4.dp)
                .clip(RoundedCornerShape(2.dp)),
            color = MaterialTheme.colorScheme.primary,
            trackColor = MaterialTheme.colorScheme.surfaceVariant
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Category Header
        CategoryHeader(category)

        Spacer(modifier = Modifier.height(16.dp))

        // Grid adaptativo
        val configuration = LocalConfiguration.current
        val columns = when {
            configuration.screenWidthDp >= 840 -> 4
            configuration.screenWidthDp >= 600 -> 3
            else -> 2
        }

        // Candidates Grid
        LazyVerticalGrid(
            columns = GridCells.Fixed(columns),
            modifier = Modifier.weight(1f),
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
                    isSelected = selectedCandidate?.userId == candidate.userId,
                    showAttributeRating = showAttributeRating && category == VoteCategory.MVP,
                    onClick = {
                        if (showAttributeRating && category == VoteCategory.MVP) {
                            selectedCandidate = candidate
                        } else {
                            onCandidateClick(candidate)
                        }
                    },
                    onAttributeRatingChange = onAttributeRatingChange
                )
            }
        }

        // Bottom actions
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            // Skip button (#56)
            if (allowSkipVote) {
                TextButton(onClick = onSkipClick) {
                    Icon(
                        imageVector = Icons.Outlined.SkipNext,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(stringResource(R.string.mvp_skip_vote))
                }
            } else {
                Spacer(modifier = Modifier.width(1.dp))
            }

            // Confirm button (when attribute rating is shown)
            AnimatedVisibility(visible = selectedCandidate != null) {
                Button(
                    onClick = {
                        selectedCandidate?.let { onCandidateClick(it) }
                    }
                ) {
                    Icon(
                        imageVector = Icons.Default.Check,
                        contentDescription = null,
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(stringResource(R.string.mvp_confirm_vote))
                }
            }
        }
    }
}

/**
 * Header da categoria.
 */
@Composable
private fun CategoryHeader(category: VoteCategory) {
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
                    VoteCategory.CUSTOM -> stringResource(R.string.mvp_custom_category)
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
                    VoteCategory.CUSTOM -> ""
                },
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f)
            )
        }
    }
}

/**
 * Card de candidato com suporte a avaliação de atributos (#53).
 */
@Composable
private fun CandidateCard(
    candidate: GameConfirmation,
    isSelected: Boolean,
    showAttributeRating: Boolean,
    onClick: () -> Unit,
    onAttributeRatingChange: (String, Int, Int, Int, Int, Int) -> Unit
) {
    val scale by animateFloatAsState(
        targetValue = if (isSelected) 1.05f else 1f,
        animationSpec = spring(),
        label = "card_scale"
    )

    Card(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(if (showAttributeRating && isSelected) 0.6f else 0.85f)
            .scale(scale),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected)
                MaterialTheme.colorScheme.primaryContainer
            else
                MaterialTheme.colorScheme.surfaceVariant
        ),
        elevation = CardDefaults.cardElevation(
            defaultElevation = if (isSelected) 8.dp else 2.dp
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // Avatar with selection indicator
            Box(contentAlignment = Alignment.BottomEnd) {
                AsyncImage(
                    model = ImageRequest.Builder(LocalContext.current)
                        .data(candidate.userPhoto)
                        .crossfade(true)
                        .placeholder(R.drawable.ic_person)
                        .error(R.drawable.ic_person)
                        .build(),
                    contentDescription = stringResource(R.string.player_photo, candidate.getDisplayName()),
                    modifier = Modifier
                        .size(if (showAttributeRating && isSelected) 60.dp else 80.dp)
                        .clip(CircleShape)
                        .then(
                            if (isSelected) Modifier.border(
                                3.dp,
                                MaterialTheme.colorScheme.primary,
                                CircleShape
                            )
                            else Modifier
                        ),
                    contentScale = ContentScale.Crop
                )

                if (isSelected) {
                    Box(
                        modifier = Modifier
                            .size(24.dp)
                            .background(MaterialTheme.colorScheme.primary, CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Check,
                            contentDescription = null,
                            modifier = Modifier.size(16.dp),
                            tint = MaterialTheme.colorScheme.onPrimary
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Player Name
            Text(
                text = candidate.getDisplayName(),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = if (isSelected)
                    MaterialTheme.colorScheme.onPrimaryContainer
                else
                    MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center,
                maxLines = 2
            )

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
                color = if (isSelected)
                    MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                else
                    MaterialTheme.colorScheme.onSurfaceVariant
            )

            // Attribute Rating (#53) - Only shown when selected
            if (showAttributeRating && isSelected) {
                Spacer(modifier = Modifier.height(12.dp))
                AttributeRatingInput(
                    playerId = candidate.userId,
                    onRatingChange = onAttributeRatingChange
                )
            }
        }
    }
}

/**
 * Input de avaliação de atributos (1-5 estrelas) (#53).
 */
@Composable
private fun AttributeRatingInput(
    playerId: String,
    onRatingChange: (String, Int, Int, Int, Int, Int) -> Unit
) {
    var defense by remember { mutableIntStateOf(0) }
    var attack by remember { mutableIntStateOf(0) }
    var technique by remember { mutableIntStateOf(0) }
    var hustle by remember { mutableIntStateOf(0) }
    var fairPlay by remember { mutableIntStateOf(0) }

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        AttributeRow(
            label = stringResource(R.string.mvp_attr_defense),
            rating = defense,
            onRatingChange = {
                defense = it
                onRatingChange(playerId, defense, attack, technique, hustle, fairPlay)
            }
        )
        AttributeRow(
            label = stringResource(R.string.mvp_attr_attack),
            rating = attack,
            onRatingChange = {
                attack = it
                onRatingChange(playerId, defense, attack, technique, hustle, fairPlay)
            }
        )
        AttributeRow(
            label = stringResource(R.string.mvp_attr_technique),
            rating = technique,
            onRatingChange = {
                technique = it
                onRatingChange(playerId, defense, attack, technique, hustle, fairPlay)
            }
        )
        AttributeRow(
            label = stringResource(R.string.mvp_attr_hustle),
            rating = hustle,
            onRatingChange = {
                hustle = it
                onRatingChange(playerId, defense, attack, technique, hustle, fairPlay)
            }
        )
        AttributeRow(
            label = stringResource(R.string.mvp_attr_fair_play),
            rating = fairPlay,
            onRatingChange = {
                fairPlay = it
                onRatingChange(playerId, defense, attack, technique, hustle, fairPlay)
            }
        )
    }
}

/**
 * Linha de atributo com estrelas.
 */
@Composable
private fun AttributeRow(
    label: String,
    rating: Int,
    onRatingChange: (Int) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onPrimaryContainer,
            modifier = Modifier.width(60.dp)
        )

        Row {
            repeat(5) { index ->
                Icon(
                    imageVector = if (index < rating) Icons.Filled.Star else Icons.Outlined.StarBorder,
                    contentDescription = null,
                    modifier = Modifier
                        .size(18.dp)
                        .clickable { onRatingChange(index + 1) },
                    tint = if (index < rating) GamificationColors.Gold
                    else MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.3f)
                )
            }
        }
    }
}

/**
 * Conteúdo para quando já votou.
 */
@Composable
private fun AlreadyVotedContent(
    isOwner: Boolean,
    votingDeadlineMs: Long,
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
        Icon(
            imageVector = Icons.Default.CheckCircle,
            contentDescription = null,
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

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = stringResource(R.string.mvp_wait_all_votes),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        // Countdown timer
        if (votingDeadlineMs > 0) {
            Spacer(modifier = Modifier.height(16.dp))
            TimerChip(remainingMs = votingDeadlineMs)
        }

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
 * Conteúdo de finalizado/já votado.
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
            Icon(
                imageVector = Icons.Default.CheckCircle,
                contentDescription = null,
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
                contentDescription = null,
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
 * Conteúdo para quando a votação expirou (#54).
 */
@Composable
private fun VotingExpiredContent(
    isOwner: Boolean,
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
            imageVector = Icons.Default.Timer,
            contentDescription = null,
            modifier = Modifier.size(80.dp),
            tint = MaterialTheme.colorScheme.error
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = stringResource(R.string.mvp_voting_expired),
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.error
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = stringResource(R.string.mvp_voting_expired_desc),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(24.dp))

        OutlinedButton(
            onClick = onCloseClick,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(stringResource(R.string.close))
        }
    }
}

/**
 * Estado de loading com Shimmer.
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

        // Grid de shimmers para os cards de candidatos
        val configuration = LocalConfiguration.current
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
