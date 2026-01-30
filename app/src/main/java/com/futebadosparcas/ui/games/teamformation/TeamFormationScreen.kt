@file:OptIn(ExperimentalFoundationApi::class)

package com.futebadosparcas.ui.games.teamformation

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.*
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.draganddrop.dragAndDropSource
import androidx.compose.foundation.draganddrop.dragAndDropTarget
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draganddrop.DragAndDropEvent
import androidx.compose.ui.draganddrop.DragAndDropTarget
import androidx.compose.ui.draganddrop.DragAndDropTransferData
import androidx.compose.ui.draganddrop.mimeTypes
import androidx.compose.ui.draganddrop.toAndroidDragEvent
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.futebadosparcas.R
import com.futebadosparcas.data.model.*
import com.futebadosparcas.domain.ai.SwapSuggestion
import com.futebadosparcas.ui.components.AppTopBar
import com.futebadosparcas.ui.components.CachedProfileImage
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateType
import com.futebadosparcas.util.ContrastHelper

/**
 * Tela de formacao de times com animacao de draft, drag-and-drop,
 * escolha por capitaes e gerenciamento de formacoes salvas.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TeamFormationScreen(
    viewModel: TeamFormationViewModel,
    gameId: String,
    onNavigateBack: () -> Unit
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val draftAnimationState by viewModel.draftAnimationState.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    // Carregar dados do jogo
    LaunchedEffect(gameId) {
        viewModel.loadGame(gameId)
    }

    // Mostrar mensagens do usuario
    LaunchedEffect(uiState) {
        val state = uiState
        if (state is TeamFormationUiState.Ready && state.userMessage != null) {
            snackbarHostState.showSnackbar(state.userMessage)
            viewModel.clearUserMessage()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.team_formation_title)) },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, stringResource(R.string.back))
                    }
                },
                actions = {
                    val state = uiState
                    if (state is TeamFormationUiState.Ready) {
                        IconButton(onClick = { viewModel.resetDraft() }) {
                            Icon(Icons.Default.Refresh, stringResource(R.string.reset))
                        }
                    }
                },
                colors = AppTopBar.surfaceColors()
            )
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            when (val state = uiState) {
                is TeamFormationUiState.Loading -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                is TeamFormationUiState.Error -> {
                    EmptyState(
                        type = EmptyStateType.Error(
                            title = stringResource(R.string.error),
                            description = state.message,
                            actionLabel = stringResource(R.string.retry),
                            onRetry = { viewModel.loadGame(gameId) }
                        )
                    )
                }
                is TeamFormationUiState.Ready -> {
                    TeamFormationContent(
                        state = state,
                        draftAnimationState = draftAnimationState,
                        onStartAutoDraft = viewModel::startAutoDraft,
                        onStartCaptainPicks = viewModel::startCaptainPicks,
                        onCaptainPick = viewModel::captainPickPlayer,
                        onMovePlayer = viewModel::movePlayerToTeam,
                        onSetTeamColor = viewModel::setTeamColor,
                        onAddPair = viewModel::addPair,
                        onRemovePair = viewModel::removePair,
                        onSaveFormation = viewModel::saveFormation,
                        onLoadFormation = viewModel::loadFormation,
                        onDeleteFormation = viewModel::deleteFormation,
                        onConfirmTeams = viewModel::confirmTeams,
                        onUpdateSettings = viewModel::updateSettings
                    )
                }
            }

            // Animacao de draft overlay
            AnimatedVisibility(
                visible = draftAnimationState is DraftAnimationState.Revealing,
                enter = fadeIn(),
                exit = fadeOut(),
                modifier = Modifier.fillMaxSize()
            ) {
                val revealState = draftAnimationState as? DraftAnimationState.Revealing
                if (revealState != null) {
                    DraftRevealOverlay(reveal = revealState.current)
                }
            }
        }
    }
}

@Composable
private fun TeamFormationContent(
    state: TeamFormationUiState.Ready,
    draftAnimationState: DraftAnimationState,
    onStartAutoDraft: () -> Unit,
    onStartCaptainPicks: (String, String) -> Unit,
    onCaptainPick: (String) -> Unit,
    onMovePlayer: (String, Int) -> Unit,
    onSetTeamColor: (Int, TeamColor) -> Unit,
    onAddPair: (String, String) -> Unit,
    onRemovePair: (String, String) -> Unit,
    onSaveFormation: (String) -> Unit,
    onLoadFormation: (String) -> Unit,
    onDeleteFormation: (String) -> Unit,
    onConfirmTeams: () -> Unit,
    onUpdateSettings: (DraftSettings) -> Unit
) {
    var showDraftModeDialog by remember { mutableStateOf(false) }
    var showCaptainSelectionDialog by remember { mutableStateOf(false) }
    var showColorPickerDialog by remember { mutableStateOf<Int?>(null) }
    var showPairDialog by remember { mutableStateOf(false) }
    var showSaveFormationDialog by remember { mutableStateOf(false) }
    var showSavedFormationsDialog by remember { mutableStateOf(false) }
    var showSettingsDialog by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Secao de jogadores disponiveis (quando draft nao iniciado)
        if (state.teamAPlayers.isEmpty() && state.teamBPlayers.isEmpty()) {
            AvailablePlayersSection(
                players = state.players,
                pairs = state.pairs,
                onAddPair = { showPairDialog = true },
                onRemovePair = onRemovePair
            )

            // Botoes de acao
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Button(
                    onClick = { showDraftModeDialog = true },
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.PlayArrow, null)
                    Spacer(Modifier.width(8.dp))
                    Text(stringResource(R.string.start_draft))
                }

                OutlinedButton(
                    onClick = { showSettingsDialog = true }
                ) {
                    Icon(Icons.Default.Settings, stringResource(R.string.settings))
                }
            }

            // Formacoes salvas
            if (state.savedFormations.isNotEmpty()) {
                SavedFormationsSection(
                    formations = state.savedFormations,
                    onLoad = onLoadFormation,
                    onDelete = onDeleteFormation,
                    onViewAll = { showSavedFormationsDialog = true }
                )
            }
        } else {
            // Times formados
            TeamsDisplaySection(
                teamAPlayers = state.teamAPlayers,
                teamBPlayers = state.teamBPlayers,
                teamAColor = state.teamAColor,
                teamBColor = state.teamBColor,
                teamAStrength = state.teamAStrength,
                teamBStrength = state.teamBStrength,
                draftState = state.draftState,
                onMovePlayer = onMovePlayer,
                onColorClick = { teamIndex -> showColorPickerDialog = teamIndex },
                onCaptainPick = onCaptainPick
            )

            // Comparacao de times
            if (state.teamAStrength != null && state.teamBStrength != null) {
                TeamComparisonSection(
                    teamAStrength = state.teamAStrength,
                    teamBStrength = state.teamBStrength,
                    headToHead = state.headToHead
                )
            }

            // Sugestoes de rotacao
            if (state.rotationSuggestions.isNotEmpty()) {
                RotationSuggestionsSection(suggestions = state.rotationSuggestions)
            }

            // Botoes de acao
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = { showSaveFormationDialog = true },
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.Star, null)
                    Spacer(Modifier.width(8.dp))
                    Text(stringResource(R.string.save_formation))
                }

                Button(
                    onClick = onConfirmTeams,
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(Icons.Default.Check, null)
                    Spacer(Modifier.width(8.dp))
                    Text(stringResource(R.string.confirm_teams))
                }
            }
        }
    }

    // Dialogs
    if (showDraftModeDialog) {
        DraftModeSelectionDialog(
            onDismiss = { showDraftModeDialog = false },
            onAutoDraft = {
                showDraftModeDialog = false
                onStartAutoDraft()
            },
            onCaptainPicks = {
                showDraftModeDialog = false
                showCaptainSelectionDialog = true
            }
        )
    }

    if (showCaptainSelectionDialog) {
        CaptainSelectionDialog(
            players = state.players,
            onDismiss = { showCaptainSelectionDialog = false },
            onConfirm = { captain1Id, captain2Id ->
                showCaptainSelectionDialog = false
                onStartCaptainPicks(captain1Id, captain2Id)
            }
        )
    }

    showColorPickerDialog?.let { teamIndex ->
        ColorPickerDialog(
            currentColor = if (teamIndex == 0) state.teamAColor else state.teamBColor,
            onDismiss = { showColorPickerDialog = null },
            onSelectColor = { color ->
                onSetTeamColor(teamIndex, color)
                showColorPickerDialog = null
            }
        )
    }

    if (showPairDialog) {
        PairSelectionDialog(
            players = state.players,
            existingPairs = state.pairs,
            onDismiss = { showPairDialog = false },
            onConfirm = { player1Id, player2Id ->
                onAddPair(player1Id, player2Id)
                showPairDialog = false
            }
        )
    }

    if (showSaveFormationDialog) {
        SaveFormationDialog(
            onDismiss = { showSaveFormationDialog = false },
            onSave = { name ->
                onSaveFormation(name)
                showSaveFormationDialog = false
            }
        )
    }

    if (showSavedFormationsDialog) {
        SavedFormationsListDialog(
            formations = state.savedFormations,
            onDismiss = { showSavedFormationsDialog = false },
            onLoad = {
                onLoadFormation(it)
                showSavedFormationsDialog = false
            },
            onDelete = onDeleteFormation
        )
    }

    if (showSettingsDialog) {
        DraftSettingsDialog(
            settings = state.settings,
            onDismiss = { showSettingsDialog = false },
            onSave = { settings ->
                onUpdateSettings(settings)
                showSettingsDialog = false
            }
        )
    }
}

// ==================== SECOES ====================

@Composable
private fun AvailablePlayersSection(
    players: List<DraftPlayer>,
    pairs: List<PlayerPair>,
    onAddPair: () -> Unit,
    onRemovePair: (String, String) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = stringResource(R.string.available_players, players.size),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )

                TextButton(onClick = onAddPair) {
                    Icon(Icons.Default.Link, null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(stringResource(R.string.add_pair))
                }
            }

            Spacer(Modifier.height(12.dp))

            // Lista de jogadores
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(players, key = { it.id }) { player ->
                    val isPaired = pairs.any { it.containsPlayer(player.id) }
                    AvailablePlayerChip(player = player, isPaired = isPaired)
                }
            }

            // Pares configurados
            if (pairs.isNotEmpty()) {
                Spacer(Modifier.height(12.dp))
                Text(
                    text = stringResource(R.string.configured_pairs),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(Modifier.height(8.dp))

                pairs.forEach { pair ->
                    PairChip(
                        pair = pair,
                        onRemove = { onRemovePair(pair.player1Id, pair.player2Id) }
                    )
                }
            }
        }
    }
}

@Composable
private fun AvailablePlayerChip(player: DraftPlayer, isPaired: Boolean) {
    Surface(
        shape = RoundedCornerShape(12.dp),
        color = if (isPaired) {
            MaterialTheme.colorScheme.primaryContainer
        } else {
            MaterialTheme.colorScheme.surfaceContainerHigh
        },
        border = if (isPaired) {
            BorderStroke(1.dp, MaterialTheme.colorScheme.primary)
        } else null
    ) {
        Column(
            modifier = Modifier.padding(8.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            CachedProfileImage(
                photoUrl = player.photoUrl,
                userName = player.name,
                size = 40.dp
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = player.name.split(" ").firstOrNull() ?: player.name,
                style = MaterialTheme.typography.labelSmall,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            if (isPaired) {
                Icon(
                    Icons.Default.Link,
                    null,
                    modifier = Modifier.size(12.dp),
                    tint = MaterialTheme.colorScheme.primary
                )
            }
        }
    }
}

@Composable
private fun PairChip(pair: PlayerPair, onRemove: () -> Unit) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.secondaryContainer,
        modifier = Modifier.padding(vertical = 2.dp)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                Icons.Default.Link,
                null,
                modifier = Modifier.size(16.dp),
                tint = MaterialTheme.colorScheme.onSecondaryContainer
            )
            Spacer(Modifier.width(8.dp))
            Text(
                text = "${pair.player1Name} + ${pair.player2Name}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSecondaryContainer
            )
            Spacer(Modifier.width(8.dp))
            IconButton(
                onClick = onRemove,
                modifier = Modifier.size(20.dp)
            ) {
                Icon(
                    Icons.Default.Close,
                    stringResource(R.string.remove),
                    modifier = Modifier.size(14.dp),
                    tint = MaterialTheme.colorScheme.onSecondaryContainer
                )
            }
        }
    }
}

@Composable
private fun TeamsDisplaySection(
    teamAPlayers: List<DraftPlayer>,
    teamBPlayers: List<DraftPlayer>,
    teamAColor: TeamColor,
    teamBColor: TeamColor,
    teamAStrength: TeamStrength?,
    teamBStrength: TeamStrength?,
    draftState: DraftState?,
    onMovePlayer: (String, Int) -> Unit,
    onColorClick: (Int) -> Unit,
    onCaptainPick: (String) -> Unit
) {
    val haptic = LocalHapticFeedback.current

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Time A
        TeamCard(
            modifier = Modifier.weight(1f),
            teamIndex = 0,
            teamColor = teamAColor,
            players = teamAPlayers,
            strength = teamAStrength,
            isPickingTurn = (draftState as? DraftState.InProgress)?.isTeam1Turn == true,
            onColorClick = { onColorClick(0) },
            onPlayerDropped = { playerId -> onMovePlayer(playerId, 0) }
        )

        // Time B
        TeamCard(
            modifier = Modifier.weight(1f),
            teamIndex = 1,
            teamColor = teamBColor,
            players = teamBPlayers,
            strength = teamBStrength,
            isPickingTurn = (draftState as? DraftState.InProgress)?.isTeam1Turn == false,
            onColorClick = { onColorClick(1) },
            onPlayerDropped = { playerId -> onMovePlayer(playerId, 1) }
        )
    }

    // Jogadores disponiveis para escolha do capitao
    val inProgress = draftState as? DraftState.InProgress
    if (inProgress != null && inProgress.remainingPlayers.isNotEmpty()) {
        Spacer(Modifier.height(16.dp))

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
            )
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = stringResource(R.string.captain_turn, inProgress.currentPickerName),
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = stringResource(R.string.pick_number, inProgress.pickNumber),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }

                    // Timer
                    Surface(
                        shape = CircleShape,
                        color = if (inProgress.timerSeconds <= 10) {
                            MaterialTheme.colorScheme.errorContainer
                        } else {
                            MaterialTheme.colorScheme.primaryContainer
                        }
                    ) {
                        Text(
                            text = "${inProgress.timerSeconds}s",
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.Bold,
                            color = if (inProgress.timerSeconds <= 10) {
                                MaterialTheme.colorScheme.onErrorContainer
                            } else {
                                MaterialTheme.colorScheme.onPrimaryContainer
                            }
                        )
                    }
                }

                Spacer(Modifier.height(12.dp))

                // Jogadores disponiveis
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(inProgress.remainingPlayers, key = { it }) { playerId ->
                        // Buscar dados do jogador
                        val player = teamAPlayers.find { it.id == playerId }
                            ?: teamBPlayers.find { it.id == playerId }

                        if (player != null) {
                            CaptainPickPlayerCard(
                                player = player,
                                onClick = {
                                    haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                                    onCaptainPick(playerId)
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TeamCard(
    modifier: Modifier = Modifier,
    teamIndex: Int,
    teamColor: TeamColor,
    players: List<DraftPlayer>,
    strength: TeamStrength?,
    isPickingTurn: Boolean,
    onColorClick: () -> Unit,
    onPlayerDropped: (String) -> Unit
) {
    val colorValue = Color(teamColor.hexValue)
    val borderColor = if (isPickingTurn) {
        MaterialTheme.colorScheme.primary
    } else {
        colorValue
    }

    var isDragOver by remember { mutableStateOf(false) }

    val dropTarget = remember {
        object : DragAndDropTarget {
            override fun onDrop(event: DragAndDropEvent): Boolean {
                val dragData = event.toAndroidDragEvent().clipData
                if (dragData.itemCount > 0) {
                    val playerId = dragData.getItemAt(0).text.toString()
                    onPlayerDropped(playerId)
                    return true
                }
                return false
            }

            override fun onEntered(event: DragAndDropEvent) {
                isDragOver = true
            }

            override fun onExited(event: DragAndDropEvent) {
                isDragOver = false
            }

            override fun onEnded(event: DragAndDropEvent) {
                isDragOver = false
            }
        }
    }

    Card(
        modifier = modifier
            .dragAndDropTarget(
                shouldStartDragAndDrop = { event ->
                    event.mimeTypes().contains("text/plain")
                },
                target = dropTarget
            ),
        colors = CardDefaults.cardColors(
            containerColor = if (isDragOver) {
                colorValue.copy(alpha = 0.2f)
            } else {
                MaterialTheme.colorScheme.surface
            }
        ),
        border = BorderStroke(
            width = if (isPickingTurn) 3.dp else 2.dp,
            color = borderColor
        )
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Header com cor e forca
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.clickable(onClick = onColorClick)
                ) {
                    Box(
                        modifier = Modifier
                            .size(24.dp)
                            .background(colorValue, CircleShape)
                            .border(1.dp, MaterialTheme.colorScheme.outline, CircleShape)
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = stringResource(
                            if (teamIndex == 0) R.string.team_a else R.string.team_b
                        ),
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )
                }

                if (strength != null) {
                    Surface(
                        shape = RoundedCornerShape(4.dp),
                        color = MaterialTheme.colorScheme.primaryContainer
                    ) {
                        Text(
                            text = stringResource(R.string.team_strength, strength.overallRating),
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onPrimaryContainer
                        )
                    }
                }
            }

            Spacer(Modifier.height(12.dp))

            // Lista de jogadores (draggable)
            if (players.isEmpty()) {
                Text(
                    text = stringResource(R.string.drag_players_here),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 24.dp),
                    textAlign = TextAlign.Center
                )
            } else {
                players.forEach { player ->
                    DraggablePlayerRow(player = player, teamColor = colorValue)
                }
            }

            // Indicador de goleiro
            if (strength != null) {
                Spacer(Modifier.height(8.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        if (strength.hasGoalkeeper) Icons.Default.CheckCircle else Icons.Default.Warning,
                        null,
                        modifier = Modifier.size(16.dp),
                        tint = if (strength.hasGoalkeeper) {
                            MaterialTheme.colorScheme.primary
                        } else {
                            MaterialTheme.colorScheme.error
                        }
                    )
                    Spacer(Modifier.width(4.dp))
                    Text(
                        text = if (strength.hasGoalkeeper) {
                            stringResource(R.string.has_goalkeeper)
                        } else {
                            stringResource(R.string.no_goalkeeper)
                        },
                        style = MaterialTheme.typography.labelSmall,
                        color = if (strength.hasGoalkeeper) {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        } else {
                            MaterialTheme.colorScheme.error
                        }
                    )
                }
            }
        }
    }
}

@Composable
private fun DraggablePlayerRow(player: DraftPlayer, teamColor: Color) {
    val haptic = LocalHapticFeedback.current

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
            .dragAndDropSource {
                detectTapGestures(
                    onLongPress = {
                        haptic.performHapticFeedback(HapticFeedbackType.LongPress)
                        startTransfer(
                            DragAndDropTransferData(
                                clipData = android.content.ClipData.newPlainText("playerId", player.id)
                            )
                        )
                    }
                )
            },
        verticalAlignment = Alignment.CenterVertically
    ) {
        CachedProfileImage(
            photoUrl = player.photoUrl,
            userName = player.name,
            size = 32.dp
        )
        Spacer(Modifier.width(8.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = player.name,
                style = MaterialTheme.typography.bodyMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = if (player.position == com.futebadosparcas.data.model.PlayerPosition.GOALKEEPER) {
                    stringResource(R.string.goalkeeper)
                } else {
                    stringResource(R.string.field_player)
                },
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Icon(
            Icons.Default.DragIndicator,
            null,
            modifier = Modifier.size(20.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun CaptainPickPlayerCard(player: DraftPlayer, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        )
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            CachedProfileImage(
                photoUrl = player.photoUrl,
                userName = player.name,
                size = 48.dp
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = player.name.split(" ").firstOrNull() ?: player.name,
                style = MaterialTheme.typography.labelMedium,
                maxLines = 1
            )
            Text(
                text = "%.1f".format(player.overallRating),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary
            )
        }
    }
}

@Composable
private fun TeamComparisonSection(
    teamAStrength: TeamStrength,
    teamBStrength: TeamStrength,
    headToHead: HeadToHeadHistory?
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = stringResource(R.string.team_comparison),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )

            Spacer(Modifier.height(12.dp))

            // Barra de comparacao de forca
            val totalStrength = teamAStrength.overallRating + teamBStrength.overallRating
            val teamAPercent = if (totalStrength > 0) {
                teamAStrength.overallRating / totalStrength
            } else 0.5f

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "%.1f".format(teamAStrength.overallRating),
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold
                )

                Spacer(Modifier.width(8.dp))

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(12.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(MaterialTheme.colorScheme.surfaceContainerHigh)
                ) {
                    Row(modifier = Modifier.fillMaxSize()) {
                        Box(
                            modifier = Modifier
                                .weight(teamAPercent)
                                .fillMaxHeight()
                                .background(MaterialTheme.colorScheme.primary)
                        )
                        Box(
                            modifier = Modifier
                                .weight(1f - teamAPercent)
                                .fillMaxHeight()
                                .background(MaterialTheme.colorScheme.error)
                        )
                    }
                }

                Spacer(Modifier.width(8.dp))

                Text(
                    text = "%.1f".format(teamBStrength.overallRating),
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            Spacer(Modifier.height(8.dp))

            // Status de balanceamento
            val diffPercent = teamAStrength.getDifferencePercent(teamBStrength)
            val isBalanced = diffPercent < 5f

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    if (isBalanced) Icons.Default.CheckCircle else Icons.Default.Warning,
                    null,
                    modifier = Modifier.size(16.dp),
                    tint = if (isBalanced) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
                )
                Spacer(Modifier.width(4.dp))
                Text(
                    text = if (isBalanced) {
                        stringResource(R.string.teams_balanced)
                    } else {
                        stringResource(R.string.teams_unbalanced, diffPercent)
                    },
                    style = MaterialTheme.typography.labelSmall,
                    color = if (isBalanced) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.error
                    }
                )
            }

            // Historico head-to-head
            if (headToHead != null && headToHead.totalMatches > 0) {
                Spacer(Modifier.height(12.dp))
                HorizontalDivider()
                Spacer(Modifier.height(12.dp))

                Text(
                    text = stringResource(R.string.head_to_head),
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = headToHead.getFormattedHistory(),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun RotationSuggestionsSection(suggestions: List<SwapSuggestion>) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.3f)
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.SwapHoriz,
                    null,
                    tint = MaterialTheme.colorScheme.tertiary
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    text = stringResource(R.string.rotation_suggestions),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.tertiary
                )
            }

            Spacer(Modifier.height(8.dp))

            suggestions.forEach { suggestion ->
                Text(
                    text = stringResource(
                        R.string.swap_suggestion,
                        suggestion.player1Name,
                        suggestion.player2Name
                    ),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }
        }
    }
}

@Composable
private fun SavedFormationsSection(
    formations: List<SavedTeamFormation>,
    onLoad: (String) -> Unit,
    onDelete: (String) -> Unit,
    onViewAll: () -> Unit
) {
    Column {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = stringResource(R.string.favorite_formations),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )
            TextButton(onClick = onViewAll) {
                Text(stringResource(R.string.see_all))
            }
        }

        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(formations.take(3)) { formation ->
                SavedFormationCard(
                    formation = formation,
                    onLoad = { onLoad(formation.id) }
                )
            }
        }
    }
}

@Composable
private fun SavedFormationCard(
    formation: SavedTeamFormation,
    onLoad: () -> Unit
) {
    Card(
        onClick = onLoad,
        modifier = Modifier.width(160.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
        )
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text = formation.name,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = stringResource(
                    R.string.formation_players,
                    formation.team1PlayerIds.size,
                    formation.team2PlayerIds.size
                ),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Row {
                Box(
                    modifier = Modifier
                        .size(12.dp)
                        .background(Color(formation.getTeam1ColorEnum().hexValue), CircleShape)
                )
                Spacer(Modifier.width(4.dp))
                Text("vs", style = MaterialTheme.typography.labelSmall)
                Spacer(Modifier.width(4.dp))
                Box(
                    modifier = Modifier
                        .size(12.dp)
                        .background(Color(formation.getTeam2ColorEnum().hexValue), CircleShape)
                )
            }
        }
    }
}

// ==================== ANIMACAO DE DRAFT ====================

@Composable
private fun DraftRevealOverlay(reveal: DraftRevealAnimation) {
    val scale by animateFloatAsState(
        targetValue = 1f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessLow
        ),
        label = "scale"
    )

    val alpha by animateFloatAsState(
        targetValue = 1f,
        animationSpec = tween(durationMillis = 300),
        label = "alpha"
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.7f)),
        contentAlignment = Alignment.Center
    ) {
        Card(
            modifier = Modifier
                .scale(scale)
                .alpha(alpha),
            colors = CardDefaults.cardColors(
                containerColor = Color(reveal.teamColor.hexValue)
            ),
            elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
        ) {
            Column(
                modifier = Modifier.padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                CachedProfileImage(
                    photoUrl = reveal.playerPhoto,
                    userName = reveal.playerName,
                    size = 80.dp
                )

                Spacer(Modifier.height(16.dp))

                Text(
                    text = reveal.playerName,
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = ContrastHelper.getContrastingTextColor(Color(reveal.teamColor.hexValue))
                )

                Spacer(Modifier.height(8.dp))

                Text(
                    text = reveal.teamName,
                    style = MaterialTheme.typography.titleMedium,
                    color = ContrastHelper.getContrastingTextColor(Color(reveal.teamColor.hexValue))
                        .copy(alpha = 0.8f)
                )
            }
        }
    }
}

// ==================== DIALOGS ====================

@Composable
private fun DraftModeSelectionDialog(
    onDismiss: () -> Unit,
    onAutoDraft: () -> Unit,
    onCaptainPicks: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.select_draft_mode)) },
        text = {
            Column {
                Text(
                    text = stringResource(R.string.draft_mode_description),
                    style = MaterialTheme.typography.bodyMedium
                )
            }
        },
        confirmButton = {
            Column {
                Button(
                    onClick = onAutoDraft,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.AutoMode, null)
                    Spacer(Modifier.width(8.dp))
                    Text(stringResource(R.string.auto_draft))
                }
                Spacer(Modifier.height(8.dp))
                OutlinedButton(
                    onClick = onCaptainPicks,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.People, null)
                    Spacer(Modifier.width(8.dp))
                    Text(stringResource(R.string.captain_picks))
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.cancel))
            }
        }
    )
}

@Composable
private fun CaptainSelectionDialog(
    players: List<DraftPlayer>,
    onDismiss: () -> Unit,
    onConfirm: (String, String) -> Unit
) {
    var captain1Id by remember { mutableStateOf<String?>(null) }
    var captain2Id by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.select_captains)) },
        text = {
            Column {
                Text(
                    text = stringResource(R.string.captain_1),
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold
                )
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(vertical = 8.dp)
                ) {
                    items(players) { player ->
                        val isSelected = captain1Id == player.id
                        val isDisabled = captain2Id == player.id

                        FilterChip(
                            selected = isSelected,
                            onClick = { if (!isDisabled) captain1Id = player.id },
                            label = { Text(player.name.split(" ").firstOrNull() ?: player.name) },
                            enabled = !isDisabled
                        )
                    }
                }

                Spacer(Modifier.height(8.dp))

                Text(
                    text = stringResource(R.string.captain_2),
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold
                )
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(vertical = 8.dp)
                ) {
                    items(players) { player ->
                        val isSelected = captain2Id == player.id
                        val isDisabled = captain1Id == player.id

                        FilterChip(
                            selected = isSelected,
                            onClick = { if (!isDisabled) captain2Id = player.id },
                            label = { Text(player.name.split(" ").firstOrNull() ?: player.name) },
                            enabled = !isDisabled
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (captain1Id != null && captain2Id != null) {
                        onConfirm(captain1Id!!, captain2Id!!)
                    }
                },
                enabled = captain1Id != null && captain2Id != null
            ) {
                Text(stringResource(R.string.start))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.cancel))
            }
        }
    )
}

@Composable
private fun ColorPickerDialog(
    currentColor: TeamColor,
    onDismiss: () -> Unit,
    onSelectColor: (TeamColor) -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.select_vest_color)) },
        text = {
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(TeamColor.entries.toTypedArray()) { color ->
                    val isSelected = color == currentColor
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .clip(CircleShape)
                            .background(Color(color.hexValue))
                            .border(
                                width = if (isSelected) 3.dp else 1.dp,
                                color = if (isSelected) {
                                    MaterialTheme.colorScheme.primary
                                } else {
                                    MaterialTheme.colorScheme.outline
                                },
                                shape = CircleShape
                            )
                            .clickable { onSelectColor(color) },
                        contentAlignment = Alignment.Center
                    ) {
                        if (isSelected) {
                            Icon(
                                Icons.Default.Check,
                                null,
                                tint = ContrastHelper.getContrastingTextColor(Color(color.hexValue)),
                                modifier = Modifier.size(24.dp)
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.close))
            }
        }
    )
}

@Composable
private fun PairSelectionDialog(
    players: List<DraftPlayer>,
    existingPairs: List<PlayerPair>,
    onDismiss: () -> Unit,
    onConfirm: (String, String) -> Unit
) {
    var player1Id by remember { mutableStateOf<String?>(null) }
    var player2Id by remember { mutableStateOf<String?>(null) }

    val pairedPlayerIds = existingPairs.flatMap { listOf(it.player1Id, it.player2Id) }.toSet()
    val availablePlayers = players.filter { it.id !in pairedPlayerIds }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.keep_together)) },
        text = {
            Column {
                Text(
                    text = stringResource(R.string.keep_together_description),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                Spacer(Modifier.height(12.dp))

                Text(
                    text = stringResource(R.string.player_1),
                    style = MaterialTheme.typography.labelMedium
                )
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(vertical = 8.dp)
                ) {
                    items(availablePlayers) { player ->
                        val isSelected = player1Id == player.id
                        val isDisabled = player2Id == player.id

                        FilterChip(
                            selected = isSelected,
                            onClick = { if (!isDisabled) player1Id = player.id },
                            label = { Text(player.name.split(" ").firstOrNull() ?: player.name) },
                            enabled = !isDisabled
                        )
                    }
                }

                Text(
                    text = stringResource(R.string.player_2),
                    style = MaterialTheme.typography.labelMedium
                )
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(vertical = 8.dp)
                ) {
                    items(availablePlayers) { player ->
                        val isSelected = player2Id == player.id
                        val isDisabled = player1Id == player.id

                        FilterChip(
                            selected = isSelected,
                            onClick = { if (!isDisabled) player2Id = player.id },
                            label = { Text(player.name.split(" ").firstOrNull() ?: player.name) },
                            enabled = !isDisabled
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (player1Id != null && player2Id != null) {
                        onConfirm(player1Id!!, player2Id!!)
                    }
                },
                enabled = player1Id != null && player2Id != null
            ) {
                Text(stringResource(R.string.add))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.cancel))
            }
        }
    )
}

@Composable
private fun SaveFormationDialog(
    onDismiss: () -> Unit,
    onSave: (String) -> Unit
) {
    var name by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.save_formation)) },
        text = {
            OutlinedTextField(
                value = name,
                onValueChange = { name = it },
                label = { Text(stringResource(R.string.formation_name)) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
        },
        confirmButton = {
            Button(
                onClick = { onSave(name) },
                enabled = name.isNotBlank()
            ) {
                Text(stringResource(R.string.save))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.cancel))
            }
        }
    )
}

@Composable
private fun SavedFormationsListDialog(
    formations: List<SavedTeamFormation>,
    onDismiss: () -> Unit,
    onLoad: (String) -> Unit,
    onDelete: (String) -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = stringResource(R.string.saved_formations),
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )

                Spacer(Modifier.height(16.dp))

                if (formations.isEmpty()) {
                    Text(
                        text = stringResource(R.string.no_saved_formations),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.heightIn(max = 300.dp)
                    ) {
                        items(formations) { formation ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = formation.name,
                                        style = MaterialTheme.typography.bodyLarge,
                                        fontWeight = FontWeight.Medium
                                    )
                                    Text(
                                        text = stringResource(
                                            R.string.times_used,
                                            formation.timesUsed
                                        ),
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }

                                Row {
                                    IconButton(onClick = { onLoad(formation.id) }) {
                                        Icon(
                                            Icons.Default.PlayArrow,
                                            stringResource(R.string.load)
                                        )
                                    }
                                    IconButton(onClick = { onDelete(formation.id) }) {
                                        Icon(
                                            Icons.Default.Delete,
                                            stringResource(R.string.delete),
                                            tint = MaterialTheme.colorScheme.error
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                Spacer(Modifier.height(16.dp))

                TextButton(
                    onClick = onDismiss,
                    modifier = Modifier.align(Alignment.End)
                ) {
                    Text(stringResource(R.string.close))
                }
            }
        }
    }
}

@Composable
private fun DraftSettingsDialog(
    settings: DraftSettings,
    onDismiss: () -> Unit,
    onSave: (DraftSettings) -> Unit
) {
    var considerPositions by remember { mutableStateOf(settings.considerPositions) }
    var goalkeepersPerTeam by remember { mutableStateOf(settings.goalkeepersPerTeam) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.draft_settings)) },
        text = {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(stringResource(R.string.consider_positions))
                    Switch(
                        checked = considerPositions,
                        onCheckedChange = { considerPositions = it }
                    )
                }

                Spacer(Modifier.height(16.dp))

                Text(stringResource(R.string.goalkeepers_per_team))
                Spacer(Modifier.height(8.dp))
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    (0..2).forEach { num ->
                        FilterChip(
                            selected = goalkeepersPerTeam == num,
                            onClick = { goalkeepersPerTeam = num },
                            label = { Text("$num") }
                        )
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onSave(
                        settings.copy(
                            considerPositions = considerPositions,
                            goalkeepersPerTeam = goalkeepersPerTeam
                        )
                    )
                }
            ) {
                Text(stringResource(R.string.save))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.cancel))
            }
        }
    )
}
