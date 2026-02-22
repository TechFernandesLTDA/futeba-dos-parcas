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

private sealed class LeagueUiState {
    object Loading : LeagueUiState()
    data class Success(
        val season: Map<String, Any?>,
        val ranking: List<Map<String, Any?>>,
        val myStats: Map<String, Any?>?,
        val prizes: List<Map<String, Any?>>
    ) : LeagueUiState()
    data class Error(val message: String) : LeagueUiState()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LeagueDetailScreen(
    seasonId: String? = null,
    onBackClick: () -> Unit,
    onPlayerClick: (String) -> Unit = {}
) {
    var uiState by remember { mutableStateOf<LeagueUiState>(LeagueUiState.Loading) }
    val scope = rememberCoroutineScope()

    fun loadLeague() {
        scope.launch {
            uiState = LeagueUiState.Loading
            try {
                val season = FirebaseManager.getActiveSeason()
                if (season == null) {
                    uiState = LeagueUiState.Error("Nenhuma temporada ativa encontrada")
                    return@launch
                }

                val currentSeasonId = season["id"] as? String ?: "season_2026_02"
                val ranking = FirebaseManager.getSeasonRanking(currentSeasonId)
                val myStats = FirebaseManager.getCurrentUserId()?.let {
                    FirebaseManager.getUserSeasonStats(it, currentSeasonId)
                }
                val prizes = FirebaseManager.getSeasonPrizes(currentSeasonId)

                uiState = LeagueUiState.Success(season, ranking, myStats, prizes)
            } catch (e: Exception) {
                uiState = LeagueUiState.Error(e.message ?: "Erro ao carregar liga")
            }
        }
    }

    LaunchedEffect(seasonId) {
        loadLeague()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Detalhes da Liga") },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Text("←", style = MaterialTheme.typography.titleLarge)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        }
    ) { paddingValues ->
        when (val state = uiState) {
            is LeagueUiState.Loading -> LeagueLoadingContent(paddingValues)
            is LeagueUiState.Success -> LeagueContent(
                season = state.season,
                ranking = state.ranking,
                myStats = state.myStats,
                prizes = state.prizes,
                paddingValues = paddingValues,
                onPlayerClick = onPlayerClick
            )
            is LeagueUiState.Error -> ErrorState(
                message = state.message,
                onRetry = { loadLeague() }
            )
        }
    }
}

@Composable
private fun LeagueContent(
    season: Map<String, Any?>,
    ranking: List<Map<String, Any?>>,
    myStats: Map<String, Any?>?,
    prizes: List<Map<String, Any?>>,
    paddingValues: PaddingValues,
    onPlayerClick: (String) -> Unit
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(paddingValues),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            LeagueHeader(season = season)
        }

        if (myStats != null) {
            item {
                MyStatsCard(stats = myStats)
            }
        }

        item {
            Text(
                text = "🏅 Prêmios da Temporada",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold
            )
        }

        item {
            PrizesRow(prizes = prizes)
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "📊 Classificação",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "${ranking.size} jogadores",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        itemsIndexed(ranking, key = { index, _ -> "league_$index" }) { index, player ->
            LeagueRankingItem(
                position = index + 1,
                player = player,
                onClick = { onPlayerClick(player["userId"] as? String ?: "") }
            )
        }

        item {
            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun LeagueHeader(season: Map<String, Any?>) {
    val name = season["name"] as? String ?: "Temporada"
    val description = season["description"] as? String ?: ""
    val participants = (season["totalParticipants"] as? Number)?.toInt() ?: 0
    val totalGames = (season["totalGames"] as? Number)?.toInt() ?: 0

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "🏆",
                    style = MaterialTheme.typography.displaySmall
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = name,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    if (description.isNotEmpty()) {
                        Text(
                            text = description,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                StatBadge(
                    emoji = "👥",
                    value = participants.toString(),
                    label = "Participantes"
                )
                StatBadge(
                    emoji = "⚽",
                    value = totalGames.toString(),
                    label = "Jogos"
                )
                StatBadge(
                    emoji = "📅",
                    value = "Em andamento",
                    label = "Status"
                )
            }
        }
    }
}

@Composable
private fun StatBadge(
    emoji: String,
    value: String,
    label: String
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = emoji,
            style = MaterialTheme.typography.titleLarge
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = value,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onPrimaryContainer
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
        )
    }
}

@Composable
private fun MyStatsCard(stats: Map<String, Any?>) {
    val division = stats["division"] as? String ?: "BRONZE"
    val leagueRating = (stats["leagueRating"] as? Number)?.toInt() ?: 1000
    val position = (stats["position"] as? Number)?.toInt() ?: 0
    val gamesPlayed = (stats["gamesPlayed"] as? Number)?.toInt() ?: 0
    val wins = (stats["wins"] as? Number)?.toInt() ?: 0
    val goals = (stats["goals"] as? Number)?.toInt() ?: 0
    val assists = (stats["assists"] as? Number)?.toInt() ?: 0
    val mvpCount = (stats["mvpCount"] as? Number)?.toInt() ?: 0
    val points = (stats["points"] as? Number)?.toInt() ?: 0

    val (divisionEmoji, divisionColor) = when (division) {
        "DIAMANTE" -> "💎" to Color(0xFF00BCD4)
        "OURO" -> "🥇" to Color(0xFFFFD700)
        "PRATA" -> "🥈" to Color(0xFFC0C0C0)
        else -> "🥉" to Color(0xFFCD7F32)
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "Sua Posição",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = "#$position",
                            style = MaterialTheme.typography.headlineMedium,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
                        )
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = divisionColor.copy(alpha = 0.2f)
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Text(text = divisionEmoji)
                                Text(
                                    text = division.replaceFirstChar { it.uppercase() },
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = divisionColor
                                )
                            }
                        }
                    }
                }

                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "$leagueRating",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        color = divisionColor
                    )
                    Text(
                        text = "Rating",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                PlayerStatItem(value = "$points", label = "Pontos")
                PlayerStatItem(value = "$gamesPlayed", label = "Jogos")
                PlayerStatItem(value = "$wins", label = "Vitórias")
                PlayerStatItem(value = "$goals", label = "Gols")
                PlayerStatItem(value = "$assists", label = "Assists")
                PlayerStatItem(value = "$mvpCount", label = "MVPs")
            }
        }
    }
}

@Composable
private fun PlayerStatItem(
    value: String,
    label: String
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun PrizesRow(prizes: List<Map<String, Any?>>) {
    LazyRow(
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(prizes, key = { it["badgeId"] as? String ?: it.hashCode() }) { prize ->
            PrizeCard(prize = prize)
        }
    }
}

@Composable
private fun PrizeCard(prize: Map<String, Any?>) {
    val emoji = prize["emoji"] as? String ?: "🏅"
    val title = prize["title"] as? String ?: "Prêmio"
    val description = prize["description"] as? String ?: ""
    val xpBonus = (prize["xpBonus"] as? Number)?.toInt() ?: 0
    val position = (prize["position"] as? Number)?.toInt() ?: 0

    Card(
        modifier = Modifier.width(140.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (position > 0) {
                when (position) {
                    1 -> Color(0xFFFFD700).copy(alpha = 0.1f)
                    2 -> Color(0xFFC0C0C0).copy(alpha = 0.1f)
                    3 -> Color(0xFFCD7F32).copy(alpha = 0.1f)
                    else -> MaterialTheme.colorScheme.surfaceVariant
                }
            } else {
                MaterialTheme.colorScheme.surfaceVariant
            }
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = emoji,
                style = MaterialTheme.typography.displayMedium
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = description,
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                maxLines = 1
            )
            Spacer(modifier = Modifier.height(4.dp))
            Surface(
                shape = RoundedCornerShape(8.dp),
                color = MaterialTheme.colorScheme.primary.copy(alpha = 0.1f)
            ) {
                Text(
                    text = "+$xpBonus XP",
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

@Composable
private fun LeagueRankingItem(
    position: Int,
    player: Map<String, Any?>,
    onClick: () -> Unit
) {
    val name = player["nickname"] as? String ?: player["userName"] as? String ?: "Jogador"
    val level = (player["level"] as? Number)?.toInt() ?: 1
    val leagueRating = (player["leagueRating"] as? Number)?.toInt() ?: 1000
    val division = player["division"] as? String ?: "BRONZE"
    val goals = (player["totalGoals"] as? Number)?.toInt() ?: 0
    val assists = (player["totalAssists"] as? Number)?.toInt() ?: 0
    val isCurrentUser = player["isCurrentUser"] as? Boolean ?: false

    val (divisionEmoji, divisionColor) = when (division) {
        "DIAMANTE" -> "💎" to Color(0xFF00BCD4)
        "OURO" -> "🥇" to Color(0xFFFFD700)
        "PRATA" -> "🥈" to Color(0xFFC0C0C0)
        else -> "🥉" to Color(0xFFCD7F32)
    }

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
            Box(
                modifier = Modifier.width(32.dp),
                contentAlignment = Alignment.Center
            ) {
                when (position) {
                    1 -> Text("🥇", style = MaterialTheme.typography.titleMedium)
                    2 -> Text("🥈", style = MaterialTheme.typography.titleMedium)
                    3 -> Text("🥉", style = MaterialTheme.typography.titleMedium)
                    else -> Text(
                        text = position.toString(),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(divisionColor.copy(alpha = 0.3f)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = name.firstOrNull()?.uppercase() ?: "?",
                    style = MaterialTheme.typography.titleMedium,
                    color = divisionColor,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = name,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Text(
                        text = divisionEmoji,
                        style = MaterialTheme.typography.labelLarge
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
                    text = "Nível $level • ⚽ $goals • 🎯 $assists",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "$leagueRating",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = divisionColor
                )
                Text(
                    text = "rating",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun LeagueLoadingContent(paddingValues: PaddingValues) {
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

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .padding(paddingValues),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(150.dp)
                        .background(brush)
                )
            }
        }

        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(100.dp)
                        .background(brush)
                )
            }
        }

        items(8) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(64.dp)
                        .background(brush)
                )
            }
        }
    }
}
