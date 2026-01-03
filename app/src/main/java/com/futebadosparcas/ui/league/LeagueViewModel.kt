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
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
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

    companion object {
        private const val TAG = "LeagueViewModel"
    }

    private val _uiState = MutableStateFlow<LeagueUiState>(LeagueUiState.Loading)
    val uiState: StateFlow<LeagueUiState> = _uiState

    private val _unreadCount = MutableStateFlow(0)
    val unreadCount: StateFlow<Int> = _unreadCount

    init {
        loadLeagueData()
        observeUnreadCount()
    }

    private fun observeUnreadCount() {
        viewModelScope.launch {
            notificationRepository.getUnreadCountFlow().collect { count ->
                _unreadCount.value = count
            }
        }
    }

    /**
     * Carrega dados da liga
     */
    private val _userCache = mutableMapOf<String, User>()

    /**
     * Carrega dados da liga em tempo real
     */
    fun loadLeagueData() {
        viewModelScope.launch {
            _uiState.value = LeagueUiState.Loading

            try {
                val seasonResult = gamificationRepository.getActiveSeason()
                val season = seasonResult.getOrNull()

                if (season == null) {
                    _uiState.value = LeagueUiState.NoActiveSeason
                    return@launch
                }

                // Iniciar observação do ranking
                gamificationRepository.observeSeasonRanking(season.id, limit = 100).collect { participations ->
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

            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro ao carregar dados da liga", e)
                _uiState.value = LeagueUiState.Error("Erro ao carregar ranking: ${e.message}")
            }
        }
    }

    private suspend fun fetchMissingUsers(userIds: List<String>) {
        // Firestore "in" query supporta max 10, então fazemos em chunks ou individualmente
        // Como o ranking é limitado a 100, ok fazer loop ou chunks
        val chunks = userIds.chunked(10)
        
        chunks.forEach { chunk ->
             try {
                val snapshot = firestore.collection("users")
                    .whereIn("id", chunk)
                    .get()
                    .await()
                
                snapshot.documents.forEach { doc ->
                    val user = doc.toObject(User::class.java)
                    if (user != null) {
                        _userCache[user.id] = user
                    }
                }
             } catch (e: Exception) {
                 AppLogger.e(TAG, "Erro ao buscar users batch", e)
             }
        }
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
