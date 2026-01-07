package com.futebadosparcas.ui.league

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.LeagueDivision
import com.futebadosparcas.data.model.Season
import com.futebadosparcas.data.model.SeasonParticipationV2
import com.futebadosparcas.data.model.User
import com.futebadosparcas.data.repository.AuthRepository
import com.futebadosparcas.data.repository.GamificationRepository
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

/**
 * ViewModel da tela de Liga/Ranking
 */
@HiltViewModel
class LeagueViewModel @Inject constructor(
    private val gamificationRepository: GamificationRepository,
    private val authRepository: AuthRepository,
    private val firestore: FirebaseFirestore,
    private val notificationRepository: com.futebadosparcas.data.repository.NotificationRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<LeagueUiState>(LeagueUiState.Loading)
    val uiState: StateFlow<LeagueUiState> = _uiState

    private val _unreadCount = MutableStateFlow(0)
    val unreadCount: StateFlow<Int> = _unreadCount

    private val _availableSeasons = MutableStateFlow<List<Season>>(emptyList())
    val availableSeasons: StateFlow<List<Season>> = _availableSeasons

    private val _selectedSeason = MutableStateFlow<Season?>(null)
    val selectedSeason: StateFlow<Season?> = _selectedSeason

    init {
        loadAvailableSeasons()
        observeUnreadCount()
    }

    private fun observeUnreadCount() {
        viewModelScope.launch {
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

                _availableSeasons.value = seasons

                // Se há seasons, selecionar a primeira (mais recente) ou a ativa
                if (seasons.isNotEmpty()) {
                    // Preferir season ativa
                    val activeSeason = seasons.find { it.isActive }
                    _selectedSeason.value = activeSeason ?: seasons.first()
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
    fun selectSeason(season: Season) {
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

    private var leagueDataJob: Job? = null

    companion object {
        private const val TAG = "LeagueViewModel"
        private const val MAX_CACHE_SIZE = 200
    }

    /**
     * Carrega dados da liga em tempo real
     */
    private fun loadLeagueData() {
        // Cancelar job anterior para evitar race condition
        leagueDataJob?.cancel()

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
                    // 1. Identificar usuários faltantes no cache
                    val missingUserIds = participations.map { it.userId }
                        .filter { !_userCache.containsKey(it) }
                        .distinct()

                    // 2. Buscar dados dos faltantes
                    if (missingUserIds.isNotEmpty()) {
                        fetchMissingUsers(missingUserIds)
                    }

                    // 3. Montar RankingItems
                    val rankingItems = participations.mapNotNull { part ->
                         _userCache[part.userId]?.let { user ->
                             RankingItem(participation = part, user = user)
                         }
                    }

                    // 4. Identificar usuário atual
                    val currentUserId = authRepository.getCurrentUserId()
                    val myParticipation = participations.find { it.userId == currentUserId }
                    val myPosition = if (myParticipation != null) {
                        participations.indexOf(myParticipation) + 1
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

    private suspend fun fetchMissingUsers(userIds: List<String>) {
        if (userIds.isEmpty()) {
            AppLogger.d(TAG) { "fetchMissingUsers: lista vazia" }
            return
        }

        AppLogger.d(TAG) { "fetchMissingUsers: buscando ${userIds.size} usuários" }

        // Firestore "in" query supporta max 10, então fazemos em chunks
        val chunks = userIds.chunked(10)

        chunks.forEach { chunk ->
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
        leagueDataJob?.cancel()
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
        val season: Season,
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
