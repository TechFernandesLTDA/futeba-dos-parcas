package com.futebadosparcas.ui.games

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.*
import com.futebadosparcas.data.repository.AuthRepository
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.util.AppLogger
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.timeout
import kotlinx.coroutines.launch
import kotlin.time.Duration.Companion.milliseconds
import java.time.*
import java.time.temporal.ChronoUnit
import java.time.temporal.TemporalAdjusters
import com.futebadosparcas.domain.repository.ScheduleRepository
import com.futebadosparcas.util.toAndroidSchedule
import com.futebadosparcas.util.toKmpSchedule
import javax.inject.Inject
import com.futebadosparcas.util.toKmpAppNotifications
import com.futebadosparcas.data.model.CancellationReason
import com.futebadosparcas.data.model.GameWaitlist
import com.futebadosparcas.data.model.GameInviteLink
import com.futebadosparcas.data.model.PlayerAttendance
import com.futebadosparcas.data.model.PixKeyType

@HiltViewModel
class GameDetailViewModel @Inject constructor(
    private val gameRepository: GameRepository,
    private val authRepository: AuthRepository,
    private val gameExperienceRepository: com.futebadosparcas.data.repository.GameExperienceRepository,
    private val scheduleRepository: ScheduleRepository,
    private val groupRepository: com.futebadosparcas.data.repository.GroupRepository,
    private val notificationRepository: com.futebadosparcas.domain.repository.NotificationRepository,
    private val waitlistRepository: com.futebadosparcas.data.repository.WaitlistRepository,
    private val confirmationUseCase: com.futebadosparcas.domain.usecase.ConfirmationUseCase,
    private val permissionManager: com.futebadosparcas.domain.permission.PermissionManager
) : ViewModel() {

    private val _uiState = MutableStateFlow<GameDetailUiState>(GameDetailUiState.Loading)
    val uiState: StateFlow<GameDetailUiState> = _uiState

    companion object {
        private const val TAG = "GameDetailViewModel"
    }

    private var gameId: String? = null
    private var gameDetailsJob: Job? = null
    private var waitlistJob: Job? = null

    // Estado da lista de espera (Issue #32)
    private val _waitlistState = MutableStateFlow<WaitlistState>(WaitlistState.Empty)
    val waitlistState: StateFlow<WaitlistState> = _waitlistState

    // Estado do deadline de confirmacao (Issue #31)
    private val _confirmationDeadline = MutableStateFlow<ConfirmationDeadlineState?>(null)
    val confirmationDeadline: StateFlow<ConfirmationDeadlineState?> = _confirmationDeadline

    @OptIn(kotlinx.coroutines.FlowPreview::class)
    fun loadGameDetails(id: String) {
        if (id.isEmpty()) {
            _uiState.value = GameDetailUiState.Error("ID do jogo inválido")
            return
        }
        if (gameId == id && gameDetailsJob?.isActive == true) return
        gameId = id

        // Cancelar job anterior para evitar coleções concorrentes
        gameDetailsJob?.cancel()
        gameDetailsJob = viewModelScope.launch {
            _uiState.value = GameDetailUiState.Loading

            try {
                combine(
                    gameRepository.getGameDetailsFlow(id),
                    gameRepository.getGameConfirmationsFlow(id),
                    gameRepository.getGameEventsFlow(id),
                    gameRepository.getGameTeamsFlow(id),
                    gameRepository.getLiveScoreFlow(id)
                ) { gameResult, confirmationsResult, eventsResult, teamsResult, liveScore ->
                    CombinedData(gameResult, confirmationsResult, eventsResult, teamsResult, liveScore)
                }
                .catch { e ->
                    AppLogger.e(TAG, "Erro no combine de Flows", e)
                    _uiState.value = GameDetailUiState.Error(e.message ?: "Erro ao carregar jogo")
                }
                .collect { data ->
                    val gameResult = data.gameResult
                    val confirmationsResult = data.confirmationsResult
                    val eventsResult = data.eventsResult
                    val teamsResult = data.teamsResult
                    val liveScore = data.liveScore

                    val game = gameResult.getOrElse {
                        _uiState.value = GameDetailUiState.Error(it.message ?: "Erro ao carregar jogo")
                        return@collect
                    }

                    // Atualizar placar do jogo com o liveScore se disponível
                    liveScore?.let {
                        game.team1Score = it.team1Score
                        game.team2Score = it.team2Score
                    }

                    val confirmations = confirmationsResult.getOrNull() ?: emptyList()
                    val events = eventsResult.getOrNull() ?: emptyList()
                    val teams = teamsResult.getOrNull()?.sortedBy { it.name } ?: emptyList()

                    val currentUserResult = authRepository.getCurrentUser()
                    val currentUserObj = currentUserResult.getOrNull()
                    val currentUserId = currentUserObj?.id ?: authRepository.getCurrentUserId()

                    // Permissões centralizadas via PermissionManager
                    val isAdmin = permissionManager.isAdmin()
                    val canManageGame = permissionManager.canEditGame(game.ownerId, game.coOrganizers)

                    val isConfirmed = confirmations.find { it.userId == currentUserId }
                    val isUserConfirmed = isConfirmed?.status == "CONFIRMED"
                    val isUserPending = isConfirmed?.status == "PENDING"
                    val isUserInWaitlist = isConfirmed?.status == ConfirmationStatus.WAITLIST.name
                    val isOwner = game.ownerId == currentUserId
                    val canLogEvents = canManageGame || isUserConfirmed

                    // Verificar deadline de confirmacao (Issue #31)
                    updateConfirmationDeadlineState(game)

                    // Carregar lista de espera (Issue #32)
                    loadWaitlist(id)

                    val currentMessage = (_uiState.value as? GameDetailUiState.Success)?.userMessage

                    val confirmedWithStats = confirmations.map { conf ->
                        val playerEvents = events.filter { it.playerId == conf.userId }
                        conf.apply {
                            goals = playerEvents.count { it.eventType == GameEventType.GOAL.name }
                            yellowCards = playerEvents.count { it.eventType == GameEventType.YELLOW_CARD.name }
                            redCards = playerEvents.count { it.eventType == GameEventType.RED_CARD.name }
                            assists = events.count { it.assistedById == conf.userId }
                        }
                    }

                    // Check vote status if game is finished
                    var hasVoted: Boolean? = (_uiState.value as? GameDetailUiState.Success)?.hasVoted
                    if (game.status == GameStatus.FINISHED.name && currentUserId != null) {
                        val voteResult = gameExperienceRepository.hasUserVoted(game.id, currentUserId)
                        hasVoted = voteResult.getOrNull() ?: false
                    }

                    // Ordenar por ordem de confirmacao (Issue #40)
                    val sortedConfirmations = confirmedWithStats.sortedBy { it.confirmationOrder }

                    _uiState.value = GameDetailUiState.Success(
                        game = game,
                        confirmations = sortedConfirmations,
                        teams = teams,
                        events = events,
                        isUserConfirmed = isUserConfirmed,
                        isUserPending = isUserPending,
                        isUserInWaitlist = isUserInWaitlist,
                        isOwner = isOwner,
                        isAdmin = isAdmin,
                        canManageGame = canManageGame,
                        canLogEvents = canLogEvents,
                        userMessage = currentMessage,
                        currentUserId = currentUserId,
                        hasVoted = hasVoted,
                        isSoftDeleted = game.isSoftDeleted() // P2 #40
                    )
                }
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro ao observar detalhes do jogo", e)
                _uiState.value = GameDetailUiState.Error(e.message ?: "Erro ao carregar jogo")
            }
        }
    }

    fun toggleConfirmation(gameId: String) {
        val currentState = _uiState.value as? GameDetailUiState.Success ?: return

        if (currentState.game.getStatusEnum() == GameStatus.CONFIRMED && !currentState.canManageGame) {
            _uiState.value = currentState.copy(userMessage = "A lista está fechada! Apenas o organizador pode alterar.")
            return
        }

        val originalIsConfirmed = currentState.isUserConfirmed
        
        viewModelScope.launch {
            val result = if (originalIsConfirmed) {
                gameRepository.cancelConfirmation(gameId)
            } else {
                gameRepository.confirmPresence(gameId, PlayerPosition.FIELD.name, false)
            }

            if (result.isFailure) {
                _uiState.value = currentState.copy(
                    userMessage = "Erro ao atualizar presença: ${result.exceptionOrNull()?.message}"
                )
            }
        }
    }

    fun confirmPresenceWithPosition(gameId: String, position: PlayerPosition) {
        val currentState = _uiState.value as? GameDetailUiState.Success ?: return

        if (currentState.game.getStatusEnum() == GameStatus.CONFIRMED && !currentState.canManageGame) {
            _uiState.value = currentState.copy(userMessage = "A lista está fechada! Apenas o organizador pode alterar.")
            return
        }

        viewModelScope.launch {
            // Se usuario ja tem convite (PENDING), aceitar o convite
            // Caso contrario, criar nova confirmacao
            val result = if (currentState.isUserPending) {
                gameRepository.acceptInvitation(gameId, position.name)
            } else {
                gameRepository.confirmPresence(gameId, position.name, false)
            }

            if (result.isFailure) {
                _uiState.value = currentState.copy(
                    userMessage = "Erro ao atualizar presença: ${result.exceptionOrNull()?.message}"
                )
            }
        }
    }

    fun toggleGameStatus(gameId: String, isChecked: Boolean) {
        viewModelScope.launch {
            gameRepository.updateGameConfirmationStatus(gameId, isChecked)
        }
    }

    fun startGame(gameId: String, currentLat: Double?, currentLng: Double?) {
        val state = _uiState.value
        if (state is GameDetailUiState.Success) {
            val game = state.game

            if (state.teams.isEmpty() || state.teams.all { it.playerIds.isEmpty() }) {
                _uiState.value = state.copy(userMessage = "Defina os times antes de iniciar o jogo")
                return
            }

            // 1. Validação de Horário (10 minutos antes)
            try {
                if (game.date.isNotEmpty() && game.time.isNotEmpty()) {
                    val date = java.time.LocalDate.parse(game.date)
                    val time = java.time.LocalTime.parse(game.time)
                    val gameDateTime = java.time.LocalDateTime.of(date, time)
                    val now = java.time.LocalDateTime.now()

                    if (now.isBefore(gameDateTime.minusMinutes(10))) {
                        _uiState.value = state.copy(userMessage = "O jogo só pode ser iniciado 10 minutos antes do horário marcado.")
                        return
                    }
                }
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro ao validar horário de início", e)
            }

            // 2. Validação de Localização (Geofencing)
            val gameLat = game.locationLat
            val gameLng = game.locationLng
            if (gameLat != null && gameLng != null && gameLat != 0.0) {
                if (currentLat == null || currentLng == null) {
                    _uiState.value = state.copy(userMessage = "Ative o GPS para confirmar que está no local do jogo.")
                    return
                }

                val distance = calculateDistance(currentLat, currentLng, gameLat, gameLng)
                val maxDistanceMeters = 500.0 // Tolerância de 500m

                if (distance > maxDistanceMeters) {
                    _uiState.value = state.copy(userMessage = "Você está muito longe da quadra (${distance.toInt()}m). Aproxime-se para iniciar.")
                    return
                }
            }
        }
        viewModelScope.launch {
            gameRepository.updateGameStatus(gameId, GameStatus.LIVE.name)
        }
    }

    private fun calculateDistance(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val earthRadius = 6371000.0 // Metros
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2)
        val c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
        return earthRadius * c
    }

    fun finishGame(gameId: String, scoreA: Int, scoreB: Int, mvpId: String?) {
        val currentState = _uiState.value
        viewModelScope.launch {
            currentState.let { state ->
                if (state is GameDetailUiState.Success) {
                    // Update Teams Score
                    val teams = state.teams
                    if (teams.size >= 2) {
                        val teamA = teams[0].copy(score = scoreA)
                        val teamB = teams[1].copy(score = scoreB)
                        val updateTeamsResult = gameRepository.updateTeams(listOf(teamA, teamB))
                        if (updateTeamsResult.isFailure) {
                            AppLogger.e(TAG, "Falha ao salvar placar", updateTeamsResult.exceptionOrNull())
                             _uiState.value = state.copy(userMessage = "Erro ao salvar placar: ${updateTeamsResult.exceptionOrNull()?.message}")
                             return@launch
                        }
                    }

                    // Atualizar MVP se selecionado
                    mvpId?.let { id ->
                         val updatedGame = state.game.copy(mvpId = id)
                         gameRepository.updateGame(updatedGame)
                    }

                    // Trigger automated scheduling (fire and forget within scope)
                    // Must be inside success check
                    scheduleNextGame(state.game)
                }
            }
            
            gameRepository.updateGameStatus(gameId, GameStatus.FINISHED.name)
        }
    }

    private fun scheduleNextGame(sourceGame: Game) {
        // Prevent scheduling if already finished or should not repeat
        if (sourceGame.status == GameStatus.FINISHED.name) return
        
        val recurrenceRaw = sourceGame.recurrence.lowercase()
        if (recurrenceRaw == "none" || recurrenceRaw == "não se repete" || recurrenceRaw.isEmpty()) {
            return
        }

        viewModelScope.launch {
            try {
                // 0. Check for Schedule template
                var currentScheduleId = sourceGame.scheduleId
                var scheduleTemplate: Schedule? = null
                
                if (currentScheduleId.isNotEmpty()) {
                    val existingScheduleResult = scheduleRepository.getScheduleById(currentScheduleId)
                    if (existingScheduleResult.isFailure) {
                        AppLogger.i(TAG) { "Agendamento automatico cancelado: O template de recorrencia foi excluido pelo usuario." }
                        return@launch
                    }
                    scheduleTemplate = existingScheduleResult.getOrNull()?.toAndroidSchedule()
                } else {
                    // Create a template if it doesn't exist but game is recurring
                    val newSchedule = Schedule(
                        ownerId = sourceGame.ownerId,
                        ownerName = sourceGame.ownerName,
                        name = "Jogo de ${sourceGame.ownerName} - ${sourceGame.locationName}",
                        locationId = sourceGame.locationId,
                        locationName = sourceGame.locationName,
                        locationAddress = sourceGame.locationAddress,
                        locationLat = sourceGame.locationLat,
                        locationLng = sourceGame.locationLng,
                        fieldId = sourceGame.fieldId,
                        fieldName = sourceGame.fieldName,
                        fieldType = sourceGame.gameType,
                        time = sourceGame.time,
                        duration = 60, // Default
                        recurrenceType = when {
                            recurrenceRaw.contains("semanal") || recurrenceRaw == "weekly" -> RecurrenceType.weekly
                            recurrenceRaw.contains("quinzenal") || recurrenceRaw == "biweekly" -> RecurrenceType.biweekly
                            recurrenceRaw.contains("mensal") || recurrenceRaw == "monthly" -> RecurrenceType.monthly
                            else -> RecurrenceType.weekly
                        },
                        dayOfWeek = try {
                            val dateFormatter = java.time.format.DateTimeFormatter.ISO_LOCAL_DATE
                            val date = java.time.LocalDate.parse(sourceGame.date, dateFormatter)
                            val isoDay = date.dayOfWeek.value
                            if (isoDay == 7) 0 else isoDay
                        } catch (e: Exception) { 0 }
                    )

                    val kmpSchedule = newSchedule.toKmpSchedule()
                    val result = scheduleRepository.createSchedule(kmpSchedule)
                    result.onSuccess { id ->
                        currentScheduleId = id
                        scheduleTemplate = newSchedule.copy(id = id)
                        // Update current game for chain continuity
                        gameRepository.updateGame(sourceGame.copy(scheduleId = id))
                    }
                }

                // 1. Parse current date
                val dateFormatter = java.time.format.DateTimeFormatter.ISO_LOCAL_DATE
                val currentDate = try {
                    java.time.LocalDate.parse(sourceGame.date, dateFormatter)
                } catch (e: Exception) {
                    AppLogger.e(TAG, "Data do jogo inválida: ${sourceGame.date}")
                    return@launch
                }
                
                // 2. Determine next date
                val nextDate = when {
                    recurrenceRaw.contains("semanal") || recurrenceRaw == "weekly" -> currentDate.plusWeeks(1)
                    recurrenceRaw.contains("quinzenal") || recurrenceRaw == "biweekly" -> currentDate.plusWeeks(2)
                    recurrenceRaw.contains("mensal") || recurrenceRaw == "monthly" -> {
                        val dayOfWeek = currentDate.dayOfWeek
                        val alignedWeek = (currentDate.dayOfMonth - 1) / 7 + 1 
                        val targetMonth = currentDate.plusMonths(1)
                        
                        var candidate = targetMonth.with(TemporalAdjusters.dayOfWeekInMonth(alignedWeek, dayOfWeek))
                        
                        // If month doesn't have Nth weekday (overflowed into month after next), use last in target month
                        if (candidate.month != targetMonth.month) {
                             candidate = targetMonth.with(TemporalAdjusters.lastInMonth(dayOfWeek))
                        }
                        candidate
                    }
                    else -> {
                        AppLogger.w(TAG) { "Recurrência desconhecida ignorada: $recurrenceRaw" }
                        null
                    }
                }

                if (nextDate == null) return@launch

                val nextDateStr = nextDate.format(dateFormatter)

                // 3. Calculate dateTime (java.util.Date) for proper Firestore sorting
                val nextDateTime: java.util.Date? = try {
                    val timeFormatter = java.time.format.DateTimeFormatter.ofPattern("HH:mm")
                    val localTime = java.time.LocalTime.parse(sourceGame.time, timeFormatter)
                    val localDateTime = nextDate.atTime(localTime)
                    val instant = localDateTime.atZone(java.time.ZoneId.systemDefault()).toInstant()
                    java.util.Date.from(instant)
                } catch (e: Exception) {
                    AppLogger.e(TAG, "Falha ao calcular dateTime para o próximo jogo, usando fallback nulo", e)
                    null
                }

                // 4. Robust conflict check (Handles overlaps)
                val conflictsResult = gameRepository.checkTimeConflict(
                    fieldId = sourceGame.fieldId,
                    date = nextDateStr,
                    startTime = sourceGame.time,
                    endTime = sourceGame.endTime
                )
                
                val conflicts = conflictsResult.getOrNull() ?: emptyList()
                if (conflicts.isNotEmpty()) {
                    AppLogger.w(TAG) { "Cancelando agendamento automático: Conflito com ${conflicts.size} jogo(s) na quadra em $nextDateStr." }
                    return@launch
                }

                // 5. Build new Game object
                // Use values from template if available, otherwise fallback to sourceGame values
                val template = scheduleTemplate
                val nextGame = sourceGame.copy(
                    id = "",
                    scheduleId = currentScheduleId,
                    date = nextDateStr,
                    time = template?.time ?: sourceGame.time,
                    // endTime is not explicitly in Schedule, we could keep same duration
                    endTime = if (template != null && template.time != sourceGame.time) {
                        try {
                           val t = java.time.LocalTime.parse(template.time)
                           t.plusMinutes(template.duration.toLong()).toString()
                        } catch(e: Exception) { sourceGame.endTime }
                    } else sourceGame.endTime,
                    locationId = template?.locationId ?: sourceGame.locationId,
                    locationName = template?.locationName ?: sourceGame.locationName,
                    locationAddress = template?.locationAddress ?: sourceGame.locationAddress,
                    locationLat = template?.locationLat ?: sourceGame.locationLat,
                    locationLng = template?.locationLng ?: sourceGame.locationLng,
                    fieldId = template?.fieldId ?: sourceGame.fieldId,
                    fieldName = template?.fieldName ?: sourceGame.fieldName,
                    gameType = template?.fieldType ?: sourceGame.gameType,
                    status = GameStatus.SCHEDULED.name,
                    playersCount = 0,
                    goalkeepersCount = 0,
                    players = emptyList(),
                    team1Score = 0,
                    team2Score = 0,
                    mvpId = null,
                    dateTimeRaw = nextDateTime,
                    createdAt = null,
                    xpProcessed = false,
                    xpProcessedAt = null,
                    groupId = template?.groupId ?: sourceGame.groupId,
                    groupName = template?.groupName ?: sourceGame.groupName
                )
                nextGame.id = "" // Backup reset

                val result = gameRepository.createGame(nextGame)
                if (result.isSuccess) {
                    val savedGame = result.getOrNull() ?: return@launch
                    // Summon group members if available
                    if (savedGame.groupId != null) {
                        summonGroupMembers(savedGame)
                    }
                    
                    AppLogger.d(TAG) { "Próximo jogo recorrente agendado: $nextDateStr às ${sourceGame.time}" }
                    (_uiState.value as? GameDetailUiState.Success)?.let { currentState ->
                         _uiState.value = currentState.copy(schedulingEvent = SchedulingEvent.Success(nextDateStr))
                    }
                } else {
                    val errorMsg = result.exceptionOrNull()?.message ?: "Erro desconhecido"
                    AppLogger.e(TAG, "Falha ao criar agendamento recorrente: $errorMsg")
                    (_uiState.value as? GameDetailUiState.Success)?.let { currentState ->
                        _uiState.value = currentState.copy(schedulingEvent = SchedulingEvent.Error(errorMsg))
                    }
                }
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro na engine de agendamento", e)
                val state = _uiState.value
                if (state is GameDetailUiState.Success) {
                    _uiState.value = state.copy(schedulingEvent = SchedulingEvent.Error(e.message ?: "Falha interna"))
                }
            }
        }
    }

    private suspend fun summonGroupMembers(game: Game) {
        val groupId = game.groupId ?: return
        val currentUserId = authRepository.getCurrentUserId() ?: ""
        val currentUserName = authRepository.getCurrentFirebaseUser()?.displayName ?: "Organizador"

        groupRepository.getGroupMembers(groupId).onSuccess { members ->
            val summoms = members.map { member ->
                GameConfirmation(
                    gameId = game.id,
                    userId = member.userId,
                    userName = member.userName,
                    userPhoto = member.userPhoto,
                    status = "PENDING"
                )
            }
            if (summoms.isNotEmpty()) {
                gameRepository.summonPlayers(game.id, summoms)
                
                // Enviar notificações
                val notifications = members.filter { it.userId != currentUserId }.map { member ->
                    com.futebadosparcas.data.model.AppNotification.createGameSummonNotification(
                        userId = member.userId,
                        gameId = game.id,
                        gameName = "Jogo de ${game.ownerName}",
                        gameDate = "${game.date} às ${game.time}",
                        groupName = game.groupName ?: "Individual",
                        summonedById = currentUserId,
                        summonedByName = currentUserName
                    )
                }
                if (notifications.isNotEmpty()) {
                    notificationRepository.batchCreateNotifications(notifications.toKmpAppNotifications())
                }
            }
        }
    }

    fun clearSchedulingEvent() {
        val state = _uiState.value
        if (state is GameDetailUiState.Success) {
            _uiState.value = state.copy(schedulingEvent = null)
        }
    }

    /**
     * Soft delete: marca o jogo como deletado sem excluir dados (P2 #40).
     * Permite restauracao posterior por admins.
     */
    fun deleteGame(gameId: String) {
        viewModelScope.launch {
            val result = gameRepository.softDeleteGame(gameId)
            if (result.isSuccess) {
                _uiState.value = GameDetailUiState.GameDeleted
            } else {
                (_uiState.value as? GameDetailUiState.Success)?.let { currentState ->
                    _uiState.value = currentState.copy(userMessage = "Erro ao cancelar jogo")
                }
            }
        }
    }

    /**
     * Restaura um jogo soft-deletado (P2 #40).
     * Disponivel apenas para admins/owners.
     */
    fun restoreGame(gameId: String) {
        viewModelScope.launch {
            val currentState = _uiState.value as? GameDetailUiState.Success ?: return@launch

            if (!currentState.canManageGame && !currentState.isAdmin) {
                _uiState.value = currentState.copy(userMessage = "Sem permissao para restaurar jogo")
                return@launch
            }

            val result = gameRepository.restoreGame(gameId)
            if (result.isSuccess) {
                _uiState.value = currentState.copy(userMessage = "Jogo restaurado com sucesso")
                // Recarregar detalhes do jogo
                loadGameDetails(gameId)
            } else {
                _uiState.value = currentState.copy(
                    userMessage = "Erro ao restaurar jogo: ${result.exceptionOrNull()?.message}"
                )
            }
        }
    }

    fun generateTeams(gameId: String, numberOfTeams: Int, balanced: Boolean) {
        val state = _uiState.value
        if (state is GameDetailUiState.Success) {
            val confirmedCount = state.confirmations.count { it.status == ConfirmationStatus.CONFIRMED.name }
            if (confirmedCount < 2) {
                _uiState.value = state.copy(userMessage = "Mínimo de 2 jogadores confirmados para sortear times")
                return
            }
        }
        viewModelScope.launch {
            gameRepository.generateTeams(gameId, numberOfTeams, balanced)
        }
    }

    fun clearTeams(gameId: String) {
        viewModelScope.launch {
            gameRepository.clearGameTeams(gameId)
        }
    }

    fun movePlayer(playerId: String, sourceTeamId: String, targetTeamId: String) {
        val currentState = _uiState.value as? GameDetailUiState.Success ?: return
        val currentTeams = currentState.teams

        val sourceTeamIndex = currentTeams.indexOfFirst { it.id == sourceTeamId }
        val targetTeamIndex = currentTeams.indexOfFirst { it.id == targetTeamId }

        if (sourceTeamIndex != -1 && targetTeamIndex != -1) {
            val sourceTeam = currentTeams[sourceTeamIndex]
            val targetTeam = currentTeams[targetTeamIndex]

            // Create mutable lists to modify
            val sourcePlayers = sourceTeam.playerIds.toMutableList()
            val targetPlayers = targetTeam.playerIds.toMutableList()

            // Modify lists
            if (sourcePlayers.remove(playerId)) {
                targetPlayers.add(playerId)
                
                // Create updated Team objects with new lists
                val newSourceTeam = sourceTeam.copy(playerIds = sourcePlayers)
                val newTargetTeam = targetTeam.copy(playerIds = targetPlayers)
                
                // Construct new teams list
                val newTeamsList = currentTeams.toMutableList()
                newTeamsList[sourceTeamIndex] = newSourceTeam
                newTeamsList[targetTeamIndex] = newTargetTeam
                
                viewModelScope.launch {
                    val result = gameRepository.updateTeams(newTeamsList)
                    if (result.isFailure) {
                         _uiState.value = currentState.copy(
                             userMessage = "Erro ao mover jogador: ${result.exceptionOrNull()?.message}"
                         )
                    }
                }
            }
        }
    }

    fun removePlayer(gameId: String, userId: String) {
        viewModelScope.launch {
            gameRepository.removePlayerFromGame(gameId, userId)
        }
    }

    /**
     * Permite ao dono/organizador confirmar um jogador pendente.
     */
    fun confirmPlayerAsOwner(gameId: String, userId: String) {
        viewModelScope.launch {
            val result = gameRepository.confirmPlayerAsOwner(gameId, userId)
            if (result.isFailure) {
                val currentState = _uiState.value as? GameDetailUiState.Success
                currentState?.let {
                    _uiState.value = it.copy(userMessage = "Erro ao confirmar jogador: ${result.exceptionOrNull()?.message}")
                }
            }
        }
    }

    fun togglePaymentStatus(gameId: String, userId: String, currentStatus: String) {
        viewModelScope.launch {
            val isPaid = currentStatus != PaymentStatus.PAID.name
            gameRepository.updatePaymentStatus(gameId, userId, isPaid)
        }
    }

    fun sendGameEvent(
        eventType: GameEventType, 
        teamId: String, 
        playerId: String?, 
        playerName: String?,
        assistedById: String? = null,
        assistedByName: String? = null
    ) {
        val gId = gameId ?: return
        viewModelScope.launch {
            val event = GameEvent(
                gameId = gId,
                eventType = eventType.name,
                teamId = teamId,
                playerId = playerId ?: "",
                playerName = playerName ?: "",
                createdBy = authRepository.getCurrentUserId() ?: "",
                assistedById = assistedById,
                assistedByName = assistedByName
            )
            gameRepository.sendGameEvent(gId, event)
        }
    }

    fun deleteGameEvent(eventId: String) {
        val gId = gameId ?: return
        viewModelScope.launch {
            gameRepository.deleteGameEvent(gId, eventId)
        }
    }

    fun clearUserMessage() {
        val currentState = _uiState.value as? GameDetailUiState.Success ?: return
        _uiState.value = currentState.copy(userMessage = null)
    }

    // === PRESENCE & CONFIRMATION FEATURES (Issues #31-40) ===

    /**
     * Issue #31: Atualiza o estado do deadline de confirmacao.
     */
    private fun updateConfirmationDeadlineState(game: Game) {
        val deadline = game.getConfirmationDeadline()
        if (deadline == null) {
            _confirmationDeadline.value = null
        } else {
            val now = java.util.Date()
            val isPassed = now.after(deadline)
            val timeRemaining = if (!isPassed) deadline.time - now.time else 0L
            _confirmationDeadline.value = ConfirmationDeadlineState(
                deadline = deadline,
                isPassed = isPassed,
                timeRemainingMs = timeRemaining
            )
        }
    }

    /**
     * Issue #32: Carrega a lista de espera do jogo.
     */
    private fun loadWaitlist(gameId: String) {
        waitlistJob?.cancel()
        waitlistJob = viewModelScope.launch {
            waitlistRepository.getWaitlistFlow(gameId)
                .catch { e ->
                    AppLogger.e(TAG, "Erro ao carregar lista de espera", e)
                    _waitlistState.value = WaitlistState.Error(e.message ?: "Erro")
                }
                .collect { result ->
                    result.fold(
                        onSuccess = { list ->
                            _waitlistState.value = if (list.isEmpty()) {
                                WaitlistState.Empty
                            } else {
                                WaitlistState.Loaded(list)
                            }
                        },
                        onFailure = { e ->
                            _waitlistState.value = WaitlistState.Error(e.message ?: "Erro")
                        }
                    )
                }
        }
    }

    /**
     * Issue #32: Adiciona jogador a lista de espera.
     */
    fun addToWaitlist(gameId: String, position: String) {
        viewModelScope.launch {
            val currentState = _uiState.value as? GameDetailUiState.Success ?: return@launch
            val result = confirmationUseCase.confirmPresence(gameId, position, false)
            result.fold(
                onSuccess = { confirmResult ->
                    if (confirmResult.addedToWaitlist) {
                        _uiState.value = currentState.copy(
                            userMessage = "Adicionado a lista de espera (posicao ${confirmResult.waitlistPosition})"
                        )
                    }
                },
                onFailure = { e ->
                    _uiState.value = currentState.copy(
                        userMessage = "Erro: ${e.message}"
                    )
                }
            )
        }
    }

    /**
     * Issue #32: Remove jogador da lista de espera.
     */
    fun removeFromWaitlist(gameId: String) {
        viewModelScope.launch {
            val currentState = _uiState.value as? GameDetailUiState.Success ?: return@launch
            val result = waitlistRepository.removeFromWaitlist(gameId, currentState.currentUserId ?: "")
            result.fold(
                onSuccess = {
                    _uiState.value = currentState.copy(
                        userMessage = "Removido da lista de espera"
                    )
                },
                onFailure = { e ->
                    _uiState.value = currentState.copy(
                        userMessage = "Erro: ${e.message}"
                    )
                }
            )
        }
    }

    /**
     * Issue #35: Marca jogador como "A caminho".
     */
    fun markOnTheWay(gameId: String, etaMinutes: Int? = null) {
        viewModelScope.launch {
            val currentState = _uiState.value as? GameDetailUiState.Success ?: return@launch
            val result = confirmationUseCase.markOnTheWay(gameId, etaMinutes)
            result.fold(
                onSuccess = {
                    _uiState.value = currentState.copy(
                        userMessage = "Marcado como 'A caminho'${etaMinutes?.let { " (ETA: $it min)" }.orEmpty()}"
                    )
                },
                onFailure = { e ->
                    _uiState.value = currentState.copy(
                        userMessage = "Erro: ${e.message}"
                    )
                }
            )
        }
    }

    /**
     * Issue #36: Realiza check-in por GPS.
     */
    fun checkIn(gameId: String, latitude: Double, longitude: Double) {
        viewModelScope.launch {
            val currentState = _uiState.value as? GameDetailUiState.Success ?: return@launch

            val location = android.location.Location("").apply {
                this.latitude = latitude
                this.longitude = longitude
            }

            val result = confirmationUseCase.checkIn(gameId, location)
            result.fold(
                onSuccess = { checkInResult ->
                    _uiState.value = currentState.copy(
                        userMessage = if (checkInResult.success) {
                            "Check-in realizado com sucesso!"
                        } else {
                            checkInResult.errorMessage ?: "Erro no check-in"
                        }
                    )
                },
                onFailure = { e ->
                    _uiState.value = currentState.copy(
                        userMessage = "Erro: ${e.message}"
                    )
                }
            )
        }
    }

    /**
     * Issue #39: Cancela confirmacao com motivo.
     */
    fun cancelWithReason(gameId: String, reason: CancellationReason, reasonText: String? = null) {
        viewModelScope.launch {
            val currentState = _uiState.value as? GameDetailUiState.Success ?: return@launch
            val result = confirmationUseCase.cancelWithReason(gameId, reason, reasonText)
            result.fold(
                onSuccess = {
                    _uiState.value = currentState.copy(
                        userMessage = "Presenca cancelada",
                        isUserConfirmed = false
                    )
                },
                onFailure = { e ->
                    _uiState.value = currentState.copy(
                        userMessage = "Erro: ${e.message}"
                    )
                }
            )
        }
    }

    /**
     * Issue #37: Busca historico de presenca do jogador.
     */
    suspend fun getPlayerAttendance(userId: String): PlayerAttendance? {
        return confirmationUseCase.getAttendanceHistory(userId).getOrNull()
    }

    /**
     * Issue #38: Gera link de convite para o jogo.
     */
    fun generateInviteLink(gameId: String): GameInviteLink? {
        val currentState = _uiState.value as? GameDetailUiState.Success ?: return null
        val currentUserId = authRepository.getCurrentUserId() ?: return null
        val currentUserName = authRepository.getCurrentFirebaseUser()?.displayName ?: "Organizador"

        return GameInviteLink.generate(
            gameId = gameId,
            game = currentState.game,
            createdById = currentUserId,
            createdByName = currentUserName
        )
    }

    /**
     * Issue #31: Atualiza deadline de confirmacao.
     */
    fun updateConfirmationDeadline(gameId: String, hours: Int) {
        viewModelScope.launch {
            val currentState = _uiState.value as? GameDetailUiState.Success ?: return@launch
            val updatedGame = currentState.game.copy(confirmationDeadlineHours = hours)
            val result = gameRepository.updateGame(updatedGame)
            if (result.isFailure) {
                _uiState.value = currentState.copy(
                    userMessage = "Erro ao atualizar deadline: ${result.exceptionOrNull()?.message}"
                )
            }
        }
    }

    /**
     * Issue #34: Atualiza configuracoes de Pix.
     */
    fun updatePixSettings(
        gameId: String,
        pixKey: String,
        pixKeyType: PixKeyType,
        beneficiaryName: String,
        enabled: Boolean
    ) {
        viewModelScope.launch {
            val currentState = _uiState.value as? GameDetailUiState.Success ?: return@launch
            val updatedGame = currentState.game.copy(
                pixKey = pixKey,
                pixKeyType = pixKeyType.name,
                pixBeneficiaryName = beneficiaryName,
                pixPaymentEnabled = enabled
            )
            val result = gameRepository.updateGame(updatedGame)
            if (result.isFailure) {
                _uiState.value = currentState.copy(
                    userMessage = "Erro ao atualizar Pix: ${result.exceptionOrNull()?.message}"
                )
            }
        }
    }

    /**
     * Issue #36: Atualiza configuracoes de check-in.
     */
    fun updateCheckinSettings(gameId: String, required: Boolean, radiusMeters: Int) {
        viewModelScope.launch {
            val currentState = _uiState.value as? GameDetailUiState.Success ?: return@launch
            val updatedGame = currentState.game.copy(
                requireCheckin = required,
                checkinRadiusMeters = radiusMeters
            )
            val result = gameRepository.updateGame(updatedGame)
            if (result.isFailure) {
                _uiState.value = currentState.copy(
                    userMessage = "Erro ao atualizar check-in: ${result.exceptionOrNull()?.message}"
                )
            }
        }
    }

    // === GAME OWNER FEATURES (Issues #61-70) ===

    /**
     * Issue #69: Atualiza pagamento parcial de um jogador.
     */
    fun updatePartialPayment(gameId: String, userId: String, amount: Double) {
        viewModelScope.launch {
            val result = gameRepository.updatePartialPayment(gameId, userId, amount)
            if (result.isFailure) {
                (_uiState.value as? GameDetailUiState.Success)?.let { currentState ->
                    _uiState.value = currentState.copy(
                        userMessage = "Erro ao atualizar pagamento: ${result.exceptionOrNull()?.message}"
                    )
                }
            }
        }
    }

    /**
     * Issue #63: Atualiza lista de co-organizadores.
     */
    fun updateCoOrganizers(gameId: String, coOrganizers: List<String>) {
        viewModelScope.launch {
            val currentState = _uiState.value as? GameDetailUiState.Success ?: return@launch
            val updatedGame = currentState.game.copy(coOrganizers = coOrganizers)
            val result = gameRepository.updateGame(updatedGame)
            if (result.isFailure) {
                _uiState.value = currentState.copy(
                    userMessage = "Erro ao atualizar co-organizadores: ${result.exceptionOrNull()?.message}"
                )
            }
        }
    }

    /**
     * Issue #65: Configura fechamento automatico de confirmacoes.
     */
    fun updateAutoCloseHours(gameId: String, hours: Int?) {
        viewModelScope.launch {
            val currentState = _uiState.value as? GameDetailUiState.Success ?: return@launch
            val updatedGame = currentState.game.copy(autoCloseHours = hours)
            val result = gameRepository.updateGame(updatedGame)
            if (result.isFailure) {
                _uiState.value = currentState.copy(
                    userMessage = "Erro ao atualizar configuracao: ${result.exceptionOrNull()?.message}"
                )
            }
        }
    }

    /**
     * Issue #68: Atualiza regras do jogo.
     */
    fun updateGameRules(gameId: String, rules: String) {
        viewModelScope.launch {
            val currentState = _uiState.value as? GameDetailUiState.Success ?: return@launch
            val updatedGame = currentState.game.copy(rules = rules)
            val result = gameRepository.updateGame(updatedGame)
            if (result.isFailure) {
                _uiState.value = currentState.copy(
                    userMessage = "Erro ao atualizar regras: ${result.exceptionOrNull()?.message}"
                )
            }
        }
    }

    /**
     * Issue #70: Transfere propriedade do jogo para outro jogador.
     */
    fun transferOwnership(gameId: String, newOwnerId: String) {
        viewModelScope.launch {
            val currentState = _uiState.value as? GameDetailUiState.Success ?: return@launch
            val newOwner = currentState.confirmations.find { it.userId == newOwnerId }

            val updatedGame = currentState.game.copy(
                ownerId = newOwnerId,
                ownerName = newOwner?.userName ?: currentState.game.ownerName
            )

            val result = gameRepository.updateGame(updatedGame)
            if (result.isSuccess) {
                _uiState.value = currentState.copy(
                    userMessage = "Propriedade transferida com sucesso!",
                    isOwner = false,
                    canManageGame = false
                )
            } else {
                _uiState.value = currentState.copy(
                    userMessage = "Erro ao transferir propriedade: ${result.exceptionOrNull()?.message}"
                )
            }
        }
    }

    /**
     * Issue #64: Bloqueia um jogador do grupo/recorrencia.
     */
    fun blockPlayer(groupId: String?, userId: String, userName: String, reason: String) {
        if (groupId == null) return
        viewModelScope.launch {
            val result = groupRepository.blockPlayer(groupId, userId, userName, reason, authRepository.getCurrentUserId() ?: "")
            if (result.isFailure) {
                (_uiState.value as? GameDetailUiState.Success)?.let { currentState ->
                    _uiState.value = currentState.copy(
                        userMessage = "Erro ao bloquear jogador: ${result.exceptionOrNull()?.message}"
                    )
                }
            }
        }
    }

    /**
     * Issue #64: Desbloqueia um jogador do grupo/recorrencia.
     */
    fun unblockPlayer(groupId: String?, userId: String) {
        if (groupId == null) return
        viewModelScope.launch {
            val result = groupRepository.unblockPlayer(groupId, userId)
            if (result.isFailure) {
                (_uiState.value as? GameDetailUiState.Success)?.let { currentState ->
                    _uiState.value = currentState.copy(
                        userMessage = "Erro ao desbloquear jogador: ${result.exceptionOrNull()?.message}"
                    )
                }
            }
        }
    }

    /**
     * Issue #66: Gera relatorio pos-jogo.
     */
    fun generatePostGameReport(): com.futebadosparcas.ui.games.owner.PostGameReport? {
        val state = _uiState.value as? GameDetailUiState.Success ?: return null

        val mvpPlayer = state.confirmations.find { it.userId == state.game.mvpId }

        // Calcular top scorers
        val topScorers = state.confirmations
            .filter { it.goals > 0 }
            .sortedByDescending { it.goals }
            .take(5)
            .map { it to it.goals }

        // Calcular top assists
        val topAssists = state.confirmations
            .filter { it.assists > 0 }
            .sortedByDescending { it.assists }
            .take(5)
            .map { it to it.assists }

        // Contar cartoes
        val totalGoals = state.events.count { it.eventType == com.futebadosparcas.data.model.GameEventType.GOAL.name }
        val yellowCards = state.events.count { it.eventType == com.futebadosparcas.data.model.GameEventType.YELLOW_CARD.name }
        val redCards = state.events.count { it.eventType == com.futebadosparcas.data.model.GameEventType.RED_CARD.name }

        return com.futebadosparcas.ui.games.owner.PostGameReport(
            game = state.game,
            confirmations = state.confirmations,
            teams = state.teams,
            mvpPlayer = mvpPlayer,
            totalGoals = totalGoals,
            topScorers = topScorers,
            topAssists = topAssists,
            yellowCards = yellowCards,
            redCards = redCards
        )
    }

    override fun onCleared() {
        super.onCleared()
        gameDetailsJob?.cancel()
        waitlistJob?.cancel()
    }
}

/**
 * Estado da lista de espera (Issue #32).
 */
sealed class WaitlistState {
    object Empty : WaitlistState()
    data class Loaded(val entries: List<GameWaitlist>) : WaitlistState()
    data class Error(val message: String) : WaitlistState()
}

/**
 * Estado do deadline de confirmacao (Issue #31).
 */
data class ConfirmationDeadlineState(
    val deadline: java.util.Date,
    val isPassed: Boolean,
    val timeRemainingMs: Long
) {
    fun getTimeRemainingDisplay(): String {
        if (timeRemainingMs <= 0) return "Encerrado"

        val minutes = timeRemainingMs / (1000 * 60)
        val hours = minutes / 60
        val remainingMinutes = minutes % 60

        return when {
            hours > 24 -> "${hours / 24}d ${hours % 24}h"
            hours > 0 -> "${hours}h ${remainingMinutes}min"
            else -> "${remainingMinutes}min"
        }
    }
}

sealed class GameDetailUiState {
    object Loading : GameDetailUiState()
    object GameDeleted : GameDetailUiState()
    data class Success(
        val game: Game,
        val confirmations: List<GameConfirmation>,
        val teams: List<Team> = emptyList(),
        val events: List<GameEvent> = emptyList(),
        val isUserConfirmed: Boolean,
        val isUserPending: Boolean = false,
        val isUserInWaitlist: Boolean = false,
        val isOwner: Boolean,
        val isAdmin: Boolean = false,
        val canManageGame: Boolean = false,
        val canLogEvents: Boolean = false,
        val userMessage: String? = null,
        val currentUserId: String? = null,
        val hasVoted: Boolean? = null,
        val schedulingEvent: SchedulingEvent? = null,
        val isSoftDeleted: Boolean = false // P2 #40: Indica se o jogo foi soft-deletado
    ) : GameDetailUiState()
    data class Error(val message: String) : GameDetailUiState()
}

sealed class SchedulingEvent {
    data class Success(val nextDate: String) : SchedulingEvent()
    data class Conflict(val date: String) : SchedulingEvent()
    data class Error(val message: String) : SchedulingEvent()
}

data class CombinedData(
    val gameResult: Result<Game>,
    val confirmationsResult: Result<List<GameConfirmation>>,
    val eventsResult: Result<List<GameEvent>>,
    val teamsResult: Result<List<Team>>,
    val liveScore: LiveGameScore?
)
