package com.futebadosparcas.ui.statistics

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.data.repository.RankingCategory
import com.futebadosparcas.data.repository.RankingPeriod
import com.futebadosparcas.ui.theme.GamificationColors

@OptIn(ExperimentalMaterial3Api::class, ExperimentalAnimationApi::class)
@Composable
fun RankingScreen(
    viewModel: RankingViewModel,
    onPlayerClick: (String) -> Unit = {}
) {
    // 🔧 OTIMIZADO: Use collectAsStateWithLifecycle to respect lifecycle and prevent memory leaks
    val state by viewModel.rankingState.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.loadRanking()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        // Header
        RankingHeader(
            selectedCategory = state.selectedCategory,
            selectedPeriod = state.selectedPeriod,
            onCategorySelected = { viewModel.selectCategory(it) },
            onPeriodSelected = { viewModel.selectPeriod(it) }
        )

        // Content
        Box(modifier = Modifier.fillMaxSize()) {
            when {
                state.isLoading -> {
                    CircularProgressIndicator(
                        modifier = Modifier.align(Alignment.Center),
                        color = MaterialTheme.colorScheme.primary
                    )
                }
                state.error != null -> {
                    Text(
                        text = state.error ?: "Erro ao carregar",
                        modifier = Modifier.align(Alignment.Center),
                        color = MaterialTheme.colorScheme.error
                    )
                }
                state.rankings.isEmpty() -> {
                    EmptyRankingMessage(modifier = Modifier.align(Alignment.Center))
                }
                else -> {
                    AnimatedContent(
                        targetState = state.rankings,
                        transitionSpec = {
                            fadeIn(animationSpec = tween(300)) togetherWith fadeOut(animationSpec = tween(150))
                        },
                        label = "rankingContent"
                    ) { currentRankings ->
                        RankingList(
                            rankings = currentRankings,
                            myPosition = state.myPosition,
                            category = state.selectedCategory,
                            onPlayerClick = onPlayerClick
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun RankingHeader(
    selectedCategory: RankingCategory,
    selectedPeriod: RankingPeriod,
    onCategorySelected: (RankingCategory) -> Unit,
    onPeriodSelected: (RankingPeriod) -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.primary)
            .padding(16.dp)
    ) {
        Text(
            text = "Ranking",
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onPrimary
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Category Chips
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            RankingCategory.entries.take(4).forEach { category ->
                FilterChip(
                    selected = category == selectedCategory,
                    onClick = { onCategorySelected(category) },
                    label = { Text(getCategoryLabel(category), fontSize = 12.sp) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = MaterialTheme.colorScheme.onPrimary,
                        selectedLabelColor = MaterialTheme.colorScheme.primary,
                        containerColor = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.2f),
                        labelColor = MaterialTheme.colorScheme.onPrimary
                    )
                )
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Period Chips
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            RankingPeriod.entries.forEach { period ->
                FilterChip(
                    selected = period == selectedPeriod,
                    onClick = { onPeriodSelected(period) },
                    label = { Text(getPeriodLabel(period), fontSize = 12.sp) },
                    colors = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = MaterialTheme.colorScheme.tertiaryContainer,
                        selectedLabelColor = MaterialTheme.colorScheme.onTertiaryContainer,
                        containerColor = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.2f),
                        labelColor = MaterialTheme.colorScheme.onPrimary
                    )
                )
            }
        }
    }
}

@Composable
private fun RankingList(
    rankings: List<PlayerRankingItem>,
    myPosition: Int,
    category: RankingCategory,
    onPlayerClick: (String) -> Unit
) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // My position card (if not in top 3)
        if (myPosition > 3) {
            item {
                MyPositionCard(position = myPosition, category = category)
            }
        }

        // Top 3 podium
        item {
            PodiumSection(rankings.take(3), category)
        }

        // Rest of the list
        itemsIndexed(rankings.drop(3)) { index, player ->
            val animatedProgress by animateFloatAsState(
                targetValue = 1f,
                animationSpec = tween(
                    durationMillis = 400,
                    delayMillis = index * 30, // Stagger
                    easing = FastOutSlowInEasing
                ),
                label = "itemAnimation"
            )

            Box(
                modifier = Modifier.graphicsLayer(
                    alpha = animatedProgress,
                    translationY = (1f - animatedProgress) * 40f
                )
            ) {
                RankingItem(
                    rank = index + 4,
                    player = player,
                    category = category,
                    isCurrentUser = player.rank == myPosition,
                    onClick = { onPlayerClick(player.userId) }
                )
            }
        }
    }
}

@Composable
private fun PodiumSection(topPlayers: List<PlayerRankingItem>, category: RankingCategory) {
    if (topPlayers.isEmpty()) return

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 16.dp),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.Bottom
    ) {
        // 2nd place
        if (topPlayers.size > 1) {
            PodiumPlayer(
                player = topPlayers[1],
                rank = 2,
                height = 80.dp,
                color = GamificationColors.Silver,
                category = category
            )
        }

        // 1st place
        if (topPlayers.isNotEmpty()) {
            PodiumPlayer(
                player = topPlayers[0],
                rank = 1,
                height = 100.dp,
                color = GamificationColors.Gold,
                category = category
            )
        }

        // 3rd place
        if (topPlayers.size > 2) {
            PodiumPlayer(
                player = topPlayers[2],
                rank = 3,
                height = 60.dp,
                color = GamificationColors.Bronze,
                category = category
            )
        }
    }
}

@Composable
private fun PodiumPlayer(
    player: PlayerRankingItem,
    rank: Int,
    height: androidx.compose.ui.unit.Dp,
    color: Color,
    category: RankingCategory
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.width(100.dp)
    ) {
        // Avatar
        Box(
            modifier = Modifier
                .size(60.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.surfaceVariant),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = player.getDisplayName().take(1).uppercase(),
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
        }

        Spacer(modifier = Modifier.height(4.dp))

        Text(
            text = player.getDisplayName().split(" ").first(),
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            maxLines = 1,
            color = MaterialTheme.colorScheme.onSurface
        )

        Text(
            text = "${player.value} ${getCategoryUnit(category)}",
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = color
        )

        // Podium base
        Box(
            modifier = Modifier
                .width(80.dp)
                .height(height)
                .clip(RoundedCornerShape(topStart = 8.dp, topEnd = 8.dp))
                .background(color),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "$rank",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }
    }
}

@Composable
private fun RankingItem(
    rank: Int,
    player: PlayerRankingItem,
    category: RankingCategory,
    isCurrentUser: Boolean,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        onClick = onClick,
        colors = CardDefaults.cardColors(
            containerColor = if (isCurrentUser)
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.2f)
            else
                MaterialTheme.colorScheme.surface
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = if (isCurrentUser) 4.dp else 1.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Rank
            Text(
                text = "$rank",
                modifier = Modifier.width(32.dp),
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.width(12.dp))

            // Avatar
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = player.getDisplayName().take(1).uppercase(),
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            // Name
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = player.getDisplayName(),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Text(
                    text = "${player.gamesPlayed} jogos",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Value
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "${player.value}",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = getCategoryUnit(category),
                    fontSize = 10.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun MyPositionCard(position: Int, category: RankingCategory) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.5f)
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Sua posicao:",
                fontSize = 14.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "#$position",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.secondary
            )
        }
    }
}

@Composable
private fun EmptyRankingMessage(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "Nenhum dado disponivel",
            fontSize = 16.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Jogue mais partidas para aparecer no ranking!",
            fontSize = 14.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
    }
}

private fun getCategoryLabel(category: RankingCategory): String {
    return when (category) {
        RankingCategory.GOALS -> "Gols"
        RankingCategory.ASSISTS -> "Assists"
        RankingCategory.SAVES -> "Defesas"
        RankingCategory.MVP -> "MVPs"
        RankingCategory.XP -> "XP"
        RankingCategory.GAMES -> "Jogos"
        RankingCategory.WINS -> "Vitorias"
    }
}

private fun getPeriodLabel(period: RankingPeriod): String {
    return when (period) {
        RankingPeriod.WEEK -> "Semana"
        RankingPeriod.MONTH -> "Mes"
        RankingPeriod.YEAR -> "Ano"
        RankingPeriod.ALL_TIME -> "Geral"
    }
}

private fun getCategoryUnit(category: RankingCategory): String {
    return when (category) {
        RankingCategory.GOALS -> "gols"
        RankingCategory.ASSISTS -> "assists"
        RankingCategory.SAVES -> "defesas"
        RankingCategory.MVP -> "vezes"
        RankingCategory.XP -> "XP"
        RankingCategory.GAMES -> "jogos"
        RankingCategory.WINS -> "vitorias"
    }
}
