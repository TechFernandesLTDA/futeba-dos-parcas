package com.futebadosparcas.ui.games

import android.content.Intent
import android.provider.CalendarContract
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.Field
import com.futebadosparcas.domain.model.Game
import com.futebadosparcas.data.model.GameDraft
import com.futebadosparcas.domain.model.Location
import com.futebadosparcas.data.repository.AuthRepository
import com.futebadosparcas.data.repository.CreateGameDraftRepository
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.domain.repository.AddressRepository
import com.futebadosparcas.domain.repository.GameTemplateRepository
import com.futebadosparcas.data.repository.TimeConflict
import com.futebadosparcas.domain.service.DayAvailability
import com.futebadosparcas.domain.service.FieldAvailabilityService
import com.futebadosparcas.domain.service.TimeSuggestion
import com.futebadosparcas.domain.service.TimeSuggestionService
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import com.futebadosparcas.domain.repository.ScheduleRepository
import com.futebadosparcas.data.model.Schedule as AndroidSchedule
import com.futebadosparcas.domain.model.Schedule as KmpSchedule
import com.futebadosparcas.data.model.RecurrenceType
import com.futebadosparcas.data.repository.GroupRepository
import com.futebadosparcas.data.model.UserGroup
import com.futebadosparcas.data.model.GroupMember
import com.futebadosparcas.domain.model.GameConfirmation
import com.futebadosparcas.domain.model.GameGender
import com.futebadosparcas.domain.model.GameVisibility
import com.futebadosparcas.domain.validation.GameValidation
import com.futebadosparcas.domain.repository.AddressLookupResult
import com.futebadosparcas.util.AppLogger
import com.futebadosparcas.util.toKmpAppNotifications
import com.futebadosparcas.util.toAndroidLocation
import com.futebadosparcas.util.toAndroidField
import com.futebadosparcas.util.toAndroidGameTemplate
import com.futebadosparcas.util.toAndroidSchedule
import com.futebadosparcas.util.toKmpSchedule
import com.futebadosparcas.util.toKmpGameTemplate

/**
 * Passos do wizard de criacao de jogo.
 */
enum class CreateGameStep(val index: Int, val titleResId: Int) {
    LOCATION(0, 0),    // Local e Quadra
    DETAILS(1, 0),     // Informacoes Basicas
    DATETIME(2, 0),    // Data e Horario
    CONFIRMATION(3, 0) // Confirmacao
}

class CreateGameViewModel(
    private val gameRepository: GameRepository,
    private val authRepository: AuthRepository,
    private val gameTemplateRepository: GameTemplateRepository,
    private val scheduleRepository: ScheduleRepository,
    private val groupRepository: GroupRepository,
    private val notificationRepository: com.futebadosparcas.domain.repository.NotificationRepository,
    private val draftRepository: CreateGameDraftRepository,
    private val timeSuggestionService: TimeSuggestionService,
    private val fieldAvailabilityService: FieldAvailabilityService,
    private val addressRepository: AddressRepository
) : ViewModel() {

    companion object {
        private const val TAG = "CreateGameViewModel"
        private const val AUTO_SAVE_DEBOUNCE_MS = 2000L

        // Fim-de-serie da recorrencia (spec #2398). count = TOTAL de jogos (min 2).
        const val RECURRENCE_END_MODE_FOREVER = "forever"
        const val RECURRENCE_END_MODE_COUNT = "count"
        const val RECURRENCE_END_MODE_UNTIL = "until"
        const val MIN_RECURRENCE_COUNT = 2
        const val MAX_RECURRENCE_COUNT = 52
        const val DEFAULT_RECURRENCE_COUNT = 10
        private const val DEFAULT_MAX_PLAYERS = 14
        private const val RECENT_GAMES_LIMIT = 10
        private const val ONE_HOUR_MS = 3_600_000L
        private const val MIN_PLAYERS = 2
        private const val MAX_PLAYERS = 50
        private const val MIN_GAME_DURATION_MINUTES = 30
        private const val MIN_NAME_LENGTH = 3
        private const val MAX_NAME_LENGTH = 50
        private const val DEFAULT_HOUR = 19
        private const val DEFAULT_DURATION_MINUTES = 60
        private const val MINUTES_IN_DAY = 24 * 60
    }

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

    // Suporte a multiplas quadras (Improvement #7)
    private val _selectedFields = MutableStateFlow<List<Field>>(emptyList())
    val selectedFields: StateFlow<List<Field>> = _selectedFields

    private val _timeConflicts = MutableStateFlow<List<TimeConflict>>(emptyList())
    val timeConflicts: StateFlow<List<TimeConflict>> = _timeConflicts

    private val _isEditing = MutableStateFlow(false)
    val isEditing: StateFlow<Boolean> = _isEditing

    private var _currentGameId: String? = null

    // State for loaded templates
    private val _templates = MutableStateFlow<List<com.futebadosparcas.data.model.GameTemplate>>(emptyList())
    val templates: StateFlow<List<com.futebadosparcas.data.model.GameTemplate>> = _templates

    // State for groups
    private val _availableGroups = MutableStateFlow<List<UserGroup>>(emptyList())
    val availableGroups: StateFlow<List<UserGroup>> = _availableGroups

    private val _selectedGroup = MutableStateFlow<UserGroup?>(null)
    val selectedGroup: StateFlow<UserGroup?> = _selectedGroup

    // Estado para visibilidade do jogo
    private val _selectedVisibility = MutableStateFlow(GameVisibility.GROUP_ONLY)
    val selectedVisibility: StateFlow<GameVisibility> = _selectedVisibility

    // Genero/categoria do jogo (MALE/FEMALE/MIXED). Default MIXED; pode vir do
    // default_gender do grupo selecionado, mas continua editavel (FASE 2).
    private val _selectedGender = MutableStateFlow(GameGender.MIXED.name)
    val selectedGender: StateFlow<String> = _selectedGender

    // Maximo de goleiros e numero de times (paridade com web, spec #2400)
    private val _maxGoalkeepers = MutableStateFlow(GameValidation.DEFAULT_MAX_GOALKEEPERS)
    val maxGoalkeepers: StateFlow<Int> = _maxGoalkeepers

    private val _numberOfTeams = MutableStateFlow(GameValidation.DEFAULT_NUMBER_OF_TEAMS)
    val numberOfTeams: StateFlow<Int> = _numberOfTeams

    // Fim-de-série da recorrencia (paridade com web, spec #2398, decisao "ambos").
    // Modo: "forever" (sem limite, ate o hard cap 52) | "count" (N jogos) | "until" (ate data).
    private val _recurrenceEndMode = MutableStateFlow(RECURRENCE_END_MODE_FOREVER)
    val recurrenceEndMode: StateFlow<String> = _recurrenceEndMode

    // Total de jogos na serie (NAO "repeticoes adicionais"). Min 2, max 52.
    private val _recurrenceCount = MutableStateFlow(DEFAULT_RECURRENCE_COUNT)
    val recurrenceCount: StateFlow<Int> = _recurrenceCount

    // Data limite ISO (yyyy-MM-dd) para o modo "until".
    private val _recurrenceEndDate = MutableStateFlow<String?>(null)
    val recurrenceEndDate: StateFlow<String?> = _recurrenceEndDate

    // Indice 1-based da serie carregado de um jogo existente (edicao). Preservado ao
    // salvar para NAO reiniciar a contagem de parada do motor (spec #2398).
    private var _loadedRecurrenceIndex: Int? = null

    // Wizard step (Improvement #8)
    private val _currentStep = MutableStateFlow(CreateGameStep.LOCATION)
    val currentStep: StateFlow<CreateGameStep> = _currentStep

    // Draft state (Improvement #9)
    private val _hasDraft = MutableStateFlow(false)
    val hasDraft: StateFlow<Boolean> = _hasDraft

    // Time suggestion (Improvement #3)
    private val _timeSuggestion = MutableStateFlow<TimeSuggestion?>(null)
    val timeSuggestion: StateFlow<TimeSuggestion?> = _timeSuggestion

    // Field availability (Improvement #4)
    private val _fieldAvailability = MutableStateFlow<List<DayAvailability>>(emptyList())
    val fieldAvailability: StateFlow<List<DayAvailability>> = _fieldAvailability

    // Recent games for duplication (Improvement #2)
    private val _recentGames = MutableStateFlow<List<Game>>(emptyList())
    val recentGames: StateFlow<List<Game>> = _recentGames

    // CEP lookup result (Improvement #5)
    private val _addressLookup = MutableStateFlow<AddressLookupResult?>(null)
    val addressLookup: StateFlow<AddressLookupResult?> = _addressLookup

    // Price per player (Improvement #6)
    private val _pricePerPlayer = MutableStateFlow<Double?>(null)
    val pricePerPlayer: StateFlow<Double?> = _pricePerPlayer

    // Manual price per player override
    private val _manualPricePerPlayer = MutableStateFlow<Double?>(null)
    val manualPricePerPlayer: StateFlow<Double?> = _manualPricePerPlayer

    private val _isManualPriceEnabled = MutableStateFlow(false)
    val isManualPriceEnabled: StateFlow<Boolean> = _isManualPriceEnabled

    // Calendar intent for Google Calendar (Improvement #10)
    private val _calendarIntent = MutableStateFlow<Intent?>(null)
    val calendarIntent: StateFlow<Intent?> = _calendarIntent

    private var autoSaveJob: Job? = null

    init {
        loadOwnerName()
        loadGroups()
        loadTemplates()
        checkForDraft()
        loadRecentGames()
    }

    private fun checkForDraft() {
        viewModelScope.launch {
            try {
                _hasDraft.value = draftRepository.hasDraft()
            } catch (e: Exception) {
                AppLogger.w(TAG) { "Falha ao verificar rascunho: ${e.message}" }
            }
        }
    }

    /**
     * Restaura rascunho salvo anteriormente.
     */
    fun restoreDraft() {
        viewModelScope.launch {
            val draft = draftRepository.getDraft() ?: return@launch

            // Restaurar dados do formulario
            _currentUser.value = draft.ownerName

            if (draft.selectedDateYear != null &&
                draft.selectedDateMonth != null &&
                draft.selectedDateDay != null) {
                _selectedDate.value = LocalDate.of(
                    draft.selectedDateYear,
                    draft.selectedDateMonth,
                    draft.selectedDateDay
                )
            }

            if (draft.selectedTimeHour != null && draft.selectedTimeMinute != null) {
                _selectedTime.value = LocalTime.of(draft.selectedTimeHour, draft.selectedTimeMinute)
            }

            if (draft.selectedEndTimeHour != null && draft.selectedEndTimeMinute != null) {
                _selectedEndTime.value = LocalTime.of(draft.selectedEndTimeHour, draft.selectedEndTimeMinute)
            }

            if (draft.locationId.isNotBlank()) {
                _selectedLocation.value = Location(
                    id = draft.locationId,
                    name = draft.locationName,
                    address = draft.locationAddress
                )
            }

            if (draft.fieldId.isNotBlank()) {
                _selectedField.value = Field(
                    id = draft.fieldId,
                    locationId = draft.locationId,
                    name = draft.fieldName,
                    type = draft.fieldType
                )
            }

            if (draft.groupId.isNotBlank()) {
                _selectedGroup.value = UserGroup(
                    id = draft.groupId,
                    groupId = draft.groupId,
                    groupName = draft.groupName
                )
            }

            try {
                _selectedVisibility.value = GameVisibility.valueOf(draft.visibility)
            } catch (e: Exception) {
                // Manter valor padrao
            }

            _uiState.value = CreateGameUiState.DraftRestored(draft)
            _hasDraft.value = false
            draftRepository.clearDraft()
        }
    }

    /**
     * Descarta o rascunho salvo.
     */
    fun discardDraft() {
        viewModelScope.launch {
            draftRepository.clearDraft()
            _hasDraft.value = false
        }
    }

    /**
     * Salva automaticamente o rascunho.
     */
    fun autoSaveDraft(
        ownerName: String,
        price: String,
        maxPlayers: String,
        recurrenceEnabled: Boolean,
        recurrenceType: String
    ) {
        autoSaveJob?.cancel()
        autoSaveJob = viewModelScope.launch {
            delay(AUTO_SAVE_DEBOUNCE_MS) // Debounce de 2 segundos

            val draft = GameDraft(
                ownerName = ownerName,
                price = price,
                maxPlayers = maxPlayers,
                selectedDateYear = _selectedDate.value?.year,
                selectedDateMonth = _selectedDate.value?.monthValue,
                selectedDateDay = _selectedDate.value?.dayOfMonth,
                selectedTimeHour = _selectedTime.value?.hour,
                selectedTimeMinute = _selectedTime.value?.minute,
                selectedEndTimeHour = _selectedEndTime.value?.hour,
                selectedEndTimeMinute = _selectedEndTime.value?.minute,
                locationId = _selectedLocation.value?.id ?: "",
                locationName = _selectedLocation.value?.name ?: "",
                locationAddress = _selectedLocation.value?.getFullAddress() ?: "",
                fieldId = _selectedField.value?.id ?: "",
                fieldName = _selectedField.value?.name ?: "",
                fieldType = _selectedField.value?.type ?: "",
                groupId = _selectedGroup.value?.id ?: "",
                groupName = _selectedGroup.value?.groupName ?: "",
                visibility = _selectedVisibility.value.name,
                recurrenceEnabled = recurrenceEnabled,
                recurrenceType = recurrenceType
            )

            if (draft.hasContent()) {
                draftRepository.saveDraft(draft)
            }
        }
    }

    // Wizard navigation (Improvement #8)
    fun nextStep() {
        val nextIndex = _currentStep.value.index + 1
        if (nextIndex <= CreateGameStep.CONFIRMATION.index) {
            _currentStep.value = CreateGameStep.entries.first { it.index == nextIndex }
        }
    }

    fun previousStep() {
        val prevIndex = _currentStep.value.index - 1
        if (prevIndex >= CreateGameStep.LOCATION.index) {
            _currentStep.value = CreateGameStep.entries.first { it.index == prevIndex }
        }
    }

    fun goToStep(step: CreateGameStep) {
        _currentStep.value = step
    }

    private fun loadGroups() {
        viewModelScope.launch {
            groupRepository.getValidGroupsForGame()
                .onSuccess { groups ->
                    _availableGroups.value = groups
                }
                .onFailure { error ->
                    AppLogger.w(TAG) { "Falha ao carregar grupos: ${error.message}" }
                }
        }
    }

    fun selectGroup(group: UserGroup?) {
        _selectedGroup.value = group

        // Pre-seleciona o genero a partir do default_gender do grupo (fallback MIXED).
        // O usuario ainda pode trocar manualmente depois (campo editavel).
        val groupId = group?.id ?: group?.groupId
        if (groupId.isNullOrBlank()) {
            _selectedGender.value = GameGender.MIXED.name
            return
        }
        viewModelScope.launch {
            groupRepository.getGroupById(groupId)
                .onSuccess { groupDoc ->
                    _selectedGender.value = GameGender.fromString(groupDoc.defaultGender).name
                }
                .onFailure {
                    AppLogger.w(TAG) { "Falha ao carregar default_gender do grupo: ${it.message}" }
                }
        }
    }

    fun setVisibility(visibility: GameVisibility) {
        _selectedVisibility.value = visibility
    }

    /** Define o genero/categoria do jogo (MALE/FEMALE/MIXED), tolerante a valores invalidos. */
    fun setGender(value: String) {
        _selectedGender.value = GameGender.fromString(value).name
    }

    /** Define o maximo de goleiros, limitado ao range valido (0..4). */
    fun setMaxGoalkeepers(value: Int) {
        _maxGoalkeepers.value = GameValidation.coerceGoalkeepers(value)
    }

    /** Define o numero de times, limitado ao range valido (2..4). */
    fun setNumberOfTeams(value: Int) {
        _numberOfTeams.value = GameValidation.coerceNumberOfTeams(value)
    }

    /** Define o modo de fim-de-serie: "forever" | "count" | "until" (spec #2398). */
    fun setRecurrenceEndMode(value: String) {
        _recurrenceEndMode.value = value
    }

    /** Define o total de jogos da serie, limitado a 2..52 (NAO repeticoes adicionais). */
    fun setRecurrenceCount(value: Int) {
        _recurrenceCount.value = value.coerceIn(MIN_RECURRENCE_COUNT, MAX_RECURRENCE_COUNT)
    }

    /** Define a data limite ISO (yyyy-MM-dd) para o modo "until". */
    fun setRecurrenceEndDate(value: String?) {
        _recurrenceEndDate.value = value
    }

    /**
     * Hidrata o estado de fim-de-serie a partir de um jogo existente (edicao/duplicacao).
     * count XOR end_date: deriva o modo do campo preenchido (spec #2398).
     */
    private fun hydrateRecurrenceEndConfig(game: Game) {
        _loadedRecurrenceIndex = game.recurrenceIndex
        when {
            game.recurrenceCount != null -> {
                _recurrenceEndMode.value = RECURRENCE_END_MODE_COUNT
                _recurrenceCount.value = game.recurrenceCount!!.coerceIn(MIN_RECURRENCE_COUNT, MAX_RECURRENCE_COUNT)
                _recurrenceEndDate.value = null
            }
            game.recurrenceEndDate != null -> {
                _recurrenceEndMode.value = RECURRENCE_END_MODE_UNTIL
                _recurrenceEndDate.value = game.recurrenceEndDate
            }
            else -> {
                _recurrenceEndMode.value = RECURRENCE_END_MODE_FOREVER
                _recurrenceEndDate.value = null
            }
        }
    }

    private fun loadOwnerName() {
        viewModelScope.launch {
            try {
                val user = authRepository.getCurrentFirebaseUser()
                user?.displayName?.let {
                    _currentUser.value = it
                }
            } catch (e: Exception) {
                AppLogger.w(TAG) { "Falha ao carregar nome do dono: ${e.message}" }
            }
        }
    }

    fun setDate(year: Int, month: Int, dayOfMonth: Int) {
        _selectedDate.value = LocalDate.of(year, month + 1, dayOfMonth)
        checkConflictsIfPossible()
        loadFieldAvailability()
    }

    fun setTime(hourOfDay: Int, minute: Int) {
        _selectedTime.value = LocalTime.of(hourOfDay, minute)
        checkConflictsIfPossible()
        updatePricePerPlayer()
    }

    fun setEndTime(hourOfDay: Int, minute: Int) {
        _selectedEndTime.value = LocalTime.of(hourOfDay, minute)
        checkConflictsIfPossible()
    }

    fun setLocation(location: Location) {
        _selectedLocation.value = location
        AppLogger.d(TAG) { "Local selecionado: ${location.name} (${location.id})" }
        // Limpar quadra quando mudar o local
        _selectedField.value = null
        _selectedFields.value = emptyList()
        _timeConflicts.value = emptyList()

        // Carregar sugestao de horario para este local
        loadTimeSuggestion(location.id)
    }

    fun setField(field: Field) {
        _selectedField.value = field
        AppLogger.d(TAG) { "Quadra selecionada: ${field.name} (${field.id})" }
        checkConflictsIfPossible()
        loadFieldAvailability()
    }

    // Multi-field support (Improvement #7)
    fun addField(field: Field) {
        if (!_selectedFields.value.any { it.id == field.id }) {
            _selectedFields.value = _selectedFields.value + field
        }
        if (_selectedField.value == null) {
            _selectedField.value = field
        }
    }

    fun removeField(field: Field) {
        _selectedFields.value = _selectedFields.value.filter { it.id != field.id }
        if (_selectedField.value?.id == field.id) {
            _selectedField.value = _selectedFields.value.firstOrNull()
        }
    }

    // Time suggestion (Improvement #3)
    private fun loadTimeSuggestion(locationId: String? = null) {
        viewModelScope.launch {
            val suggestion = timeSuggestionService.getBestTimeSuggestion(locationId)
            _timeSuggestion.value = suggestion
        }
    }

    fun applyTimeSuggestion() {
        val suggestion = _timeSuggestion.value ?: return
        try {
            val time = LocalTime.parse(suggestion.time, DateTimeFormatter.ofPattern("HH:mm"))
            _selectedTime.value = time
            _selectedEndTime.value = time.plusHours(1)
            checkConflictsIfPossible()
        } catch (e: Exception) {
            // Ignorar erro de parse
        }
    }

    // Field availability (Improvement #4)
    private fun loadFieldAvailability() {
        val field = _selectedField.value ?: return
        val date = _selectedDate.value ?: LocalDate.now()

        viewModelScope.launch {
            val availability = fieldAvailabilityService.getWeekAvailability(field.id, date)
            _fieldAvailability.value = availability
        }
    }

    // Recent games for duplication (Improvement #2)
    private fun loadRecentGames() {
        viewModelScope.launch {
            gameRepository.getAllGames().onSuccess { games ->
                _recentGames.value = games
                    .filter { it.status !in setOf("CANCELLED", "FINISHED", "EXPIRED") }
                    .sortedByDescending { it.createdAt }
                    .take(RECENT_GAMES_LIMIT)
            }
        }
    }

    /**
     * Duplica configuracoes de um jogo anterior (Improvement #2).
     */
    fun duplicateGame(game: Game) {
        _selectedLocation.value = Location(
            id = game.locationId,
            name = game.locationName,
            address = game.locationAddress,
            latitude = game.locationLat,
            longitude = game.locationLng
        )

        _selectedField.value = Field(
            id = game.fieldId,
            locationId = game.locationId,
            name = game.fieldName,
            type = game.gameType.uppercase()
        )

        if (game.time.isNotBlank()) {
            try {
                _selectedTime.value = LocalTime.parse(game.time, DateTimeFormatter.ofPattern("HH:mm"))
            } catch (e: Exception) {
                AppLogger.w(TAG) { "Falha ao parsear horario: ${game.time}" }
            }
        }

        if (game.endTime.isNotBlank()) {
            try {
                _selectedEndTime.value = LocalTime.parse(game.endTime, DateTimeFormatter.ofPattern("HH:mm"))
            } catch (e: Exception) {
                AppLogger.w(TAG) { "Falha ao parsear horario fim: ${game.endTime}" }
            }
        }

        _selectedVisibility.value = game.getVisibilityEnum()

        // Copiar goleiros/times do jogo duplicado (paridade, spec #2400)
        _maxGoalkeepers.value = GameValidation.coerceGoalkeepers(game.maxGoalkeepers)
        _numberOfTeams.value = GameValidation.coerceNumberOfTeams(game.numberOfTeams)

        // Copiar genero/categoria do jogo duplicado (FASE 2)
        _selectedGender.value = GameGender.fromString(game.gender).name

        // Copiar fim-de-serie da recorrencia (spec #2398, count XOR end_date)
        hydrateRecurrenceEndConfig(game)

        val groupId = game.groupId
        if (groupId != null) {
            _selectedGroup.value = UserGroup(
                id = groupId,
                groupId = groupId,
                groupName = game.groupName ?: ""
            )
        }

        _uiState.value = CreateGameUiState.GameDuplicated(game)
    }

    // CEP lookup (Improvement #5)
    fun lookupCep(cep: String) {
        if (cep.length < 8) return

        viewModelScope.launch {
            addressRepository.getAddressByCep(cep).onSuccess { result ->
                _addressLookup.value = result
            }.onFailure {
                _addressLookup.value = null
            }
        }
    }

    fun clearAddressLookup() {
        _addressLookup.value = null
    }

    // Price per player calculation (Improvement #6)
    fun updatePricePerPlayer(price: Double? = null, maxPlayers: Int? = null) {
        // Se override manual estiver ativo, nao recalcula automaticamente
        if (_isManualPriceEnabled.value) return

        val totalPrice = price ?: 0.0
        val players = maxPlayers ?: DEFAULT_MAX_PLAYERS

        _pricePerPlayer.value = if (players > 0) {
            totalPrice / players
        } else {
            null
        }
    }

    /**
     * Define preco manual por jogador (override do calculo automatico).
     */
    fun setManualPricePerPlayer(price: Double?) {
        _manualPricePerPlayer.value = price
        if (price != null && price > 0) {
            _isManualPriceEnabled.value = true
            _pricePerPlayer.value = price
        }
    }

    /**
     * Alterna entre calculo automatico e manual.
     */
    fun toggleManualPriceMode(enabled: Boolean) {
        _isManualPriceEnabled.value = enabled
        if (!enabled) {
            _manualPricePerPlayer.value = null
            // Recalcular automaticamente
        }
    }

    /**
     * Define a data selecionada a partir do calendario de disponibilidade.
     */
    fun setDateFromAvailability(date: LocalDate) {
        _selectedDate.value = date
        checkConflictsIfPossible()
        loadFieldAvailability()
    }

    // Google Calendar integration (Improvement #10)
    fun createCalendarIntent(game: Game): Intent {
        val dateTime = try {
            val date = LocalDate.parse(game.date, DateTimeFormatter.ISO_LOCAL_DATE)
            val time = LocalTime.parse(game.time, DateTimeFormatter.ofPattern("HH:mm"))
            val endTime = if (game.endTime.isNotBlank()) {
                LocalTime.parse(game.endTime, DateTimeFormatter.ofPattern("HH:mm"))
            } else {
                time.plusHours(1)
            }

            Pair(
                date.atTime(time).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli(),
                date.atTime(endTime).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
            )
        } catch (e: Exception) {
            Pair(System.currentTimeMillis(), System.currentTimeMillis() + ONE_HOUR_MS)
        }

        val intent = Intent(Intent.ACTION_INSERT).apply {
            data = CalendarContract.Events.CONTENT_URI
            putExtra(CalendarContract.Events.TITLE, "Futeba - ${game.locationName}")
            putExtra(CalendarContract.Events.DESCRIPTION, buildString {
                append("Jogo organizado por ${game.ownerName}\n")
                append("Quadra: ${game.fieldName}\n")
                append("Tipo: ${game.gameType}\n")
                if (game.dailyPrice > 0) {
                    append("Valor: R$ %.2f\n".format(game.dailyPrice))
                }
                if (game.groupName != null) {
                    append("Grupo: ${game.groupName}\n")
                }
                append("\nCriado pelo app Futeba dos Parcas")
            })
            putExtra(CalendarContract.Events.EVENT_LOCATION, game.locationAddress)
            putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, dateTime.first)
            putExtra(CalendarContract.EXTRA_EVENT_END_TIME, dateTime.second)
        }

        _calendarIntent.value = intent
        return intent
    }

    fun clearCalendarIntent() {
        _calendarIntent.value = null
    }

    /**
     * Verifica conflitos de horario se todos os dados necessarios estiverem preenchidos
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
                onFailure = { /* Ignorar erros de verificacao */ }
            )
        }
    }

    fun loadGame(gameId: String) {
        if (_currentGameId == gameId) return

        viewModelScope.launch {
            _uiState.value = CreateGameUiState.Loading

            val result = gameRepository.getGameDetails(gameId)
            if (result.isSuccess) {
                val game = result.getOrNull() ?: run {
                    _uiState.value = CreateGameUiState.Error("Jogo nao encontrado")
                    return@launch
                }

                // Validar permissao de edicao (owner ou admin do grupo)
                val currentUserId = authRepository.getCurrentFirebaseUser()?.uid
                val gameGroupId = game.groupId
                val canEdit = when {
                    currentUserId == null -> false
                    game.ownerId == currentUserId -> true
                    gameGroupId != null -> {
                        val roleResult = groupRepository.getMyRoleInGroup(gameGroupId)
                        val role = roleResult.getOrNull()
                        role?.name in listOf("OWNER", "ADMIN")
                    }
                    else -> false
                }

                if (!canEdit) {
                    _uiState.value = CreateGameUiState.Error("Voce nao tem permissao para editar este jogo")
                    return@launch
                }

                _currentGameId = game.id
                _isEditing.value = true

                try {
                   val date = LocalDate.parse(game.date, DateTimeFormatter.ISO_LOCAL_DATE)
                   _selectedDate.value = date

                   // Parse do horario com tratamento para campos vazios
                   if (game.time.isNotEmpty()) {
                        try {
                            val time = LocalTime.parse(game.time, DateTimeFormatter.ofPattern("HH:mm"))
                            _selectedTime.value = time
                        } catch (e: Exception) {
                            _selectedTime.value = LocalTime.of(DEFAULT_HOUR, 0)
                        }
                    } else {
                        _selectedTime.value = LocalTime.of(DEFAULT_HOUR, 0)
                   }

                   if (game.endTime.isNotEmpty()){
                       try {
                           val endTime = LocalTime.parse(game.endTime, DateTimeFormatter.ofPattern("HH:mm"))
                           _selectedEndTime.value = endTime
                       } catch (e: Exception) {
                           _selectedEndTime.value = _selectedTime.value?.plusHours(1)
                       }
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
                   game.groupId?.let { groupId ->
                       _selectedGroup.value = UserGroup(
                           id = groupId,
                           groupId = groupId,
                           groupName = game.groupName ?: ""
                       )
                   }

                   // Carregar visibilidade
                   _selectedVisibility.value = game.getVisibilityEnum()

                   // Restaurar goleiros/times para nao sobrescrever com default ao salvar (spec #2400)
                   _maxGoalkeepers.value = GameValidation.coerceGoalkeepers(game.maxGoalkeepers)
                   _numberOfTeams.value = GameValidation.coerceNumberOfTeams(game.numberOfTeams)

                   // Restaurar genero/categoria do jogo em edicao (FASE 2)
                   _selectedGender.value = GameGender.fromString(game.gender).name

                   // Restaurar fim-de-serie da recorrencia (spec #2398, count XOR end_date)
                   hydrateRecurrenceEndConfig(game)

                } catch (e: Exception) {
                    // Continuar com valores vazios se parse falhar
                }

                _uiState.value = CreateGameUiState.Editing(game)
            } else {
                 _uiState.value = CreateGameUiState.Error("Erro ao carregar jogo para edicao")
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

        AppLogger.d(TAG) { "saveGame - Local: ${location?.name}, Quadra: ${field?.name}, Data: ${_selectedDate.value}, Hora: ${_selectedTime.value}" }

        // Validacao de campos obrigatorios
        if (location == null) {
            _uiState.value = CreateGameUiState.Error("Selecione um local")
            return
        }

        if (field == null) {
            _uiState.value = CreateGameUiState.Error("Selecione uma quadra")
            return
        }

        val selectedDate = _selectedDate.value ?: run {
            _uiState.value = CreateGameUiState.Error("Selecione a data do jogo")
            return
        }

        val selectedStartTime = _selectedTime.value ?: run {
            _uiState.value = CreateGameUiState.Error("Selecione o horario de inicio")
            return
        }

        val selectedEndTime = _selectedEndTime.value ?: run {
            _uiState.value = CreateGameUiState.Error("Selecione o horario de termino")
            return
        }

        // Validacao de inputs de texto
        if (ownerName.trim().isEmpty()) {
            _uiState.value = CreateGameUiState.Error("Nome do responsavel e obrigatorio")
            return
        }

        if (ownerName.length < MIN_NAME_LENGTH || ownerName.length > MAX_NAME_LENGTH) {
            _uiState.value = CreateGameUiState.Error("Nome do responsavel deve ter entre $MIN_NAME_LENGTH e $MAX_NAME_LENGTH caracteres")
            return
        }

        if (price < 0) {
            _uiState.value = CreateGameUiState.Error("O preco nao pode ser negativo")
            return
        }

        if (maxPlayers < MIN_PLAYERS || maxPlayers > MAX_PLAYERS) {
            _uiState.value = CreateGameUiState.Error("Numero de jogadores invalido (min $MIN_PLAYERS, max $MAX_PLAYERS)")
            return
        }

        if (!GameValidation.isGoalkeepersValid(_maxGoalkeepers.value)) {
            _uiState.value = CreateGameUiState.Error("Numero de goleiros invalido (min ${GameValidation.MIN_GOALKEEPERS}, max ${GameValidation.MAX_GOALKEEPERS})")
            return
        }

        if (!GameValidation.isNumberOfTeamsValid(_numberOfTeams.value)) {
            _uiState.value = CreateGameUiState.Error("Numero de times invalido (min ${GameValidation.MIN_NUMBER_OF_TEAMS}, max ${GameValidation.MAX_NUMBER_OF_TEAMS})")
            return
        }

        if (_availableGroups.value.isEmpty()) {
            _uiState.value = CreateGameUiState.Error("Voce precisa ser Dono ou Administrador de pelo menos um grupo valido para criar jogos.")
            return
        }

        if (group == null) {
            _uiState.value = CreateGameUiState.Error("Voce precisa selecionar um grupo para agendar o jogo")
            return
        }

        // Validar que data/horario nao sejam no passado
        val selectedDateTime = java.time.LocalDateTime.of(selectedDate, selectedStartTime)
        val now = java.time.LocalDateTime.now()

        if (selectedDateTime.isBefore(now)) {
            _uiState.value = CreateGameUiState.Error("A data e horario do inicio devem ser futuros")
            return
        }

        if (selectedEndTime.isBefore(selectedStartTime)) {
            _uiState.value = CreateGameUiState.Error("O horario de termino deve ser apos o inicio")
            return
        }

        // Validar duracao minima de 30 minutos
        val startMinutes = selectedStartTime.hour * 60 + selectedStartTime.minute
        var endMinutes = selectedEndTime.hour * 60 + selectedEndTime.minute
        // Tratar virada de meia-noite
        if (endMinutes <= startMinutes) {
            endMinutes += MINUTES_IN_DAY
        }
        val durationMinutes = endMinutes - startMinutes
        if (durationMinutes < MIN_GAME_DURATION_MINUTES) {
            _uiState.value = CreateGameUiState.Error("A duracao minima do jogo e de $MIN_GAME_DURATION_MINUTES minutos")
            return
        }

        // Verificar se ha conflitos
        if (_timeConflicts.value.isNotEmpty()) {
            _uiState.value = CreateGameUiState.Error("Ha conflito de horario com outro jogo nesta quadra. Escolha outro horario.")
            return
        }

        viewModelScope.launch {
            _uiState.value = CreateGameUiState.Loading

            // Limpar rascunho ao salvar
            draftRepository.clearDraft()

            var scheduleId = ""
            // Create Schedule if recurrence is set and it's a new game (not editing)
            // Or if editing and adding recurrence for the first time
            if (recurrence != "none" && gameId == null && _currentGameId == null) {
                val newSchedule = AndroidSchedule(
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
                    duration = DEFAULT_DURATION_MINUTES,
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

                val kmpSchedule = newSchedule.toKmpSchedule()
                val scheduleResult = scheduleRepository.createSchedule(kmpSchedule)
                scheduleResult.onSuccess { id ->
                    scheduleId = id
                }
            }

            val visibility = _selectedVisibility.value
            val game = Game(
                id = gameId ?: _currentGameId ?: "",
                scheduleId = scheduleId,
                date = selectedDate.format(DateTimeFormatter.ISO_LOCAL_DATE),
                time = selectedStartTime.format(DateTimeFormatter.ofPattern("HH:mm")),
                endTime = selectedEndTime.format(DateTimeFormatter.ofPattern("HH:mm")),
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
                maxGoalkeepers = _maxGoalkeepers.value,
                numberOfTeams = _numberOfTeams.value,
                // Genero/categoria do jogo (FASE 2). Persiste no campo `gender`.
                gender = _selectedGender.value,
                recurrence = recurrence,
                // Fim-de-serie (spec #2398, decisao "ambos"): count XOR end_date.
                // recurrence_index marca a posicao na serie; o motor (recurrence-engine)
                // propaga count/end_date e para via recurrenceStopReason (hard cap 52).
                // Em criacao/duplicacao esta e a 1a ocorrencia (indice 1). Em EDICAO,
                // preserva o indice carregado: resetar para 1 faria o motor recontar a
                // serie do zero e gerar jogos extras alem do total (quebra o count).
                recurrenceIndex = if (recurrence != "none") {
                    if (gameId != null || _currentGameId != null) _loadedRecurrenceIndex ?: 1 else 1
                } else {
                    null
                },
                recurrenceCount = if (recurrence != "none" && _recurrenceEndMode.value == RECURRENCE_END_MODE_COUNT) {
                    _recurrenceCount.value.coerceIn(MIN_RECURRENCE_COUNT, MAX_RECURRENCE_COUNT)
                } else {
                    null
                },
                recurrenceEndDate = if (recurrence != "none" && _recurrenceEndMode.value == RECURRENCE_END_MODE_UNTIL) {
                    _recurrenceEndDate.value
                } else {
                    null
                },
                status = "SCHEDULED",
                groupId = group?.id,
                groupName = group?.groupName,
                visibility = visibility.name,
                isPublic = visibility != GameVisibility.GROUP_ONLY,
                createdAt = java.util.Date.from(selectedDateTime.atZone(java.time.ZoneId.systemDefault()).toInstant()).time
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
            val summons = members.map { member ->
                GameConfirmation(
                    gameId = game.id,
                    userId = member.userId,
                    userName = member.userName,
                    userPhoto = member.userPhoto,
                    status = if (member.userId == currentUserId) "CONFIRMED" else "PENDING"
                )
            }
            if (summons.isNotEmpty()) {
                gameRepository.summonPlayers(game.id, summons)

                // Enviar notificacoes apenas para outros membros
                val notifications = members
                    .filter { it.userId != currentUserId }
                    .map { member ->
                        com.futebadosparcas.data.model.AppNotification.createGameSummonNotification(
                            userId = member.userId,
                            gameId = game.id,
                            gameName = "Jogo de ${game.ownerName}",
                            gameDate = "${game.date} as ${game.time}",
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
            _uiState.value = CreateGameUiState.Error("Local e Nome do Template sao obrigatorios")
            return
        }

        viewModelScope.launch {
            val userId = authRepository.getCurrentUserId() ?: return@launch

            val androidTemplate = com.futebadosparcas.data.model.GameTemplate(
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

            val kmpTemplate = androidTemplate.toKmpGameTemplate()

            gameTemplateRepository.saveTemplate(kmpTemplate)
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
                .onSuccess { kmpList ->
                    val androidList = kmpList.map { it.toAndroidGameTemplate() }
                    _templates.value = androidList
                    _uiState.value = CreateGameUiState.TemplatesLoaded(androidList)
                }
                .onFailure {
                    _uiState.value = CreateGameUiState.Error("Erro ao carregar templates")
                }
        }
    }

    fun deleteTemplate(templateId: String) {
        viewModelScope.launch {
            val userId = authRepository.getCurrentUserId() ?: return@launch
            gameTemplateRepository.deleteTemplate(userId, templateId)
                .onSuccess {
                    loadTemplates()
                }
                .onFailure { e ->
                    _uiState.value = CreateGameUiState.Error("Erro ao deletar template: ${e.message}")
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

    override fun onCleared() {
        super.onCleared()
        autoSaveJob?.cancel()
    }
}

sealed class CreateGameUiState {
    object Idle : CreateGameUiState()
    object Loading : CreateGameUiState()
    object SuccessTemplateSaved : CreateGameUiState()
    data class TemplatesLoaded(val templates: List<com.futebadosparcas.data.model.GameTemplate>) : CreateGameUiState()
    data class TemplateApplied(val template: com.futebadosparcas.data.model.GameTemplate) : CreateGameUiState()
    data class DraftRestored(val draft: GameDraft) : CreateGameUiState()
    data class GameDuplicated(val game: Game) : CreateGameUiState()
    data class Editing(val game: Game) : CreateGameUiState()
    data class Success(val game: Game) : CreateGameUiState()
    data class Error(val message: String) : CreateGameUiState()
    data class ConflictDetected(val conflicts: List<TimeConflict>) : CreateGameUiState()
}
