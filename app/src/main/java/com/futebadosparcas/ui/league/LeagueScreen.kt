package com.futebadosparcas.ui.league

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext


import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.futebadosparcas.R
import com.futebadosparcas.data.model.LeagueDivision
import com.futebadosparcas.data.model.Season
import com.futebadosparcas.data.model.SeasonParticipationV2
import com.futebadosparcas.data.model.LeagueRatingCalculator
import com.futebadosparcas.ui.components.FutebaTopBar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LeagueScreen(
    uiState: LeagueUiState,
    unreadCount: Int,
    onBack: () -> Unit,
    onDivisionSelected: (LeagueDivision) -> Unit,
    onRefresh: () -> Unit,
    onNavigateNotifications: () -> Unit,
    onNavigateGroups: () -> Unit,
    onNavigateMap: () -> Unit
) {
    var isRefreshing by remember { mutableStateOf(false) }
    
    // Sincroniza o estado de refresh com o uiState
    LaunchedEffect(uiState) {
        if (uiState !is LeagueUiState.Loading) {
            isRefreshing = false
        }
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        containerColor = MaterialTheme.colorScheme.surface,
        topBar = {
            FutebaTopBar(
                unreadCount = unreadCount,
                onNavigateNotifications = onNavigateNotifications,
                onNavigateGroups = onNavigateGroups,
                onNavigateMap = onNavigateMap
            )
        }
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = isRefreshing,
            onRefresh = {
                isRefreshing = true
                onRefresh()
            },
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
                when (uiState) {
                    is LeagueUiState.Loading -> {
                        if (!isRefreshing) {
                            CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                        }
                    }
                    is LeagueUiState.Error -> {
                        ErrorMessage(uiState.message, onRefresh)
                    }
                    is LeagueUiState.NoActiveSeason -> {
                        EmptySeasonMessage()
                    }
                    is LeagueUiState.Success -> {
                        LeagueContent(
                            state = uiState,
                            onDivisionSelected = onDivisionSelected
                        )
                    }
                }
            }
        }
    }
}

@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
fun LeagueContent(
    state: LeagueUiState.Success,
    onDivisionSelected: (LeagueDivision) -> Unit
) {
    val filteredRanking = remember(state.allRankings, state.selectedDivision) {
        state.allRankings.filter { it.participation.division == state.selectedDivision }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize()
    ) {
        // 1. Cabeçalho Dinâmico (Sobe com o scroll)
        item {
            LeagueHeader(
                season = state.season,
                myParticipation = state.myParticipation,
                myPosition = state.myPosition
            )
        }

        // 2. Seletor de Divisões (Fica preso no topo)
        stickyHeader {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.surface,
                shadowElevation = 2.dp
            ) {
                Column {
                    DivisionSelector(
                        selectedDivision = state.selectedDivision,
                        onDivisionSelected = onDivisionSelected
                    )
                    
                    // Título e Contador (Também fica fixo para contexto)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Classificação",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "${filteredRanking.size} jogadores",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }

        // 3. Lista de Ranking ou Empty State
        if (filteredRanking.isEmpty()) {
            item {
                Box(
                    modifier = Modifier
                        .fillParentMaxHeight(0.6f)
                        .fillMaxWidth(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        "Nenhum jogador nesta divisão",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center
                    )
                }
            }
        } else {
            itemsIndexed(
                items = filteredRanking,
                key = { _, item -> item.participation.userId }
            ) { index, item ->
                RankingListItem(
                    item = item,
                    position = index + 1,
                    isMe = item.participation.userId == state.myParticipation?.userId
                )
            }
        }
    }
}

@Composable
fun LeagueHeader(
    season: Season,
    myParticipation: SeasonParticipationV2?,
    myPosition: Int?
) {
    val divisionColor = getDivisionColor(myParticipation?.division ?: LeagueDivision.BRONZE)
    
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(16.dp),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
    ) {
        Box(
            modifier = Modifier
                .padding(24.dp)
        ) {
            Column {
                Text(
                    text = season.name,
                    color = MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp
                )
                
                Spacer(modifier = Modifier.height(20.dp))
                
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "Minha Posição",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 14.sp
                        )
                        Text(
                            text = if (myPosition != null) "#$myPosition" else "—",
                            color = MaterialTheme.colorScheme.onSurface,
                            fontSize = 42.sp,
                            fontWeight = FontWeight.Black
                        )
                    }
                    
                    Surface(
                        color = divisionColor.copy(alpha = 0.18f),
                        contentColor = divisionColor,
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.padding(8.dp),
                        border = BorderStroke(1.dp, divisionColor.copy(alpha = 0.5f))
                    ) {
                        Column(
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = getDivisionEmoji(myParticipation?.division ?: LeagueDivision.BRONZE),
                                fontSize = 18.sp
                            )
                            Text(
                                text = (myParticipation?.division ?: LeagueDivision.BRONZE).name,
                                color = divisionColor,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp
                            )
                        }
                    }
                }

                // Barra de Progresso da Divisão (Rating)
                if (myParticipation != null) {
                    val currentRating = myParticipation.leagueRating
                    val division = myParticipation.division
                    val nextThreshold = LeagueRatingCalculator.getNextDivisionThreshold(division)
                    val prevThreshold = LeagueRatingCalculator.getPreviousDivisionThreshold(division)
                    
                    // Normalizar progresso (0 a 1 dentro da faixa da divisão)
                    val range = nextThreshold - prevThreshold
                    val progress = ((currentRating - prevThreshold) / range).coerceIn(0.0, 1.0).toFloat()
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    Column {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "Rating: ${"%.1f".format(currentRating)}",
                                color = MaterialTheme.colorScheme.onSurface,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Prox: ${nextThreshold.toInt()}",
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                fontSize = 12.sp
                            )
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        LinearProgressIndicator(
                            progress = { progress },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(6.dp)
                                .clip(RoundedCornerShape(3.dp)),
                            color = MaterialTheme.colorScheme.primary,
                            trackColor = MaterialTheme.colorScheme.outlineVariant,
                        )
                    }
                }
                
                Spacer(modifier = Modifier.height(20.dp))
                
                // Mini Stats - Row 1
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    MiniStatItem("Pontos", "${myParticipation?.points ?: 0}")
                    MiniStatItem("Jogos", "${myParticipation?.gamesPlayed ?: 0}")
                    MiniStatItem("Vitórias", "✅ ${myParticipation?.wins ?: 0}")
                }
                
                Spacer(modifier = Modifier.height(16.dp))
                
                // Mini Stats - Row 2
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    MiniStatItem("Gols", "⚽ ${myParticipation?.goalsScored ?: 0}")
                    MiniStatItem("Assists", "👟 ${myParticipation?.assists ?: 0}")
                    MiniStatItem("MVPs", "⭐ ${myParticipation?.mvpCount ?: 0}")
                }
            }
        }
    }
}

@Composable
fun MiniStatItem(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
        Text(text = value, color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold, fontSize = 18.sp)
    }
}

@Composable
fun DivisionSelector(
    selectedDivision: LeagueDivision,
    onDivisionSelected: (LeagueDivision) -> Unit
) {
    val divisions = listOf(
        LeagueDivision.BRONZE,
        LeagueDivision.PRATA,
        LeagueDivision.OURO,
        LeagueDivision.DIAMANTE
    )
    
    ScrollableTabRow(
        selectedTabIndex = divisions.indexOf(selectedDivision),
        containerColor = Color.Transparent,
        contentColor = MaterialTheme.colorScheme.primary,
        edgePadding = 16.dp,
        divider = {},
        indicator = { tabPositions ->
            TabRowDefaults.SecondaryIndicator(
                Modifier.tabIndicatorOffset(tabPositions[divisions.indexOf(selectedDivision)]),
                color = MaterialTheme.colorScheme.primary
            )
        }
    ) {
        divisions.forEach { division ->
            Tab(
                selected = selectedDivision == division,
                onClick = { onDivisionSelected(division) },
                text = {
                    Text(
                        text = "${getDivisionEmoji(division)} ${division.name.lowercase().capitalize()}",
                        fontWeight = if (selectedDivision == division) FontWeight.Bold else FontWeight.Normal
                    )
                }
            )
        }
    }
}

@Composable
fun RankingListItem(
    item: RankingItem,
    position: Int,
    isMe: Boolean
) {
    val backgroundColor = if (isMe) {
        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
    } else {
        MaterialTheme.colorScheme.surface
    }

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp),
        shape = RoundedCornerShape(16.dp),
        color = backgroundColor,
        tonalElevation = if (isMe) 4.dp else 1.dp,
        border = if (isMe) {
            BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.5f))
        } else null
    ) {
        Row(
            modifier = Modifier
                .padding(12.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Posição
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(
                        if (position <= 3) getRankColor(position) 
                        else MaterialTheme.colorScheme.surfaceVariant
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = position.toString(),
                    fontWeight = FontWeight.Bold,
                    color = if (position <= 3) Color.White else MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 14.sp
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            // Avatar
            AsyncImage(
                model = ImageRequest.Builder(LocalContext.current)
                    .data(item.user.photoUrl)
                    .crossfade(true)
                    .placeholder(R.drawable.ic_person)
                    .error(R.drawable.ic_person)
                    .build(),
                contentDescription = null,
                modifier = Modifier
                    .size(44.dp)
                    .clip(CircleShape),
                contentScale = ContentScale.Crop
            )

            Spacer(modifier = Modifier.width(12.dp))

            // Nome e Nickname
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = item.user.name,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                if (!item.user.nickname.isNullOrEmpty()) {
                    Text(
                        text = item.user.nickname ?: "",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Pontos e Stats
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "${item.participation.points} pts",
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.primary,
                    fontSize = 16.sp
                )
                Text(
                    text = "Rating: ${"%.1f".format(item.participation.leagueRating)}",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = "${item.participation.wins}V • ${item.participation.goalsScored}G",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
fun ErrorMessage(message: String, onRetry: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(text = "❌", fontSize = 48.sp)
        Spacer(modifier = Modifier.height(16.dp))
        Text(text = message, textAlign = TextAlign.Center)
        Spacer(modifier = Modifier.height(24.dp))
        Button(onClick = onRetry) {
            Text("Tentar Novamente")
        }
    }
}

@Composable
fun EmptySeasonMessage() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(text = "🏆", fontSize = 64.sp)
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Nenhuma temporada ativa no momento.",
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center
        )
        Text(
            text = "Aguarde o início da próxima temporada para subir no ranking!",
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

// Helpers
fun getDivisionColor(division: LeagueDivision): Color {
    return when (division) {
        LeagueDivision.BRONZE -> Color(0xFFCD7F32)
        LeagueDivision.PRATA -> Color(0xFFC0C0C0)
        LeagueDivision.OURO -> Color(0xFFFFC800)
        LeagueDivision.DIAMANTE -> Color(0xFF1CB0F6)
    }
}

fun getDivisionEmoji(division: LeagueDivision): String {
    return when (division) {
        LeagueDivision.BRONZE -> "🥉"
        LeagueDivision.PRATA -> "🥈"
        LeagueDivision.OURO -> "🥇"
        LeagueDivision.DIAMANTE -> "💎"
    }
}

fun getRankColor(position: Int): Color {
    return when (position) {
        1 -> Color(0xFFFFC800) // Gold
        2 -> Color(0xFFC0C0C0) // Silver
        3 -> Color(0xFFCD7F32) // Bronze
        else -> Color.Gray
    }
}

fun String.capitalize() = replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }

