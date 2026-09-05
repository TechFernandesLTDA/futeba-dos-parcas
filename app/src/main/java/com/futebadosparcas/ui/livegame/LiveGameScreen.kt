package com.futebadosparcas.ui.livegame

import android.Manifest
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.futebadosparcas.R
import com.futebadosparcas.data.model.*
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateType
import com.futebadosparcas.ui.components.ShimmerBox
import com.futebadosparcas.ui.livegame.components.CompactGameTimer
import com.futebadosparcas.ui.livegame.components.FieldHeatMap
import com.futebadosparcas.ui.livegame.components.FieldPositionSelector
import com.futebadosparcas.ui.livegame.components.GameTimer
import com.futebadosparcas.ui.livegame.components.HeatMapBottomSheet
import com.futebadosparcas.ui.livegame.components.ParsedVoiceEvent
import com.futebadosparcas.ui.livegame.components.RefereeModeScreen
import com.futebadosparcas.ui.livegame.components.TimerConfigDialog
import com.futebadosparcas.ui.livegame.components.VoiceEventInput
import com.futebadosparcas.ui.theme.GamificationColors
import kotlinx.coroutines.launch
import java.util.Locale

/**
 * LiveGameScreen - Tela principal de jogo ao vivo em Jetpack Compose
 *
 * Features:
 * - HorizontalPager Material3 para navegacao entre tabs
 * - TabRow com indicador animado
 * - Real-time updates via Firestore com collectAsStateWithLifecycle
 * - ExtendedFloatingActionButton com animacoes
 * - ModalBottomSheet para adicionar eventos
 * - Voice narration com Speech Recognition
 * - Configurable timer (duracao do tempo)
 * - Pause/Resume timer
 * - Substitutions (substituicoes)
 * - Undo event com janela de 30s
 * - Referee Mode (modo arbitro simplificado)
 * - Stats per half (estatisticas por tempo)
 * - Event heat map (mapa de calor)
 *
 * @param viewModel ViewModel principal do jogo ao vivo
 * @param statsViewModel ViewModel das estatisticas
 * @param eventsViewModel ViewModel dos eventos
 * @param gameId ID do jogo
 * @param onNavigateBack Callback de navegacao para voltar
 * @param onNavigateToVote Callback de navegacao para votacao MVP
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
    val isRefereeMode by viewModel.isRefereeMode.collectAsStateWithLifecycle()
    val undoableEvent by viewModel.undoableEvent.collectAsStateWithLifecycle()

    // Estado do Pager (2 tabs: Estatisticas e Eventos)
    val pagerState = rememberPagerState(pageCount = { 2 })
    val scope = rememberCoroutineScope()

    // Estado do bottom sheet para adicionar eventos
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var showAddEventSheet by remember { mutableStateOf(false) }
    var showTimerConfigSheet by remember { mutableStateOf(false) }
    var showSubstitutionSheet by remember { mutableStateOf(false) }
    var showHeatMapSheet by remember { mutableStateOf(false) }

    // Snackbar host state para mensagens
    val snackbarHostState = remember { SnackbarHostState() }

    // Observar mensagens do usuario
    LaunchedEffect(userMessage) {
        if (userMessage.isNotEmpty()) {
            snackbarHostState.showSnackbar(userMessage)
        }
    }

    // Observar navegacao para votacao
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

    // Mostrar snackbar para undo
    LaunchedEffect(undoableEvent) {
        if (undoableEvent != null) {
            val result = snackbarHostState.showSnackbar(
                message = "Evento registrado",
                actionLabel = "Desfazer",
                duration = SnackbarDuration.Short
            )
            if (result == SnackbarResult.ActionPerformed) {
                viewModel.undoLastEvent()
            }
        }
    }

    Scaffold(
        topBar = {
            LiveGameTopBar(
                uiState = uiState,
                isRefereeMode = isRefereeMode,
                onNavigateBack = onNavigateBack,
                onToggleRefereeMode = { viewModel.toggleRefereeMode() }
            )
        },
        floatingActionButton = {
            // FAB animado - so aparece se jogo estiver LIVE e nao estiver em modo arbitro
            AnimatedVisibility(
                visible = !isRefereeMode && uiState is LiveGameUiState.Success &&
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
                    if (isRefereeMode) {
                        // Referee Mode - UI simplificada
                        RefereeModeContent(
                            state = state,
                            onGoalTeam1 = { playerId, playerName ->
                                viewModel.addGoal(playerId, playerName, state.team1.id, null, null, 0)
                            },
                            onGoalTeam2 = { playerId, playerName ->
                                viewModel.addGoal(playerId, playerName, state.team2.id, null, null, 0)
                            },
                            onYellowCard = { playerId, playerName, teamId ->
                                viewModel.addYellowCard(playerId, playerName, teamId, 0)
                            },
                            onRedCard = { playerId, playerName, teamId ->
                                viewModel.addRedCard(playerId, playerName, teamId, 0)
                            },
                            onPauseResume = {
                                if (state.score.isPaused) viewModel.resumeTimer() else viewModel.pauseTimer()
                            },
                            onFinishGame = { viewModel.finishGame() }
                        )
                    } else {
                        // Modo normal
                        Column(
                            modifier = Modifier.fillMaxSize()
                        ) {
                            // Header com placar e informacoes do jogo
                            LiveGameHeader(
                                state = state,
                                onFinishGame = { viewModel.finishGame() },
                                onPauseResume = {
                                    if (state.score.isPaused) viewModel.resumeTimer() else viewModel.pauseTimer()
                                },
                                onStartSecondHalf = { viewModel.startSecondHalf() },
                                onConfigureTimer = { showTimerConfigSheet = true }
                            )

                            // TabRow + HorizontalPager
                            LiveGameTabs(
                                pagerState = pagerState,
                                statsViewModel = statsViewModel,
                                eventsViewModel = eventsViewModel,
                                gameId = gameId,
                                score = state.score,
                                onTabSelected = { tabIndex ->
                                    scope.launch {
                                        pagerState.animateScrollToPage(tabIndex)
                                    }
                                },
                                onShowHeatMap = { showHeatMapSheet = true }
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
                                currentHalf = state.score.currentHalf,
                                onDismiss = { showAddEventSheet = false },
                                onEventAdded = { eventType, playerId, playerName, teamId, assistId, assistName, minute ->
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
                                        GameEventType.SUBSTITUTION -> {
                                            showAddEventSheet = false
                                            showSubstitutionSheet = true
                                        }
                                        else -> {}
                                    }
                                    if (eventType != GameEventType.SUBSTITUTION) {
                                        showAddEventSheet = false
                                    }
                                },
                                onVoiceCommand = { command ->
                                    parseVoiceCommand(command, state, viewModel)
                                }
                            )
                        }

                        // Bottom Sheet para substituicao
                        if (showSubstitutionSheet) {
                            SubstitutionBottomSheet(
                                sheetState = sheetState,
                                team1 = state.team1,
                                team2 = state.team2,
                                team1Players = state.team1Players,
                                team2Players = state.team2Players,
                                onDismiss = { showSubstitutionSheet = false },
                                onSubstitution = { playerInId, playerInName, playerOutId, playerOutName, teamId, minute ->
                                    viewModel.addSubstitution(
                                        playerInId, playerInName, playerOutId, playerOutName, teamId, minute
                                    )
                                    showSubstitutionSheet = false
                                }
                            )
                        }

                        // Bottom Sheet para configurar timer
                        if (showTimerConfigSheet) {
                            TimerConfigBottomSheet(
                                sheetState = sheetState,
                                currentDuration = state.score.halfDurationMinutes,
                                onDismiss = { showTimerConfigSheet = false },
                                onDurationSelected = { duration ->
                                    viewModel.setHalfDuration(duration)
                                    showTimerConfigSheet = false
                                }
                            )
                        }

                        // Bottom Sheet para heat map
                        if (showHeatMapSheet) {
                            HeatMapBottomSheet(
                                sheetState = sheetState,
                                events = eventsViewModel.events.collectAsStateWithLifecycle().value,
                                team1 = state.team1,
                                team2 = state.team2,
                                onDismiss = { showHeatMapSheet = false }
                            )
                        }
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
 * TopBar com informacoes do jogo
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LiveGameTopBar(
    uiState: LiveGameUiState,
    isRefereeMode: Boolean,
    onNavigateBack: () -> Unit,
    onToggleRefereeMode: () -> Unit
) {
    TopAppBar(
        title = {
            if (uiState is LiveGameUiState.Success) {
                Column {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = stringResource(R.string.live_game_label),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        if (isRefereeMode) {
                            Surface(
                                shape = RoundedCornerShape(4.dp),
                                color = MaterialTheme.colorScheme.tertiaryContainer
                            ) {
                                Text(
                                    text = stringResource(R.string.live_game_referee_mode),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onTertiaryContainer,
                                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }
                    }
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
        actions = {
            // Botao para alternar modo arbitro
            IconButton(onClick = onToggleRefereeMode) {
                Icon(
                    imageVector = if (isRefereeMode) Icons.Default.Visibility else Icons.Default.Sports,
                    contentDescription = stringResource(R.string.live_game_toggle_referee_mode),
                    tint = if (isRefereeMode) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.onSurface
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
 * Cronometro isolado com suporte a pause e half indicator
 */
@Composable
private fun IsolatedGameTimer(
    score: LiveGameScore,
    isFinished: Boolean
) {
    var elapsedTime by remember { mutableLongStateOf(0L) }

    LaunchedEffect(score.halfStartedAt, score.startedAt, score.isPaused, score.totalPausedTimeMs, isFinished) {
        val startTime = score.halfStartedAt?.time ?: score.startedAt?.time

        if (startTime != null && !isFinished && !score.isPaused) {
            while (true) {
                val now = System.currentTimeMillis()
                elapsedTime = now - startTime - score.totalPausedTimeMs
                kotlinx.coroutines.delay(1000L)
            }
        } else if (score.isPaused && score.pausedAt != null && startTime != null) {
            // Quando pausado, mostrar o tempo ate a pausa
            elapsedTime = score.pausedAt!!.time - startTime - score.totalPausedTimeMs
        }
    }

    val minutes = (elapsedTime / 1000 / 60).toInt()
    val seconds = (elapsedTime / 1000 % 60).toInt()
    val halfDurationMs = score.halfDurationMinutes * 60 * 1000L

    val isOvertime = elapsedTime > halfDurationMs

    Column(
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Indicador de tempo (1o ou 2o)
        Surface(
            shape = RoundedCornerShape(4.dp),
            color = MaterialTheme.colorScheme.secondaryContainer
        ) {
            Text(
                text = if (score.currentHalf == 1)
                    stringResource(R.string.live_game_first_half)
                else
                    stringResource(R.string.live_game_second_half),
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSecondaryContainer,
                modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp)
            )
        }

        Spacer(modifier = Modifier.height(4.dp))

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            // Indicador de pausa
            if (score.isPaused) {
                Icon(
                    imageVector = Icons.Default.Pause,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.error
                )
            }

            Text(
                text = if (isFinished)
                    stringResource(R.string.live_game_end_label)
                else
                    String.format("%02d:%02d", minutes, seconds),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = when {
                    isOvertime -> MaterialTheme.colorScheme.error
                    score.isPaused -> MaterialTheme.colorScheme.onSurfaceVariant
                    else -> MaterialTheme.colorScheme.onPrimaryContainer
                }
            )

            if (isOvertime && !isFinished) {
                Text(
                    text = "+",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}

/**
 * Header com placar, cronometro e botoes de controle
 */
@Composable
private fun LiveGameHeader(
    state: LiveGameUiState.Success,
    onFinishGame: () -> Unit,
    onPauseResume: () -> Unit,
    onStartSecondHalf: () -> Unit,
    onConfigureTimer: () -> Unit
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
            // Cronometro com indicador de tempo
            if (state.score.startedAt != null || isFinished) {
                IsolatedGameTimer(
                    score = state.score,
                    isFinished = isFinished
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
                    text = stringResource(R.string.live_game_vs),
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

            // Stats per half (se segundo tempo)
            if (state.score.currentHalf == 2) {
                Spacer(modifier = Modifier.height(8.dp))
                HalfStatsRow(score = state.score)
            }

            // Botoes de controle
            if (state.isOwner && !isFinished) {
                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Botao Pause/Resume
                    OutlinedButton(
                        onClick = onPauseResume,
                        modifier = Modifier.weight(1f)
                    ) {
                        Icon(
                            imageVector = if (state.score.isPaused) Icons.Default.PlayArrow else Icons.Default.Pause,
                            contentDescription = null,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = if (state.score.isPaused)
                                stringResource(R.string.live_game_resume)
                            else
                                stringResource(R.string.live_game_pause)
                        )
                    }

                    // Botao Segundo Tempo (se primeiro tempo)
                    if (state.score.currentHalf == 1) {
                        OutlinedButton(
                            onClick = onStartSecondHalf,
                            modifier = Modifier.weight(1f)
                        ) {
                            Icon(
                                imageVector = Icons.Default.FastForward,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(stringResource(R.string.live_game_start_second_half))
                        }
                    }
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Botao Finalizar
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
 * Linha de estatisticas por tempo
 */
@Composable
private fun HalfStatsRow(score: LiveGameScore) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        // Primeiro tempo
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = stringResource(R.string.live_game_first_half_abbr),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
            )
            Text(
                text = "${score.team1ScoreFirstHalf} - ${score.team2ScoreFirstHalf}",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )
        }

        // Segundo tempo
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = stringResource(R.string.live_game_second_half_abbr),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
            )
            val team1SecondHalf = score.team1Score - score.team1ScoreFirstHalf
            val team2SecondHalf = score.team2Score - score.team2ScoreFirstHalf
            Text(
                text = "$team1SecondHalf - $team2SecondHalf",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onPrimaryContainer
            )
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
 * Referee Mode - UI simplificada com botoes grandes
 */
@Composable
private fun RefereeModeContent(
    state: LiveGameUiState.Success,
    onGoalTeam1: (String, String) -> Unit,
    onGoalTeam2: (String, String) -> Unit,
    onYellowCard: (String, String, String) -> Unit,
    onRedCard: (String, String, String) -> Unit,
    onPauseResume: () -> Unit,
    onFinishGame: () -> Unit
) {
    val isFinished = state.game.getStatusEnum() == GameStatus.FINISHED
    var showPlayerSelectDialog by remember { mutableStateOf<RefereeAction?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Timer e placar grande
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.primaryContainer
            )
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                IsolatedGameTimer(
                    score = state.score,
                    isFinished = isFinished
                )

                Spacer(modifier = Modifier.height(16.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = state.score.team1Score.toString(),
                        style = MaterialTheme.typography.displayLarge,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Text(
                        text = "-",
                        style = MaterialTheme.typography.displayMedium,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                    Text(
                        text = state.score.team2Score.toString(),
                        style = MaterialTheme.typography.displayLarge,
                        fontWeight = FontWeight.Black,
                        color = MaterialTheme.colorScheme.secondary
                    )
                }
            }
        }

        // Botoes de gol
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Button(
                onClick = { showPlayerSelectDialog = RefereeAction.GoalTeam1 },
                modifier = Modifier
                    .weight(1f)
                    .height(80.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary
                )
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(text = "GOL", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    Text(text = state.team1.name.take(10), style = MaterialTheme.typography.labelSmall)
                }
            }

            Button(
                onClick = { showPlayerSelectDialog = RefereeAction.GoalTeam2 },
                modifier = Modifier
                    .weight(1f)
                    .height(80.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.secondary
                )
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(text = "GOL", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    Text(text = state.team2.name.take(10), style = MaterialTheme.typography.labelSmall)
                }
            }
        }

        // Botoes de cartao
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Button(
                onClick = { showPlayerSelectDialog = RefereeAction.YellowCard },
                modifier = Modifier
                    .weight(1f)
                    .height(60.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFFFDD835)
                )
            ) {
                Text(
                    text = stringResource(R.string.live_game_yellow_card),
                    color = MaterialTheme.colorScheme.onSurface,
                    fontWeight = FontWeight.Bold
                )
            }

            Button(
                onClick = { showPlayerSelectDialog = RefereeAction.RedCard },
                modifier = Modifier
                    .weight(1f)
                    .height(60.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error
                )
            ) {
                Text(
                    text = stringResource(R.string.live_game_red_card),
                    fontWeight = FontWeight.Bold
                )
            }
        }

        Spacer(modifier = Modifier.weight(1f))

        // Botoes de controle
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            OutlinedButton(
                onClick = onPauseResume,
                modifier = Modifier.weight(1f)
            ) {
                Icon(
                    imageVector = if (state.score.isPaused) Icons.Default.PlayArrow else Icons.Default.Pause,
                    contentDescription = null
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    if (state.score.isPaused)
                        stringResource(R.string.live_game_resume)
                    else
                        stringResource(R.string.live_game_pause)
                )
            }

            if (state.isOwner && !isFinished) {
                Button(
                    onClick = onFinishGame,
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Icon(Icons.Default.Check, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(stringResource(R.string.live_game_finish))
                }
            }
        }
    }

    // Dialog para selecionar jogador
    showPlayerSelectDialog?.let { action ->
        val players = when (action) {
            RefereeAction.GoalTeam1 -> state.team1Players
            RefereeAction.GoalTeam2 -> state.team2Players
            RefereeAction.YellowCard, RefereeAction.RedCard -> state.team1Players + state.team2Players
        }

        AlertDialog(
            onDismissRequest = { showPlayerSelectDialog = null },
            title = {
                Text(
                    when (action) {
                        RefereeAction.GoalTeam1 -> "Gol - ${state.team1.name}"
                        RefereeAction.GoalTeam2 -> "Gol - ${state.team2.name}"
                        RefereeAction.YellowCard -> stringResource(R.string.live_game_yellow_card)
                        RefereeAction.RedCard -> stringResource(R.string.live_game_red_card)
                    }
                )
            },
            text = {
                LazyColumn {
                    items(players) { player ->
                        TextButton(
                            onClick = {
                                when (action) {
                                    RefereeAction.GoalTeam1 -> onGoalTeam1(player.userId, player.userName)
                                    RefereeAction.GoalTeam2 -> onGoalTeam2(player.userId, player.userName)
                                    RefereeAction.YellowCard -> {
                                        val teamId = if (state.team1Players.contains(player)) state.team1.id else state.team2.id
                                        onYellowCard(player.userId, player.userName, teamId)
                                    }
                                    RefereeAction.RedCard -> {
                                        val teamId = if (state.team1Players.contains(player)) state.team1.id else state.team2.id
                                        onRedCard(player.userId, player.userName, teamId)
                                    }
                                }
                                showPlayerSelectDialog = null
                            },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = player.userName,
                                style = MaterialTheme.typography.bodyLarge
                            )
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = { showPlayerSelectDialog = null }) {
                    Text(stringResource(R.string.action_cancel))
                }
            }
        )
    }
}

private enum class RefereeAction {
    GoalTeam1, GoalTeam2, YellowCard, RedCard
}

/**
 * TabRow + HorizontalPager com as duas tabs (Estatisticas e Eventos)
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun LiveGameTabs(
    pagerState: androidx.compose.foundation.pager.PagerState,
    statsViewModel: LiveStatsViewModel,
    eventsViewModel: LiveEventsViewModel,
    gameId: String,
    score: LiveGameScore,
    onTabSelected: (Int) -> Unit,
    onShowHeatMap: () -> Unit
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
                0 -> LiveStatsTabWithHalf(
                    viewModel = statsViewModel,
                    gameId = gameId,
                    score = score
                )
                1 -> LiveEventsTabWithHeatMap(
                    viewModel = eventsViewModel,
                    gameId = gameId,
                    onShowHeatMap = onShowHeatMap
                )
            }
        }
    }
}

/**
 * Tab de Estatisticas com suporte a stats por tempo
 */
@Composable
private fun LiveStatsTabWithHalf(
    viewModel: LiveStatsViewModel,
    gameId: String,
    score: LiveGameScore
) {
    Column(modifier = Modifier.fillMaxSize()) {
        // Info dos tempos se estiver no segundo tempo
        if (score.currentHalf == 2) {
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                shape = RoundedCornerShape(8.dp),
                color = MaterialTheme.colorScheme.surfaceVariant
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = stringResource(R.string.live_game_first_half),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Text(
                            text = "${score.team1ScoreFirstHalf} - ${score.team2ScoreFirstHalf}",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = stringResource(R.string.live_game_second_half),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        val t1Second = score.team1Score - score.team1ScoreFirstHalf
                        val t2Second = score.team2Score - score.team2ScoreFirstHalf
                        Text(
                            text = "$t1Second - $t2Second",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }

        LiveStatsScreen(
            viewModel = viewModel,
            gameId = gameId,
            onPlayerClick = { }
        )
    }
}

/**
 * Tab de Eventos com botao de heat map
 */
@Composable
private fun LiveEventsTabWithHeatMap(
    viewModel: LiveEventsViewModel,
    gameId: String,
    onShowHeatMap: () -> Unit
) {
    Column(modifier = Modifier.fillMaxSize()) {
        // Botao de heat map
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp)
                .clickable { onShowHeatMap() },
            shape = RoundedCornerShape(8.dp),
            color = MaterialTheme.colorScheme.secondaryContainer
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.Map,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSecondaryContainer
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = stringResource(R.string.live_game_view_heat_map),
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSecondaryContainer
                )
            }
        }

        LiveEventsScreen(
            viewModel = viewModel,
            gameId = gameId,
            onEventClick = { }
        )
    }
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
        derivedStateOf { pagerState.currentPage == 1 }
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
 * Bottom Sheet para adicionar eventos com suporte a voz
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
    currentHalf: Int,
    onDismiss: () -> Unit,
    onEventAdded: (
        eventType: GameEventType,
        playerId: String,
        playerName: String,
        teamId: String,
        assistId: String?,
        assistName: String?,
        minute: Int
    ) -> Unit,
    onVoiceCommand: (String) -> Unit
) {
    val context = LocalContext.current
    var selectedEventType by remember { mutableStateOf(GameEventType.GOAL) }
    var selectedTeam by remember { mutableStateOf(team1) }
    var selectedPlayer by remember { mutableStateOf<GameConfirmation?>(null) }
    var selectedAssist by remember { mutableStateOf<GameConfirmation?>(null) }
    var minute by remember { mutableStateOf("0") }

    // Voice recognition state
    var isListening by remember { mutableStateOf(false) }
    var voiceResult by remember { mutableStateOf("") }

    // Permission launcher
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            isListening = true
        }
    }

    // Speech recognizer
    val speechRecognizer = remember { SpeechRecognizer.createSpeechRecognizer(context) }

    DisposableEffect(Unit) {
        speechRecognizer.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() { isListening = false }
            override fun onError(error: Int) { isListening = false }
            override fun onResults(results: Bundle?) {
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                if (!matches.isNullOrEmpty()) {
                    voiceResult = matches[0]
                    onVoiceCommand(matches[0])
                }
                isListening = false
            }
            override fun onPartialResults(partialResults: Bundle?) {}
            override fun onEvent(eventType: Int, params: Bundle?) {}
        })

        onDispose {
            speechRecognizer.destroy()
        }
    }

    fun startListening() {
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale("pt", "BR"))
            putExtra(RecognizerIntent.EXTRA_PROMPT, "Fale o evento...")
        }
        speechRecognizer.startListening(intent)
    }

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
            // Titulo com botao de voz
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = stringResource(R.string.live_game_add_event_title),
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )

                // Botao de voz
                IconButton(
                    onClick = {
                        if (SpeechRecognizer.isRecognitionAvailable(context)) {
                            permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                            if (isListening) {
                                speechRecognizer.stopListening()
                                isListening = false
                            } else {
                                startListening()
                                isListening = true
                            }
                        }
                    }
                ) {
                    Icon(
                        imageVector = if (isListening) Icons.Default.MicOff else Icons.Default.Mic,
                        contentDescription = stringResource(R.string.live_game_voice_command),
                        tint = if (isListening) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
                    )
                }
            }

            // Indicador de tempo atual
            Surface(
                shape = RoundedCornerShape(4.dp),
                color = MaterialTheme.colorScheme.secondaryContainer
            ) {
                Text(
                    text = if (currentHalf == 1)
                        stringResource(R.string.live_game_first_half)
                    else
                        stringResource(R.string.live_game_second_half),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSecondaryContainer,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                )
            }

            // Voice result feedback
            if (voiceResult.isNotEmpty()) {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = MaterialTheme.colorScheme.primaryContainer
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.RecordVoiceOver,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "\"$voiceResult\"",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }
            }

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
                    icon = "GOL",
                    selected = selectedEventType == GameEventType.GOAL,
                    onClick = { selectedEventType = GameEventType.GOAL },
                    modifier = Modifier.weight(1f)
                )
                EventTypeChip(
                    label = stringResource(R.string.live_game_save),
                    icon = "DEF",
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
                    icon = "AM",
                    selected = selectedEventType == GameEventType.YELLOW_CARD,
                    onClick = { selectedEventType = GameEventType.YELLOW_CARD },
                    modifier = Modifier.weight(1f),
                    color = Color(0xFFFDD835)
                )
                EventTypeChip(
                    label = stringResource(R.string.live_game_red_card),
                    icon = "VM",
                    selected = selectedEventType == GameEventType.RED_CARD,
                    onClick = { selectedEventType = GameEventType.RED_CARD },
                    modifier = Modifier.weight(1f),
                    color = MaterialTheme.colorScheme.error
                )
            }

            // Botao de substituicao
            OutlinedButton(
                onClick = { onEventAdded(GameEventType.SUBSTITUTION, "", "", "", null, null, 0) },
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.SwapHoriz, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text(stringResource(R.string.live_game_substitution))
            }

            HorizontalDivider()

            // Selecao de Time
            Text(
                text = stringResource(R.string.live_game_select_team),
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
                label = { Text(stringResource(R.string.live_game_minute)) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            // Lista de jogadores atuais baseada no time selecionado
            val currentPlayers = remember(selectedTeam) {
                if (selectedTeam.id == team1.id) team1Players else team2Players
            }

            // Selecao de Jogador (Dropdown)
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

            // Assistencia (Apenas para Gols)
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

            // Botoes
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
                    Text(stringResource(R.string.action_confirm))
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}

/**
 * Bottom Sheet para substituicao
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SubstitutionBottomSheet(
    sheetState: SheetState,
    team1: Team,
    team2: Team,
    team1Players: List<GameConfirmation>,
    team2Players: List<GameConfirmation>,
    onDismiss: () -> Unit,
    onSubstitution: (
        playerInId: String,
        playerInName: String,
        playerOutId: String,
        playerOutName: String,
        teamId: String,
        minute: Int
    ) -> Unit
) {
    var selectedTeam by remember { mutableStateOf(team1) }
    var playerOut by remember { mutableStateOf<GameConfirmation?>(null) }
    var playerIn by remember { mutableStateOf<GameConfirmation?>(null) }
    var minute by remember { mutableStateOf("0") }

    val currentPlayers = remember(selectedTeam) {
        if (selectedTeam.id == team1.id) team1Players else team2Players
    }

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
            Text(
                text = stringResource(R.string.live_game_substitution),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )

            // Selecao de Time
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                FilterChip(
                    selected = selectedTeam.id == team1.id,
                    onClick = {
                        selectedTeam = team1
                        playerOut = null
                        playerIn = null
                    },
                    label = { Text(team1.name.ifEmpty { "Time 1" }) },
                    modifier = Modifier.weight(1f)
                )
                FilterChip(
                    selected = selectedTeam.id == team2.id,
                    onClick = {
                        selectedTeam = team2
                        playerOut = null
                        playerIn = null
                    },
                    label = { Text(team2.name.ifEmpty { "Time 2" }) },
                    modifier = Modifier.weight(1f)
                )
            }

            // Jogador que sai
            var playerOutExpanded by remember { mutableStateOf(false) }
            Box(modifier = Modifier.fillMaxWidth()) {
                OutlinedTextField(
                    value = playerOut?.userName ?: "",
                    onValueChange = {},
                    label = { Text(stringResource(R.string.live_game_player_out)) },
                    readOnly = true,
                    leadingIcon = {
                        Icon(Icons.Default.PersonRemove, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                    },
                    trailingIcon = {
                        IconButton(onClick = { playerOutExpanded = true }) {
                            Icon(Icons.Default.ArrowDropDown, contentDescription = null)
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                )
                DropdownMenu(
                    expanded = playerOutExpanded,
                    onDismissRequest = { playerOutExpanded = false }
                ) {
                    currentPlayers.forEach { player ->
                        DropdownMenuItem(
                            text = { Text(player.userName) },
                            onClick = {
                                playerOut = player
                                playerOutExpanded = false
                            }
                        )
                    }
                }
            }

            // Jogador que entra
            var playerInExpanded by remember { mutableStateOf(false) }
            Box(modifier = Modifier.fillMaxWidth()) {
                OutlinedTextField(
                    value = playerIn?.userName ?: "",
                    onValueChange = {},
                    label = { Text(stringResource(R.string.live_game_player_in)) },
                    readOnly = true,
                    leadingIcon = {
                        Icon(Icons.Default.PersonAdd, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                    },
                    trailingIcon = {
                        IconButton(onClick = { playerInExpanded = true }) {
                            Icon(Icons.Default.ArrowDropDown, contentDescription = null)
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                )
                DropdownMenu(
                    expanded = playerInExpanded,
                    onDismissRequest = { playerInExpanded = false }
                ) {
                    currentPlayers.filter { it.userId != playerOut?.userId }.forEach { player ->
                        DropdownMenuItem(
                            text = { Text(player.userName) },
                            onClick = {
                                playerIn = player
                                playerInExpanded = false
                            }
                        )
                    }
                }
            }

            // Minuto
            OutlinedTextField(
                value = minute,
                onValueChange = { minute = it.filter { c -> c.isDigit() } },
                label = { Text(stringResource(R.string.live_game_minute)) },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )

            // Botoes
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
                        if (playerIn != null && playerOut != null) {
                            onSubstitution(
                                playerIn!!.userId,
                                playerIn!!.userName,
                                playerOut!!.userId,
                                playerOut!!.userName,
                                selectedTeam.id,
                                minute.toIntOrNull() ?: 0
                            )
                        }
                    },
                    modifier = Modifier.weight(1f),
                    enabled = playerIn != null && playerOut != null
                ) {
                    Text(stringResource(R.string.action_confirm))
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}

/**
 * Bottom Sheet para configurar duracao do tempo
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TimerConfigBottomSheet(
    sheetState: SheetState,
    currentDuration: Int,
    onDismiss: () -> Unit,
    onDurationSelected: (Int) -> Unit
) {
    val durations = listOf(20, 25, 30, 35, 40)

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
            Text(
                text = stringResource(R.string.live_game_timer_config),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )

            Text(
                text = stringResource(R.string.live_game_half_duration),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            durations.forEach { duration ->
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onDurationSelected(duration) },
                    shape = RoundedCornerShape(12.dp),
                    color = if (duration == currentDuration)
                        MaterialTheme.colorScheme.primaryContainer
                    else
                        MaterialTheme.colorScheme.surfaceVariant
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "2 x $duration ${stringResource(R.string.live_game_minutes)}",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = if (duration == currentDuration) FontWeight.Bold else FontWeight.Normal
                        )
                        if (duration == currentDuration) {
                            Icon(
                                imageVector = Icons.Default.Check,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}

/**
 * Bottom Sheet para visualizar heat map
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HeatMapBottomSheet(
    sheetState: SheetState,
    events: List<GameEvent>,
    team1: Team,
    team2: Team,
    onDismiss: () -> Unit
) {
    val goalsWithPosition = events.filter {
        it.getEventTypeEnum() == GameEventType.GOAL && it.hasFieldPosition()
    }

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
            Text(
                text = stringResource(R.string.live_game_heat_map),
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )

            // Campo de futebol com pontos de gols
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(1.5f)
                    .clip(RoundedCornerShape(8.dp))
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(
                                Color(0xFF2E7D32),
                                Color(0xFF388E3C)
                            )
                        )
                    )
                    .border(2.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(8.dp))
            ) {
                // Linhas do campo
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(8.dp)
                ) {
                    // Linha central
                    Box(
                        modifier = Modifier
                            .fillMaxHeight()
                            .width(2.dp)
                            .align(Alignment.Center)
                            .background(Color.White.copy(alpha = 0.5f))
                    )

                    // Circulo central
                    Box(
                        modifier = Modifier
                            .size(60.dp)
                            .align(Alignment.Center)
                            .border(2.dp, Color.White.copy(alpha = 0.5f), CircleShape)
                    )

                    // Pontos de gols
                    goalsWithPosition.forEach { event ->
                        val x = event.fieldPositionX ?: 0.5f
                        val y = event.fieldPositionY ?: 0.5f
                        val isTeam1 = event.teamId == team1.id

                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(20.dp)
                                    .offset(
                                        x = (x * 280).dp,
                                        y = (y * 180).dp
                                    )
                                    .background(
                                        if (isTeam1) MaterialTheme.colorScheme.primary.copy(alpha = 0.8f)
                                        else MaterialTheme.colorScheme.secondary.copy(alpha = 0.8f),
                                        CircleShape
                                    )
                            )
                        }
                    }
                }

                // Legenda
                if (goalsWithPosition.isEmpty()) {
                    Text(
                        text = stringResource(R.string.live_game_no_goals_with_position),
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White,
                        modifier = Modifier.align(Alignment.Center)
                    )
                }
            }

            // Legenda de times
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(16.dp)
                            .background(MaterialTheme.colorScheme.primary, CircleShape)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(team1.name, style = MaterialTheme.typography.labelMedium)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(16.dp)
                            .background(MaterialTheme.colorScheme.secondary, CircleShape)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(team2.name, style = MaterialTheme.typography.labelMedium)
                }
            }

            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}

/**
 * Chip para selecao de tipo de evento
 */
@Composable
private fun EventTypeChip(
    label: String,
    icon: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    color: Color? = null
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
                Text(text = icon, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                Spacer(modifier = Modifier.width(4.dp))
                Text(text = label, style = MaterialTheme.typography.labelMedium)
            }
        },
        modifier = modifier,
        colors = FilterChipDefaults.filterChipColors(
            selectedContainerColor = color ?: MaterialTheme.colorScheme.primaryContainer,
            selectedLabelColor = if (color != null) Color.Black else MaterialTheme.colorScheme.onPrimaryContainer
        )
    )
}

/**
 * Conteudo de Loading com Shimmer
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
 * Conteudo de Erro com EmptyState
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

/**
 * Parse voice command e executa acao correspondente
 */
private fun parseVoiceCommand(
    command: String,
    state: LiveGameUiState.Success,
    viewModel: LiveGameViewModel
) {
    val lowerCommand = command.lowercase(Locale("pt", "BR"))

    // Patterns para detectar comandos
    when {
        // Gol do [jogador]
        lowerCommand.contains("gol") -> {
            val playerName = extractPlayerName(lowerCommand, "gol")
            val player = findPlayerByName(playerName, state.team1Players + state.team2Players)
            if (player != null) {
                val teamId = if (state.team1Players.contains(player)) state.team1.id else state.team2.id
                viewModel.addGoal(player.userId, player.userName, teamId, null, null, 0)
            }
        }

        // Cartao amarelo [jogador]
        lowerCommand.contains("amarelo") || lowerCommand.contains("cartao amarelo") -> {
            val playerName = extractPlayerName(lowerCommand, "amarelo")
            val player = findPlayerByName(playerName, state.team1Players + state.team2Players)
            if (player != null) {
                val teamId = if (state.team1Players.contains(player)) state.team1.id else state.team2.id
                viewModel.addYellowCard(player.userId, player.userName, teamId, 0)
            }
        }

        // Cartao vermelho [jogador]
        lowerCommand.contains("vermelho") || lowerCommand.contains("cartao vermelho") -> {
            val playerName = extractPlayerName(lowerCommand, "vermelho")
            val player = findPlayerByName(playerName, state.team1Players + state.team2Players)
            if (player != null) {
                val teamId = if (state.team1Players.contains(player)) state.team1.id else state.team2.id
                viewModel.addRedCard(player.userId, player.userName, teamId, 0)
            }
        }

        // Defesa [jogador]
        lowerCommand.contains("defesa") -> {
            val playerName = extractPlayerName(lowerCommand, "defesa")
            val player = findPlayerByName(playerName, state.team1Players + state.team2Players)
            if (player != null) {
                val teamId = if (state.team1Players.contains(player)) state.team1.id else state.team2.id
                viewModel.addSave(player.userId, player.userName, teamId, 0)
            }
        }

        // Pausar
        lowerCommand.contains("pausar") || lowerCommand.contains("pausa") -> {
            viewModel.pauseTimer()
        }

        // Continuar / Retomar
        lowerCommand.contains("continuar") || lowerCommand.contains("retomar") -> {
            viewModel.resumeTimer()
        }
    }
}

/**
 * Extrai nome do jogador do comando de voz
 */
private fun extractPlayerName(command: String, keyword: String): String {
    val patterns = listOf(
        "do\\s+(.+)",
        "para\\s+(.+)",
        "\\s+(.+)"
    )

    val keywordIndex = command.indexOf(keyword)
    if (keywordIndex >= 0) {
        val afterKeyword = command.substring(keywordIndex + keyword.length).trim()
        for (pattern in patterns) {
            val regex = Regex(pattern)
            val match = regex.find(afterKeyword)
            if (match != null) {
                return match.groupValues.getOrNull(1)?.trim() ?: afterKeyword
            }
        }
        return afterKeyword
    }
    return ""
}

/**
 * Encontra jogador por nome (busca aproximada)
 */
private fun findPlayerByName(
    name: String,
    players: List<GameConfirmation>
): GameConfirmation? {
    if (name.isBlank()) return null

    val normalizedName = name.lowercase(Locale("pt", "BR"))

    // Busca exata
    players.find { it.userName.lowercase(Locale("pt", "BR")) == normalizedName }?.let { return it }

    // Busca parcial
    players.find { it.userName.lowercase(Locale("pt", "BR")).contains(normalizedName) }?.let { return it }

    // Busca por primeiro nome
    players.find {
        it.userName.split(" ").firstOrNull()?.lowercase(Locale("pt", "BR")) == normalizedName
    }?.let { return it }

    return null
}
