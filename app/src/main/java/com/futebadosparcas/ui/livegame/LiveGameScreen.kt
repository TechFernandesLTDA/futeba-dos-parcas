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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.R
import com.futebadosparcas.data.model.*
import com.futebadosparcas.ui.theme.GamificationColors
import kotlinx.coroutines.launch

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
    val userMessage by viewModel.userMessage.collectAsStateWithLifecycle(initialValue = "")

    // Estado do Pager (2 tabs: Estatísticas e Eventos)
    val pagerState = rememberPagerState(pageCount = { 2 })
    val scope = rememberCoroutineScope()

    // Estado do bottom sheet para adicionar eventos
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var showAddEventSheet by remember { mutableStateOf(false) }

    // Observar mensagens do usuário
    LaunchedEffect(userMessage) {
        if (userMessage.isNotEmpty()) {
            // SnackbarHost será exibido automaticamente
        }
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
            SnackbarHost(hostState = remember { SnackbarHostState() }) { data ->
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
                        modifier = Modifier.fillMaxSize()
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
                            team1 = state.team1,
                            team2 = state.team2,
                            team1Players = state.team1Players,
                            team2Players = state.team2Players,
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
        title = {
            if (uiState is LiveGameUiState.Success) {
                Column {
                    Text(
                        text = "Jogo ao Vivo",
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
                    text = "Jogo ao Vivo",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
            }
        },
        navigationIcon = {
            IconButton(onClick = onNavigateBack) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Voltar"
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
 * Header com placar, cronômetro e botão de finalizar
 */
@Composable
private fun LiveGameHeader(
    state: LiveGameUiState.Success,
    onFinishGame: () -> Unit
) {
    val isFinished = state.game.getStatusEnum() == GameStatus.FINISHED

    // Cronômetro em tempo real
    var elapsedTime by remember { mutableLongStateOf(0L) }

    LaunchedEffect(state.score.startedAt, isFinished) {
        if (state.score.startedAt != null && !isFinished) {
            while (true) {
                val startTime = state.score.startedAt!!.time
                elapsedTime = System.currentTimeMillis() - startTime
                kotlinx.coroutines.delay(1000L)
            }
        }
    }

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
            // Cronômetro
            if (state.score.startedAt != null) {
                val minutes = (elapsedTime / 1000 / 60).toInt()
                val seconds = (elapsedTime / 1000 % 60).toInt()
                Text(
                    text = if (isFinished) "Fim de Jogo" else String.format("%02d:%02d", minutes, seconds),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            } else if (isFinished) {
                Text(
                    text = "Fim de Jogo",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Placar
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Time 1
                TeamScoreCard(
                    teamName = state.team1.name,
                    score = state.score.team1Score,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.weight(1f)
                )

                // VS
                Text(
                    text = "VS",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Black,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                    modifier = Modifier.padding(horizontal = 8.dp)
                )

                // Time 2
                TeamScoreCard(
                    teamName = state.team2.name,
                    score = state.score.team2Score,
                    color = MaterialTheme.colorScheme.secondary,
                    modifier = Modifier.weight(1f)
                )
            }

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
                        contentDescription = stringResource(R.string.dialog_finish_game_text_1),
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(text = stringResource(R.string.dialog_finish_game_text_1))
                }
            }
        }
    }
}

/**
 * Card de placar de um time
 */
@Composable
private fun TeamScoreCard(
    teamName: String,
    score: Int,
    color: Color,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = teamName,
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
            color = color.copy(alpha = 0.2f),
            modifier = Modifier.size(64.dp)
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier.fillMaxSize()
            ) {
                Text(
                    text = score.toString(),
                    style = MaterialTheme.typography.headlineLarge,
                    fontWeight = FontWeight.Black,
                    color = color
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
    val tabTitles = listOf("Estatísticas", "Eventos")
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

    ExtendedFloatingActionButton(
        onClick = onClick,
        expanded = expanded,
        icon = {
            Icon(
                imageVector = Icons.Default.Add,
                contentDescription = "Adicionar evento"
            )
        },
        text = {
            Text(text = "Adicionar Evento")
        },
        containerColor = MaterialTheme.colorScheme.primaryContainer,
        contentColor = MaterialTheme.colorScheme.onPrimaryContainer
    )
}

/**
 * Bottom Sheet para adicionar eventos
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddEventBottomSheet(
    sheetState: SheetState,
    team1: Team,
    team2: Team,
    team1Players: List<GameConfirmation>,
    team2Players: List<GameConfirmation>,
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
    var selectedTeam by remember { mutableStateOf(team1) }
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
                text = stringResource(R.string.dialog_add_event_text_1),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )

            HorizontalDivider()

            // Tipo de Evento
            Text(
                text = stringResource(R.string.dialog_add_event_text_2),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                EventTypeChip(
                    label = stringResource(R.string.dialog_add_event_text_3),
                    icon = "⚽",
                    selected = selectedEventType == GameEventType.GOAL,
                    onClick = { selectedEventType = GameEventType.GOAL },
                    modifier = Modifier.weight(1f)
                )
                EventTypeChip(
                    label = stringResource(R.string.dialog_add_event_text_4),
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
                    label = stringResource(R.string.dialog_add_event_text_5),
                    icon = "🟨",
                    selected = selectedEventType == GameEventType.YELLOW_CARD,
                    onClick = { selectedEventType = GameEventType.YELLOW_CARD },
                    modifier = Modifier.weight(1f)
                )
                EventTypeChip(
                    label = stringResource(R.string.dialog_add_event_text_6),
                    icon = "🟥",
                    selected = selectedEventType == GameEventType.RED_CARD,
                    onClick = { selectedEventType = GameEventType.RED_CARD },
                    modifier = Modifier.weight(1f)
                )
            }

            HorizontalDivider()

            // Seleção de Time
            Text(
                text = stringResource(R.string.dialog_add_event_text_7),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = selectedTeam.id == team1.id,
                    onClick = { selectedTeam = team1 },
                    label = { Text(team1.name.ifEmpty { "Time 1" }) },
                    modifier = Modifier.weight(1f)
                )
                FilterChip(
                    selected = selectedTeam.id == team2.id,
                    onClick = { selectedTeam = team2 },
                    label = { Text(team2.name.ifEmpty { "Time 2" }) },
                    modifier = Modifier.weight(1f)
                )
            }

            HorizontalDivider()

            // Minuto
            OutlinedTextField(
                value = minute,
                onValueChange = { minute = it.filter { char -> char.isDigit() } },
                label = { Text(stringResource(R.string.dialog_add_event_hint_12)) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            // Lista de jogadores atuais baseada no time selecionado
            val currentPlayers = remember(selectedTeam) {
                if (selectedTeam.id == team1.id) team1Players else team2Players
            }

            // Seleção de Jogador (Dropdown)
            var playerExpanded by remember { mutableStateOf(false) }
            val playerLabel = when (selectedEventType) {
                GameEventType.GOAL -> "Quem fez o Gol?"
                GameEventType.SAVE -> "Quem fez a Defesa?"
                GameEventType.YELLOW_CARD -> "Quem tomou cartão Amarelo?"
                GameEventType.RED_CARD -> "Quem tomou cartão Vermelho?"
                else -> "Jogador"
            }

            Box(modifier = Modifier.fillMaxWidth()) {
                OutlinedTextField(
                    value = selectedPlayer?.userName ?: "",
                    onValueChange = {},
                    label = { Text(playerLabel) },
                    readOnly = true,
                    trailingIcon = {
                        IconButton(onClick = { playerExpanded = true }) {
                            Icon(Icons.Default.ArrowDropDown, contentDescription = "Expandir")
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
                            text = { Text("Nenhum jogador encontrado") },
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
                        label = { Text("Assistência (Opcional)") },
                        readOnly = true,
                        trailingIcon = {
                            IconButton(onClick = { assistExpanded = true }) {
                                Icon(Icons.Default.ArrowDropDown, contentDescription = "Expandir")
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
                            text = { Text("Sem assistência") },
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
                    Text(stringResource(R.string.dialog_add_event_text_14))
                }
                Button(
                    onClick = {
                        // Validação simplificada - em produção, implementar completamente
                        selectedPlayer?.let { player ->
                            onEventAdded(
                                selectedEventType,
                                player.userId,
                                player.userName,
                                selectedTeam.id,
                                selectedAssist?.userId,
                                selectedAssist?.userName,
                                minute.toIntOrNull() ?: 0
                            )
                        }
                    },
                    modifier = Modifier.weight(1f)
                ) {
                    Text(stringResource(R.string.dialog_add_event_text_15))
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
 * Conteúdo de Loading
 */
@Composable
private fun LoadingContent() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            CircularProgressIndicator(
                modifier = Modifier.size(48.dp),
                color = MaterialTheme.colorScheme.primary
            )
            Text(
                text = "Carregando jogo...",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

/**
 * Conteúdo de Erro
 */
@Composable
private fun ErrorContent(
    message: String,
    onRetry: () -> Unit
) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(16.dp),
            modifier = Modifier.padding(32.dp)
        ) {
            Icon(
                imageVector = Icons.Default.ErrorOutline,
                contentDescription = "Erro ao carregar jogo",
                modifier = Modifier.size(64.dp),
                tint = MaterialTheme.colorScheme.error
            )
            Text(
                text = "Erro ao carregar jogo",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface
            )
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
            Button(onClick = onRetry) {
                Icon(
                    imageVector = Icons.Default.Refresh,
                    contentDescription = "Tentar Novamente",
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text("Tentar Novamente")
            }
        }
    }
}
