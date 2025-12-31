package com.futebadosparcas.ui.games

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.*
import com.futebadosparcas.data.repository.AuthRepository
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.util.AppLogger
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import java.time.*
import java.time.temporal.ChronoUnit
import java.time.temporal.TemporalAdjusters
import com.futebadosparcas.data.repository.ScheduleRepository
import javax.inject.Inject

@HiltViewModel
class GameDetailViewModel @Inject constructor(
    private val gameRepository: GameRepository,
    private val authRepository: AuthRepository,
    private val gameExperienceRepository: com.futebadosparcas.data.repository.GameExperienceRepository,
    private val scheduleRepository: ScheduleRepository,
    private val groupRepository: com.futebadosparcas.data.repository.GroupRepository,
    private val notificationRepository: com.futebadosparcas.data.repository.NotificationRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<GameDetailUiState>(GameDetailUiState.Loading)
    val uiState: StateFlow<GameDetailUiState> = _uiState

    companion object {
        private const val TAG = "GameDetailViewModel"
    }

    private var gameId: String? = null

    fun loadGameDetails(id: String) {
        if (id.isEmpty()) {
            _uiState.value = GameDetailUiState.Error("ID do jogo inválido")
            return
        }
        if (gameId == id) return
        gameId = id
        
        viewModelScope.launch {
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
                }.collect { data ->
                    val gameResult = data.gameResult
                    val confirmationsResult = data.confirmationsResult
                    val eventsResult = data.eventsResult
                    val teamsResult = data.teamsResult
                    val liveScore = data.liveScore

                    if (gameResult.isSuccess) {
                        val game = gameResult.getOrNull()!!
                        
                        // Atualizar placar do jogo com o liveScore se disponível
                        liveScore?.let {
                            game.team1Score = it.team1Score
                            game.team2Score = it.team2Score
                        }

                        val confirmations = confirmationsResult.getOrNull() ?: emptyList()
                        val events = eventsResult.getOrNull() ?: emptyList()
                        val teams = teamsResult.getOrNull()?.sortedBy { it.name } ?: emptyList() // Sorted by name

                        val currentUserResult = authRepository.getCurrentUser()
                        val currentUserObj = currentUserResult.getOrNull()
                        val currentUserId = currentUserObj?.id ?: authRepository.getCurrentUserId()
                        val isAdmin = currentUserObj?.isAdmin() == true
                        
                        val isConfirmed = confirmations.find { it.userId == currentUserId }
                        val isUserConfirmed = isConfirmed?.status == "CONFIRMED"
                        val isUserPending = isConfirmed?.status == "PENDING"
                        val isOwner = game.ownerId == currentUserId
                        val canManageGame = isOwner || isAdmin
                        val canLogEvents = canManageGame || isUserConfirmed // Any confirmed player can log

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

                        _uiState.value = GameDetailUiState.Success(
                            game = game,
                            confirmations = confirmedWithStats,
                            teams = teams,
                            events = events,
                            isUserConfirmed = isUserConfirmed,
                            isUserPending = isUserPending,
                            isOwner = isOwner,
                            isAdmin = isAdmin,
                            canManageGame = canManageGame,
                            canLogEvents = canLogEvents,
                            userMessage = currentMessage,
                            currentUserId = currentUserId,
                            hasVoted = hasVoted
                        )
                    } else {
                        _uiState.value = GameDetailUiState.Error(
                            gameResult.exceptionOrNull()?.message ?: "Erro ao carregar jogo"
                        )
                    }
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
            val result = gameRepository.confirmPresence(gameId, position.name, false)
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
            if (game.locationLat != null && game.locationLng != null && game.locationLat != 0.0) {
                if (currentLat == null || currentLng == null) {
                    _uiState.value = state.copy(userMessage = "Ative o GPS para confirmar que está no local do jogo.")
                    return
                }

                val distance = calculateDistance(currentLat, currentLng, game.locationLat!!, game.locationLng!!)
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

                    // Update MVP if selected
                    if (mvpId != null) {
                         val updatedGame = state.game.copy(mvpId = mvpId)
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
                        AppLogger.i(TAG) { "Agendamento automático cancelado: O template de recorrência foi excluído pelo usuário." }
                        return@launch
                    }
                    scheduleTemplate = existingScheduleResult.getOrNull()
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
                    
                    val result = scheduleRepository.createSchedule(newSchedule)
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
                    dateTime = nextDateTime,
                    createdAt = null,
                    xpProcessed = false,
                    xpProcessedAt = null,
                    groupId = template?.groupId ?: sourceGame.groupId,
                    groupName = template?.groupName ?: sourceGame.groupName
                )
                nextGame.id = "" // Backup reset

                val result = gameRepository.createGame(nextGame)
                if (result.isSuccess) {
                    val savedGame = result.getOrNull()!!
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
                    notificationRepository.batchCreateNotifications(notifications)
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

    fun deleteGame(gameId: String) {
        viewModelScope.launch {
            val result = gameRepository.deleteGame(gameId)
            if (result.isSuccess) {
                _uiState.value = GameDetailUiState.GameDeleted
            } else {
                val currentState = _uiState.value as? GameDetailUiState.Success
                if (currentState != null) {
                    _uiState.value = currentState.copy(userMessage = "Erro ao cancelar jogo")
                }
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
        val isOwner: Boolean,
        val isAdmin: Boolean = false,
        val canManageGame: Boolean = false,
        val canLogEvents: Boolean = false,
        val userMessage: String? = null,
        val currentUserId: String? = null,
        val hasVoted: Boolean? = null,
        val schedulingEvent: SchedulingEvent? = null
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
