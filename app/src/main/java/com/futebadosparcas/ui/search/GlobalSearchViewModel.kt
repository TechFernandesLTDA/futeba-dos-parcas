package com.futebadosparcas.ui.search

import com.futebadosparcas.util.AppLogger
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.domain.repository.GroupRepository
import com.futebadosparcas.domain.repository.LocationRepository
import com.futebadosparcas.domain.repository.UserRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

// ==================== ViewModel-specific Models ====================

/**
 * Estado da UI de busca global.
 */
sealed class GlobalSearchUiState {
    data object Idle : GlobalSearchUiState()
    data object Loading : GlobalSearchUiState()
    data class Success(val results: List<GlobalSearchResult>) : GlobalSearchUiState()
    data class Error(val message: String) : GlobalSearchUiState()
}

/**
 * Filtro de busca.
 */
enum class SearchFilter {
    ALL, GAMES, GROUPS, PLAYERS, LOCATIONS
}

/**
 * Tipo de resultado de busca.
 */
enum class SearchResultType {
    GAME, GROUP, PLAYER, LOCATION
}

/**
 * Resultado de busca genérico para o ViewModel.
 */
data class GlobalSearchResult(
    val id: String,
    val type: SearchResultType,
    val title: String,
    val subtitle: String?,
    val imageUrl: String?,
    val relevanceScore: Float = 0f
)

/**
 * ViewModel para a tela de busca global.
 * Realiza busca em jogos, grupos, jogadores e locais.
 */
class GlobalSearchViewModel(
    private val gameRepository: GameRepository,
    private val groupRepository: GroupRepository,
    private val userRepository: UserRepository,
    private val locationRepository: LocationRepository,
    private val dataStore: DataStore<Preferences>
) : ViewModel() {

    companion object {
        private const val TAG = "GlobalSearchViewModel"
        private const val DEBOUNCE_MS = 300L
        private const val MAX_RECENT_SEARCHES = 10
        private const val MIN_QUERY_LENGTH = 2
        // A persistência reutiliza o DataStore já registrado no app. A chave é
        // namespaced por usuário para não compartilhar histórico entre contas.
        private const val RECENT_SEARCHES_KEY_PREFIX = "search_history_recent_"
        private const val SEPARATOR = "\n"
    }

    private val _uiState = MutableStateFlow<GlobalSearchUiState>(GlobalSearchUiState.Idle)
    val uiState: StateFlow<GlobalSearchUiState> = _uiState.asStateFlow()

    private val _query = MutableStateFlow("")
    val query: StateFlow<String> = _query.asStateFlow()

    private val _selectedCategory = MutableStateFlow(SearchFilter.ALL)
    val selectedCategory: StateFlow<SearchFilter> = _selectedCategory.asStateFlow()

    private val _recentSearches = MutableStateFlow<List<String>>(emptyList())
    val recentSearches: StateFlow<List<String>> = _recentSearches.asStateFlow()

    private var searchJob: Job? = null

    init {
        loadRecentSearches()
    }

    /**
     * Atualiza a query de busca com debounce.
     */
    fun onQueryChange(newQuery: String) {
        _query.value = newQuery

        searchJob?.cancel()

        if (newQuery.length >= MIN_QUERY_LENGTH) {
            searchJob = viewModelScope.launch {
                delay(DEBOUNCE_MS)
                performSearch(newQuery)
            }
        } else {
            _uiState.value = GlobalSearchUiState.Idle
        }
    }

    /**
     * Limpa a query de busca.
     */
    fun clearQuery() {
        _query.value = ""
        _uiState.value = GlobalSearchUiState.Idle
        searchJob?.cancel()
    }

    /**
     * Seleciona um filtro de busca.
     */
    fun onFilterSelected(filter: SearchFilter) {
        _selectedCategory.value = filter
        if (_query.value.length >= MIN_QUERY_LENGTH) {
            search()
        }
    }

    /**
     * Executa a busca imediatamente.
     */
    fun search() {
        val currentQuery = _query.value
        if (currentQuery.length >= MIN_QUERY_LENGTH) {
            searchJob?.cancel()
            searchJob = viewModelScope.launch {
                performSearch(currentQuery)
            }
        }
    }

    /**
     * Limpa o histórico de buscas.
     */
    fun clearHistory() {
        _recentSearches.value = emptyList()
        viewModelScope.launch {
            val key = recentSearchesKey() ?: return@launch
            runCatching {
                dataStore.edit { prefs -> prefs.remove(key) }
            }.onFailure { e ->
                AppLogger.e(TAG, "Falha ao limpar histórico de buscas", e)
            }
        }
    }

    /**
     * Realiza a busca em todos os repositórios.
     */
    private suspend fun performSearch(query: String) {
        _uiState.value = GlobalSearchUiState.Loading

        try {
            val results = mutableListOf<GlobalSearchResult>()
            val filter = _selectedCategory.value
            val normalizedQuery = query.lowercase().trim()

            // Busca em paralelo baseado no filtro
            val deferreds = mutableListOf<kotlinx.coroutines.Deferred<Unit>>()

            // Jogos - busca todos os jogos e filtra localmente
            if (filter == SearchFilter.ALL || filter == SearchFilter.GAMES) {
                deferreds.add(viewModelScope.async {
                    try {
                        val gamesResult = gameRepository.getUpcomingGames()
                        gamesResult.getOrNull()?.let { games ->
                            val filteredGames = games.filter { game ->
                                game.ownerName.lowercase().contains(normalizedQuery) ||
                                game.locationName.lowercase().contains(normalizedQuery) ||
                                (game.groupName?.lowercase()?.contains(normalizedQuery) == true)
                            }
                            synchronized(results) {
                                results.addAll(filteredGames.map { game ->
                                    GlobalSearchResult(
                                        id = game.id,
                                        type = SearchResultType.GAME,
                                        title = game.ownerName.ifEmpty { "Jogo" },
                                        subtitle = "${game.date} - ${game.locationName}",
                                        imageUrl = null,
                                        relevanceScore = calculateRelevance(game.ownerName, normalizedQuery)
                                    )
                                })
                            }
                        }
                    } catch (e: Exception) {
                        AppLogger.w(TAG) { "Erro ao buscar jogos: ${e.message}" }
                    }
                    Unit
                })
            }

            // Grupos - busca todos os grupos do usuário e filtra localmente
            if (filter == SearchFilter.ALL || filter == SearchFilter.GROUPS) {
                deferreds.add(viewModelScope.async {
                    try {
                        val groupsResult = groupRepository.getUserGroups()
                        groupsResult.getOrNull()?.let { userGroups ->
                            val filteredGroups = userGroups.filter { userGroup ->
                                userGroup.groupName.lowercase().contains(normalizedQuery)
                            }
                            synchronized(results) {
                                results.addAll(filteredGroups.map { userGroup ->
                                    GlobalSearchResult(
                                        id = userGroup.groupId,
                                        type = SearchResultType.GROUP,
                                        title = userGroup.groupName,
                                        subtitle = userGroup.role,
                                        imageUrl = userGroup.groupPhoto,
                                        relevanceScore = calculateRelevance(userGroup.groupName, normalizedQuery)
                                    )
                                })
                            }
                        }
                    } catch (e: Exception) {
                        AppLogger.w(TAG) { "Erro ao buscar grupos: ${e.message}" }
                    }
                    Unit
                })
            }

            // Jogadores - usa método de pesquisa do repositório
            if (filter == SearchFilter.ALL || filter == SearchFilter.PLAYERS) {
                deferreds.add(viewModelScope.async {
                    try {
                        val usersResult = userRepository.searchUsers(normalizedQuery)
                        usersResult.getOrNull()?.let { users ->
                            synchronized(results) {
                                results.addAll(users.map { user ->
                                    GlobalSearchResult(
                                        id = user.id,
                                        type = SearchResultType.PLAYER,
                                        title = user.getDisplayName(),
                                        subtitle = "Nível ${user.level}",
                                        imageUrl = user.photoUrl,
                                        relevanceScore = calculateRelevance(user.name, normalizedQuery)
                                    )
                                })
                            }
                        }
                    } catch (e: Exception) {
                        AppLogger.w(TAG) { "Erro ao buscar jogadores: ${e.message}" }
                    }
                    Unit
                })
            }

            // Locais - usa método de pesquisa do repositório
            if (filter == SearchFilter.ALL || filter == SearchFilter.LOCATIONS) {
                deferreds.add(viewModelScope.async {
                    try {
                        val locationsResult = locationRepository.searchLocations(normalizedQuery)
                        locationsResult.getOrNull()?.let { locations ->
                            synchronized(results) {
                                results.addAll(locations.map { location ->
                                    GlobalSearchResult(
                                        id = location.id,
                                        type = SearchResultType.LOCATION,
                                        title = location.name,
                                        subtitle = location.address,
                                        imageUrl = location.photoUrl,
                                        relevanceScore = calculateRelevance(location.name, normalizedQuery)
                                    )
                                })
                            }
                        }
                    } catch (e: Exception) {
                        AppLogger.w(TAG) { "Erro ao buscar locais: ${e.message}" }
                    }
                    Unit
                })
            }

            // Aguarda todas as buscas
            deferreds.awaitAll()

            // Ordena por relevância
            val sortedResults = results.sortedByDescending { it.relevanceScore }

            // Salva no histórico
            saveToRecentSearches(query)

            _uiState.value = GlobalSearchUiState.Success(sortedResults)

        } catch (e: Exception) {
            AppLogger.e(TAG, "Erro na busca", e)
            _uiState.value = GlobalSearchUiState.Error("Erro ao buscar. Tente novamente.")
        }
    }

    /**
     * Calcula relevância do resultado baseado na query.
     */
    private fun calculateRelevance(text: String, query: String): Float {
        val normalizedText = text.lowercase()
        return when {
            normalizedText == query -> 1.0f
            normalizedText.startsWith(query) -> 0.9f
            normalizedText.contains(query) -> 0.7f
            else -> 0.5f
        }
    }

    /**
     * Salva busca no histórico.
     */
    private fun saveToRecentSearches(query: String) {
        val current = _recentSearches.value.toMutableList()
        current.remove(query)
        current.add(0, query)
        val updated = current.take(MAX_RECENT_SEARCHES)
        _recentSearches.value = updated
        viewModelScope.launch {
            val key = recentSearchesKey() ?: return@launch
            runCatching {
                dataStore.edit { prefs ->
                    prefs[key] = updated.joinToString(SEPARATOR)
                }
            }.onFailure { e ->
                AppLogger.e(TAG, "Falha ao salvar histórico de buscas", e)
            }
        }
    }

    /**
     * Carrega o histórico do usuário atual. A chave global legada não é lida,
     * pois pode conter termos de outra conta usada no mesmo dispositivo.
     */
    private fun loadRecentSearches() {
        viewModelScope.launch {
            val key = recentSearchesKey() ?: return@launch
            runCatching {
                val prefs = dataStore.data.first()
                val raw = prefs[key].orEmpty()
                val list = if (raw.isEmpty()) emptyList()
                    else raw.split(SEPARATOR).filter { it.isNotBlank() }.take(MAX_RECENT_SEARCHES)
                _recentSearches.value = list
            }.onFailure { e ->
                AppLogger.e(TAG, "Falha ao carregar histórico de buscas", e)
                _recentSearches.value = emptyList()
            }
        }
    }

    private fun recentSearchesKey(): Preferences.Key<String>? =
        userRepository.getCurrentUserId()
            ?.takeIf(String::isNotBlank)
            ?.let { userId -> stringPreferencesKey("$RECENT_SEARCHES_KEY_PREFIX$userId") }

    override fun onCleared() {
        super.onCleared()
        searchJob?.cancel()
    }
}
