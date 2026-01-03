package com.futebadosparcas.ui.games

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.Field
import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.Location
import com.futebadosparcas.data.repository.AuthRepository
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.data.repository.GameTemplateRepository
import com.futebadosparcas.data.repository.TimeConflict
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import com.futebadosparcas.data.repository.ScheduleRepository
import com.futebadosparcas.data.model.Schedule
import com.futebadosparcas.data.model.RecurrenceType
import com.futebadosparcas.data.repository.GroupRepository
import com.futebadosparcas.data.model.UserGroup
import com.futebadosparcas.data.model.GroupMember
import com.futebadosparcas.data.model.GameConfirmation
import com.futebadosparcas.data.model.GameVisibility
import javax.inject.Inject

@HiltViewModel
class CreateGameViewModel @Inject constructor(
    private val gameRepository: GameRepository,
    private val authRepository: AuthRepository,
    private val gameTemplateRepository: GameTemplateRepository,
    private val scheduleRepository: ScheduleRepository,
    private val groupRepository: GroupRepository,
    private val notificationRepository: com.futebadosparcas.data.repository.NotificationRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<CreateGameUiState>(CreateGameUiState.Idle)
    val uiState: StateFlow<CreateGameUiState> = _uiState

    private val _selectedDate = MutableStateFlow<LocalDate?>(null)
    val selectedDate: StateFlow<LocalDate?> = _selectedDate

    private val _selectedTime = MutableStateFlow<LocalTime?>(null)
    val selectedTime: StateFlow<LocalTime?> = _selectedTime

    private val _selectedEndTime = MutableStateFlow<LocalTime?>(null)
    val selectedEndTime: StateFlow<LocalTime?> = _selectedEndTime

    private val _currentUser = MutableStateFlow<String>("")
    val currentUser: StateFlow<String> = _currentUser

    // Estados para local e quadra selecionados
    private val _selectedLocation = MutableStateFlow<Location?>(null)
    val selectedLocation: StateFlow<Location?> = _selectedLocation

    private val _selectedField = MutableStateFlow<Field?>(null)
    val selectedField: StateFlow<Field?> = _selectedField

    private val _timeConflicts = MutableStateFlow<List<TimeConflict>>(emptyList())
    val timeConflicts: StateFlow<List<TimeConflict>> = _timeConflicts

    private val _isEditing = MutableStateFlow(false)
    val isEditing: StateFlow<Boolean> = _isEditing

    private var _currentGameId: String? = null

    // New state for loaded templates
    private val _templates = MutableStateFlow<List<com.futebadosparcas.data.model.GameTemplate>>(emptyList())
    val templates: StateFlow<List<com.futebadosparcas.data.model.GameTemplate>> = _templates

    // New state for groups
    private val _availableGroups = MutableStateFlow<List<UserGroup>>(emptyList())
    val availableGroups: StateFlow<List<UserGroup>> = _availableGroups

    private val _selectedGroup = MutableStateFlow<UserGroup?>(null)
    val selectedGroup: StateFlow<UserGroup?> = _selectedGroup

    // Estado para visibilidade do jogo
    private val _selectedVisibility = MutableStateFlow(GameVisibility.GROUP_ONLY)
    val selectedVisibility: StateFlow<GameVisibility> = _selectedVisibility

    init {
        loadOwnerName()
        loadGroups()
        // loadTemplates() // Desabilitado - funcionalidade não necessária
    }

    private fun loadGroups() {
        viewModelScope.launch {
            groupRepository.getValidGroupsForGame().onSuccess { groups ->
                _availableGroups.value = groups
            }
        }
    }

    fun selectGroup(group: UserGroup?) {
        _selectedGroup.value = group
    }

    fun setVisibility(visibility: GameVisibility) {
        _selectedVisibility.value = visibility
    }

    private fun loadOwnerName() {
        viewModelScope.launch {
            val user = authRepository.getCurrentFirebaseUser()
            user?.displayName?.let {
                _currentUser.value = it
            }
        }
    }

    fun setDate(year: Int, month: Int, dayOfMonth: Int) {
        _selectedDate.value = LocalDate.of(year, month + 1, dayOfMonth)
        checkConflictsIfPossible()
    }

    fun setTime(hourOfDay: Int, minute: Int) {
        _selectedTime.value = LocalTime.of(hourOfDay, minute)
        checkConflictsIfPossible()
    }

    fun setEndTime(hourOfDay: Int, minute: Int) {
        _selectedEndTime.value = LocalTime.of(hourOfDay, minute)
        checkConflictsIfPossible()
    }

    fun setLocation(location: Location) {
        _selectedLocation.value = location
        android.util.Log.d("CreateGameVM", "Local selecionado: ${location.name} (${location.id})")
        // Limpar quadra quando mudar o local
        _selectedField.value = null
        _timeConflicts.value = emptyList()
    }

    fun setField(field: Field) {
        _selectedField.value = field
        android.util.Log.d("CreateGameVM", "Quadra selecionada: ${field.name} (${field.id})")
        checkConflictsIfPossible()
    }

    /**
     * Verifica conflitos de horário se todos os dados necessários estiverem preenchidos
     */
    private fun checkConflictsIfPossible() {
        val field = _selectedField.value ?: return
        val date = _selectedDate.value ?: return
        val startTime = _selectedTime.value ?: return
        val endTime = _selectedEndTime.value ?: return

        viewModelScope.launch {
            val dateStr = date.format(DateTimeFormatter.ISO_LOCAL_DATE)
            val startTimeStr = startTime.format(DateTimeFormatter.ofPattern("HH:mm"))
            val endTimeStr = endTime.format(DateTimeFormatter.ofPattern("HH:mm"))

            val result = gameRepository.checkTimeConflict(
                fieldId = field.id,
                date = dateStr,
                startTime = startTimeStr,
                endTime = endTimeStr,
                excludeGameId = _currentGameId
            )

            result.fold(
                onSuccess = { conflicts ->
                    _timeConflicts.value = conflicts
                    if (conflicts.isNotEmpty()) {
                        _uiState.value = CreateGameUiState.ConflictDetected(conflicts)
                    }
                },
                onFailure = { /* Ignorar erros de verificação */ }
            )
        }
    }

    fun loadGame(gameId: String) {
        if (_currentGameId == gameId) return

        viewModelScope.launch {
            _uiState.value = CreateGameUiState.Loading

            val result = gameRepository.getGameDetails(gameId)
            if (result.isSuccess) {
                val game = result.getOrNull()!!
                _currentGameId = game.id
                _isEditing.value = true

                try {
                   val date = LocalDate.parse(game.date, DateTimeFormatter.ISO_LOCAL_DATE)
                   _selectedDate.value = date

                   val time = LocalTime.parse(game.time, DateTimeFormatter.ofPattern("HH:mm"))
                   _selectedTime.value = time

                   if (game.endTime.isNotEmpty()){
                       val endTime = LocalTime.parse(game.endTime, DateTimeFormatter.ofPattern("HH:mm"))
                       _selectedEndTime.value = endTime
                   }

                   _currentUser.value = game.ownerName

                   // Carregar local e quadra se existirem
                   if (game.locationId.isNotEmpty()) {
                       _selectedLocation.value = Location(
                           id = game.locationId,
                           name = game.locationName,
                           address = game.locationAddress,
                           latitude = game.locationLat,
                           longitude = game.locationLng
                       )
                   }

                   if (game.fieldId.isNotEmpty()) {
                       _selectedField.value = Field(
                           id = game.fieldId,
                           locationId = game.locationId,
                           name = game.fieldName,
                           type = game.gameType.uppercase()
                       )
                   }

                   // Carregar grupo se houver
                   if (game.groupId != null) {
                       _selectedGroup.value = UserGroup(
                           id = game.groupId!!,
                           groupId = game.groupId!!,
                           groupName = game.groupName ?: ""
                       )
                   }

                   // Carregar visibilidade
                   _selectedVisibility.value = game.getVisibilityEnum()

                } catch (e: Exception) {
                    // Continuar com valores vazios se parse falhar
                }

                _uiState.value = CreateGameUiState.Editing(game)
            } else {
                 _uiState.value = CreateGameUiState.Error("Erro ao carregar jogo para edição")
            }
        }
    }

    fun saveGame(
        gameId: String?,
        ownerName: String,
        price: Double,
        maxPlayers: Int,
        recurrence: String
    ) {
        val location = _selectedLocation.value
        val field = _selectedField.value
        val group = _selectedGroup.value

        android.util.Log.d("CreateGameVM", "saveGame - Local: ${location?.name}, Quadra: ${field?.name}, Data: ${_selectedDate.value}, Hora: ${_selectedTime.value}")

        // Validação de campos obrigatórios
        if (location == null) {
            _uiState.value = CreateGameUiState.Error("Selecione um local")
            return
        }

        if (field == null) {
            _uiState.value = CreateGameUiState.Error("Selecione uma quadra")
            return
        }

        if (_selectedDate.value == null) {
            _uiState.value = CreateGameUiState.Error("Selecione a data do jogo")
            return
        }

        if (_selectedTime.value == null) {
            _uiState.value = CreateGameUiState.Error("Selecione o horário de início")
            return
        }

        if (_selectedEndTime.value == null) {
            _uiState.value = CreateGameUiState.Error("Selecione o horário de término")
            return
        }

        // Validação de inputs de texto
        if (ownerName.trim().isEmpty()) {
            _uiState.value = CreateGameUiState.Error("Nome do responsável é obrigatório")
            return
        }

        if (ownerName.length < 3 || ownerName.length > 50) {
            _uiState.value = CreateGameUiState.Error("Nome do responsável deve ter entre 3 e 50 caracteres")
            return
        }

        if (price < 0) {
            _uiState.value = CreateGameUiState.Error("O preço não pode ser negativo")
            return
        }

        if (maxPlayers < 4 || maxPlayers > 100) {
            _uiState.value = CreateGameUiState.Error("Número de jogadores inválido (mín 4, máx 100)")
            return
        }

        if (_availableGroups.value.isEmpty()) {
            _uiState.value = CreateGameUiState.Error("Você precisa ser Dono ou Administrador de pelo menos um grupo válido para criar jogos.")
            return
        }

        if (group == null) {
            _uiState.value = CreateGameUiState.Error("Você precisa selecionar um grupo para agendar o jogo")
            return
        }

        // Validar que data/horário não sejam no passado
        val selectedDateTime = java.time.LocalDateTime.of(_selectedDate.value!!, _selectedTime.value!!)
        val now = java.time.LocalDateTime.now()

        if (selectedDateTime.isBefore(now)) {
            _uiState.value = CreateGameUiState.Error("A data e horário do início devem ser futuros")
            return
        }

        if (_selectedEndTime.value!!.isBefore(_selectedTime.value!!)) {
            _uiState.value = CreateGameUiState.Error("O horário de término deve ser após o início")
            return
        }

        // Verificar se há conflitos
        if (_timeConflicts.value.isNotEmpty()) {
            _uiState.value = CreateGameUiState.Error("Há conflito de horário com outro jogo nesta quadra. Escolha outro horário.")
            return
        }

        viewModelScope.launch {
            _uiState.value = CreateGameUiState.Loading

            var scheduleId = ""
            // Create Schedule if recurrence is set and it's a new game (not editing)
            // Or if editing and adding recurrence for the first time
            if (recurrence != "none" && gameId == null && _currentGameId == null) {
                val newSchedule = Schedule(
                    ownerId = authRepository.getCurrentUserId() ?: "",
                    ownerName = ownerName,
                    name = "Jogo de $ownerName - ${location.name}",
                    locationId = location.id,
                    locationName = location.name,
                    locationAddress = location.getFullAddress(),
                    locationLat = location.latitude,
                    locationLng = location.longitude,
                    fieldId = field?.id ?: "",
                    fieldName = field?.name ?: "",
                    fieldType = field?.type ?: "Society",
                    time = _selectedTime.value?.format(DateTimeFormatter.ofPattern("HH:mm")) ?: "",
                    duration = 60,
                    recurrenceType = when (recurrence) {
                        "weekly" -> RecurrenceType.weekly
                        "biweekly" -> RecurrenceType.biweekly
                        "monthly" -> RecurrenceType.monthly
                        else -> RecurrenceType.weekly
                    },
                    dayOfWeek = _selectedDate.value?.let { date ->
                        val isoDay = date.dayOfWeek.value
                        if (isoDay == 7) 0 else isoDay
                    } ?: 0,
                    groupId = group?.id,
                    groupName = group?.groupName
                )
                
                val scheduleResult = scheduleRepository.createSchedule(newSchedule)
                scheduleResult.onSuccess { id ->
                    scheduleId = id
                }
            }

            val visibility = _selectedVisibility.value
            val game = Game(
                id = gameId ?: _currentGameId ?: "",
                scheduleId = scheduleId,
                date = _selectedDate.value!!.format(DateTimeFormatter.ISO_LOCAL_DATE),
                time = _selectedTime.value!!.format(DateTimeFormatter.ofPattern("HH:mm")),
                endTime = _selectedEndTime.value!!.format(DateTimeFormatter.ofPattern("HH:mm")),
                locationId = location.id,
                fieldId = field?.id ?: "",
                locationName = location.name,
                locationAddress = location.getFullAddress(),
                locationLat = location.latitude,
                locationLng = location.longitude,
                fieldName = field?.name ?: "",
                gameType = field?.getTypeEnum()?.displayName ?: "Society",
                ownerName = ownerName.ifEmpty { _currentUser.value },
                ownerId = authRepository.getCurrentUserId() ?: "",
                dailyPrice = price,
                maxPlayers = maxPlayers,
                recurrence = recurrence,
                status = "SCHEDULED",
                groupId = group?.id,
                groupName = group?.groupName,
                visibility = visibility.name,
                isPublic = visibility != GameVisibility.GROUP_ONLY,
                dateTime = java.util.Date.from(selectedDateTime.atZone(java.time.ZoneId.systemDefault()).toInstant())
            )

            if (game.id.isNotEmpty() && (gameId != null || _currentGameId != null)) {
                gameRepository.updateGame(game).fold(
                    onSuccess = {
                        summonGroupMembers(game)
                        _uiState.value = CreateGameUiState.Success(game)
                    },
                    onFailure = { error ->
                        _uiState.value = CreateGameUiState.Error(error.message ?: "Erro ao salvar jogo")
                    }
                )
            } else {
                gameRepository.createGame(game).fold(
                    onSuccess = { savedGame ->
                        summonGroupMembers(savedGame)
                        _uiState.value = CreateGameUiState.Success(savedGame)
                    },
                    onFailure = { error ->
                        _uiState.value = CreateGameUiState.Error(error.message ?: "Erro ao salvar jogo")
                    }
                )
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
                    status = if (member.userId == currentUserId) "CONFIRMED" else "PENDING"
                )
            }
            if (summoms.isNotEmpty()) {
                gameRepository.summonPlayers(game.id, summoms)

                // Enviar notificações apenas para outros membros
                val notifications = members
                    .filter { it.userId != currentUserId }
                    .map { member ->
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

    fun saveAsTemplate(
        templateName: String,
        ownerName: String,
        price: Double,
        maxPlayers: Int,
        recurrence: String
    ) {
        val location = _selectedLocation.value
        val field = _selectedField.value

        if (location == null || templateName.isBlank()) {
            _uiState.value = CreateGameUiState.Error("Local e Nome do Template são obrigatórios")
            return
        }

        viewModelScope.launch {
            val userId = authRepository.getCurrentUserId() ?: return@launch
            
            val template = com.futebadosparcas.data.model.GameTemplate(
                userId = userId,
                templateName = templateName,
                locationName = location.name,
                locationAddress = location.getFullAddress(),
                locationId = location.id,
                fieldName = field?.name ?: "",
                fieldId = field?.id ?: "",
                
                gameTime = _selectedTime.value?.format(DateTimeFormatter.ofPattern("HH:mm")) ?: "19:00",
                gameEndTime = _selectedEndTime.value?.format(DateTimeFormatter.ofPattern("HH:mm")) ?: "20:00",
                
                maxPlayers = maxPlayers,
                dailyPrice = price,
                recurrence = recurrence
            )

            gameTemplateRepository.saveTemplate(template)
                .onSuccess { 
                     _uiState.value = CreateGameUiState.SuccessTemplateSaved
                     loadTemplates() // Reload list
                }
                .onFailure { e ->
                    _uiState.value = CreateGameUiState.Error("Erro ao salvar template: ${e.message}")
                }
        }
    }

    fun loadTemplates() {
        viewModelScope.launch {
            val userId = authRepository.getCurrentUserId() ?: return@launch
            gameTemplateRepository.getUserTemplates(userId)
                .onSuccess { list ->
                    _templates.value = list
                    _uiState.value = CreateGameUiState.TemplatesLoaded(list)
                }
                .onFailure {
                    _uiState.value = CreateGameUiState.Error("Erro ao carregar templates")
                }
        }
    }

    fun applyTemplate(template: com.futebadosparcas.data.model.GameTemplate) {
        try {
            _selectedTime.value = LocalTime.parse(template.gameTime, DateTimeFormatter.ofPattern("HH:mm"))
            _selectedEndTime.value = LocalTime.parse(template.gameEndTime, DateTimeFormatter.ofPattern("HH:mm"))

            if (template.locationId.isNotEmpty()) {
               _selectedLocation.value = Location(
                   id = template.locationId,
                   name = template.locationName,
                   address = template.locationAddress
                   // Coords missing in template, might need fetch or optional
               )
            }
            
            if (template.fieldId.isNotEmpty()) {
                _selectedField.value = Field(
                    id = template.fieldId,
                    locationId = template.locationId,
                    name = template.fieldName
                )
            }
            
            _uiState.value = CreateGameUiState.TemplateApplied(template)
        } catch (e: Exception) {
            _uiState.value = CreateGameUiState.Error("Erro ao aplicar template")
        }
    }

    fun clearConflictState() {
        if (_uiState.value is CreateGameUiState.ConflictDetected) {
            _uiState.value = CreateGameUiState.Idle
        }
    }
}

sealed class CreateGameUiState {
    object Idle : CreateGameUiState()
    object Loading : CreateGameUiState()
    object SuccessTemplateSaved : CreateGameUiState()
    data class TemplatesLoaded(val templates: List<com.futebadosparcas.data.model.GameTemplate>) : CreateGameUiState()
    data class TemplateApplied(val template: com.futebadosparcas.data.model.GameTemplate) : CreateGameUiState()
    data class Editing(val game: Game) : CreateGameUiState()
    data class Success(val game: Game) : CreateGameUiState()
    data class Error(val message: String) : CreateGameUiState()
    data class ConflictDetected(val conflicts: List<TimeConflict>) : CreateGameUiState()
}
