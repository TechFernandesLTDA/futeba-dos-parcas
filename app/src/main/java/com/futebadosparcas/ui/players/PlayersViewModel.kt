package com.futebadosparcas.ui.players

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.FieldType
import com.futebadosparcas.domain.model.PlayerRatingRole
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.util.AppLogger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch

@OptIn(FlowPreview::class)
class PlayersViewModel(
    private val userRepository: UserRepository,
    private val statisticsRepository: com.futebadosparcas.data.repository.IStatisticsRepository,
    private val groupRepository: com.futebadosparcas.data.repository.GroupRepository,
    private val inviteRepository: com.futebadosparcas.domain.repository.InviteRepository,
    private val notificationRepository: com.futebadosparcas.domain.repository.NotificationRepository,
    private val savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val _uiState = MutableStateFlow<PlayersUiState>(PlayersUiState.Loading)
    val uiState: StateFlow<PlayersUiState> = _uiState

    private val _unreadCount = MutableStateFlow(0)
    val unreadCount: StateFlow<Int> = _unreadCount

    // Estatísticas do jogador selecionado para o PlayerCard
    private val _selectedPlayerStats = MutableStateFlow<com.futebadosparcas.domain.model.Statistics?>(null)
    val selectedPlayerStats: StateFlow<com.futebadosparcas.domain.model.Statistics?> = _selectedPlayerStats

    // Flow para busca com debounce automático
    private val _searchQuery = MutableSharedFlow<String>(replay = 1)

    private var allPlayers: List<User> = emptyList()

    // SavedState para persistir filtros e ordenação
    var currentQuery: String
        get() = savedStateHandle.get<String>(KEY_CURRENT_QUERY) ?: ""
        set(value) = savedStateHandle.set(KEY_CURRENT_QUERY, value)

    var currentFieldType: FieldType?
        get() = savedStateHandle.get<String>(KEY_CURRENT_FIELD_TYPE)?.let {
            runCatching { FieldType.valueOf(it) }.getOrNull()
        }
        set(value) = savedStateHandle.set(KEY_CURRENT_FIELD_TYPE, value?.name)

    var currentSortOption: SortOption
        get() = savedStateHandle.get<String>(KEY_CURRENT_SORT_OPTION)?.let {
            runCatching { SortOption.valueOf(it) }.getOrDefault(SortOption.NAME)
        } ?: SortOption.NAME
        set(value) = savedStateHandle.set(KEY_CURRENT_SORT_OPTION, value.name)

    enum class SortOption {
        NAME,
        BEST_STRIKER,
        BEST_GK
    }

    private var searchJob: Job? = null
    private var unreadCountJob: Job? = null
    private var playerStatsJob: Job? = null
    private var comparisonJob: Job? = null

    init {
        // Sempre carregar jogadores ao inicializar
        // Query vazia = todos os jogadores
        if (currentQuery.isNotEmpty()) {
            loadPlayers(currentQuery)
        } else {
            // Carregar lista completa de jogadores (query vazia)
            loadPlayers("")
        }
        observeUnreadCount()
        observeSearchQuery()
    }

    private fun observeUnreadCount() {
        unreadCountJob?.cancel()
        unreadCountJob = viewModelScope.launch {
            notificationRepository.getUnreadCountFlow()
                .catch { e ->
                    // Tratamento de erro: zerar contador em caso de falha
                    AppLogger.e(TAG, "Erro ao observar notificações", e)
                    _unreadCount.value = 0
                }
                .collect { count ->
                    _unreadCount.value = count
                }
        }
    }

    /**
     * Carrega estatísticas de um jogador específico para exibir no PlayerCard.
     * Cancela job anterior para evitar coleções concorrentes ao trocar de jogador.
     */
    fun loadPlayerStats(userId: String) {
        playerStatsJob?.cancel()
        playerStatsJob = viewModelScope.launch {
            _selectedPlayerStats.value = null // Limpar anterior
            try {
                statisticsRepository.getStatistics(userId)
                    .onSuccess { stats ->
                        _selectedPlayerStats.value = stats
                    }
                    .onFailure { e ->
                        AppLogger.w(TAG) { "Erro ao carregar estatísticas do jogador $userId: ${e.message}" }
                        _selectedPlayerStats.value = null
                    }
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro inesperado ao carregar estatísticas", e)
                _selectedPlayerStats.value = null
            }
        }
    }

    /**
     * Limpa as estatísticas do jogador selecionado.
     */
    fun clearPlayerStats() {
        _selectedPlayerStats.value = null
    }

    /**
     * Observa queries de busca com debounce automático de 300ms
     * Evita múltiplas requisições em rápida sucessão durante digitação
     */
    private fun observeSearchQuery() {
        viewModelScope.launch {
            _searchQuery
                .debounce(DEBOUNCE_MILLIS) // Debounce de 300ms
                .distinctUntilChanged() // Só processa se a query mudou
                .catch { e ->
                    AppLogger.e(TAG, "Erro no fluxo de busca", e)
                    _uiState.value = PlayersUiState.Error("Erro ao buscar jogadores")
                }
                .collect { query ->
                    loadPlayersInternal(query)
                }
        }
    }

    override fun onCleared() {
        super.onCleared()
        searchJob?.cancel()
        unreadCountJob?.cancel()
        playerStatsJob?.cancel()
        comparisonJob?.cancel()
    }

    /**
     * Carrega jogadores com query de busca
     * Usa debounce automático via Flow
     */
    fun loadPlayers(query: String = "") {
        currentQuery = query
        viewModelScope.launch {
            _searchQuery.emit(query)
        }
    }

    /**
     * Implementação interna de carregamento de jogadores
     * Chamada pelo Flow com debounce
     */
    private fun loadPlayersInternal(query: String) {
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            try {
                _uiState.value = PlayersUiState.Loading

                // Query vazia = carregar todos os jogadores
                val result = if (query.isEmpty()) {
                    userRepository.getAllUsers()
                } else {
                    userRepository.searchUsers(query, limit = 100)
                }

                result.fold(
                    onSuccess = { users ->
                        allPlayers = users
                        applyFiltersAndSort()
                    },
                    onFailure = { error ->
                        AppLogger.e(TAG, "Erro ao carregar jogadores", error)
                        _uiState.value = PlayersUiState.Error(
                            error.message ?: "Erro ao carregar jogadores"
                        )
                    }
                )
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro inesperado ao carregar jogadores", e)
                _uiState.value = PlayersUiState.Error(
                    e.message ?: "Erro inesperado"
                )
            }
        }
    }

    /**
     * Busca jogadores com debounce automático
     * Usa Flow interno para evitar requisições desnecessárias
     */
    fun searchPlayers(query: String) {
        loadPlayers(query)
    }

    /**
     * Define filtro de tipo de campo e persiste no SavedState
     */
    fun setFieldTypeFilter(fieldType: FieldType?) {
        currentFieldType = fieldType
        applyFiltersAndSort()
    }

    /**
     * Define opção de ordenação e persiste no SavedState
     */
    fun setSortOption(sortOption: SortOption) {
        currentSortOption = sortOption
        applyFiltersAndSort()
    }

    /**
     * Limpa todos os filtros
     */
    fun clearFilters() {
        currentFieldType = null
        currentSortOption = SortOption.NAME
        applyFiltersAndSort()
    }

    private val _comparisonState = MutableStateFlow<ComparisonUiState>(ComparisonUiState.Idle)
    val comparisonState: StateFlow<ComparisonUiState> = _comparisonState

    private val _inviteEvent = MutableSharedFlow<InviteUiEvent>()
    val inviteEvent: SharedFlow<InviteUiEvent> = _inviteEvent

    /**
     * Carrega dados de comparação entre dois jogadores
     * - Busca estatísticas em paralelo para melhor performance
     * - Tratamento de erro gracioso com fallback
     * - Cancela comparação anterior para evitar race conditions
     */
    fun loadComparisonData(user1: User, user2: User) {
        comparisonJob?.cancel()
        comparisonJob = viewModelScope.launch {
            try {
                _comparisonState.value = ComparisonUiState.Loading

                // Busca estatisticas em paralelo
                val stats1Async = async {
                    runCatching { statisticsRepository.getStatistics(user1.id) }
                }
                val stats2Async = async {
                    runCatching { statisticsRepository.getStatistics(user2.id) }
                }

                val result1 = stats1Async.await()
                val result2 = stats2Async.await()

                // Sempre mostra resultado, mesmo com falhas parciais
                _comparisonState.value = ComparisonUiState.Ready(
                    user1 = user1,
                    stats1 = result1.getOrNull()?.getOrNull(),
                    user2 = user2,
                    stats2 = result2.getOrNull()?.getOrNull()
                )

                // Log de erros se houver
                if (result1.isFailure) {
                    AppLogger.e(TAG, "Erro ao carregar estatísticas do usuário ${user1.id}", result1.exceptionOrNull())
                }
                if (result2.isFailure) {
                    AppLogger.e(TAG, "Erro ao carregar estatísticas do usuário ${user2.id}", result2.exceptionOrNull())
                }
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro ao carregar comparação", e)
                _comparisonState.value = ComparisonUiState.Error("Erro ao carregar comparação")
            }
        }
    }

    fun resetComparison() {
        _comparisonState.value = ComparisonUiState.Idle
    }

    /**
     * Convida jogador para um grupo
     * - Verifica grupos onde usuário é admin
     * - Se apenas 1 grupo, envia direto
     * - Se múltiplos, pede para escolher
     */
    fun invitePlayer(user: User) {
        viewModelScope.launch {
            try {
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
                    onFailure = { error ->
                        AppLogger.e(TAG, "Erro ao verificar grupos", error)
                        _inviteEvent.emit(InviteUiEvent.Error("Erro ao verificar grupos: ${error.message}"))
                    }
                )
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro ao convidar jogador", e)
                _inviteEvent.emit(InviteUiEvent.Error("Erro ao convidar jogador"))
            }
        }
    }

    /**
     * Envia convite para jogador em grupo específico
     */
    fun sendInvite(groupId: String, user: User) {
        viewModelScope.launch {
            try {
                inviteRepository.createInvite(groupId, user.id).fold(
                    onSuccess = {
                        _inviteEvent.emit(InviteUiEvent.InviteSent(user.name))
                    },
                    onFailure = { error ->
                        AppLogger.e(TAG, "Erro ao enviar convite", error)
                        _inviteEvent.emit(InviteUiEvent.Error("Erro ao enviar convite: ${error.message}"))
                    }
                )
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro ao enviar convite", e)
                _inviteEvent.emit(InviteUiEvent.Error("Erro ao enviar convite"))
            }
        }
    }

    /**
     * Aplica filtros e ordenação à lista de jogadores
     * - Filtra apenas perfis públicos
     * - Aplica filtro de tipo de campo se definido
     * - Aplica ordenação selecionada
     */
    private fun applyFiltersAndSort() {
        try {
            var filteredPlayers = allPlayers

            // Filtrar apenas jogadores com perfil público
            filteredPlayers = filteredPlayers.filter { user ->
                user.isProfilePublic
            }

            // Aplicar filtro de tipo de campo
            currentFieldType?.let { fieldType ->
                filteredPlayers = filteredPlayers.filter { user ->
                    user.preferredFieldTypes.contains(fieldType)
                }
            }

            // Aplicar ordenação
            filteredPlayers = when (currentSortOption) {
                SortOption.NAME -> filteredPlayers.sortedBy { it.name }
                SortOption.BEST_STRIKER -> filteredPlayers.sortedByDescending {
                    it.getEffectiveRating(PlayerRatingRole.STRIKER)
                }
                SortOption.BEST_GK -> filteredPlayers.sortedByDescending {
                    it.getEffectiveRating(PlayerRatingRole.GOALKEEPER)
                }
            }

            _uiState.value = if (filteredPlayers.isEmpty()) {
                PlayersUiState.Empty
            } else {
                PlayersUiState.Success(filteredPlayers)
            }
        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro ao aplicar filtros", e)
            _uiState.value = PlayersUiState.Error("Erro ao filtrar jogadores")
        }
    }

    companion object {
        private const val TAG = "PlayersViewModel"
        private const val DEBOUNCE_MILLIS = 300L
        private const val KEY_CURRENT_QUERY = "current_query"
        private const val KEY_CURRENT_FIELD_TYPE = "current_field_type"
        private const val KEY_CURRENT_SORT_OPTION = "current_sort_option"
    }
}

/**
 * Estados semânticos para a UI de jogadores
 * - Loading: Carregando dados
 * - Empty: Nenhum jogador encontrado
 * - Success: Jogadores carregados com sucesso
 * - Error: Erro ao carregar
 */
sealed class PlayersUiState {
    object Loading : PlayersUiState()
    object Empty : PlayersUiState()
    data class Success(val players: List<User>) : PlayersUiState()
    data class Error(val message: String) : PlayersUiState()
}

sealed class ComparisonUiState {
    object Idle : ComparisonUiState()
    object Loading : ComparisonUiState()
    data class Ready(
        val user1: User,
        val stats1: com.futebadosparcas.domain.model.Statistics?,
        val user2: User,
        val stats2: com.futebadosparcas.domain.model.Statistics?
    ) : ComparisonUiState()
    data class Error(val message: String) : ComparisonUiState()
}

sealed class InviteUiEvent {
    data class ShowGroupSelection(val groups: List<com.futebadosparcas.data.model.UserGroup>, val targetUser: User) : InviteUiEvent()
    data class InviteSent(val userName: String) : InviteUiEvent()
    data class Error(val message: String) : InviteUiEvent()
}
