package com.futebadosparcas.ui

import androidx.compose.animation.core.*
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.background
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.layout.*
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.lazy.LazyColumn
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.lazy.LazyRow
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.lazy.items
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.lazy.itemsIndexed
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.shape.CircleShape
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.foundation.shape.RoundedCornerShape
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.material3.*
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.runtime.*
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.Alignment
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.Modifier
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.draw.clip
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.graphics.Brush
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.graphics.Color
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.text.font.FontWeight
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.text.style.TextOverflow
import com.futebadosparcas.ui.components.states.ErrorState
import androidx.compose.ui.unit.dp
import com.futebadosparcas.ui.components.states.ErrorState
import com.futebadosparcas.firebase.FirebaseManager
import com.futebadosparcas.ui.components.states.ErrorState
import kotlinx.coroutines.launch
import com.futebadosparcas.ui.components.states.ErrorState

private sealed class RankingTab {
    object Geral : RankingTab()
    object PorGrupo : RankingTab()
    object Mvps : RankingTab()
}

private sealed class RankingUiState {
    object Loading : RankingUiState()
    data class Success(val ranking: List<Map<String, Any?>>, val season: Map<String, Any?>?) : RankingUiState()
    data class Error(val message: String) : RankingUiState()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RankingTab(
    onLeagueClick: () -> Unit = {},
    onPlayerClick: (String) -> Unit = {}
) {
    var selectedTab by remember { mutableStateOf<RankingTab>(RankingTab.Geral) }
    var uiState by remember { mutableStateOf<RankingUiState>(RankingUiState.Loading) }
    val scope = rememberCoroutineScope()

    fun loadRanking() {
        scope.launch {
            uiState = RankingUiState.Loading
            try {
                val ranking = when (selectedTab) {
                    RankingTab.Geral -> FirebaseManager.getGlobalRanking()
                    RankingTab.PorGrupo -> FirebaseManager.getGroupRanking("group1")
                    RankingTab.Mvps -> FirebaseManager.getMvpRanking()
                }
                val season = FirebaseManager.getActiveSeason()
                uiState = RankingUiState.Success(ranking, season)
            } catch (e: Exception) {
                uiState = RankingUiState.Error(e.message ?: "Erro ao carregar ranking")
            }
        }
    }

    LaunchedEffect(selectedTab) {
        loadRanking()
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp)
    ) {
        Text(
            text = "🏆 Rankings",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(vertical = 16.dp)
        )

        RankingTabRow(
            selectedTab = selectedTab,
            onTabSelected = { selectedTab = it }
        )

        Spacer(modifier = Modifier.height(12.dp))

        when (val state = uiState) {
            is RankingUiState.Loading -> RankingLoadingContent()
            is RankingUiState.Success -> {
                if (state.season != null) {
                    SeasonHeader(
                        season = state.season,
                        onLeagueClick = onLeagueClick
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                }

                if (state.ranking.isEmpty()) {
                    EmptyRankingState()
                } else {
                    RankingList(
                        ranking = state.ranking,
                        showMvpCount = selectedTab == RankingTab.Mvps,
                        onPlayerClick = onPlayerClick
                    )
                }
            }
            is RankingUiState.Error -> ErrorState(
                message = state.message,
                onRetry = { loadRanking() }
            )
        }
    }
}

@Composable
private fun RankingTabRow(
    selectedTab: RankingTab,
    onTabSelected: (RankingTab) -> Unit
) {
    val tabs = listOf(
        RankingTab.Geral to "Geral",
        RankingTab.PorGrupo to "Por Grupo",
        RankingTab.Mvps to "MVPs"
    )

    ScrollableTabRow(
        selectedTabIndex = tabs.indexOfFirst { it.first == selectedTab }.coerceAtLeast(0),
        containerColor = MaterialTheme.colorScheme.surface,
        contentColor = MaterialTheme.colorScheme.primary,
        edgePadding = 0.dp
    ) {
        tabs.forEach { (tab, label) ->
            Tab(
                selected = selectedTab == tab,
                onClick = { onTabSelected(tab) },
                text = {
                    Text(
                        text = label,
                        fontWeight = if (selectedTab == tab) FontWeight.Bold else FontWeight.Normal
                    )
                }
            )
        }
    }
}

@Composable
private fun SeasonHeader(
    season: Map<String, Any?>,
    onLeagueClick: () -> Unit
) {
    val seasonName = season["name"] as? String ?: "Temporada Atual"
    val participants = (season["totalParticipants"] as? Number)?.toInt() ?: 0
    val totalGames = (season["totalGames"] as? Number)?.toInt() ?: 0

    Card(
        onClick = onLeagueClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = seasonName,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
                Spacer(modifier = Modifier.height(4.dp))
                Row(
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = "👥 $participants",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                    )
                    Text(
                        text = "⚽ $totalGames jogos",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                    )
                }
            }

            FilledTonalButton(
                onClick = onLeagueClick,
                colors = ButtonDefaults.filledTonalButtonColors(
                    containerColor = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.1f)
                )
            ) {
                Text("Ver Liga")
                Spacer(modifier = Modifier.width(4.dp))
                Text("→")
            }
        }
    }
}

@Composable
private fun RankingList(
    ranking: List<Map<String, Any?>>,
    showMvpCount: Boolean,
    onPlayerClick: (String) -> Unit
) {
    val top3 = ranking.take(3)
    val rest = ranking.drop(3)

    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(8.dp),
        contentPadding = PaddingValues(bottom = 80.dp)
    ) {
        if (top3.isNotEmpty()) {
            item {
                Top3Podium(
                    players = top3,
                    onPlayerClick = onPlayerClick
                )
            }
        }

        if (rest.isNotEmpty()) {
            itemsIndexed(rest, key = { index, _ -> "ranking_$index" }) { index, player ->
                RankingItem(
                    position = index + 4,
                    player = player,
                    showMvpCount = showMvpCount,
                    onClick = { onPlayerClick(player["userId"] as? String ?: "") }
                )
            }
        }
    }
}

@Composable
private fun Top3Podium(
    players: List<Map<String, Any?>>,
    onPlayerClick: (String) -> Unit
) {
    val positions = listOf(1, 0, 2)
    val emojis = mapOf(0 to "🥇", 1 to "🥈", 2 to "🥉")
    val colors = mapOf(
        0 to Color(0xFFFFD700),
        1 to Color(0xFFC0C0C0),
        2 to Color(0xFFCD7F32)
    )

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        positions.forEach { podiumIndex ->
            if (podiumIndex < players.size) {
                val player = players[podiumIndex]
                val actualPosition = podiumIndex + 1
                val bgColor = colors[podiumIndex] ?: MaterialTheme.colorScheme.primaryContainer

                Top3Card(
                    player = player,
                    position = actualPosition,
                    emoji = emojis[podiumIndex] ?: "🏅",
                    backgroundColor = bgColor,
                    onClick = { onPlayerClick(player["userId"] as? String ?: "") }
                )
            }
        }
    }
}

@Composable
private fun Top3Card(
    player: Map<String, Any?>,
    position: Int,
    emoji: String,
    backgroundColor: Color,
    onClick: () -> Unit
) {
    val name = player["nickname"] as? String ?: player["userName"] as? String ?: "Jogador"
    val level = (player["level"] as? Number)?.toInt() ?: 1
    val xp = (player["experiencePoints"] as? Long)?.toInt() ?: 0
    val isCurrentUser = player["isCurrentUser"] as? Boolean ?: false

    Card(
        onClick = onClick,
        modifier = Modifier
            .width(110.dp)
            .then(
                if (position == 1) Modifier.height(160.dp) else Modifier.height(140.dp)
            ),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isCurrentUser) {
                MaterialTheme.colorScheme.primaryContainer
            } else {
                MaterialTheme.colorScheme.surfaceVariant
            }
        ),
        elevation = CardDefaults.cardElevation(
            defaultElevation = if (position == 1) 4.dp else 2.dp
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Box(
                modifier = Modifier.size(if (position == 1) 56.dp else 48.dp),
                contentAlignment = Alignment.Center
            ) {
                Box(
                    modifier = Modifier
                        .size(if (position == 1) 56.dp else 48.dp)
                        .clip(CircleShape)
                        .background(
                            Brush.linearGradient(
                                listOf(backgroundColor, backgroundColor.copy(alpha = 0.7f))
                            )
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = name.firstOrNull()?.uppercase() ?: "?",
                        style = if (position == 1) MaterialTheme.typography.titleLarge else MaterialTheme.typography.titleMedium,
                        color = Color.White,
                        fontWeight = FontWeight.Bold
                    )
                }

                if (isCurrentUser) {
                    Surface(
                        modifier = Modifier.align(Alignment.BottomEnd),
                        shape = CircleShape,
                        color = MaterialTheme.colorScheme.primary,
                        contentColor = MaterialTheme.colorScheme.onPrimary
                    ) {
                        Text(
                            text = "⭐",
                            modifier = Modifier.padding(2.dp),
                            style = MaterialTheme.typography.labelSmall
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = emoji,
                style = if (position == 1) MaterialTheme.typography.headlineMedium else MaterialTheme.typography.titleLarge
            )

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = name,
                style = if (position == 1) MaterialTheme.typography.titleSmall else MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Text(
                text = "Nv. $level • $xp XP",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun RankingItem(
    position: Int,
    player: Map<String, Any?>,
    showMvpCount: Boolean,
    onClick: () -> Unit
) {
    val name = player["nickname"] as? String ?: player["userName"] as? String ?: "Jogador"
    val level = (player["level"] as? Number)?.toInt() ?: 1
    val xp = (player["experiencePoints"] as? Long)?.toInt() ?: 0
    val goals = (player["totalGoals"] as? Number)?.toInt() ?: 0
    val assists = (player["totalAssists"] as? Number)?.toInt() ?: 0
    val mvpCount = (player["mvpCount"] as? Number)?.toInt() ?: 0
    val isCurrentUser = player["isCurrentUser"] as? Boolean ?: false

    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isCurrentUser) {
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.5f)
            } else {
                MaterialTheme.colorScheme.surface
            }
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = position.toString(),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = when (position) {
                    4 -> Color(0xFFCD7F32)
                    5 -> MaterialTheme.colorScheme.onSurfaceVariant
                    6 -> MaterialTheme.colorScheme.onSurfaceVariant
                    else -> MaterialTheme.colorScheme.onSurface
                },
                modifier = Modifier.width(32.dp)
            )

            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.secondary),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = name.firstOrNull()?.uppercase() ?: "?",
                    style = MaterialTheme.typography.titleMedium,
                    color = Color.White,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        text = name,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    if (isCurrentUser) {
                        Surface(
                            shape = RoundedCornerShape(4.dp),
                            color = MaterialTheme.colorScheme.primary
                        ) {
                            Text(
                                text = " VOCÊ ",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onPrimary,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
                Text(
                    text = "Nível $level",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "$xp XP",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    if (showMvpCount) {
                        Text(
                            text = "👑 $mvpCount",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    } else {
                        Text(
                            text = "⚽ $goals",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = "🎯 $assists",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun RankingLoadingContent() {
    LazyColumn(
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                repeat(3) {
                    ShimmerTop3Card()
                }
            }
        }
        items(8) {
            ShimmerRankingItem()
        }
    }
}

@Composable
private fun ShimmerTop3Card() {
    val shimmerColors = listOf(
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f)
    )

    val transition = rememberInfiniteTransition(label = "shimmer")
    val translateAnim = transition.animateFloat(
        initialValue = 0f,
        targetValue = 1000f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmer_translate"
    )

    val brush = Brush.linearGradient(
        colors = shimmerColors,
        start = androidx.compose.ui.geometry.Offset(translateAnim.value - 1000f, 0f),
        end = androidx.compose.ui.geometry.Offset(translateAnim.value, 0f)
    )

    Card(
        modifier = Modifier
            .width(110.dp)
            .height(140.dp),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(brush)
            )
            Spacer(modifier = Modifier.height(12.dp))
            Box(
                modifier = Modifier
                    .width(36.dp)
                    .height(36.dp)
                    .background(brush)
            )
            Spacer(modifier = Modifier.height(8.dp))
            Box(
                modifier = Modifier
                    .width(70.dp)
                    .height(14.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(brush)
            )
        }
    }
}

@Composable
private fun ShimmerRankingItem() {
    val shimmerColors = listOf(
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f)
    )

    val transition = rememberInfiniteTransition(label = "shimmer")
    val translateAnim = transition.animateFloat(
        initialValue = 0f,
        targetValue = 1000f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmer_translate"
    )

    val brush = Brush.linearGradient(
        colors = shimmerColors,
        start = androidx.compose.ui.geometry.Offset(translateAnim.value - 1000f, 0f),
        end = androidx.compose.ui.geometry.Offset(translateAnim.value, 0f)
    )

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .width(32.dp)
                    .height(20.dp)
                    .background(brush)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(brush)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Box(
                    modifier = Modifier
                        .width(100.dp)
                        .height(16.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(brush)
                )
                Spacer(modifier = Modifier.height(6.dp))
                Box(
                    modifier = Modifier
                        .width(60.dp)
                        .height(12.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(brush)
                )
            }
            Box(
                modifier = Modifier
                    .width(50.dp)
                    .height(16.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(brush)
            )
        }
    }
}

@Composable
private fun EmptyRankingState() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "📊",
            style = MaterialTheme.typography.displayLarge
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Nenhum ranking disponível",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Jogue algumas partidas para entrar no ranking!",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
