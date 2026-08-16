package com.futebadosparcas.ui.games

import android.Manifest
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.*
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Place
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil3.compose.AsyncImage
import com.futebadosparcas.domain.model.*
import com.futebadosparcas.ui.components.EmptyState
import com.futebadosparcas.ui.components.EmptyStateType
import com.futebadosparcas.ui.components.ShimmerBox
import com.futebadosparcas.util.ShareCardHelper
import com.futebadosparcas.ui.components.CachedProfileImage
import com.futebadosparcas.ui.components.design.AppTopBar
import com.futebadosparcas.ui.components.team.TeamBadgeById
import com.futebadosparcas.ui.games.components.WaitlistSection
import com.futebadosparcas.ui.games.components.GameChatSection
import com.futebadosparcas.ui.games.components.GameCommentsSection
import com.futebadosparcas.ui.games.components.GameVideosSection
import com.futebadosparcas.ui.adaptive.adaptiveContentWidth
import com.futebadosparcas.ui.theme.MatchEventColors
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GameDetailScreen(
    viewModel: GameDetailViewModel,
    gameId: String,
    onNavigateBack: () -> Unit,
    onNavigateToCreateGame: (String) -> Unit,
    onNavigateToMvpVote: (String) -> Unit,
    onNavigateToTacticalBoard: () -> Unit,
    onNavigateToLiveGame: () -> Unit = {},
    onNavigateToLocation: (String) -> Unit = {}
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }

    // Launchers
    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            getLastLocationAndStartGame(context, viewModel, gameId)
        }
    }

    // Load Data
    LaunchedEffect(gameId) {
        viewModel.loadGameDetails(gameId)
    }

    val successState = uiState as? GameDetailUiState.Success
    val schedulingEvent = successState?.schedulingEvent
    val userMessage = successState?.userMessageResId?.let { context.getString(it) } ?: successState?.userMessage
    val canRetryLastMutation = successState?.canRetryLastMutation == true
    val isGameDeleted = uiState is GameDetailUiState.GameDeleted
    val gameDeletedMessage = stringResource(R.string.game_detail_deleted_success)

    // Effect for automated scheduling event feedback
    LaunchedEffect(schedulingEvent, userMessage, canRetryLastMutation, isGameDeleted, gameDeletedMessage) {
        if (successState != null) {
            schedulingEvent?.let { event ->
                val message = when (event) {
                    is SchedulingEvent.Success -> context.getString(R.string.next_game_scheduled, event.nextDate)
                    is SchedulingEvent.Conflict -> context.getString(R.string.scheduling_conflict, event.date)
                    is SchedulingEvent.Error -> context.getString(R.string.scheduling_error, event.message)
                }
                snackbarHostState.showSnackbar(message)
                viewModel.clearSchedulingEvent()
            }
            userMessage?.let { message ->
                val result = snackbarHostState.showSnackbar(
                    message = message,
                    actionLabel = if (canRetryLastMutation) context.getString(R.string.retry) else null,
                    duration = if (canRetryLastMutation) SnackbarDuration.Long else SnackbarDuration.Short
                )
                viewModel.clearUserMessage()
                if (result == SnackbarResult.ActionPerformed) {
                    viewModel.retryLastMutation()
                }
            }
        }
        if (isGameDeleted) {
            snackbarHostState.showSnackbar(gameDeletedMessage)
            onNavigateBack()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            if (uiState is GameDetailUiState.Success) {
                val state = uiState as GameDetailUiState.Success
                GameDetailTopBar(
                    game = state.game,
                    hasTeams = state.teams.isNotEmpty(),
                    hasVoted = state.hasVoted,
                    onBackClick = onNavigateBack,
                    onInviteWhatsApp = { inviteToWhatsApp(context, state, context.getString(R.string.whatsapp_invite_title)) },
                    onShare = { shareGameDetails(context, state, context.getString(R.string.game_at), context.getString(R.string.share)) },
                    onVoteMvp = { onNavigateToMvpVote(gameId) },
                    onShareCard = { generateAndShareCard(context, state) },
                    onTacticalBoard = onNavigateToTacticalBoard
                )
            } else {
                // TopBar padrão para loading/error
                TopAppBar(
                    title = { Text(stringResource(R.string.game_details)) },
                    navigationIcon = {
                        IconButton(onClick = onNavigateBack) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.back))
                        }
                    },
                    colors = AppTopBar.surfaceColors()
                )
            }
        }
    ) { paddingValues ->
        Box(modifier = Modifier.padding(paddingValues).fillMaxSize()) {
            when (val state = uiState) {
                is GameDetailUiState.Loading -> {
                    GameDetailLoadingState()
                }
                is GameDetailUiState.Error -> {
                    EmptyState(
                        type = EmptyStateType.Error(
                            title = stringResource(R.string.error),
                            // Prefere resId i18n; cai para a string crua (legado)
                            description = state.errorResId?.let { stringResource(it) } ?: state.message,
                            actionLabel = stringResource(R.string.retry),
                            onRetry = { viewModel.loadGameDetails(gameId) }
                        )
                    )
                }
                is GameDetailUiState.Success -> {
                    GameDetailContent(
                        state = state,
                        viewModel = viewModel,
                        gameId = gameId,
                        onStartGame = {
                            locationPermissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
                        },
                        onEditGame = { onNavigateToCreateGame(gameId) },
                        onEditTeams = { },
                        onNavigateToMvpVote = { onNavigateToMvpVote(gameId) },
                        onNavigateToLocation = onNavigateToLocation,
                        onNavigateToLiveGame = onNavigateToLiveGame
                    )
                }
                is GameDetailUiState.GameDeleted -> {
                    // Handled in LaunchedEffect
                }
                else -> {}
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GameDetailTopBar(
    game: Game,
    hasTeams: Boolean,
    hasVoted: Boolean?,
    onBackClick: () -> Unit,
    onInviteWhatsApp: () -> Unit,
    onShare: () -> Unit,
    onVoteMvp: () -> Unit,
    onShareCard: () -> Unit,
    onTacticalBoard: () -> Unit
) {
    var showMenu by remember { mutableStateOf(false) }
    val votingPresentation = resolveGameDetailVotingPresentation(game.status, hasVoted)

    TopAppBar(
        title = { Text(stringResource(R.string.game_details)) },
        navigationIcon = {
            IconButton(onClick = onBackClick) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.back))
            }
        },
        actions = {
            IconButton(onClick = onInviteWhatsApp) {
                Icon(painterResource(R.drawable.ic_whatsapp), contentDescription = stringResource(R.string.invite_whatsapp), tint = com.futebadosparcas.ui.theme.BrandColors.WhatsApp)
            }
            // Box para ancorar o DropdownMenu ao IconButton
            Box {
                IconButton(onClick = { showMenu = true }) {
                    Icon(Icons.Default.MoreVert, contentDescription = stringResource(R.string.more_options))
                }
                DropdownMenu(expanded = showMenu, onDismissRequest = { showMenu = false }) {
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.share_link)) },
                        onClick = { onShare(); showMenu = false },
                        leadingIcon = { Icon(Icons.Outlined.Share, stringResource(R.string.share)) }
                    )
                    if (votingPresentation != null) {
                        DropdownMenuItem(
                            text = {
                                Text(
                                    stringResource(
                                        if (votingPresentation == GameDetailVotingPresentation.COMPLETED) {
                                            R.string.game_detail_vote_completed_title
                                        } else {
                                            R.string.vote_mvp
                                        }
                                    )
                                )
                            },
                            onClick = { onVoteMvp(); showMenu = false },
                            leadingIcon = {
                                Icon(
                                    imageVector = if (votingPresentation == GameDetailVotingPresentation.COMPLETED) {
                                        Icons.Default.CheckCircle
                                    } else {
                                        Icons.Default.Star
                                    },
                                    contentDescription = null,
                                    tint = if (votingPresentation == GameDetailVotingPresentation.COMPLETED) {
                                        MaterialTheme.colorScheme.primary
                                    } else {
                                        MaterialTheme.colorScheme.tertiary
                                    }
                                )
                            }
                        )
                        if (hasTeams) {
                            DropdownMenuItem(
                                text = { Text(stringResource(R.string.generate_game_card)) },
                                onClick = { onShareCard(); showMenu = false },
                                leadingIcon = { Icon(Icons.Default.Share, stringResource(R.string.card)) }
                            )
                        }
                    }
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.tactical_board)) },
                        onClick = { onTacticalBoard(); showMenu = false },
                        leadingIcon = { Icon(Icons.Default.Create, stringResource(R.string.tactical_board)) }
                    )
                }
            }
        },
        colors = AppTopBar.surfaceColors()
    )
}

@Composable
fun GameDetailContent(
    state: GameDetailUiState.Success,
    viewModel: GameDetailViewModel,
    gameId: String,
    onStartGame: () -> Unit,
    onEditGame: () -> Unit,
    onEditTeams: () -> Unit,
    onNavigateToMvpVote: () -> Unit,
    onNavigateToLocation: (String) -> Unit,
    onNavigateToLiveGame: () -> Unit
) {
    var showCancelDialog by remember { mutableStateOf(false) }
    var showGenerateTeamsDialog by remember { mutableStateOf(false) }
    var showFinishGameDialog by remember { mutableStateOf(false) }
    var showPositionDialog by remember { mutableStateOf(false) }
    var showMovePlayerDialog by remember { mutableStateOf<Pair<String,String>?>(null) }
    var playerPendingRemoval by remember { mutableStateOf<GameConfirmation?>(null) }

    val waitlistState = state.waitlistState

    if (showCancelDialog) {
        AlertDialog(
            onDismissRequest = { showCancelDialog = false },
            title = { Text(stringResource(R.string.game_detail_delete_game)) },
            text = { Text(stringResource(R.string.game_detail_delete_confirmation)) },
            confirmButton = {
                TextButton(
                    onClick = { viewModel.deleteGame(gameId); showCancelDialog = false },
                    colors = ButtonDefaults.textButtonColors(
                        contentColor = MaterialTheme.colorScheme.error
                    )
                ) {
                    Text(stringResource(R.string.delete))
                }
            },
            dismissButton = {
                TextButton(onClick = { showCancelDialog = false }) {
                    Text(stringResource(R.string.cancel))
                }
            }
        )
    }

    if (showPositionDialog) {
        PositionSelectionDialog(
            state = state,
            onDismiss = { showPositionDialog = false },
            onConfirm = { position ->
                viewModel.confirmPresenceWithPosition(gameId, position)
                showPositionDialog = false
            }
        )
    }

    playerPendingRemoval?.let { confirmation ->
        val isRemoving = confirmation.userId in state.removingPlayerIds
        AlertDialog(
            onDismissRequest = {
                if (!isRemoving) playerPendingRemoval = null
            },
            title = { Text(stringResource(R.string.game_detail_remove_player_title)) },
            text = {
                Text(stringResource(R.string.game_detail_remove_player_message, confirmation.userName))
            },
            confirmButton = {
                TextButton(
                    enabled = !isRemoving,
                    onClick = { viewModel.removePlayer(gameId, confirmation.userId) }
                ) {
                    if (isRemoving) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(stringResource(R.string.game_detail_removing_player))
                    } else {
                        Text(stringResource(R.string.remove_player))
                    }
                }
            },
            dismissButton = {
                TextButton(
                    enabled = !isRemoving,
                    onClick = { playerPendingRemoval = null }
                ) {
                    Text(stringResource(R.string.cancel))
                }
            }
        )
    }

    LaunchedEffect(
        playerPendingRemoval?.userId,
        state.confirmations,
        state.removingPlayerIds
    ) {
        val target = playerPendingRemoval ?: return@LaunchedEffect
        val removalFinished = target.userId !in state.removingPlayerIds
        val playerWasRemoved = state.confirmations.none { it.userId == target.userId }
        if (removalFinished && playerWasRemoved) {
            playerPendingRemoval = null
        }
    }

    if (showGenerateTeamsDialog) {
        GenerateTeamsDialog(
            onDismiss = { showGenerateTeamsDialog = false },
            onGenerate = { count, balanced ->
                viewModel.generateTeams(gameId, count, balanced)
                showGenerateTeamsDialog = false
            },
            onClear = {
                viewModel.clearTeams(gameId)
                showGenerateTeamsDialog = false
            }
        )
    }

    if (showFinishGameDialog) {
        FinishGameDialog(
            state = state,
            onDismiss = { showFinishGameDialog = false },
            onFinish = { scoreA, scoreB, mvpId ->
                viewModel.finishGame(gameId, scoreA, scoreB, mvpId)
                showFinishGameDialog = false
            }
        )
    }

    showMovePlayerDialog?.let { (playerId, sourceTeamId) ->
        MovePlayerDialog(
            state = state,
            playerId = playerId,
            sourceTeamId = sourceTeamId,
            onDismiss = { showMovePlayerDialog = null },
            onMove = { targetTeamId ->
                viewModel.movePlayer(playerId, sourceTeamId, targetTeamId)
                showMovePlayerDialog = null
            }
        )
    }

    Box(modifier = Modifier.fillMaxSize()) {
        LazyColumn(
            modifier = Modifier.adaptiveContentWidth(),
            contentPadding = PaddingValues(bottom = 16.dp)
        ) {
            // Header
            item {
                Column {
                    GameHeaderSection(
                        game = state.game,
                        canManage = state.canManageGame,
                        confirmedCount = state.confirmations.count { it.status == "CONFIRMED" },
                        onEdit = onEditGame,
                        onCancel = { showCancelDialog = true },
                        onToggleStatus = { viewModel.toggleGameStatus(gameId, it) },
                        onStart = onStartGame,
                        onFinish = { showFinishGameDialog = true },
                        onLocationClick = { onNavigateToLocation(state.game.locationId) },
                        onGenerateTeams = { showGenerateTeamsDialog = true }
                    )
                    GameValidationStatusCard(
                        game = state.game,
                        canManageGame = state.canManageGame,
                        isAdmin = state.isAdmin
                    )
                }
            }

            // Live Match Section
            if (state.game.status == "LIVE" || state.game.status == "FINISHED") {
                item {
                    LiveMatchSection(
                        state = state,
                        onAddEvent = { onNavigateToLiveGame() },
                        onOpenLiveGame = onNavigateToLiveGame,
                        onDeleteEvent = { viewModel.deleteGameEvent(it) }
                    )
                }
            }

            resolveGameDetailVotingPresentation(state.game.status, state.hasVoted)?.let { presentation ->
                item {
                    PostGameVotingCard(
                        presentation = presentation,
                        onVoteClick = onNavigateToMvpVote
                    )
                }
            }

            // Teams Section
            if (state.teams.isNotEmpty()) {
                item {
                    Text(
                        stringResource(R.string.teams),
                        style = MaterialTheme.typography.titleLarge,
                        modifier = Modifier.padding(16.dp)
                    )
                }
                items(state.teams, key = { it.id }) { team ->
                    TeamCard(
                        team = team,
                        players = state.confirmations.filter { it.userId in team.playerIds },
                        canManage = state.canManageGame,
                        onPlayerClick = { playerId ->
                            if (state.canManageGame) {
                                showMovePlayerDialog = playerId to team.id
                            }
                        }
                    )
                }
            }

            // Confirmations Section
            item {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(stringResource(R.string.attendance_list), style = MaterialTheme.typography.titleLarge)
                    Text("${state.confirmations.size}/${state.game.maxPlayers}")
                }
            }

            // Lista de espera (Issue #1136): renderiza secao com estado vindo do VM.
            // O componente decide internamente se exibe (jogo cheio + canConfirm, ou lista nao vazia).
            item {
                val confirmedCount = state.confirmations.count { it.status == "CONFIRMED" }
                val gameFull = confirmedCount >= state.game.maxPlayers
                val canConfirm = !state.isUserConfirmed && !state.isUserPending && state.currentUserId != null

                WaitlistSection(
                    waitlistState = waitlistState,
                    currentUserId = state.currentUserId,
                    gameFull = gameFull,
                    canConfirm = canConfirm,
                    onJoinWaitlist = { viewModel.addToWaitlist(gameId, "ANY") },
                    onLeaveWaitlist = { viewModel.removeFromWaitlist(gameId) },
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                )
            }

            items(state.confirmations, key = { it.userId }) { confirmation ->
                ConfirmationCard(
                    confirmation = confirmation,
                    isOwner = state.canManageGame,
                    currentUserId = state.currentUserId,
                    onPaymentClick = {
                        if (state.canManageGame && confirmation.userId != state.currentUserId) {
                            viewModel.togglePaymentStatus(gameId, confirmation.userId, confirmation.paymentStatus)
                        }
                    },
                    onRemoveClick = { playerPendingRemoval = confirmation },
                    isRemoving = confirmation.userId in state.removingPlayerIds,
                    isPresenceSubmitting = state.isPresenceSubmitting,
                    onAcceptClick = {
                        showPositionDialog = true
                    },
                    onDeclineClick = { viewModel.declineInvitation(gameId) }
                )
            }

            // Issue #3230: Chat em tempo real por jogo (épico #3240)
            item {
                val now = System.currentTimeMillis()
                val gameTs = state.game.dateTimeRaw
                val isChatArchived = gameTs > 0 && (now - gameTs) > 7 * 24 * 60 * 60 * 1000L
                val canWriteChat = (state.isUserConfirmed || state.canManageGame) && !isChatArchived
                GameChatSection(
                    gameId = gameId,
                    canWrite = canWriteChat,
                    isArchived = isChatArchived,
                    currentUserId = state.currentUserId,
                    canManage = state.canManageGame,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                )
                GameCommentsSection(
                    gameId = gameId,
                    canWrite = state.isUserConfirmed || state.canManageGame,
                    currentUserId = state.currentUserId,
                    canManage = state.canManageGame,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                )
                GameVideosSection(
                    gameId = gameId,
                    canUpload = state.game.status == GameStatus.FINISHED.name &&
                        (state.isUserConfirmed || state.canManageGame),
                    currentUserId = state.currentUserId,
                    canManage = state.canManageGame,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                )
            }
        }

        // Floating Button for Main Action
        Box(modifier = Modifier.align(Alignment.BottomCenter)) {
            Button(
                onClick = {
                    if (state.isUserConfirmed) {
                        viewModel.toggleConfirmation(gameId)
                    } else {
                        showPositionDialog = true
                    }
                },
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (state.isUserConfirmed) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
                ),
                enabled = !state.isPresenceSubmitting,
                modifier = Modifier.padding(16.dp).fillMaxWidth().height(56.dp),
                shape = RoundedCornerShape(16.dp)
            ) {
                if (state.isPresenceSubmitting) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(22.dp),
                        strokeWidth = 2.dp,
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                }
                Text(
                    text = when {
                        state.isPresenceSubmitting -> stringResource(R.string.game_detail_updating_presence)
                        state.isUserConfirmed -> stringResource(R.string.cancel_presence)
                        state.isUserPending -> stringResource(R.string.accept_invite)
                        else -> stringResource(R.string.confirm_presence)
                    },
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

// --- Specific Composables ---

private data class ValidationBannerUi(
    val titleResId: Int,
    val bodyResId: Int,
    val containerColor: Color,
    val contentColor: Color,
)

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun GameValidationStatusCard(
    game: Game,
    canManageGame: Boolean,
    isAdmin: Boolean,
) {
    if (game.status != GameStatus.FINISHED.name) return

    val rewardStatus = game.xpRewardStatus
    val validationStatus = game.validationStatus
    val reasons = remember(game.validationReasons, game.xpRewardHoldReasons) {
        (game.xpRewardHoldReasons.ifEmpty { game.validationReasons })
            .filter { it.isNotBlank() }
            .distinct()
    }

    val banner = when {
        rewardStatus == "HELD_FOR_REVIEW" -> ValidationBannerUi(
            titleResId = R.string.validation_banner_title_held,
            bodyResId = if (isAdmin || canManageGame) {
                R.string.validation_banner_body_held_admin
            } else {
                R.string.validation_banner_body_held_player
            },
            containerColor = MaterialTheme.colorScheme.errorContainer,
            contentColor = MaterialTheme.colorScheme.onErrorContainer,
        )
        rewardStatus == "REJECTED_BY_ADMIN" -> ValidationBannerUi(
            titleResId = R.string.validation_banner_title_rejected,
            bodyResId = R.string.validation_banner_body_rejected,
            containerColor = MaterialTheme.colorScheme.errorContainer,
            contentColor = MaterialTheme.colorScheme.onErrorContainer,
        )
        rewardStatus == "ELIGIBLE" && game.xpRewardReviewDecision == "APPROVED" -> ValidationBannerUi(
            titleResId = R.string.validation_banner_title_approved,
            bodyResId = R.string.validation_banner_body_approved,
            containerColor = MaterialTheme.colorScheme.secondaryContainer,
            contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
        )
        validationStatus == "REVIEW_REQUIRED" -> ValidationBannerUi(
            titleResId = R.string.validation_banner_title_review_required,
            bodyResId = R.string.validation_banner_body_review_required,
            containerColor = MaterialTheme.colorScheme.errorContainer,
            contentColor = MaterialTheme.colorScheme.onErrorContainer,
        )
        validationStatus == "LOW_CONFIDENCE" -> ValidationBannerUi(
            titleResId = R.string.validation_banner_title_low_confidence,
            bodyResId = R.string.validation_banner_body_low_confidence,
            containerColor = MaterialTheme.colorScheme.tertiaryContainer,
            contentColor = MaterialTheme.colorScheme.onTertiaryContainer,
        )
        validationStatus == "VALIDATED" -> ValidationBannerUi(
            titleResId = R.string.validation_banner_title_validated,
            bodyResId = R.string.validation_banner_body_validated,
            containerColor = MaterialTheme.colorScheme.primaryContainer,
            contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
        )
        else -> null
    } ?: return

    Card(
        modifier = Modifier
            .padding(horizontal = 16.dp)
            .fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = banner.containerColor
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = when (rewardStatus) {
                        "HELD_FOR_REVIEW", "REJECTED_BY_ADMIN" -> Icons.Default.Warning
                        "ELIGIBLE" -> Icons.Default.CheckCircle
                        else -> Icons.Default.Verified
                    },
                    contentDescription = null,
                    tint = banner.contentColor
                )
                Text(
                    text = stringResource(banner.titleResId),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = banner.contentColor
                )
            }

            Text(
                text = stringResource(banner.bodyResId),
                style = MaterialTheme.typography.bodyMedium,
                color = banner.contentColor
            )

            if (game.validationScore != null || validationStatus != null) {
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    validationStatus?.let {
                        AssistChip(
                            onClick = {},
                            enabled = false,
                            label = { Text(it) }
                        )
                    }
                    game.validationScore?.let {
                        AssistChip(
                            onClick = {},
                            enabled = false,
                            label = { Text(stringResource(R.string.validation_score_chip, it)) }
                        )
                    }
                }
            }

            if (reasons.isNotEmpty()) {
                Text(
                    text = stringResource(R.string.validation_reasons_label),
                    style = MaterialTheme.typography.labelLarge,
                    color = banner.contentColor
                )
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    reasons.forEach { reason ->
                        AssistChip(
                            onClick = {},
                            enabled = false,
                            label = { Text(reason) }
                        )
                    }
                }
            }

            game.xpRewardReviewReason?.takeIf { it.isNotBlank() }?.let { reviewReason ->
                Text(
                    text = stringResource(R.string.validation_review_reason_prefix, reviewReason),
                    style = MaterialTheme.typography.bodySmall,
                    color = banner.contentColor
                )
            }
        }
    }
}

@Composable
fun GameHeaderSection(
    game: Game,
    canManage: Boolean,
    confirmedCount: Int,
    onEdit: () -> Unit,
    onCancel: () -> Unit,
    onToggleStatus: (Boolean) -> Unit,
    onStart: () -> Unit,
    onFinish: () -> Unit,
    onLocationClick: () -> Unit,
    onGenerateTeams: () -> Unit
) {
    Card(
        modifier = Modifier.padding(16.dp).fillMaxWidth(),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text(game.date, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Text(
                    text = if (game.time.isEmpty()) "--:--" else game.time,
                    style = MaterialTheme.typography.headlineSmall,
                    color = if (game.time.isEmpty()) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface
                )
            }
            Spacer(modifier = Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Place, contentDescription = stringResource(R.string.create_game_cd_location_icon), tint = MaterialTheme.colorScheme.primary)
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = game.locationName,
                    style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier
                        .minimumInteractiveComponentSize()
                        .clickable(
                            enabled = game.locationId.isNotBlank(),
                            onClick = onLocationClick
                        )
                        .padding(horizontal = 4.dp)
                )
            }
            if (game.fieldName.isNotEmpty()) {
                Text(stringResource(R.string.field_field, game.fieldName), style = MaterialTheme.typography.bodyMedium)
            }
            Spacer(modifier = Modifier.height(16.dp))

            if (canManage) {
                Row(horizontalArrangement = Arrangement.SpaceEvenly, modifier = Modifier.fillMaxWidth()) {
                    FilledTonalButton(onClick = onEdit) {
                        Icon(Icons.Outlined.Edit, contentDescription = stringResource(R.string.edit))
                        Spacer(Modifier.width(4.dp))
                        Text(stringResource(R.string.edit), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    // startGameLifecycle aceita somente CONFIRMED: a lista deve
                    // ser fechada antes de a partida entrar em LIVE.
                    if (game.status == "CONFIRMED") {
                        FilledTonalButton(
                            onClick = onStart,
                            colors = ButtonDefaults.filledTonalButtonColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)
                        ) {
                            Text(stringResource(R.string.start_game), maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                    if (game.status == "LIVE") {
                        Button(
                            onClick = onFinish,
                            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
                        ) {
                            Text(stringResource(R.string.finish), maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Switch(checked = game.status == "CONFIRMED", onCheckedChange = onToggleStatus)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = if (game.status == "CONFIRMED") stringResource(R.string.list_closed) else stringResource(R.string.list_open),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                TextButton(onClick = onGenerateTeams) {
                    Text(stringResource(R.string.generate_teams), maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                TextButton(
                    onClick = onCancel,
                    colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)
                ) {
                    Text(stringResource(R.string.game_detail_delete_game), maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }
    }
}

internal enum class GameDetailVotingPresentation {
    PENDING,
    COMPLETED
}

internal fun resolveGameDetailVotingPresentation(
    gameStatus: String,
    hasVoted: Boolean?
): GameDetailVotingPresentation? {
    if (gameStatus != GameStatus.FINISHED.name) return null
    return if (hasVoted == true) {
        GameDetailVotingPresentation.COMPLETED
    } else {
        GameDetailVotingPresentation.PENDING
    }
}

@Composable
internal fun PostGameVotingCard(
    presentation: GameDetailVotingPresentation,
    onVoteClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isCompleted = presentation == GameDetailVotingPresentation.COMPLETED
    val containerColor = if (isCompleted) {
        MaterialTheme.colorScheme.secondaryContainer
    } else {
        MaterialTheme.colorScheme.primaryContainer
    }
    val contentColor = if (isCompleted) {
        MaterialTheme.colorScheme.onSecondaryContainer
    } else {
        MaterialTheme.colorScheme.onPrimaryContainer
    }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        colors = CardDefaults.cardColors(
            containerColor = containerColor,
            contentColor = contentColor
        )
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = if (isCompleted) Icons.Default.CheckCircle else Icons.Default.Star,
                contentDescription = null,
                tint = contentColor
            )
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text(
                    text = stringResource(
                        if (isCompleted) {
                            R.string.game_detail_vote_completed_title
                        } else {
                            R.string.game_detail_vote_pending_title
                        }
                    ),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = stringResource(
                        if (isCompleted) {
                            R.string.game_detail_vote_completed_description
                        } else {
                            R.string.game_detail_vote_pending_description
                        }
                    ),
                    style = MaterialTheme.typography.bodyMedium
                )
            }
            if (!isCompleted) {
                Button(onClick = onVoteClick) {
                    Text(stringResource(R.string.game_detail_vote_now))
                }
            }
        }
    }
}

@Composable
fun ConfirmationCard(
    confirmation: GameConfirmation,
    isOwner: Boolean,
    currentUserId: String?,
    onPaymentClick: () -> Unit,
    onRemoveClick: () -> Unit,
    isRemoving: Boolean,
    isPresenceSubmitting: Boolean,
    onAcceptClick: () -> Unit,
    onDeclineClick: () -> Unit
) {
    Card(
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp).fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            CachedProfileImage(
                photoUrl = confirmation.userPhoto,
                userName = confirmation.userName,
                size = 40.dp
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(confirmation.userName, fontWeight = FontWeight.SemiBold)
                    Spacer(modifier = Modifier.width(4.dp))
                    TeamBadgeById(
                        teamId = confirmation.teamId,
                        iconSize = 18
                    )
                }
                Text(confirmation.position, style = MaterialTheme.typography.bodySmall)
            }

            if (currentUserId == confirmation.userId && confirmation.status == "PENDING") {
                IconButton(onClick = onAcceptClick, enabled = !isPresenceSubmitting) {
                    Icon(Icons.Default.Check, contentDescription = stringResource(R.string.accept), tint = MaterialTheme.colorScheme.primary)
                }
                IconButton(onClick = onDeclineClick, enabled = !isPresenceSubmitting) {
                    Icon(Icons.Default.Close, contentDescription = stringResource(R.string.decline), tint = MaterialTheme.colorScheme.error)
                }
            } else {
                if (isOwner || currentUserId == confirmation.userId) {
                    val payColor = if (confirmation.paymentStatus == "PAID")
                        com.futebadosparcas.ui.theme.BrandColors.WhatsApp else MaterialTheme.colorScheme.onSurfaceVariant
                    IconButton(onClick = onPaymentClick) {
                        Icon(painterResource(R.drawable.ic_money), contentDescription = stringResource(R.string.payment), tint = payColor)
                    }
                }
                if (isOwner) {
                    IconButton(onClick = onRemoveClick, enabled = !isRemoving) {
                        if (isRemoving) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                        } else {
                            Icon(Icons.Outlined.Delete, contentDescription = stringResource(R.string.action_remove), tint = MaterialTheme.colorScheme.error)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun TeamCard(
    team: Team,
    players: List<GameConfirmation>,
    canManage: Boolean,
    onPlayerClick: (String) -> Unit
) {
    Card(modifier = Modifier.padding(16.dp).fillMaxWidth()) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text(team.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(stringResource(R.string.goals_count, team.score), style = MaterialTheme.typography.titleMedium)
            }
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            // Usa Column + forEach para evitar LazyColumn aninhado dentro de LazyColumn
            Column(modifier = Modifier.fillMaxWidth()) {
                players.forEach { player ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .heightIn(min = 48.dp)
                            .clickable(enabled = canManage) { onPlayerClick(player.userId) }
                            .padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                            Text(player.userName)
                            Spacer(modifier = Modifier.width(4.dp))
                            TeamBadgeById(
                                teamId = player.teamId,
                                iconSize = 18
                            )
                        }
                        if (player.goals > 0) {
                            Text("⚽ ${player.goals} ", style = MaterialTheme.typography.labelMedium)
                        }
                    }
                }
            }
        }
    }
}

// --- Helper Functions ---
private fun getLastLocationAndStartGame(context: Context, viewModel: GameDetailViewModel, gameId: String) {
    try {
        val client = LocationServices.getFusedLocationProviderClient(context)
        client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
            .addOnSuccessListener { location ->
                if (location != null) {
                    if (isMockLocation(location)) {
                        viewModel.startGame(gameId, null, null)
                    } else {
                        viewModel.startGame(gameId, location.latitude, location.longitude)
                    }
                } else {
                    client.lastLocation.addOnSuccessListener { last ->
                        if (last != null && isMockLocation(last)) {
                            viewModel.startGame(gameId, null, null)
                        } else {
                            viewModel.startGame(gameId, last?.latitude, last?.longitude)
                        }
                    }
                }
            }
            .addOnFailureListener {
                viewModel.startGame(gameId, null, null)
            }
    } catch (e: SecurityException) {
        viewModel.startGame(gameId, null, null)
    }
}

private fun isMockLocation(location: android.location.Location): Boolean {
    return if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
        location.isMock
    } else {
        @Suppress("DEPRECATION")
        location.isFromMockProvider
    }
}

fun inviteToWhatsApp(context: Context, state: GameDetailUiState.Success, inviteTitle: String) {
    val message = context.getString(R.string.invite_whatsapp_message, inviteTitle, state.game.date, state.game.time, state.game.locationName)
    try {
        val intent = Intent(Intent.ACTION_VIEW).apply {
            data = Uri.parse("https://wa.me/?text=${Uri.encode(message)}")
        }
        context.startActivity(intent)
    } catch (e: Exception) {
        // Fallback
    }
}

fun shareGameDetails(context: Context, state: GameDetailUiState.Success, gameAt: String, share: String) {
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, context.getString(R.string.share_game_at_location, gameAt, state.game.locationName))
    }
    context.startActivity(Intent.createChooser(intent, share))
}

fun generateAndShareCard(context: Context, state: GameDetailUiState.Success) {
    val team1 = state.teams.getOrNull(0)
    val team2 = state.teams.getOrNull(1)
    if (team1 != null && team2 != null) {
        val goals = state.events.filter { it.eventType == "GOAL" }
        val s1 = goals.count { it.teamId == team1.id }
        val s2 = goals.count { it.teamId == team2.id }
        ShareCardHelper.shareGameResult(context, state.game, team1.name, team2.name, s1, s2)
    }
}

@Composable
fun PositionSelectionDialog(
    state: GameDetailUiState.Success,
    onDismiss: () -> Unit,
    onConfirm: (PlayerPosition) -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.select_position)) },
        text = {
            Column {
                Button(onClick = { onConfirm(PlayerPosition.GOALKEEPER) }, modifier = Modifier.fillMaxWidth()) {
                    Text(stringResource(R.string.goalkeeper))
                }
                Spacer(modifier = Modifier.height(8.dp))
                Button(onClick = { onConfirm(PlayerPosition.LINE) }, modifier = Modifier.fillMaxWidth()) {
                    Text(stringResource(R.string.field_player))
                }
            }
        },
        confirmButton = {}
    )
}

@Composable
fun GenerateTeamsDialog(
    onDismiss: () -> Unit,
    onGenerate: (Int, Boolean) -> Unit,
    onClear: () -> Unit
) {
    var selectedTeams by remember { mutableIntStateOf(2) }
    var balanced by remember { mutableStateOf(true) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.generate_teams)) },
        text = {
            Column {
                Text(stringResource(R.string.how_many_teams))
                Row {
                    listOf(2, 3, 4).forEach { num ->
                        FilterChip(
                            selected = selectedTeams == num,
                            onClick = { selectedTeams = num },
                            label = { Text("$num") },
                            modifier = Modifier.padding(horizontal = 4.dp)
                        )
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = balanced, onCheckedChange = { balanced = it })
                    Text(stringResource(R.string.balance_by_skill))
                }
            }
        },
        confirmButton = {
            Button(onClick = { onGenerate(selectedTeams, balanced) }) {
                Text(stringResource(R.string.generate))
            }
        },
        dismissButton = {
            TextButton(onClick = onClear) {
                Text(stringResource(R.string.clear_teams))
            }
        }
    )
}

@Composable
fun MovePlayerDialog(
    state: GameDetailUiState.Success,
    playerId: String,
    sourceTeamId: String,
    onDismiss: () -> Unit,
    onMove: (String) -> Unit
) {
    val teams = remember(state.teams, sourceTeamId) {
        state.teams.filter { it.id != sourceTeamId }
    }

    Dialog(onDismissRequest = onDismiss) {
        Card {
            Column(Modifier.padding(16.dp)) {
                Text(stringResource(R.string.move_to), style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(8.dp))
                teams.forEach { team ->
                    TextButton(
                        onClick = { onMove(team.id) },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(team.name)
                    }
                }
            }
        }
    }
}

@Composable
fun FinishGameDialog(
    state: GameDetailUiState.Success,
    onDismiss: () -> Unit,
    onFinish: (Int, Int, String?) -> Unit
) {
    val teamA = state.teams.getOrNull(0)
    val teamB = state.teams.getOrNull(1)

    var scoreA by remember { mutableStateOf(teamA?.score?.toString() ?: "0") }
    var scoreB by remember { mutableStateOf(teamB?.score?.toString() ?: "0") }
    var selectedMvp by remember { mutableStateOf<String?>(null) }
    var expandedMvp by remember { mutableStateOf(false) }

    val candidates = remember(state.confirmations) {
        state.confirmations.filter { it.status == "CONFIRMED" }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.finish_game)) },
        text = {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(teamA?.name ?: stringResource(R.string.team_a), modifier = Modifier.weight(1f))
                    OutlinedTextField(
                        value = scoreA,
                        onValueChange = { scoreA = it },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.width(60.dp)
                    )
                }
                Spacer(Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(teamB?.name ?: stringResource(R.string.team_b), modifier = Modifier.weight(1f))
                    OutlinedTextField(
                        value = scoreB,
                        onValueChange = { scoreB = it },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.width(60.dp)
                    )
                }
                Spacer(Modifier.height(16.dp))
                Text(stringResource(R.string.match_mvp))
                Box {
                    OutlinedButton(onClick = { expandedMvp = true }, modifier = Modifier.fillMaxWidth()) {
                        Text(candidates.find { it.userId == selectedMvp }?.userName ?: stringResource(R.string.choose_mvp))
                    }
                    DropdownMenu(expanded = expandedMvp, onDismissRequest = { expandedMvp = false }) {
                        candidates.forEach { player ->
                            DropdownMenuItem(
                                text = { Text(player.userName) },
                                onClick = {
                                    selectedMvp = player.userId
                                    expandedMvp = false
                                }
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(onClick = {
                val sA = scoreA.toIntOrNull() ?: 0
                val sB = scoreB.toIntOrNull() ?: 0
                onFinish(sA, sB, selectedMvp)
            }) {
                Text(stringResource(R.string.confirm))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.action_cancel))
            }
        }
    )
}

@Composable
fun LiveMatchSection(
    state: GameDetailUiState.Success,
    onAddEvent: (GameEventType) -> Unit,
    onOpenLiveGame: () -> Unit,
    onDeleteEvent: (String) -> Unit
) {
    Card(Modifier.padding(16.dp).fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Text(stringResource(R.string.real_time), style = MaterialTheme.typography.titleMedium)

            if (state.game.status == "LIVE") {
                Button(
                    onClick = onOpenLiveGame,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)
                ) {
                    Text(stringResource(R.string.real_time))
                }
            }

            Column(Modifier.fillMaxWidth()) {
                val sortedEvents = remember(state.events) {
                    state.events.sortedByDescending { it.createdAt }
                }
                sortedEvents.forEach { event ->
                    Row(
                        modifier = Modifier.padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            painter = painterResource(getEventIcon(event.eventType)),
                            contentDescription = stringResource(R.string.cd_event_type_icon),
                            tint = getEventColor(event.eventType),
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "${event.minute}' ${event.playerName} - ${getGameDetailEventLabel(event.eventType)}",
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Spacer(modifier = Modifier.weight(1f))
                        if (
                            state.canManageGame ||
                            (state.canLogEvents && event.createdBy == state.currentUserId)
                        ) {
                            IconButton(onClick = { onDeleteEvent(event.id) }) {
                                Icon(Icons.Outlined.Delete, contentDescription = stringResource(R.string.delete), tint = MaterialTheme.colorScheme.error)
                            }
                        }
                    }
                    HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant, thickness = 0.5.dp)
                }
            }

            if (state.canLogEvents && state.game.status == "LIVE") {
                Row(horizontalArrangement = Arrangement.SpaceEvenly, modifier = Modifier.fillMaxWidth()) {
                    IconButton(onClick = { onAddEvent(GameEventType.GOAL) }) {
                        Icon(painterResource(R.drawable.ic_football), contentDescription = stringResource(R.string.live_goal), tint = MaterialTheme.colorScheme.onSurface)
                    }
                    IconButton(onClick = { onAddEvent(GameEventType.YELLOW_CARD) }) {
                        Icon(painterResource(R.drawable.ic_card_filled), contentDescription = stringResource(R.string.live_yellow_card), tint = MatchEventColors.YellowCard)
                    }
                    IconButton(onClick = { onAddEvent(GameEventType.RED_CARD) }) {
                        Icon(painterResource(R.drawable.ic_card_filled), contentDescription = stringResource(R.string.live_red_card), tint = MatchEventColors.RedCard)
                    }
                }
            }
        }
    }
}

fun getEventIcon(type: String): Int {
    return when(type) {
        "GOAL" -> R.drawable.ic_football
        "ASSIST" -> R.drawable.ic_sports_soccer
        "SAVE" -> R.drawable.ic_sports_soccer
        "YELLOW_CARD", "RED_CARD" -> R.drawable.ic_card_filled
        else -> R.drawable.ic_sports_soccer
    }
}

@Composable
fun getGameDetailEventLabel(type: String): String {
    return when(type) {
        "GOAL" -> stringResource(R.string.live_game_event_goal)
        "ASSIST" -> stringResource(R.string.live_game_assist)
        "SAVE" -> stringResource(R.string.live_game_save)
        "YELLOW_CARD" -> stringResource(R.string.live_game_event_yellow_card)
        "RED_CARD" -> stringResource(R.string.live_game_event_red_card)
        "SUBSTITUTION" -> stringResource(R.string.live_game_event_substitution)
        else -> stringResource(R.string.live_game_event_default)
    }
}

@Composable
fun getEventColor(type: String): Color {
    return when(type) {
        "GOAL" -> MaterialTheme.colorScheme.onSurface
        "ASSIST", "SAVE", "SUBSTITUTION" -> MaterialTheme.colorScheme.secondary
        "YELLOW_CARD" -> MatchEventColors.YellowCard
        "RED_CARD" -> MatchEventColors.RedCard
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
}

/**
 * Estado de loading com Shimmer
 */
@Composable
private fun GameDetailLoadingState() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Header shimmer
        ShimmerBox(
            modifier = Modifier
                .fillMaxWidth()
                .height(120.dp),
            cornerRadius = 12.dp
        )

        // Content shimmers
        repeat(3) {
            ShimmerBox(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(80.dp),
                cornerRadius = 12.dp
            )
        }
    }
}
