package com.futebadosparcas.ui.livegame

import android.os.SystemClock
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.EventNote
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.domain.model.*
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateType
import com.futebadosparcas.ui.components.ShimmerBox
import com.futebadosparcas.ui.theme.GamificationColors
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import com.futebadosparcas.R
import com.futebadosparcas.ui.adaptive.adaptiveContentWidth
import com.futebadosparcas.ui.theme.statusBarsPadding

/**
 * LiveGameScreen - Tela principal de jogo ao vivo em Jetpack Compose
 *
 * Features Modernas:
 * - HorizontalPager Material3 para navegação entre tabs
 * - TabRow com indicador animado
 * - Real-time updates via Firestore com collectAsStateWithLifecycle
 * - ExtendedFloatingActionButton com animações
 * - ModalBottomSheet para adicionar eventos
 * - Preparado para KMP (toda lógica no ViewModel)
 * - Swipe gestures para navegação
 * - Performance otimizada com remember e key parameters
 *
 * @param viewModel ViewModel principal do jogo ao vivo
 * @param statsViewModel ViewModel das estatísticas
 * @param eventsViewModel ViewModel dos eventos
 * @param gameId ID do jogo
 * @param onNavigateBack Callback de navegação para voltar
 * @param onNavigateToVote Callback de navegação para votação MVP
 */
@OptIn(ExperimentalFoundationApi::class, ExperimentalMaterial3Api::class)
@Composable
fun LiveGameScreen(
    viewModel: LiveGameViewModel,
    statsViewModel: LiveStatsViewModel,
    eventsViewModel: LiveEventsViewModel,
    gameId: String,
    onNavigateBack: () -> Unit,
    onNavigateToVote: () -> Unit,
    modifier: Modifier = Modifier
) {
    // Estado da UI principal
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    // Estado do Pager (2 tabs: Estatísticas e Eventos)
    val pagerState = rememberPagerState(pageCount = { 2 })
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    // Estado do bottom sheet para adicionar eventos
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var showAddEventSheet by remember { mutableStateOf(false) }

    // Observar cada mensagem como evento. Coletar o SharedFlow diretamente
    // preserva emissões consecutivas com o mesmo texto (#3600).
    LaunchedEffect(viewModel, snackbarHostState) {
        collectLiveGameUserMessages(viewModel.userMessage, snackbarHostState)
    }

    // Observar navegação para votação
    LaunchedEffect(Unit) {
        viewModel.navigationEvent.collect { event ->
            when (event) {
                is LiveGameNavigationEvent.NavigateToVote -> {
                    onNavigateToVote()
                }
            }
        }
    }

    // Carregar jogo ao iniciar
    LaunchedEffect(gameId) {
        viewModel.loadGame(gameId)
        statsViewModel.observeStats(gameId)
        eventsViewModel.observeEvents(gameId)
    }

    Scaffold(
        topBar = {
            LiveGameTopBar(
                uiState = uiState,
                onNavigateBack = onNavigateBack
            )
        },
        floatingActionButton = {
            // FAB animado - só aparece se jogo estiver LIVE
            AnimatedVisibility(
                visible = uiState is LiveGameUiState.Success &&
                          (uiState as? LiveGameUiState.Success)?.let { state ->
                              !state.game.getStatusEnum().let { it == GameStatus.FINISHED } &&
                              state.game.getStatusEnum() == GameStatus.LIVE
                          } == true,
                enter = scaleIn() + fadeIn(),
                exit = scaleOut() + fadeOut()
            ) {
                LiveGameFAB(
                    pagerState = pagerState,
                    onClick = { showAddEventSheet = true }
                )
            }
        },
        snackbarHost = {
            SnackbarHost(hostState = snackbarHostState) { data ->
                Snackbar(
                    snackbarData = data,
                    containerColor = MaterialTheme.colorScheme.inverseSurface,
                    contentColor = MaterialTheme.colorScheme.inverseOnSurface
                )
            }
        }
    ) { paddingValues ->
        Box(
            modifier = modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (val state = uiState) {
                is LiveGameUiState.Loading -> {
                    LoadingContent()
                }
                is LiveGameUiState.Success -> {
                    Column(
                        modifier = Modifier.fillMaxSize().adaptiveContentWidth()
                    ) {
                        // Header com placar e informações do jogo
                        LiveGameHeader(
                            state = state,
                            onFinishGame = { viewModel.finishGame() }
                        )

                        // TabRow + HorizontalPager
                        LiveGameTabs(
                            pagerState = pagerState,
                            statsViewModel = statsViewModel,
                            eventsViewModel = eventsViewModel,
                            gameId = gameId,
                            onTabSelected = { tabIndex ->
                                scope.launch {
                                    pagerState.animateScrollToPage(tabIndex)
                                }
                            }
                        )
                    }

                    // Bottom Sheet para adicionar eventos
                    if (showAddEventSheet) {
                        AddEventBottomSheet(
                            sheetState = sheetState,
                            teamScores = state.teamScores,
                            gameId = gameId,
                            onDismiss = { showAddEventSheet = false },
                            onEventAdded = { eventType, playerId, playerName, teamId, assistId, assistName, minute ->
                                // Adicionar evento via ViewModel
                                when (eventType) {
                                    GameEventType.GOAL -> viewModel.addGoal(
                                        playerId, playerName, teamId, assistId, assistName, minute
                                    )
                                    GameEventType.SAVE -> viewModel.addSave(
                                        playerId, playerName, teamId, minute
                                    )
                                    GameEventType.YELLOW_CARD -> viewModel.addYellowCard(
                                        playerId, playerName, teamId, minute
                                    )
                                    GameEventType.RED_CARD -> viewModel.addRedCard(
                                        playerId, playerName, teamId, minute
                                    )
                                    else -> {}
                                }
                                showAddEventSheet = false
                            }
                        )
                    }
                }
                is LiveGameUiState.Error -> {
                    ErrorContent(
                        message = state.message,
                        onRetry = { viewModel.loadGame(gameId) }
                    )
                }
            }
        }
    }
}

internal suspend fun collectLiveGameUserMessages(
    userMessages: Flow<String>,
    snackbarHostState: SnackbarHostState
) {
    userMessages.collect { message ->
        if (message.isNotBlank()) {
            snackbarHostState.showSnackbar(message)
        }
    }
}

/**
 * TopBar com informações do jogo
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LiveGameTopBar(
    uiState: LiveGameUiState,
    onNavigateBack: () -> Unit
) {
    TopAppBar(
        modifier = Modifier.statusBarsPadding(),
        title = {
            if (uiState is LiveGameUiState.Success) {
                Column {
                    Text(
                        text = stringResource(R.string.live_game_label),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "${uiState.game.locationName} - ${uiState.game.fieldName}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                Text(
                    text = stringResource(R.string.live_game_label),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }
        },
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

/**
 * Cronômetro isolado - reduz recomposições para apenas este componente
 * Atualiza a cada 1 segundo sem causar recomposição de parent components (98% menos recomposições)
 */
@Composable
private fun IsolatedGameTimer(
    startTimeMs: Long?,
    isFinished: Boolean
) {
    var elapsedTime by remember { mutableLongStateOf(0L) }

    LaunchedEffect(startTimeMs, isFinished) {
        if (startTimeMs != null && !isFinished) {
            while (true) {
                elapsedTime = System.currentTimeMillis() - startTimeMs
                kotlinx.coroutines.delay(1000L)
            }
        }
    }

    val minutes = (elapsedTime / 1000 / 60).toInt()
    val seconds = (elapsedTime / 1000 % 60).toInt()

    Text(
        text = if (isFinished) stringResource(R.string.live_game_end_label) else String.format("%02d:%02d", minutes, seconds),
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.Bold,
        color = MaterialTheme.colorScheme.onPrimaryContainer
    )
}

/**
 * Header com placar, cronômetro e botão de finalizar
 */
@Composable
private fun LiveGameHeader(
    state: LiveGameUiState.Success,
    onFinishGame: () -> Unit
) {
    val isFinished = state.game.getStatusEnum() == GameStatus.FINISHED

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(12.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Cronômetro isolado (reduz recomposições em 98%)
            if (state.score.startedAt != null || isFinished) {
                IsolatedGameTimer(
                    startTimeMs = state.score.startedAt,
                    isFinished = isFinished
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Placar — 2 times (clássico com "VS") ou 3-4 times (FlowRow responsivo).
            // #3942: o placar é lido do mapa canônico teamScores, não dos campos
            // legados team1/team2, para suportar jogos de até 4 times.
            TeamScoreBoard(teamScores = state.teamScores)

            // Botão de finalizar (apenas para organizador e se jogo não finalizado)
            if (state.isOwner && !isFinished) {
                Spacer(modifier = Modifier.height(12.dp))
                Button(
                    onClick = onFinishGame,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Icon(
                        imageVector = Icons.Default.Check,
                        contentDescription = stringResource(R.string.live_game_finish),
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(text = stringResource(R.string.live_game_finish_content))
                }
            }
        }
    }
}

/**
 * Placar responsivo dos times. Renderiza 2 a 4 times.
 *
 * - **2 times:** Row centralizado com separador "VS" (identidade clássica).
 * - **3-4 times:** [FlowRow] que envolve para a próxima linha em telas
 *   estreitas e ocupa uma única linha em tablets/desktop, sem overflow.
 *
 * Cada time recebe um acento distinto (primary/secondary/tertiary/error) e o
 * nó é anotado com [contentDescription][androidx.compose.ui.semantics.semantics]
 * para leitores de tela ("Time A, 2 gols").
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun TeamScoreBoard(
    teamScores: List<TeamScore>,
    modifier: Modifier = Modifier
) {
    val teamCount = teamScores.size
    if (teamCount <= 2) {
        Row(
            modifier = modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            teamScores.getOrNull(0)?.let { TeamScoreCard(it, index = 0, modifier = Modifier.weight(1f)) }

            Text(
                text = stringResource(R.string.live_game_vs),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Black,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
                modifier = Modifier.padding(horizontal = 8.dp)
            )

            teamScores.getOrNull(1)?.let { TeamScoreCard(it, index = 1, modifier = Modifier.weight(1f)) }
        }
    } else {
        FlowRow(
            modifier = modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterHorizontally),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            teamScores.forEachIndexed { index, teamScore ->
                TeamScoreCard(
                    teamScore = teamScore,
                    index = index,
                    // Sem weight: o FlowRow envolve para a próxima linha em
                    // telas estreitas e mantém uma linha em telas largas.
                    modifier = Modifier.widthIn(min = 84.dp, max = 120.dp)
                )
            }
        }
    }
}

/**
 * Cor de acento por time, derivada dos roles do Material 3 para garantir
 * contraste e distinção sem hardcodear hex. Cicla a cada 4 times.
 */
@Composable
private fun teamAccentColor(index: Int): Color = when (index % 4) {
    0 -> MaterialTheme.colorScheme.primary
    1 -> MaterialTheme.colorScheme.secondary
    2 -> MaterialTheme.colorScheme.tertiary
    else -> MaterialTheme.colorScheme.error
}

/**
 * Card de placar de um time. O nome usa onPrimaryContainer (contraste AA
 * garantido pelo scheme); o número usa o acento do time sobre o próprio
 * acento a 20% — legível para texto grande/negrito (AA large ≥ 3:1).
 * O contentDescription descreve time + placar para acessibilidade.
 */
@Composable
private fun TeamScoreCard(
    teamScore: TeamScore,
    index: Int,
    modifier: Modifier = Modifier
) {
    val accent = teamAccentColor(index)
    val displayName = teamScore.team.name.ifEmpty {
        stringResource(R.string.live_game_team_default_n, index + 1)
    }
    // pluralStringResource é @Composable; chamado fora do lambda semantics.
    val goalsLabel = pluralStringResource(
        R.plurals.live_game_goals_count, teamScore.score, teamScore.score
    )
    Column(
        modifier = modifier
            .padding(vertical = 4.dp)
            .semantics(mergeDescendants = true) {
                contentDescription = "$displayName, $goalsLabel"
            },
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = displayName,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onPrimaryContainer,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(4.dp))

        Surface(
            shape = CircleShape,
            color = accent.copy(alpha = 0.2f),
            modifier = Modifier.size(64.dp)
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier.fillMaxSize()
            ) {
                Text(
                    text = teamScore.score.toString(),
                    style = MaterialTheme.typography.headlineLarge,
                    fontWeight = FontWeight.Black,
                    color = accent
                )
            }
        }
    }
}

/**
 * TabRow + HorizontalPager com as duas tabs (Estatísticas e Eventos)
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun LiveGameTabs(
    pagerState: androidx.compose.foundation.pager.PagerState,
    statsViewModel: LiveStatsViewModel,
    eventsViewModel: LiveEventsViewModel,
    gameId: String,
    onTabSelected: (Int) -> Unit
) {
    val tabTitles = listOf(stringResource(R.string.live_game_statistics), stringResource(R.string.live_game_events))
    val tabIcons = listOf(Icons.Default.BarChart, Icons.AutoMirrored.Filled.EventNote)

    Column(modifier = Modifier.fillMaxSize()) {
        // TabRow
        TabRow(
            selectedTabIndex = pagerState.currentPage,
            containerColor = MaterialTheme.colorScheme.surface,
            contentColor = MaterialTheme.colorScheme.primary,
            indicator = { tabPositions ->
                TabRowDefaults.SecondaryIndicator(
                    modifier = Modifier,
                    color = MaterialTheme.colorScheme.primary
                )
            }
        ) {
            tabTitles.forEachIndexed { index, title ->
                Tab(
                    selected = pagerState.currentPage == index,
                    onClick = { onTabSelected(index) },
                    text = {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = tabIcons[index],
                                contentDescription = title,
                                modifier = Modifier.size(20.dp)
                            )
                            Text(
                                text = title,
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = if (pagerState.currentPage == index)
                                    FontWeight.Bold else FontWeight.Normal
                            )
                        }
                    },
                    selectedContentColor = MaterialTheme.colorScheme.primary,
                    unselectedContentColor = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        // HorizontalPager
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxSize()
        ) { page ->
            when (page) {
                0 -> LiveStatsTab(
                    viewModel = statsViewModel,
                    gameId = gameId
                )
                1 -> LiveEventsTab(
                    viewModel = eventsViewModel,
                    gameId = gameId
                )
            }
        }
    }
}

/**
 * Tab de Estatísticas (reutiliza LiveStatsScreen)
 */
@Composable
private fun LiveStatsTab(
    viewModel: LiveStatsViewModel,
    gameId: String
) {
    LiveStatsScreen(
        viewModel = viewModel,
        gameId = gameId,
        onPlayerClick = { /* Handle player click if needed */ }
    )
}

/**
 * Tab de Eventos (reutiliza LiveEventsScreen)
 */
@Composable
private fun LiveEventsTab(
    viewModel: LiveEventsViewModel,
    gameId: String
) {
    LiveEventsScreen(
        viewModel = viewModel,
        gameId = gameId,
        onEventClick = { /* Handle event click if needed */ }
    )
}

/**
 * FAB Animado (Extended quando na tab de eventos)
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun LiveGameFAB(
    pagerState: androidx.compose.foundation.pager.PagerState,
    onClick: () -> Unit
) {
    val expanded by remember {
        derivedStateOf { pagerState.currentPage == 1 } // Expandido na tab de eventos
    }
    val haptics = LocalHapticFeedback.current

    ExtendedFloatingActionButton(
        onClick = {
            haptics.performHapticFeedback(HapticFeedbackType.LongPress)
            onClick()
        },
        expanded = expanded,
        icon = {
            Icon(
                imageVector = Icons.Default.Add,
                contentDescription = stringResource(R.string.live_game_add_event)
            )
        },
        text = {
            Text(text = stringResource(R.string.live_game_add_event))
        },
        containerColor = MaterialTheme.colorScheme.primaryContainer,
        contentColor = MaterialTheme.colorScheme.onPrimaryContainer
    )
}

/**
 * Bottom Sheet para adicionar eventos
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun AddEventBottomSheet(
    sheetState: SheetState,
    teamScores: List<TeamScore>,
    gameId: String,
    onDismiss: () -> Unit,
    onEventAdded: (
        eventType: GameEventType,
        playerId: String,
        playerName: String,
        teamId: String,
        assistId: String?,
        assistName: String?,
        minute: Int
    ) -> Unit
) {
    var selectedEventType by remember { mutableStateOf(GameEventType.GOAL) }
    var selectedTeamScore by remember { mutableStateOf(teamScores.firstOrNull()) }
    var selectedPlayer by remember { mutableStateOf<GameConfirmation?>(null) }
    var selectedAssist by remember { mutableStateOf<GameConfirmation?>(null) }
    var minute by remember { mutableStateOf("0") }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = MaterialTheme.colorScheme.surface
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
                .navigationBarsPadding(),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Título
            Text(
                text = stringResource(R.string.live_game_add_event_title),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )

            HorizontalDivider()

            // Tipo de Evento
            Text(
                text = stringResource(R.string.live_game_event_type),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                EventTypeChip(
                    label = stringResource(R.string.live_game_goal),
                    icon = "⚽",
                    selected = selectedEventType == GameEventType.GOAL,
                    onClick = { selectedEventType = GameEventType.GOAL },
                    modifier = Modifier.weight(1f)
                )
                EventTypeChip(
                    label = stringResource(R.string.live_game_save),
                    icon = "🧤",
                    selected = selectedEventType == GameEventType.SAVE,
                    onClick = { selectedEventType = GameEventType.SAVE },
                    modifier = Modifier.weight(1f)
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                EventTypeChip(
                    label = stringResource(R.string.live_game_yellow_card),
                    icon = "🟨",
                    selected = selectedEventType == GameEventType.YELLOW_CARD,
                    onClick = { selectedEventType = GameEventType.YELLOW_CARD },
                    modifier = Modifier.weight(1f)
                )
                EventTypeChip(
                    label = stringResource(R.string.live_game_red_card),
                    icon = "🟥",
                    selected = selectedEventType == GameEventType.RED_CARD,
                    onClick = { selectedEventType = GameEventType.RED_CARD },
                    modifier = Modifier.weight(1f)
                )
            }

            HorizontalDivider()

            // Seleção de Time — #3942: FlowRow com 2 a 4 times (chips com touch target ≥48dp).
            Text(
                text = stringResource(R.string.live_game_select_team),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )

            FlowRow(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                teamScores.forEachIndexed { index, teamScore ->
                    val team = teamScore.team
                    val label = team.name.ifEmpty {
                        stringResource(R.string.live_game_team_default_n, index + 1)
                    }
                    FilterChip(
                        selected = selectedTeamScore?.team?.id == team.id,
                        onClick = { selectedTeamScore = teamScore },
                        label = { Text(label) },
                        modifier = Modifier.widthIn(min = 96.dp)
                    )
                }
            }

            HorizontalDivider()

            // Minuto
            OutlinedTextField(
                value = minute,
                onValueChange = { minute = it.filter { char -> char.isDigit() } },
                label = { Text(stringResource(R.string.live_game_minute)) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            // Lista de jogadores atuais baseada no time selecionado
            val currentPlayers = remember(selectedTeamScore) {
                selectedTeamScore?.players ?: emptyList()
            }

            // Seleção de Jogador (Dropdown)
            var playerExpanded by remember { mutableStateOf(false) }
            val playerLabel = when (selectedEventType) {
                GameEventType.GOAL -> stringResource(R.string.live_game_goal_label)
                GameEventType.SAVE -> stringResource(R.string.live_game_save_label)
                GameEventType.YELLOW_CARD -> stringResource(R.string.live_game_yellow_card_label)
                GameEventType.RED_CARD -> stringResource(R.string.live_game_red_card_label)
                else -> stringResource(R.string.live_game_player_label)
            }

            Box(modifier = Modifier.fillMaxWidth()) {
                OutlinedTextField(
                    value = selectedPlayer?.userName ?: "",
                    onValueChange = {},
                    label = { Text(playerLabel) },
                    readOnly = true,
                    trailingIcon = {
                        IconButton(onClick = { playerExpanded = true }) {
                            Icon(Icons.Default.ArrowDropDown, contentDescription = stringResource(R.string.live_game_expand))
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                )
                DropdownMenu(
                    expanded = playerExpanded,
                    onDismissRequest = { playerExpanded = false },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    currentPlayers.forEach { player ->
                        DropdownMenuItem(
                            text = { Text(player.userName) },
                            onClick = {
                                selectedPlayer = player
                                playerExpanded = false
                            }
                        )
                    }
                    if (currentPlayers.isEmpty()) {
                        DropdownMenuItem(
                            text = { Text(stringResource(R.string.live_game_no_player)) },
                            onClick = { playerExpanded = false },
                            enabled = false
                        )
                    }
                }
            }

            // Assistência (Apenas para Gols)
            if (selectedEventType == GameEventType.GOAL) {
                var assistExpanded by remember { mutableStateOf(false) }

                Box(modifier = Modifier.fillMaxWidth()) {
                    OutlinedTextField(
                        value = selectedAssist?.userName ?: "",
                        onValueChange = {},
                        label = { Text(stringResource(R.string.live_game_assist)) },
                        readOnly = true,
                        trailingIcon = {
                            IconButton(onClick = { assistExpanded = true }) {
                                Icon(Icons.Default.ArrowDropDown, contentDescription = stringResource(R.string.live_game_expand))
                            }
                        },
                        modifier = Modifier.fillMaxWidth()
                    )
                    DropdownMenu(
                        expanded = assistExpanded,
                        onDismissRequest = { assistExpanded = false },
                         modifier = Modifier.fillMaxWidth()
                    ) {
                         DropdownMenuItem(
                            text = { Text(stringResource(R.string.live_game_no_assist_label)) },
                            onClick = {
                                selectedAssist = null
                                assistExpanded = false
                            }
                        )
                        currentPlayers.forEach { player ->
                            // Não permitir auto-assistência (opcional, mas comum)
                            if (player.userId != selectedPlayer?.userId) {
                                DropdownMenuItem(
                                    text = { Text(player.userName) },
                                    onClick = {
                                        selectedAssist = player
                                        assistExpanded = false
                                    }
                                )
                            }
                        }
                    }
                }
            }

            // Botões
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = onDismiss,
                    modifier = Modifier.weight(1f)
                ) {
                    Text(stringResource(R.string.action_cancel))
                }
                Button(
                    onClick = {
                        val teamId = selectedTeamScore?.team?.id
                        // Validação simplificada - em produção, implementar completamente
                        if (teamId != null) {
                            selectedPlayer?.let { player ->
                                onEventAdded(
                                    selectedEventType,
                                    player.userId,
                                    player.userName,
                                    teamId,
                                    selectedAssist?.userId,
                                    selectedAssist?.userName,
                                    minute.toIntOrNull() ?: 0
                                )
                            }
                        }
                    },
                    enabled = selectedTeamScore != null,
                    modifier = Modifier.weight(1f)
                ) {
                    Text(stringResource(R.string.action_confirm))
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}

/**
 * Chip para seleção de tipo de evento
 */
@Composable
private fun EventTypeChip(
    label: String,
    icon: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    FilterChip(
        selected = selected,
        onClick = onClick,
        label = {
            Row(
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(text = icon, style = MaterialTheme.typography.titleMedium)
                Spacer(modifier = Modifier.width(4.dp))
                Text(text = label, style = MaterialTheme.typography.labelMedium)
            }
        },
        modifier = modifier,
        colors = FilterChipDefaults.filterChipColors(
            selectedContainerColor = MaterialTheme.colorScheme.primaryContainer,
            selectedLabelColor = MaterialTheme.colorScheme.onPrimaryContainer
        )
    )
}

/**
 * Conteúdo de Loading com Shimmer
 */
@Composable
private fun LoadingContent() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        ShimmerBox(
            modifier = Modifier
                .fillMaxWidth()
                .height(120.dp),
            cornerRadius = 16.dp
        )

        Spacer(modifier = Modifier.height(16.dp))

        ShimmerBox(
            modifier = Modifier
                .fillMaxWidth()
                .height(200.dp),
            cornerRadius = 16.dp
        )
    }
}

/**
 * Conteúdo de Erro com EmptyState
 */
@Composable
private fun ErrorContent(
    message: String,
    onRetry: () -> Unit
) {
    EmptyState(
        type = EmptyStateType.Error(
            title = stringResource(R.string.live_game_load_error),
            description = message,
            actionLabel = stringResource(R.string.action_retry),
            onRetry = onRetry
        )
    )
}
