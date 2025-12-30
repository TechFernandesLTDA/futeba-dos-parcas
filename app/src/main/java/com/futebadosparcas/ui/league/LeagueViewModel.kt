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
    fun loadLeagueData() {
        viewModelScope.launch {
            _uiState.value = LeagueUiState.Loading

            try {
                // Buscar temporada ativa
                val seasonResult = gamificationRepository.getActiveSeason()
                val season = seasonResult.getOrNull()

                if (season == null) {
                    _uiState.value = LeagueUiState.NoActiveSeason
                    return@launch
                }

                // Buscar ranking completo
                val rankingResult = gamificationRepository.getSeasonRanking(season.id, limit = 100)
                val allParticipations = rankingResult.getOrThrow()

                // Buscar dados dos usuários
                val rankingWithUsers = loadUserDataForRanking(allParticipations)

                // Buscar minha participação
                val currentUserId = authRepository.getCurrentUserId()
                val myParticipation = if (currentUserId != null) {
                    allParticipations.find { it.userId == currentUserId }
                } else {
                    null
                }

                // Calcular minha posição
                val myPosition = if (myParticipation != null) {
                    allParticipations.indexOf(myParticipation) + 1
                } else {
                    null
                }

                _uiState.value = LeagueUiState.Success(
                    season = season,
                    allRankings = rankingWithUsers,
                    myParticipation = myParticipation,
                    myPosition = myPosition,
                    selectedDivision = myParticipation?.division ?: LeagueDivision.BRONZE
                )

            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro ao carregar dados da liga", e)
                _uiState.value = LeagueUiState.Error("Erro ao carregar ranking: ${e.message}")
            }
        }
    }

    /**
     * Carrega dados dos usuários para o ranking
     */
    private suspend fun loadUserDataForRanking(participations: List<SeasonParticipationV2>): List<RankingItem> {
        return participations.mapNotNull { participation ->
            try {
                val userDoc = firestore.collection("users")
                    .document(participation.userId)
                    .get()
                    .await()

                val user = userDoc.toObject(User::class.java)
                if (user != null) {
                    RankingItem(
                        participation = participation,
                        user = user
                    )
                } else {
                    null
                }
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro ao buscar usuário ${participation.userId}", e)
                null
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
