package com.futebadosparcas.ui.players

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.FieldType
import com.futebadosparcas.data.model.PlayerRatingRole
import com.futebadosparcas.data.model.User
import com.futebadosparcas.data.repository.UserRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class PlayersViewModel @Inject constructor(
    private val userRepository: UserRepository,
    private val statisticsRepository: com.futebadosparcas.data.repository.IStatisticsRepository,
    private val groupRepository: com.futebadosparcas.data.repository.GroupRepository,
    private val inviteRepository: com.futebadosparcas.data.repository.InviteRepository,
    private val notificationRepository: com.futebadosparcas.data.repository.NotificationRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<PlayersUiState>(PlayersUiState.Loading)
    val uiState: StateFlow<PlayersUiState> = _uiState

    private val _unreadCount = MutableStateFlow(0)
    val unreadCount: StateFlow<Int> = _unreadCount

    private var allPlayers: List<User> = emptyList()
    private var currentQuery: String = ""
    private var currentFieldType: FieldType? = null
    private var currentSortOption: SortOption = SortOption.NAME

    enum class SortOption {
        NAME,
        BEST_STRIKER,
        BEST_GK
    }

    init {
        loadPlayers()
        observeUnreadCount()
    }

    private fun observeUnreadCount() {
        viewModelScope.launch {
            notificationRepository.getUnreadCountFlow().collect { count ->
                _unreadCount.value = count
            }
        }
    }

    private var searchJob: kotlinx.coroutines.Job? = null

    fun loadPlayers(query: String = "") {
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            _uiState.value = PlayersUiState.Loading
            userRepository.searchUsers(query).fold(
                 onSuccess = { users ->
                     allPlayers = users
                     currentQuery = query
                     applyFiltersAndSort()
                 },
                 onFailure = { error ->
                     _uiState.value = PlayersUiState.Error(error.message ?: "Erro ao carregar jogadores")
                 }
            )
        }
    }

    fun searchPlayers(query: String) {
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            kotlinx.coroutines.delay(500) // Debounce de 500ms
            if (currentQuery != query) {
                loadPlayers(query)
            }
        }
    }

    fun setFieldTypeFilter(fieldType: FieldType?) {
        currentFieldType = fieldType
        applyFiltersAndSort()
    }

    fun setSortOption(sortOption: SortOption) {
        currentSortOption = sortOption
        applyFiltersAndSort()
    }

    private val _comparisonState = MutableStateFlow<ComparisonUiState>(ComparisonUiState.Idle)
    val comparisonState: StateFlow<ComparisonUiState> = _comparisonState

    private val _inviteEvent = kotlinx.coroutines.flow.MutableSharedFlow<InviteUiEvent>()
    val inviteEvent: kotlinx.coroutines.flow.SharedFlow<InviteUiEvent> = _inviteEvent

    fun loadComparisonData(user1: User, user2: User) {
        viewModelScope.launch {
             _comparisonState.value = ComparisonUiState.Loading
             
             // Busca estatisticas em paralelo
             val stats1Async = async { statisticsRepository.getUserStatistics(user1.id) }
             val stats2Async = async { statisticsRepository.getUserStatistics(user2.id) }

             val result1 = stats1Async.await()
             val result2 = stats2Async.await()

             if (result1.isSuccess && result2.isSuccess) {
                 _comparisonState.value = ComparisonUiState.Ready(
                     user1 = user1, 
                     stats1 = result1.getOrNull(), 
                     user2 = user2, 
                     stats2 = result2.getOrNull()
                 )
             } else {
                 // Fallback: mostra sem stats se falhar
                 _comparisonState.value = ComparisonUiState.Ready(
                     user1 = user1, 
                     stats1 = result1.getOrNull(), 
                     user2 = user2, 
                     stats2 = result2.getOrNull()
                 )
                 // Opcional: avisar erro parcial
             }
        }
    }

    fun resetComparison() {
        _comparisonState.value = ComparisonUiState.Idle
    }
    
    fun invitePlayer(user: User) {
        viewModelScope.launch {
            // Verifica grupos onde sou admin
            groupRepository.getMyGroups().fold(
                onSuccess = { groups ->
                    val adminGroups = groups.filter { it.isAdmin() }
                    if (adminGroups.isEmpty()) {
                        _inviteEvent.emit(InviteUiEvent.Error("Você precisa ser admin de um grupo para convidar."))
                    } else if (adminGroups.size == 1) {
                        // Envia direto
                        sendInvite(adminGroups.first().groupId, user)
                    } else {
                        // Pede pra escolher
                        _inviteEvent.emit(InviteUiEvent.ShowGroupSelection(adminGroups, user))
                    }
                },
                onFailure = {
                    _inviteEvent.emit(InviteUiEvent.Error("Erro ao verificar grupos: ${it.message}"))
                }
            )
        }
    }

    fun sendInvite(groupId: String, user: User) {
        viewModelScope.launch {
            inviteRepository.createInvite(groupId, user.id).fold(
                onSuccess = {
                     _inviteEvent.emit(InviteUiEvent.InviteSent(user.name))
                },
                onFailure = {
                     _inviteEvent.emit(InviteUiEvent.Error("Erro ao enviar convite: ${it.message}"))
                }
            )
        }
    }

    private fun applyFiltersAndSort() {
        var filteredPlayers = allPlayers
        
        // Filtrar apenas jogadores com perfil público
        filteredPlayers = filteredPlayers.filter { user ->
            user.isProfilePublic
        }

        // Aplicar filtro de tipo de campo
        if (currentFieldType != null) {
            filteredPlayers = filteredPlayers.filter { user ->
                user.preferredFieldTypes.contains(currentFieldType)
            }
        }

        // Aplicar ordenação
        filteredPlayers = when (currentSortOption) {
            SortOption.NAME -> filteredPlayers.sortedBy { it.name }
            SortOption.BEST_STRIKER -> filteredPlayers.sortedByDescending { it.getEffectiveRating(PlayerRatingRole.STRIKER) }
            SortOption.BEST_GK -> filteredPlayers.sortedByDescending { it.getEffectiveRating(PlayerRatingRole.GOALKEEPER) }
        }

        _uiState.value = PlayersUiState.Success(filteredPlayers)
    }
}

sealed class PlayersUiState {
    object Loading : PlayersUiState()
    data class Success(val players: List<User>) : PlayersUiState()
    data class Error(val message: String) : PlayersUiState()
}

sealed class ComparisonUiState {
    object Idle : ComparisonUiState()
    object Loading : ComparisonUiState()
    data class Ready(
        val user1: User,
        val stats1: com.futebadosparcas.data.model.UserStatistics?,
        val user2: User,
        val stats2: com.futebadosparcas.data.model.UserStatistics?
    ) : ComparisonUiState()
    data class Error(val message: String) : ComparisonUiState()
}

sealed class InviteUiEvent {
    data class ShowGroupSelection(val groups: List<com.futebadosparcas.data.model.UserGroup>, val targetUser: User) : InviteUiEvent()
    data class InviteSent(val userName: String) : InviteUiEvent()
    data class Error(val message: String) : InviteUiEvent()
}
