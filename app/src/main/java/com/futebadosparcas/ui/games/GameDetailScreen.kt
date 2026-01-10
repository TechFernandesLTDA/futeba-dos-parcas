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
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.futebadosparcas.R
import com.futebadosparcas.data.model.*
import com.futebadosparcas.util.ShareCardHelper
import com.futebadosparcas.ui.components.CachedProfileImage
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GameDetailScreen(
    viewModel: GameDetailViewModel,
    gameId: String,
    onNavigateBack: () -> Unit,
    onNavigateToCreateGame: (String) -> Unit,
    onNavigateToMvpVote: (String) -> Unit,
    onNavigateToTacticalBoard: () -> Unit
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
        } else {
            // Show snackbar via side effect or state
        }
    }

    // Load Data
    LaunchedEffect(gameId) {
        viewModel.loadGameDetails(gameId)
    }

    // Effect for automated scheduling event feedback
    LaunchedEffect(uiState) {
        val state = uiState
        if (state is GameDetailUiState.Success) {
            state.schedulingEvent?.let { event ->
                when (event) {
                    is SchedulingEvent.Success -> snackbarHostState.showSnackbar("Proximo jogo agendado: ${event.nextDate}")
                    is SchedulingEvent.Conflict -> snackbarHostState.showSnackbar("Conflito! Nao foi possivel agendar em ${event.date}.")
                    is SchedulingEvent.Error -> snackbarHostState.showSnackbar("Erro no agendamento: ${event.message}")
                }
                viewModel.clearSchedulingEvent()
            }
            if (state.userMessage != null) {
                snackbarHostState.showSnackbar(state.userMessage)
                viewModel.clearUserMessage()
            }
        }
        if (state is GameDetailUiState.GameDeleted) {
            snackbarHostState.showSnackbar("Jogo cancelado com sucesso")
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
                    onBackClick = onNavigateBack,
                    onInviteWhatsApp = { inviteToWhatsApp(context, state) },
                    onShare = { shareGameDetails(context, state) },
                    onVoteMvp = { onNavigateToMvpVote(gameId) },
                    onShareCard = { generateAndShareCard(context, state) },
                    onTacticalBoard = onNavigateToTacticalBoard
                )
            }
        },
        bottomBar = {
            if (uiState is GameDetailUiState.Success) {
                val state = uiState as GameDetailUiState.Success
                GameDetailBottomBar(
                    state = state,
                    onConfirmClick = {
                        if (state.isUserConfirmed) {
                             viewModel.toggleConfirmation(gameId) // Cancel
                        } else {
                             // Will need position selection
                        }
                    },
                    onAcceptInvite = { /* Position Selection happens in dialog */ }
                )
            }
        }
    ) { paddingValues ->
        Box(modifier = Modifier.padding(paddingValues).fillMaxSize()) {
            when (val state = uiState) {
                is GameDetailUiState.Loading -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                is GameDetailUiState.Error -> {
                    Text(
                        text = state.message,
                        color = MaterialTheme.colorScheme.error,
                        modifier = Modifier.align(Alignment.Center)
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
                        onEditTeams = { /* Show Generate Teams Dialog */ }
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
    onBackClick: () -> Unit,
    onInviteWhatsApp: () -> Unit,
    onShare: () -> Unit,
    onVoteMvp: () -> Unit,
    onShareCard: () -> Unit,
    onTacticalBoard: () -> Unit
) {
    var showMenu by remember { mutableStateOf(false) }

    TopAppBar(
        title = { Text("Detalhes do Jogo") },
        navigationIcon = {
            IconButton(onClick = onBackClick) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Voltar")
            }
        },
        actions = {
            IconButton(onClick = onInviteWhatsApp) {
                Icon(painterResource(R.drawable.ic_whatsapp), contentDescription = "WhatsApp", tint = com.futebadosparcas.ui.theme.BrandColors.WhatsApp)
            }
            IconButton(onClick = { showMenu = true }) {
                Icon(Icons.Default.MoreVert, contentDescription = "Mais opções")
            }
            DropdownMenu(expanded = showMenu, onDismissRequest = { showMenu = false }) {
                DropdownMenuItem(
                    text = { Text("Compartilhar Link") },
                    onClick = { onShare(); showMenu = false },
                    leadingIcon = { Icon(Icons.Outlined.Share, contentDescription = "Compartilhar") }
                )
                if (game.status == "FINISHED") {
                    DropdownMenuItem(
                        text = { Text("Votar MVP") },
                        onClick = { onVoteMvp(); showMenu = false },
                        leadingIcon = { Icon(Icons.Default.Star, contentDescription = "Votar MVP") }
                    )
                    if (hasTeams) {
                        DropdownMenuItem(
                            text = { Text("Gerar Card do Jogo") },
                            onClick = { onShareCard(); showMenu = false },
                             leadingIcon = { Icon(Icons.Default.Share, contentDescription = "Gerar Card") }
                        )
                    }
                }
                 DropdownMenuItem(
                    text = { Text("Prancheta Tática") },
                    onClick = { onTacticalBoard(); showMenu = false },
                    leadingIcon = { Icon(Icons.Default.Create, contentDescription = "Prancheta Tática") }
                 )
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    )
}

@Composable
fun GameDetailBottomBar(
    state: GameDetailUiState.Success,
    onConfirmClick: () -> Unit,
    onAcceptInvite: () -> Unit
) {
    // Handling dialog state internally in the wrapper normally, but here simplifying
    // Logic for button text/color is in ViewModel mostly, but UI needs to reflect
    
    val (text, containerColor, contentColor) = when {
        state.isUserConfirmed -> Triple("Cancelar Confirmação", MaterialTheme.colorScheme.error, MaterialTheme.colorScheme.onError)
        state.isUserPending -> Triple("Aceitar Convite", MaterialTheme.colorScheme.primary, MaterialTheme.colorScheme.onPrimary)
        else -> Triple("Confirmar Presença", MaterialTheme.colorScheme.primary, MaterialTheme.colorScheme.onPrimary)
    }

    // Implementation handled in main content's FAB or bottom bar?
    // Project design usually uses a bottom button.
    
    // We actually need to invoke the Position Dialog if not confirmed/canceling
    // So this is just UI
}

@Composable
fun GameDetailContent(
    state: GameDetailUiState.Success,
    viewModel: GameDetailViewModel,
    gameId: String,
    onStartGame: () -> Unit,
    onEditGame: () -> Unit,
    onEditTeams: () -> Unit
) {
    var showCancelDialog by remember { mutableStateOf(false) }
    var showGenerateTeamsDialog by remember { mutableStateOf(false) }
    var showFinishGameDialog by remember { mutableStateOf(false) }
    var showPositionDialog by remember { mutableStateOf(false) }
    var showMovePlayerDialog by remember { mutableStateOf<Pair<String,String>?>(null) } // playerId, sourceTeamId

    if (showCancelDialog) {
        AlertDialog(
            onDismissRequest = { showCancelDialog = false },
            title = { Text("Cancelar Jogo") },
            text = { Text("Tem certeza que deseja cancelar este jogo? Todas as confirmações serão perdidas.") },
            confirmButton = {
                TextButton(onClick = { viewModel.deleteGame(gameId); showCancelDialog = false }) { Text("Sim") }
            },
            dismissButton = {
                TextButton(onClick = { showCancelDialog = false }) { Text("Não") }
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

    LazyColumn(
        contentPadding = PaddingValues(bottom = 80.dp) // Space for floating button
    ) {
        // Header
        item {
            GameHeaderSection(
                game = state.game,
                canManage = state.canManageGame,
                confirmedCount = state.confirmations.count { it.status == "CONFIRMED" },
                onEdit = onEditGame,
                onCancel = { showCancelDialog = true },
                onToggleStatus = { viewModel.toggleGameStatus(gameId, it) },
                onStart = onStartGame,
                onFinish = { showFinishGameDialog = true },
                onLocationClick = { /* Show map options */ },
                onGenerateTeams = { showGenerateTeamsDialog = true }
            )
        }

        // Live Match Section
        if (state.game.status == "LIVE" || state.game.status == "FINISHED") {
             item {
                 LiveMatchSection(
                     state = state,
                     onAddEvent = { /* Handle Add Event */ },
                     onDeleteEvent = { viewModel.deleteGameEvent(it) }
                 )
             }
        }

        // Teams Section
        if (state.teams.isNotEmpty()) {
            item {
                Text(
                    "Times",
                    style = MaterialTheme.typography.titleLarge,
                    modifier = Modifier.padding(16.dp)
                )
            }
            items(state.teams) { team ->
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
                 Text("Lista de Presença", style = MaterialTheme.typography.titleLarge)
                 Text("${state.confirmations.size}/${state.game.maxPlayers}")
             }
        }
        
        items(state.confirmations) { confirmation ->
            ConfirmationCard(
                confirmation = confirmation,
                isOwner = state.canManageGame,
                currentUserId = state.currentUserId,
                onPaymentClick = { 
                    if (state.canManageGame && confirmation.userId != state.currentUserId) {
                        viewModel.togglePaymentStatus(gameId, confirmation.userId, confirmation.paymentStatus)
                    }
                },
                onRemoveClick = { viewModel.removePlayer(gameId, confirmation.userId) },
                onAcceptClick = { 
                    // Set as if accepted, go to position
                    showPositionDialog = true 
                },
                onDeclineClick = { viewModel.toggleConfirmation(gameId) }
            )
        }
    }
    
    // Floating Button for Main Action
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.BottomCenter) {
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
            modifier = Modifier.padding(16.dp).fillMaxWidth().height(56.dp),
            shape = RoundedCornerShape(16.dp)
        ) {
            Text(
                text = if (state.isUserConfirmed) "Cancelar Presença" else if (state.isUserPending) "Aceitar Convite" else "Confirmar Presença",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}

// --- Specific Composables ---

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
                Text(game.time, style = MaterialTheme.typography.headlineSmall)
            }
            Spacer(modifier = Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Place, null, tint = MaterialTheme.colorScheme.primary)
                Spacer(modifier = Modifier.width(4.dp))
                Text(game.locationName, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.clickable { onLocationClick() })
            }
            if (game.fieldName.isNotEmpty()) {
                 Text("Quadra: ${game.fieldName}", style = MaterialTheme.typography.bodyMedium)
            }
            Spacer(modifier = Modifier.height(16.dp))
            
            if (canManage) {
                Row(horizontalArrangement = Arrangement.SpaceEvenly, modifier = Modifier.fillMaxWidth()) {
                    FilledTonalButton(onClick = onEdit) {
                        Icon(Icons.Outlined.Edit, "Editar");
                        Spacer(Modifier.width(4.dp));
                        Text("Editar", maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                    }
                    if (game.status == "OPEN" || game.status == "SCHEDULED") {
                         FilledTonalButton(onClick = onStart, colors = ButtonDefaults.filledTonalButtonColors(containerColor = MaterialTheme.colorScheme.secondaryContainer)) {
                             Text("Iniciar Jogo", maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                         }
                    }
                    if (game.status == "LIVE") {
                         Button(onClick = onFinish, colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)) {
                             Text("Finalizar", maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                         }
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Switch(checked = game.status == "CONFIRMED", onCheckedChange = onToggleStatus)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = if (game.status == "CONFIRMED") "Lista Fechada" else "Lista Aberta",
                        maxLines = 1,
                        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                    )
                }
                TextButton(onClick = onGenerateTeams) {
                    Text("Gerar Times", maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                }
                TextButton(onClick = onCancel, colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)) {
                    Text("Cancelar Jogo", maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
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
                Text(confirmation.userName, fontWeight = FontWeight.SemiBold)
                Text(confirmation.position, style = MaterialTheme.typography.bodySmall)
            }
            
            if (currentUserId == confirmation.userId && confirmation.status == "PENDING") {
                IconButton(onClick = onAcceptClick) { Icon(Icons.Default.Check, "Aceitar", tint = MaterialTheme.colorScheme.primary) }
                IconButton(onClick = onDeclineClick) { Icon(Icons.Default.Close, "Recusar", tint = MaterialTheme.colorScheme.error) }
            } else {
                 if (isOwner || currentUserId == confirmation.userId) {
                    val payColor = if (confirmation.paymentStatus == "PAID") com.futebadosparcas.ui.theme.BrandColors.WhatsApp else Color.Gray
                    IconButton(onClick = onPaymentClick) {
                        Icon(painterResource(R.drawable.ic_money), "Pagamento", tint = payColor)
                    }
                 }
                 if (isOwner) {
                     IconButton(onClick = onRemoveClick) {
                         Icon(Icons.Outlined.Delete, "Remover", tint = MaterialTheme.colorScheme.error)
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
                Text("Gols: ${team.score}", style = MaterialTheme.typography.titleMedium)
            }
            HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
            // 🔧 OTIMIZADO: Use LazyColumn instead of forEach for proper Compose list rendering
            LazyColumn(modifier = Modifier.fillMaxWidth()) {
                items(
                    items = players,
                    key = { it.userId }  // ✅ Each player has unique key for efficient recomposition
                ) { player ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable(enabled = canManage) { onPlayerClick(player.userId) }
                            .padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(player.userName, modifier = Modifier.weight(1f))
                        if (player.goals > 0) {
                            Text("⚽ ${player.goals} ", fontSize = 12.sp)
                        }
                    }
                }
            }
        }
    }
}

// --- Helper Functions ---
// Moved logic from Fragment
private fun getLastLocationAndStartGame(context: Context, viewModel: GameDetailViewModel, gameId: String) {
    try {
        val client = LocationServices.getFusedLocationProviderClient(context)
        client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
            .addOnSuccessListener { location ->
                 if (location != null) {
                     viewModel.startGame(gameId, location.latitude, location.longitude)
                 } else {
                     client.lastLocation.addOnSuccessListener { last ->
                         viewModel.startGame(gameId, last?.latitude, last?.longitude)
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

fun inviteToWhatsApp(context: Context, state: GameDetailUiState.Success) {
    val message = "⚽ *Bora jogar bola!*\n\n📅 *${state.game.date}* às *${state.game.time}*\n📍 ${state.game.locationName}\n"
    try {
        val intent = Intent(Intent.ACTION_VIEW).apply {
            data = Uri.parse("https://wa.me/?text=${Uri.encode(message)}")
        }
        context.startActivity(intent)
    } catch (e: Exception) {
        // Fallback
    }
}

fun shareGameDetails(context: Context, state: GameDetailUiState.Success) {
    // Implement share logic
     val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, "Jogo em ${state.game.locationName}")
    }
    context.startActivity(Intent.createChooser(intent, "Compartilhar"))
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
    // Simplified specific logic
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Escolha sua posição") },
        text = {
            Column {
                Button(onClick = { onConfirm(PlayerPosition.GOALKEEPER) }, modifier = Modifier.fillMaxWidth()) {
                    Text("Goleiro")
                }
                Spacer(modifier = Modifier.height(8.dp))
                Button(onClick = { onConfirm(PlayerPosition.FIELD) }, modifier = Modifier.fillMaxWidth()) {
                    Text("Linha")
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
    var selectedTeams by remember { mutableStateOf(2) }
    var balanced by remember { mutableStateOf(true) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Gerar Times") },
        text = {
            Column {
                Text("Quantos times?")
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
                    Text("Equilibrar por habilidade?")
                }
            }
        },
        confirmButton = {
            Button(onClick = { onGenerate(selectedTeams, balanced) }) { Text("Gerar") }
        },
        dismissButton = {
            TextButton(onClick = onClear) { Text("Limpar Times") }
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
    val teams = state.teams.filter { it.id != sourceTeamId }
    
    Dialog(onDismissRequest = onDismiss) {
        Card {
            Column(Modifier.padding(16.dp)) {
                Text("Mover para:", style = MaterialTheme.typography.titleMedium)
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

    val candidates = state.confirmations.filter { it.status == "CONFIRMED" }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Finalizar Jogo") },
        text = {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(teamA?.name ?: "Time A", modifier = Modifier.weight(1f))
                    OutlinedTextField(
                        value = scoreA,
                        onValueChange = { scoreA = it },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.width(60.dp)
                    )
                }
                Spacer(Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(teamB?.name ?: "Time B", modifier = Modifier.weight(1f))
                    OutlinedTextField(
                        value = scoreB,
                        onValueChange = { scoreB = it },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.width(60.dp)
                    )
                }
                Spacer(Modifier.height(16.dp))
                Text("MVP da Partida")
                Box {
                    OutlinedButton(onClick = { expandedMvp = true }, modifier = Modifier.fillMaxWidth()) {
                        Text(candidates.find { it.userId == selectedMvp }?.userName ?: "Escolher MVP")
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
            }) { Text("Confirmar") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancelar") }
        }
    )
}

@Composable
fun LiveMatchSection(
    state: GameDetailUiState.Success,
    onAddEvent: (GameEventType) -> Unit,
    onDeleteEvent: (String) -> Unit
) {
    Card(Modifier.padding(16.dp).fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Text("Tempo Real", style = MaterialTheme.typography.titleMedium)
            
            Column(Modifier.fillMaxWidth()) {
                val sortedEvents = state.events.sortedByDescending { it.createdAt }
                sortedEvents.forEach { event ->
                    Row(
                        modifier = Modifier.padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            painter = painterResource(getEventIcon(event.eventType)),
                            contentDescription = null,
                            tint = getEventColor(event.eventType),
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = "${event.minute}' ${event.playerName} - ${event.eventType}",
                            style = MaterialTheme.typography.bodyMedium
                        )
                        Spacer(Modifier.weight(1f))
                        if (state.canLogEvents) {
                             IconButton(onClick = { onDeleteEvent(event.id) }) {
                                 Icon(Icons.Outlined.Delete, "Apagar", tint = MaterialTheme.colorScheme.error)
                             }
                        }
                    }
                    HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant, thickness = 0.5.dp)
                }
            }
            
            if (state.canLogEvents && state.game.status == "LIVE") {
                Row(horizontalArrangement = Arrangement.SpaceEvenly, modifier = Modifier.fillMaxWidth()) {
                    IconButton(onClick = { onAddEvent(GameEventType.GOAL) }) { Icon(painterResource(R.drawable.ic_football), "Gol", tint = Color.Black) }
                    IconButton(onClick = { onAddEvent(GameEventType.YELLOW_CARD) }) { Icon(painterResource(R.drawable.ic_card_filled), "Amarelo", tint = Color.Yellow) }
                    IconButton(onClick = { onAddEvent(GameEventType.RED_CARD) }) { Icon(painterResource(R.drawable.ic_card_filled), "Vermelho", tint = Color.Red) }
                }
            }
        }
    }
}

fun getEventIcon(type: String): Int {
    return when(type) {
        "GOAL" -> R.drawable.ic_football
        "YELLOW_CARD", "RED_CARD" -> R.drawable.ic_card_filled
        else -> R.drawable.ic_sports_soccer
    }
}

fun getEventColor(type: String): Color {
    return when(type) {
        "GOAL" -> Color.Black
        "YELLOW_CARD" -> Color.Yellow
        "RED_CARD" -> Color.Red
        else -> Color.Gray
    }
}
