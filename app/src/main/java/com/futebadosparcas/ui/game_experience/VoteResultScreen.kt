package com.futebadosparcas.ui.game_experience

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.scaleIn
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.SportsSoccer
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.ThumbDown
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import com.futebadosparcas.util.ContrastHelper
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.futebadosparcas.R
import com.futebadosparcas.data.model.MVPVoteResult
import com.futebadosparcas.data.model.VoteCategory
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateType
import com.futebadosparcas.ui.components.LoadingView
import com.futebadosparcas.ui.theme.GamificationColors
import kotlinx.coroutines.delay

/**
 * Tela de resultados da votação MVP.
 * Exibe o pódio (1º, 2º, 3º) e contagem de votos para cada categoria.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VoteResultScreen(
    gameId: String,
    viewModel: VoteResultViewModel = hiltViewModel(),
    onNavigateBack: () -> Unit = {},
    onShareCard: (gameId: String, category: VoteCategory) -> Unit = { _, _ -> }
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    LaunchedEffect(gameId) {
        viewModel.loadResults(gameId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.mvp_results_title)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.action_back)
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface
                )
            )
        }
    ) { padding ->
        when (val state = uiState) {
            is VoteResultUiState.Loading -> {
                LoadingView(modifier = Modifier.padding(padding))
            }

            is VoteResultUiState.Success -> {
                VoteResultContent(
                    results = state.results,
                    gameInfo = state.gameInfo,
                    modifier = Modifier.padding(padding),
                    onShareCard = { category ->
                        viewModel.shareResultCard(context, gameId, category)
                    }
                )
            }

            is VoteResultUiState.Empty -> {
                EmptyState(
                    type = EmptyStateType.NoData(
                        title = stringResource(R.string.mvp_no_votes),
                        description = stringResource(R.string.mvp_wait_all_votes)
                    ),
                    modifier = Modifier.padding(padding)
                )
            }

            is VoteResultUiState.Error -> {
                EmptyState(
                    type = EmptyStateType.NoData(
                        title = stringResource(R.string.error_title),
                        description = state.message
                    ),
                    modifier = Modifier.padding(padding)
                )
            }
        }
    }
}

@Composable
private fun VoteResultContent(
    results: VoteResultsData,
    gameInfo: GameResultInfo?,
    modifier: Modifier = Modifier,
    onShareCard: (VoteCategory) -> Unit = {}
) {
    var showMvp by remember { mutableStateOf(false) }
    var showGk by remember { mutableStateOf(false) }
    var showWorst by remember { mutableStateOf(false) }

    // Animação sequencial para revelar resultados
    LaunchedEffect(Unit) {
        delay(300)
        showMvp = true
        delay(500)
        showGk = true
        delay(500)
        showWorst = true
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        // Header do jogo
        if (gameInfo != null) {
            item {
                GameResultHeader(gameInfo)
            }
        }

        // Categoria MVP
        if (results.mvpResults.isNotEmpty()) {
            item {
                AnimatedVisibility(
                    visible = showMvp,
                    enter = fadeIn() + scaleIn(initialScale = 0.8f)
                ) {
                    CategoryResultCard(
                        category = VoteCategory.MVP,
                        categoryTitle = stringResource(R.string.mvp_category_mvp),
                        categoryIcon = Icons.Default.EmojiEvents,
                        iconTint = GamificationColors.Gold,
                        results = results.mvpResults,
                        totalVotes = results.totalMvpVotes,
                        onShare = { onShareCard(VoteCategory.MVP) }
                    )
                }
            }
        }

        // Categoria Melhor Goleiro
        if (results.gkResults.isNotEmpty()) {
            item {
                AnimatedVisibility(
                    visible = showGk,
                    enter = fadeIn() + scaleIn(initialScale = 0.8f)
                ) {
                    CategoryResultCard(
                        category = VoteCategory.BEST_GOALKEEPER,
                        categoryTitle = stringResource(R.string.mvp_category_goalkeeper),
                        categoryIcon = Icons.Default.SportsSoccer,
                        iconTint = MaterialTheme.colorScheme.primary,
                        results = results.gkResults,
                        totalVotes = results.totalGkVotes,
                        onShare = { onShareCard(VoteCategory.BEST_GOALKEEPER) }
                    )
                }
            }
        }

        // Categoria Bola Murcha
        if (results.worstResults.isNotEmpty()) {
            item {
                AnimatedVisibility(
                    visible = showWorst,
                    enter = fadeIn() + scaleIn(initialScale = 0.8f)
                ) {
                    CategoryResultCard(
                        category = VoteCategory.WORST,
                        categoryTitle = stringResource(R.string.mvp_category_worst),
                        categoryIcon = Icons.Default.ThumbDown,
                        iconTint = MaterialTheme.colorScheme.error,
                        results = results.worstResults,
                        totalVotes = results.totalWorstVotes,
                        onShare = { onShareCard(VoteCategory.WORST) }
                    )
                }
            }
        }

        // Espaço no final
        item { Spacer(modifier = Modifier.height(32.dp)) }
    }
}

@Composable
private fun GameResultHeader(gameInfo: GameResultInfo) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = gameInfo.date,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(8.dp))

            // Placar
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Text(
                    text = gameInfo.team1Name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Spacer(modifier = Modifier.width(16.dp))
                Text(
                    text = "${gameInfo.team1Score} x ${gameInfo.team2Score}",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.width(16.dp))
                Text(
                    text = gameInfo.team2Name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }

            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = gameInfo.location,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun CategoryResultCard(
    category: VoteCategory,
    categoryTitle: String,
    categoryIcon: ImageVector,
    iconTint: Color,
    results: List<MVPVoteResult>,
    totalVotes: Int,
    onShare: () -> Unit = {}
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            // Header da categoria
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = categoryIcon,
                        contentDescription = null,
                        tint = iconTint,
                        modifier = Modifier.size(28.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Column {
                        Text(
                            text = categoryTitle,
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                        Text(
                            text = stringResource(R.string.mvp_total_votes) + ": $totalVotes",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                // Botão de compartilhar
                IconButton(onClick = onShare) {
                    Icon(
                        imageVector = Icons.Default.Share,
                        contentDescription = stringResource(R.string.action_share),
                        tint = MaterialTheme.colorScheme.primary
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            Spacer(modifier = Modifier.height(16.dp))

            // Pódio (Top 3)
            if (results.isNotEmpty()) {
                PodiumSection(results = results.take(3), category = category)
            }

            // Lista completa (se houver mais de 3)
            if (results.size > 3) {
                Spacer(modifier = Modifier.height(16.dp))
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                Spacer(modifier = Modifier.height(8.dp))

                results.drop(3).forEachIndexed { index, result ->
                    VoteResultRow(
                        position = index + 4,
                        result = result,
                        totalVotes = totalVotes
                    )
                }
            }
        }
    }
}

@Composable
private fun PodiumSection(
    results: List<MVPVoteResult>,
    category: VoteCategory
) {
    val first = results.getOrNull(0)
    val second = results.getOrNull(1)
    val third = results.getOrNull(2)

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.Bottom
    ) {
        // 2º lugar (esquerda)
        if (second != null) {
            PodiumPosition(
                result = second,
                position = 2,
                color = GamificationColors.Silver,
                heightModifier = 0.85f
            )
        } else {
            Spacer(modifier = Modifier.weight(1f))
        }

        // 1º lugar (centro)
        if (first != null) {
            PodiumPosition(
                result = first,
                position = 1,
                color = GamificationColors.Gold,
                heightModifier = 1f,
                showCrown = category == VoteCategory.MVP
            )
        }

        // 3º lugar (direita)
        if (third != null) {
            PodiumPosition(
                result = third,
                position = 3,
                color = GamificationColors.Bronze,
                heightModifier = 0.7f
            )
        } else {
            Spacer(modifier = Modifier.weight(1f))
        }
    }
}

@Composable
private fun PodiumPosition(
    result: MVPVoteResult,
    position: Int,
    color: Color,
    heightModifier: Float,
    showCrown: Boolean = false
) {
    val animatedHeight by animateFloatAsState(
        targetValue = heightModifier,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessLow
        ),
        label = "podiumHeight"
    )

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.width(100.dp)
    ) {
        // Coroa para MVP
        if (showCrown && position == 1) {
            Text(
                text = "👑",
                fontSize = 24.sp,
                modifier = Modifier.offset(y = 8.dp)
            )
        }

        // Foto do jogador
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(64.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.surfaceVariant)
        ) {
            if (result.playerPhoto != null) {
                AsyncImage(
                    model = result.playerPhoto,
                    contentDescription = result.playerName,
                    modifier = Modifier
                        .size(64.dp)
                        .clip(CircleShape),
                    contentScale = ContentScale.Crop
                )
            } else {
                Text(
                    text = result.playerName.take(2).uppercase(),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Nome
        Text(
            text = result.playerName.split(" ").firstOrNull() ?: result.playerName,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Bold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            color = MaterialTheme.colorScheme.onSurface
        )

        // Votos e porcentagem
        Text(
            text = "${result.voteCount} votos",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = "${result.percentage.toInt()}%",
            style = MaterialTheme.typography.labelSmall,
            color = color,
            fontWeight = FontWeight.Bold
        )

        Spacer(modifier = Modifier.height(8.dp))

        // Pedestal
        Box(
            modifier = Modifier
                .width(80.dp)
                .height((60 * animatedHeight).dp)
                .clip(RoundedCornerShape(topStart = 8.dp, topEnd = 8.dp))
                .background(color),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "${position}º",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = ContrastHelper.getContrastingTextColor(color)
            )
        }
    }
}

@Composable
private fun VoteResultRow(
    position: Int,
    result: MVPVoteResult,
    totalVotes: Int
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Posição
        Text(
            text = "${position}º",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(32.dp)
        )

        // Foto
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.surfaceVariant),
            contentAlignment = Alignment.Center
        ) {
            if (result.playerPhoto != null) {
                AsyncImage(
                    model = result.playerPhoto,
                    contentDescription = null,
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape),
                    contentScale = ContentScale.Crop
                )
            } else {
                Text(
                    text = result.playerName.take(1).uppercase(),
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        Spacer(modifier = Modifier.width(12.dp))

        // Nome e votos
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = result.playerName,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = "${result.voteCount} votos",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }

        // Barra de progresso + porcentagem
        Column(
            horizontalAlignment = Alignment.End,
            modifier = Modifier.width(80.dp)
        ) {
            Text(
                text = "${result.percentage.toInt()}%",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
            Spacer(modifier = Modifier.height(4.dp))
            LinearProgressIndicator(
                progress = { (result.percentage / 100f).toFloat() },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(4.dp)
                    .clip(RoundedCornerShape(2.dp)),
                color = MaterialTheme.colorScheme.primary,
                trackColor = MaterialTheme.colorScheme.surfaceVariant
            )
        }
    }
}

// ============ DATA CLASSES ============

/**
 * Dados consolidados dos resultados da votação
 */
data class VoteResultsData(
    val mvpResults: List<MVPVoteResult> = emptyList(),
    val gkResults: List<MVPVoteResult> = emptyList(),
    val worstResults: List<MVPVoteResult> = emptyList(),
    val totalMvpVotes: Int = 0,
    val totalGkVotes: Int = 0,
    val totalWorstVotes: Int = 0
)

/**
 * Informações do jogo para exibição no header
 */
data class GameResultInfo(
    val date: String = "",
    val location: String = "",
    val team1Name: String = "Time A",
    val team2Name: String = "Time B",
    val team1Score: Int = 0,
    val team2Score: Int = 0
)

/**
 * Estados da UI
 */
sealed class VoteResultUiState {
    data object Loading : VoteResultUiState()
    data class Success(
        val results: VoteResultsData,
        val gameInfo: GameResultInfo?
    ) : VoteResultUiState()
    data object Empty : VoteResultUiState()
    data class Error(val message: String) : VoteResultUiState()
}
