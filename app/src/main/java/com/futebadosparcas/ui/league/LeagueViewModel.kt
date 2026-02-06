package com.futebadosparcas.ui.league

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.LeagueDivision
import com.futebadosparcas.data.model.Season as AndroidSeason
import com.futebadosparcas.data.model.SeasonParticipationV2
import com.futebadosparcas.data.model.User
import com.futebadosparcas.data.mapper.SeasonMapper
import com.futebadosparcas.domain.model.Season
import com.futebadosparcas.domain.repository.AuthRepository
import com.futebadosparcas.domain.repository.GamificationRepository
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import javax.inject.Inject

/**
 * ViewModel da tela de Liga/Ranking
 */
@HiltViewModel
class LeagueViewModel @Inject constructor(
    private val gamificationRepository: GamificationRepository,
    private val authRepository: AuthRepository,
    private val firestore: FirebaseFirestore,
    private val notificationRepository: com.futebadosparcas.domain.repository.NotificationRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<LeagueUiState>(LeagueUiState.Loading)
    val uiState: StateFlow<LeagueUiState> = _uiState

    private val _unreadCount = MutableStateFlow(0)
    val unreadCount: StateFlow<Int> = _unreadCount

    private val _availableSeasons = MutableStateFlow<List<AndroidSeason>>(emptyList())
    val availableSeasons: StateFlow<List<AndroidSeason>> = _availableSeasons

    private val _selectedSeason = MutableStateFlow<AndroidSeason?>(null)
    val selectedSeason: StateFlow<AndroidSeason?> = _selectedSeason

    init {
        loadAvailableSeasons()
        observeUnreadCount()
    }

    private fun observeUnreadCount() {
        unreadCountJob?.cancel()
        unreadCountJob = viewModelScope.launch {
            notificationRepository.getUnreadCountFlow()
                .catch { e ->
                    // Tratamento de erro: zerar contador em caso de falha
                    AppLogger.e(TAG, "Erro ao observar notificacoes", e)
                    _unreadCount.value = 0
                }
                .collect { count ->
                    _unreadCount.value = count
                }
        }
    }

    /**
     * Carrega todas as seasons disponíveis
     */
    private fun loadAvailableSeasons() {
        viewModelScope.launch {
            try {
                val seasonsResult = gamificationRepository.getAllSeasons()
                val seasons = seasonsResult.getOrNull() ?: emptyList()

                // Converter para Android Season models
                _availableSeasons.value = SeasonMapper.toAndroidSeasons(seasons)

                // Se há seasons, selecionar a primeira (mais recente) ou a ativa
                if (seasons.isNotEmpty()) {
                    // Preferir season ativa
                    val activeSeason = seasons.find { it.isActive }
                    _selectedSeason.value = SeasonMapper.toAndroidSeason(activeSeason ?: seasons.first())
                    loadLeagueData()
                } else {
                    _uiState.value = LeagueUiState.NoActiveSeason
                }
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro ao carregar seasons", e)
                _uiState.value = LeagueUiState.Error("Erro ao carregar temporadas: ${e.message}")
            }
        }
    }

    /**
     * Seleciona uma season diferente e recarrega os dados
     */
    fun selectSeason(season: AndroidSeason) {
        // Debounce de 500ms para evitar múltiplos refreshes rápidos durante pull-to-refresh
        val currentTime = System.currentTimeMillis()
        if (currentTime - lastRefreshTime < REFRESH_DEBOUNCE_MS) {
            // Refresh ainda em cooldown, ignora chamada
            return
        }

        lastRefreshTime = currentTime
        _selectedSeason.value = season
        loadLeagueData()
    }

    /**
     * Carrega dados da liga
     */
    private val _userCache = object : LinkedHashMap<String, User>(MAX_CACHE_SIZE, 0.75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, User>?): Boolean {
            return size > MAX_CACHE_SIZE
        }
    }

    /**
     * ✅ OTIMIZAÇÃO #5: Cancelamento de Queries Stale
     *
     * Rastreia e cancela queries que ficaram obsoletas:
     * - Quando usuário muda de temporada, cancela query anterior
     * - Quando ViewModel é destruído, cancela todas as queries pendentes
     * - Previne memory leaks e leituras desnecessárias do Firestore
     */
    private var leagueDataJob: Job? = null
    private var userFetchJob: Job? = null
    private var unreadCountJob: Job? = null

    companion object {
        private const val TAG = "LeagueViewModel"
        private const val MAX_CACHE_SIZE = 200
        private const val REFRESH_DEBOUNCE_MS = 500L
    }

    // Debounce para pull-to-refresh (500ms para evitar múltiplos refreshes rápidos)
    private var lastRefreshTime: Long = 0

    /**
     * Carrega dados da liga em tempo real
     */
    private fun loadLeagueData() {
        // ✅ OTIMIZAÇÃO #5: Cancelar queries anteriores antes de iniciar nova
        // Previne race conditions, memory leaks e leituras desnecessárias do Firestore
        leagueDataJob?.cancel()
        userFetchJob?.cancel()

        AppLogger.d(TAG) { "🔄 Carregando league data para nova temporada (queries stale canceladas)" }

        leagueDataJob = viewModelScope.launch {
            _uiState.value = LeagueUiState.Loading

            val season = _selectedSeason.value

            if (season == null) {
                _uiState.value = LeagueUiState.NoActiveSeason
                return@launch
            }

            // Iniciar observação do ranking com tratamento de erros via catch
            gamificationRepository.observeSeasonRanking(season.id, limit = 100)
                .catch { e ->
                    AppLogger.e(TAG, "Erro no Flow de ranking", e)
                    _uiState.value = LeagueUiState.Error("Erro ao carregar ranking: ${e.message}")
                }
                .collect { participations ->
                    // Converter SeasonParticipation para SeasonParticipationV2
                    val participationsV2 = participations.map { SeasonMapper.toSeasonParticipationV2(it) }

                    // 1. Identificar usuários faltantes no cache
                    val missingUserIds = participationsV2.map { it.userId }
                        .filter { !_userCache.containsKey(it) }
                        .distinct()

                    // 2. Buscar dados dos faltantes (em job separado para cancelamento independente)
                    if (missingUserIds.isNotEmpty()) {
                        // ✅ OTIMIZAÇÃO #5: Rastrear job de fetch para cancelamento
                        userFetchJob?.cancel()
                        userFetchJob = viewModelScope.launch {
                            try {
                                fetchMissingUsers(missingUserIds)
                            } catch (e: Exception) {
                                AppLogger.d(TAG) { "🔄 User fetch job cancelado ou falhou: ${e.message}" }
                            }
                        }
                    }

                    // 3. Montar RankingItems
                    val rankingItems = participationsV2.mapNotNull { part ->
                         _userCache[part.userId]?.let { user ->
                             RankingItem(participation = part, user = user)
                         }
                    }

                    // 4. Identificar usuário atual
                    val currentUserId = authRepository.getCurrentUserId()
                    val myParticipation = participationsV2.find { it.userId == currentUserId }
                    val myPosition = if (myParticipation != null) {
                        participationsV2.indexOf(myParticipation) + 1
                    } else null

                    // 5. Atualizar Estado
                    _uiState.value = LeagueUiState.Success(
                        season = season,
                        allRankings = rankingItems,
                        myParticipation = myParticipation,
                        myPosition = myPosition,
                        selectedDivision = ( _uiState.value as? LeagueUiState.Success)?.selectedDivision
                            ?: myParticipation?.division
                            ?: LeagueDivision.BRONZE
                    )
                }
        }
    }

    private suspend fun fetchMissingUsers(userIds: List<String>) = withContext(Dispatchers.IO) {
        if (userIds.isEmpty()) {
            AppLogger.d(TAG) { "fetchMissingUsers: lista vazia" }
            return@withContext
        }

        AppLogger.d(TAG) { "fetchMissingUsers: buscando ${userIds.size} usuários" }

        // Verificar cache primeiro
        val missing = userIds.filter { !_userCache.containsKey(it) }
        if (missing.isEmpty()) {
            AppLogger.d(TAG) { "Todos os usuários já estão no cache" }
            return@withContext
        }

        AppLogger.d(TAG) { "Faltando ${missing.size} usuários no cache" }

        // Firestore "in" query supporta max 10, então fazemos em chunks
        val chunks = missing.chunked(10)

        // PERF FIX: Paralelizar queries em chunks (200-300ms → 50-100ms)
        val deferredChunks = chunks.map { chunk ->
            async {
                try {
                    AppLogger.d(TAG) { "Buscando chunk de ${chunk.size} usuários" }

                    val snapshot = firestore.collection("users")
                        .whereIn(com.google.firebase.firestore.FieldPath.documentId(), chunk)
                        .get()
                        .await()

                    AppLogger.d(TAG) { "Recebido ${snapshot.documents.size} documentos" }

                    snapshot.documents.forEach { doc ->
                        val user = doc.toObject(User::class.java)
                        if (user != null) {
                            _userCache[doc.id] = user
                            AppLogger.d(TAG) { "User adicionado ao cache: ${doc.id}" }
                        } else {
                            AppLogger.w(TAG) { "Falha ao desserializar user: ${doc.id}" }
                        }
                    }
                } catch (e: Exception) {
                    AppLogger.e(TAG, "Erro ao buscar users batch", e)

                    // Fallback: tentar buscar individualmente
                    chunk.forEach { userId ->
                        try {
                            val doc = firestore.collection("users").document(userId).get().await()
                            if (doc.exists()) {
                                val user = doc.toObject(User::class.java)
                                if (user != null) {
                                    _userCache[userId] = user
                                    AppLogger.d(TAG) { "User buscado individualmente: $userId" }
                                }
                            }
                        } catch (e2: Exception) {
                            AppLogger.e(TAG, "Erro ao buscar user $userId", e2)
                        }
                    }
                }
            }
        }

        // Aguardar todos os chunks em paralelo
        deferredChunks.awaitAll()

        AppLogger.d(TAG) { "fetchMissingUsers concluído. Cache tem ${_userCache.size} usuários" }
    }

    /**
     * Filtra ranking por divisão
     */
    fun filterByDivision(division: LeagueDivision) {
        val currentState = _uiState.value
        if (currentState is LeagueUiState.Success) {
            _uiState.value = currentState.copy(selectedDivision = division)
        }
    }

    /**
     * Retorna o ranking filtrado pela divisão selecionada
     */
    fun getFilteredRanking(state: LeagueUiState.Success): List<RankingItem> {
        return state.allRankings.filter { it.participation.division == state.selectedDivision }
    }

    override fun onCleared() {
        super.onCleared()
        // ✅ OTIMIZAÇÃO #5: Cancelar todas as queries pendentes ao destruir ViewModel
        // Previne memory leaks, conexões abertas e leituras desnecessárias do Firestore
        leagueDataJob?.cancel()
        userFetchJob?.cancel()
        unreadCountJob?.cancel()
        AppLogger.d(TAG) { "LeagueViewModel destruido - todas as queries canceladas" }
    }
}

/**
 * Estados da UI da tela de Liga
 */
sealed class LeagueUiState {
    object Loading : LeagueUiState()
    object NoActiveSeason : LeagueUiState()
    data class Error(val message: String) : LeagueUiState()
    data class Success(
        val season: AndroidSeason,
        val allRankings: List<RankingItem>,
        val myParticipation: SeasonParticipationV2?,
        val myPosition: Int?,
        val selectedDivision: LeagueDivision
    ) : LeagueUiState()
}

/**
 * Item do ranking com dados do usuário e participação
 */
data class RankingItem(
    val participation: SeasonParticipationV2,
    val user: User
)
