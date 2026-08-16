package com.futebadosparcas.ui.league

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.ui.draw.scale
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
import com.futebadosparcas.domain.model.GameGender
import com.futebadosparcas.domain.model.LeagueDivision
import com.futebadosparcas.data.model.Season
import com.futebadosparcas.domain.model.LeagueDivision as DomainLeagueDivision
import com.futebadosparcas.domain.model.SeasonParticipation
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateCompact
import com.futebadosparcas.ui.components.EmptyStateType
import com.futebadosparcas.ui.components.lists.RankingItemShimmer
import com.futebadosparcas.ui.components.design.AppTopBar
import com.futebadosparcas.ui.components.CachedProfileImage
import com.futebadosparcas.ui.components.team.TeamBadgeById
import com.futebadosparcas.ui.theme.GamificationColors
import com.futebadosparcas.ui.theme.gamificationTextColor
import com.futebadosparcas.ui.adaptive.rememberWindowSizeClass
import com.futebadosparcas.R
import com.futebadosparcas.ui.theme.AppDimensions
import com.futebadosparcas.ui.theme.MotionSpring
import com.futebadosparcas.ui.theme.rememberReduceMotion
import androidx.compose.ui.res.stringResource

@Composable
fun LeagueScreen(
    uiState: LeagueUiState,
    unreadCount: Int,
    availableSeasons: List<Season>,
    selectedSeason: Season?,
    selectedGender: GameGender?,
    onBack: () -> Unit,
    onDivisionSelected: (LeagueDivision) -> Unit,
    onSeasonSelected: (Season) -> Unit,
    onGenderSelected: (GameGender?) -> Unit,
    onRefresh: () -> Unit,
    onNavigateNotifications: () -> Unit,
    onNavigateGroups: () -> Unit,
    onNavigateMap: () -> Unit,
    onPlayerClick: (String) -> Unit = {}
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
            AppTopBar.Root(
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
                                // Marca refreshing para evitar double-tap e exibir loading no retry
                                onRetry = {
                                    isRefreshing = true
                                    onRefresh()
                                }
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
                            selectedGender = selectedGender,
                            onDivisionSelected = onDivisionSelected,
                            onSeasonSelected = onSeasonSelected,
                            onGenderSelected = onGenderSelected,
                            onPlayerClick = onPlayerClick
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
    selectedGender: GameGender?,
    onDivisionSelected: (LeagueDivision) -> Unit,
    onSeasonSelected: (Season) -> Unit,
    onGenderSelected: (GameGender?) -> Unit,
    onPlayerClick: (String) -> Unit = {}
) {
    // Usa derivedStateOf para evitar recálculos desnecessários durante scroll
    val filteredRanking by remember(state.allRankings, state.selectedDivision) {
        derivedStateOf {
            state.allRankings.filter { it.participation.getDivisionEnum() == state.selectedDivision }
        }
    }

    val windowSizeClass = rememberWindowSizeClass()

    // Em tablets, centraliza o conteúdo com largura máxima para legibilidade
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.TopCenter
    ) {
    LazyColumn(
        modifier = Modifier
            .fillMaxHeight()
            .then(
                if (!windowSizeClass.isCompact) {
                    Modifier.widthIn(max = windowSizeClass.contentMaxWidth)
                } else {
                    Modifier.fillMaxWidth()
                }
            ),
        // Adiciona contentPadding para melhor performance de scroll
        contentPadding = PaddingValues(bottom = AppDimensions.spacing_large)
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
                    // Fase 4b: filtro de gênero (Todos/Masculino/Feminino/Misto).
                    GenderFilterRow(
                        selectedGender = selectedGender,
                        onGenderSelected = onGenderSelected
                    )

                    DivisionSelector(
                        selectedDivision = state.selectedDivision,
                        onDivisionSelected = onDivisionSelected,
                        isLoading = false
                    )
                    
                    // Título e Contador (Também fica fixo para contexto)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = AppDimensions.spacing_medium),
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
                        .padding(vertical = AppDimensions.spacing_massive)
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
                    isMe = item.participation.userId == state.myParticipation?.userId,
                    onPlayerClick = onPlayerClick
                )
            }
        }
    }
    } // fecha Box adaptativo
}

/**
 * Filtro de gênero do ranking (Fase 4b). null = Todos (combinado).
 * MALE/FEMALE/MIXED = segmentado. Enforcement SOFT: apenas filtra a visão,
 * não bloqueia ninguém.
 */
@Composable
fun GenderFilterRow(
    selectedGender: GameGender?,
    onGenderSelected: (GameGender?) -> Unit
) {
    // (label, valor) — null representa "Todos"/combinado.
    val options: List<Pair<String, GameGender?>> = listOf(
        stringResource(R.string.game_gender_filter_all) to null,
        stringResource(R.string.game_gender_male) to GameGender.MALE,
        stringResource(R.string.game_gender_female) to GameGender.FEMALE,
        stringResource(R.string.game_gender_mixed) to GameGender.MIXED
    )

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = AppDimensions.spacing_small),
        horizontalArrangement = Arrangement.spacedBy(AppDimensions.spacing_small)
    ) {
        options.forEach { (label, value) ->
            val selected = selectedGender == value
            FilterChip(
                selected = selected,
                onClick = { onGenderSelected(value) },
                label = { Text(label) }
            )
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
            .padding(AppDimensions.spacing_large),
        shape = RoundedCornerShape(AppDimensions.spacing_extraLarge),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
        border = BorderStroke(AppDimensions.elevation_small, MaterialTheme.colorScheme.outlineVariant)
    ) {
        Box(
            modifier = Modifier
                .padding(AppDimensions.spacing_extraLarge)
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
                                                fontSize = MaterialTheme.typography.labelSmall.fontSize,
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
                                    { Text(stringResource(R.string.league_emoji_selected), color = MaterialTheme.colorScheme.primary) }
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
                            fontSize = MaterialTheme.typography.bodyMedium.fontSize
                        )
                        Text(
                            text = if (myPosition != null) "#$myPosition" else stringResource(R.string.league_no_position),
                            color = MaterialTheme.colorScheme.onSurface,
                            fontSize = MaterialTheme.typography.displayMedium.fontSize,
                            fontWeight = FontWeight.Black
                        )
                    }
                    
                    Surface(
                        color = divisionColor.copy(alpha = 0.18f),
                        contentColor = divisionColor,
                        shape = RoundedCornerShape(AppDimensions.radius_large),
                        modifier = Modifier.padding(AppDimensions.spacing_small),
                        border = BorderStroke(AppDimensions.elevation_small, divisionColor.copy(alpha = 0.5f))
                    ) {
                        Column(
                            modifier = Modifier.padding(horizontal = AppDimensions.spacing_large, vertical = AppDimensions.spacing_small),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Text(
                                text = getDivisionEmoji(myParticipation?.getDivisionEnum() ?: LeagueDivision.BRONZE),
                                fontSize = MaterialTheme.typography.titleMedium.fontSize
                            )
                            Text(
                                text = (myParticipation?.getDivisionEnum() ?: LeagueDivision.BRONZE).name,
                                color = divisionColor,
                                fontWeight = FontWeight.Bold,
                                fontSize = MaterialTheme.typography.bodySmall.fontSize
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
                    
                    Spacer(modifier = Modifier.height(AppDimensions.spacing_large))
                    
                    Column {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = stringResource(R.string.league_rating_format, "%.1f".format(currentRating)),
                                color = MaterialTheme.colorScheme.onSurface,
                                fontSize = MaterialTheme.typography.bodySmall.fontSize,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = stringResource(R.string.league_next_threshold, nextThreshold.toInt()),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                fontSize = MaterialTheme.typography.bodySmall.fontSize
                            )
                        }
                        Spacer(modifier = Modifier.height(AppDimensions.spacing_extraSmall))
                        LinearProgressIndicator(
                            progress = { progress },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(AppDimensions.xp_bar_height)
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
                    MiniStatItem(stringResource(R.string.league_victories), stringResource(R.string.league_stat_win_format, "${myParticipation?.wins ?: 0}"))
                }

                Spacer(modifier = Modifier.height(AppDimensions.spacing_large))

                // Mini Stats - Row 2
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    MiniStatItem(stringResource(R.string.league_goals), stringResource(R.string.league_stat_goal_format, "${myParticipation?.goals ?: 0}"))
                    MiniStatItem(stringResource(R.string.league_assists), stringResource(R.string.league_stat_assist_format, "${myParticipation?.assists ?: 0}"))
                    MiniStatItem(stringResource(R.string.league_mvp_count), stringResource(R.string.league_stat_mvp_format, "${myParticipation?.mvpCount ?: 0}"))
                }
            }
        }
    }
}

@Composable
fun MiniStatItem(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(text = label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = MaterialTheme.typography.bodySmall.fontSize)
        Text(text = value, color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold, fontSize = MaterialTheme.typography.titleMedium.fontSize)
    }
}

@Composable
fun DivisionSelector(
    selectedDivision: LeagueDivision,
    onDivisionSelected: (LeagueDivision) -> Unit,
    isLoading: Boolean = false
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
                .padding(horizontal = AppDimensions.spacing_large, vertical = AppDimensions.spacing_small),
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
                    fontSize = MaterialTheme.typography.bodySmall.fontSize
                )
            }
        }

        AnimatedVisibility(visible = showInfo) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = AppDimensions.spacing_large, vertical = AppDimensions.spacing_small),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
                )
            ) {
                Column(modifier = Modifier.padding(AppDimensions.spacing_large)) {
                    Text(
                        stringResource(R.string.league_title),
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )

                    Spacer(modifier = Modifier.height(AppDimensions.spacing_medium))

                    DivisionInfoItem(
                        emoji = stringResource(R.string.league_emoji_diamond),
                        name = stringResource(R.string.league_division_diamond),
                        rating = "70-100",
                        color = gamificationTextColor(GamificationColors.Diamond),
                        description = stringResource(R.string.league_elite)
                    )
                    DivisionInfoItem(
                        emoji = stringResource(R.string.league_emoji_gold),
                        name = stringResource(R.string.league_division_gold),
                        rating = "50-69",
                        color = gamificationTextColor(GamificationColors.Gold),
                        description = stringResource(R.string.league_experienced)
                    )
                    DivisionInfoItem(
                        emoji = stringResource(R.string.league_emoji_silver),
                        name = stringResource(R.string.league_division_silver),
                        rating = "30-49",
                        color = gamificationTextColor(GamificationColors.Silver),
                        description = stringResource(R.string.league_evolving)
                    )
                    DivisionInfoItem(
                        emoji = stringResource(R.string.league_emoji_bronze),
                        name = stringResource(R.string.league_division_bronze),
                        rating = "0-29",
                        color = gamificationTextColor(GamificationColors.Bronze),
                        description = stringResource(R.string.league_beginners)
                    )

                    Spacer(modifier = Modifier.height(AppDimensions.spacing_medium))

                    Text(
                        stringResource(R.string.league_rating_description),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        fontSize = MaterialTheme.typography.labelSmall.fontSize
                    )
                    Spacer(modifier = Modifier.height(AppDimensions.spacing_extraSmall))
                    Text(
                        stringResource(R.string.league_rating_components),
                        style = MaterialTheme.typography.bodySmall,
                        fontSize = MaterialTheme.typography.labelSmall.fontSize,
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
            edgePadding = AppDimensions.spacing_large,
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

        if (isLoading) {
            LinearProgressIndicator(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(2.dp)
            )
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
            .padding(vertical = AppDimensions.spacing_extraSmall),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = emoji,
            fontSize = MaterialTheme.typography.bodyLarge.fontSize,
            modifier = Modifier.width(AppDimensions.spacing_huge)
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = name,
                fontWeight = FontWeight.Bold,
                fontSize = MaterialTheme.typography.bodySmall.fontSize,
                color = color
            )
            Text(
                text = description,
                fontSize = MaterialTheme.typography.labelSmall.fontSize,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Text(
            text = rating,
            fontSize = MaterialTheme.typography.labelSmall.fontSize,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
fun RankingListItem(
    item: RankingItem,
    position: Int,
    isMe: Boolean,
    onPlayerClick: (String) -> Unit = {}
) {
    val isPromotion = position <= 3
    val isRelegation = position > 0 && position <= 3
    val reducedMotion = rememberReduceMotion()

    val scale by animateFloatAsState(
        targetValue = if (isPromotion) 1.02f else 1f,
        animationSpec = MotionSpring.effects(reducedMotion),
        label = "scale"
    )
    val borderColor by animateColorAsState(
        targetValue = when {
            isMe -> MaterialTheme.colorScheme.primary
            isPromotion -> GamificationColors.Gold.copy(alpha = 0.5f)
            else -> Color.Transparent
        },
        animationSpec = MotionSpring.effects(reducedMotion),
        label = "borderColor"
    )

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = AppDimensions.spacing_large, vertical = 6.dp)
            .scale(scale)
            .clickable { onPlayerClick(item.participation.userId) },
        shape = RoundedCornerShape(AppDimensions.radius_large),
        colors = CardDefaults.cardColors(
            containerColor = if (isMe) {
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
            } else {
                MaterialTheme.colorScheme.surfaceContainerLow
            }
        ),
        // Remove tonalElevation variável - causa jank no scroll
        elevation = CardDefaults.cardElevation(defaultElevation = AppDimensions.elevation_none),
        border = if (isMe || isPromotion) {
            BorderStroke(AppDimensions.elevation_small, borderColor)
        } else null
    ) {
        Row(
            modifier = Modifier
                .padding(AppDimensions.spacing_medium)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Posição
            Box(
                modifier = Modifier
                    .size(AppDimensions.icon_large)
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
                    fontSize = MaterialTheme.typography.bodyMedium.fontSize
                )
            }

            Spacer(modifier = Modifier.width(AppDimensions.spacing_medium))

            // Avatar
            CachedProfileImage(
                photoUrl = item.user.photoUrl,
                userName = item.user.name,
                size = 44.dp
            )

            Spacer(modifier = Modifier.width(AppDimensions.spacing_medium))

            // Nome e Nickname
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = item.user.name,
                        fontWeight = FontWeight.Bold,
                        fontSize = MaterialTheme.typography.bodyLarge.fontSize,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(modifier = Modifier.width(AppDimensions.spacing_extraSmall))
                    TeamBadgeById(
                        teamId = item.user.favoriteTeam,
                        iconSize = 18
                    )
                }
                if (!item.user.nickname.isNullOrEmpty()) {
                    Text(
                        text = item.user.nickname ?: "",
                        fontSize = MaterialTheme.typography.bodySmall.fontSize,
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
                    fontSize = MaterialTheme.typography.bodyLarge.fontSize
                )
                Text(
                    text = stringResource(R.string.league_rating_format, "%.1f".format(item.participation.leagueRating)),
                    fontSize = MaterialTheme.typography.labelSmall.fontSize,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = stringResource(R.string.league_wins_goals_format, item.participation.wins, item.participation.goals),
                    fontSize = MaterialTheme.typography.labelSmall.fontSize,
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
        modifier = modifier.padding(AppDimensions.spacing_large),
        verticalArrangement = Arrangement.spacedBy(AppDimensions.spacing_medium)
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

@Composable
fun getDivisionEmoji(division: LeagueDivision): String {
    // Emojis centralizados em strings.xml (#2257) — localizáveis/substituíveis
    return when (division) {
        LeagueDivision.BRONZE -> stringResource(R.string.league_emoji_bronze)
        LeagueDivision.PRATA -> stringResource(R.string.league_emoji_silver)
        LeagueDivision.OURO -> stringResource(R.string.league_emoji_gold)
        LeagueDivision.DIAMANTE -> stringResource(R.string.league_emoji_diamond)
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
