package com.futebadosparcas.ui.league

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.TabRowDefaults.tabIndicatorOffset
import androidx.compose.runtime.*
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
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
import coil3.compose.AsyncImage
import coil3.request.ImageRequest
import com.futebadosparcas.domain.model.LeagueDivision
import com.futebadosparcas.data.model.Season
import com.futebadosparcas.domain.model.LeagueDivision as DomainLeagueDivision
import com.futebadosparcas.domain.model.SeasonParticipation
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateCompact
import com.futebadosparcas.ui.components.EmptyStateType
import com.futebadosparcas.ui.components.lists.RankingItemShimmer
import com.futebadosparcas.ui.components.FutebaTopBar
import com.futebadosparcas.ui.components.CachedProfileImage
import com.futebadosparcas.ui.theme.GamificationColors
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LeagueScreen(
    uiState: LeagueUiState,
    unreadCount: Int,
    availableSeasons: List<Season>,
    selectedSeason: Season?,
    onBack: () -> Unit,
    onDivisionSelected: (LeagueDivision) -> Unit,
    onSeasonSelected: (Season) -> Unit,
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
                            LeagueLoadingState(modifier = Modifier.align(Alignment.Center))
                        }
                    }
                    is LeagueUiState.Error -> {
                        EmptyState(
                            type = EmptyStateType.Error(
                                title = stringResource(R.string.error),
                                description = uiState.message,
                                actionLabel = stringResource(R.string.retry),
                                onRetry = onRefresh
                            ),
                            modifier = Modifier.align(Alignment.Center)
                        )
                    }
                    is LeagueUiState.NoActiveSeason -> {
                        EmptyState(
                            type = EmptyStateType.NoData(
                                title = stringResource(R.string.league_no_season),
                                description = stringResource(R.string.league_season_message),
                                icon = Icons.Default.EmojiEvents
                            ),
                            modifier = Modifier.align(Alignment.Center)
                        )
                    }
                    is LeagueUiState.Success -> {
                        LeagueContent(
                            state = uiState,
                            availableSeasons = availableSeasons,
                            selectedSeason = selectedSeason,
                            onDivisionSelected = onDivisionSelected,
                            onSeasonSelected = onSeasonSelected
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
    availableSeasons: List<Season>,
    selectedSeason: Season?,
    onDivisionSelected: (LeagueDivision) -> Unit,
    onSeasonSelected: (Season) -> Unit
) {
    // Usa derivedStateOf para evitar recálculos desnecessários durante scroll
    val filteredRanking by remember(state.allRankings, state.selectedDivision) {
        derivedStateOf {
            state.allRankings.filter { it.participation.getDivisionEnum() == state.selectedDivision }
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        // Adiciona contentPadding para melhor performance de scroll
        contentPadding = PaddingValues(bottom = 16.dp)
    ) {
        // 1. Cabeçalho Dinâmico (Sobe com o scroll)
        item {
            LeagueHeader(
                season = state.season,
                availableSeasons = availableSeasons,
                selectedSeason = selectedSeason,
                myParticipation = state.myParticipation,
                myPosition = state.myPosition,
                onSeasonSelected = onSeasonSelected
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
                            text = stringResource(R.string.league_classification),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = stringResource(R.string.league_players_count, filteredRanking.size),
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
                EmptyStateCompact(
                    icon = Icons.Default.EmojiEvents,
                    message = stringResource(R.string.league_no_players),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 48.dp)
                )
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LeagueHeader(
    season: Season,
    availableSeasons: List<Season>,
    selectedSeason: Season?,
    myParticipation: SeasonParticipation?,
    myPosition: Int?,
    onSeasonSelected: (Season) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val divisionColor = getDivisionColor(myParticipation?.getDivisionEnum() ?: LeagueDivision.BRONZE)

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
                // Seletor de Season
                ExposedDropdownMenuBox(
                    expanded = expanded,
                    onExpandedChange = { expanded = it }
                ) {
                    OutlinedTextField(
                        value = season.name,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text(stringResource(R.string.league_period)) },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedContainerColor = MaterialTheme.colorScheme.surface,
                            unfocusedContainerColor = MaterialTheme.colorScheme.surface
                        ),
                        modifier = Modifier
                            .menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable)
                            .fillMaxWidth(),
                        textStyle = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
                    )

                    ExposedDropdownMenu(
                        expanded = expanded,
                        onDismissRequest = { expanded = false }
                    ) {
                        availableSeasons.forEach { s ->
                            DropdownMenuItem(
                                text = {
                                    Column {
                                        Text(
                                            text = s.name,
                                            fontWeight = if (s.id == selectedSeason?.id) FontWeight.Bold else FontWeight.Normal
                                        )
                                        if (s.isActive) {
                                            Text(
                                                text = stringResource(R.string.league_active),
                                                fontSize = 11.sp,
                                                color = MaterialTheme.colorScheme.primary
                                            )
                                        }
                                    }
                                },
                                onClick = {
                                    onSeasonSelected(s)
                                    expanded = false
                                },
                                leadingIcon = if (s.id == selectedSeason?.id) {
                                    { Text("✓", color = MaterialTheme.colorScheme.primary) }
                                } else null
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = stringResource(R.string.league_my_position),
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
                                text = getDivisionEmoji(myParticipation?.getDivisionEnum() ?: LeagueDivision.BRONZE),
                                fontSize = 18.sp
                            )
                            Text(
                                text = (myParticipation?.getDivisionEnum() ?: LeagueDivision.BRONZE).name,
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
                    val domainDivision = myParticipation.getDivisionEnum()
                    val nextThreshold = DomainLeagueDivision.getNextDivisionThreshold(domainDivision)
                    val prevThreshold = DomainLeagueDivision.getPreviousDivisionThreshold(domainDivision)

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
                                text = stringResource(R.string.league_rating_format, "%.1f".format(currentRating)),
                                color = MaterialTheme.colorScheme.onSurface,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = stringResource(R.string.league_next_threshold, nextThreshold.toInt()),
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
                    MiniStatItem(stringResource(R.string.league_points), "${myParticipation?.points ?: 0}")
                    MiniStatItem(stringResource(R.string.league_games_played), "${myParticipation?.gamesPlayed ?: 0}")
                    MiniStatItem(stringResource(R.string.league_victories), "✅ ${myParticipation?.wins ?: 0}")
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Mini Stats - Row 2
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    MiniStatItem(stringResource(R.string.league_goals), "⚽ ${myParticipation?.goals ?: 0}")
                    MiniStatItem(stringResource(R.string.league_assists), "👟 ${myParticipation?.assists ?: 0}")
                    MiniStatItem(stringResource(R.string.league_mvp_count), "⭐ ${myParticipation?.mvpCount ?: 0}")
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
    var showInfo by remember { mutableStateOf(false) }

    val divisions = listOf(
        LeagueDivision.BRONZE,
        LeagueDivision.PRATA,
        LeagueDivision.OURO,
        LeagueDivision.DIAMANTE
    )

    Column {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                stringResource(R.string.league_divisions),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            TextButton(onClick = { showInfo = !showInfo }) {
                Text(
                    if (showInfo) stringResource(R.string.league_rules_hide) else stringResource(R.string.league_rules_show),
                    fontSize = 12.sp
                )
            }
        }

        AnimatedVisibility(visible = showInfo) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
                )
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(
                        stringResource(R.string.league_title),
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    DivisionInfoItem(
                        emoji = "💎",
                        name = stringResource(R.string.league_division_diamond),
                        rating = "70-100",
                        color = GamificationColors.Diamond,
                        description = stringResource(R.string.league_elite)
                    )
                    DivisionInfoItem(
                        emoji = "🥇",
                        name = stringResource(R.string.league_division_gold),
                        rating = "50-69",
                        color = GamificationColors.Gold,
                        description = stringResource(R.string.league_experienced)
                    )
                    DivisionInfoItem(
                        emoji = "🥈",
                        name = stringResource(R.string.league_division_silver),
                        rating = "30-49",
                        color = GamificationColors.Silver,
                        description = stringResource(R.string.league_evolving)
                    )
                    DivisionInfoItem(
                        emoji = "🥉",
                        name = stringResource(R.string.league_division_bronze),
                        rating = "0-29",
                        color = GamificationColors.Bronze,
                        description = stringResource(R.string.league_beginners)
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    Text(
                        stringResource(R.string.league_rating_description),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        fontSize = 11.sp
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        stringResource(R.string.league_rating_components),
                        style = MaterialTheme.typography.bodySmall,
                        fontSize = 11.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        lineHeight = 16.sp
                    )
                }
            }
        }

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
}

@Composable
fun DivisionInfoItem(
    emoji: String,
    name: String,
    rating: String,
    color: Color,
    description: String
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = emoji,
            fontSize = 16.sp,
            modifier = Modifier.width(32.dp)
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = name,
                fontWeight = FontWeight.Bold,
                fontSize = 12.sp,
                color = color
            )
            Text(
                text = description,
                fontSize = 10.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Text(
            text = rating,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
fun RankingListItem(
    item: RankingItem,
    position: Int,
    isMe: Boolean
) {
    // Usa Card ao invés de Surface com tonalElevation dinâmico para melhor performance de scroll
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (isMe) {
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
            } else {
                MaterialTheme.colorScheme.surfaceContainerLow
            }
        ),
        // Remove tonalElevation variável - causa jank no scroll
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
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
                val backgroundColor = if (position <= 3) getRankColor(position)
                                     else MaterialTheme.colorScheme.surfaceVariant

                Text(
                    text = position.toString(),
                    fontWeight = FontWeight.Bold,
                    color = if (position <= 3) {
                        com.futebadosparcas.util.ContrastHelper.getContrastingTextColor(backgroundColor)
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    },
                    fontSize = 14.sp
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            // Avatar
            CachedProfileImage(
                photoUrl = item.user.photoUrl,
                userName = item.user.name,
                size = 44.dp
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
                    text = stringResource(R.string.league_points_format, item.participation.points),
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.primary,
                    fontSize = 16.sp
                )
                Text(
                    text = stringResource(R.string.league_rating_format, "%.1f".format(item.participation.leagueRating)),
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = stringResource(R.string.league_wins_goals_format, item.participation.wins, item.participation.goals),
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

/**
 * Estado de loading para a tela de liga usando ShimmerBox
 */
@Composable
private fun LeagueLoadingState(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        repeat(5) {
            RankingItemShimmer(
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

// Helpers
fun getDivisionColor(division: LeagueDivision): Color {
    return when (division) {
        LeagueDivision.BRONZE -> GamificationColors.Bronze
        LeagueDivision.PRATA -> GamificationColors.Silver
        LeagueDivision.OURO -> GamificationColors.Gold
        LeagueDivision.DIAMANTE -> GamificationColors.Diamond
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
        1 -> GamificationColors.Gold
        2 -> GamificationColors.Silver
        3 -> GamificationColors.Bronze
        else -> Color.Transparent  // Não usado - MaterialTheme.colorScheme.surfaceVariant é usado no código
    }
}

fun String.capitalize() = replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }

