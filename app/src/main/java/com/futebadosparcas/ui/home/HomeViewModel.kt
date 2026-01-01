package com.futebadosparcas.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.LeagueDivision
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.data.repository.GamificationRepository
import com.futebadosparcas.data.repository.UserRepository
import com.futebadosparcas.util.AppLogger
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val gameRepository: GameRepository,
    private val userRepository: UserRepository,
    private val notificationRepository: com.futebadosparcas.data.repository.NotificationRepository,
    private val gamificationRepository: GamificationRepository,
    private val statisticsRepository: com.futebadosparcas.data.repository.StatisticsRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<HomeUiState>(HomeUiState.Loading)
    val uiState: StateFlow<HomeUiState> = _uiState

    private val _unreadCount = MutableStateFlow(0)
    val unreadCount: StateFlow<Int> = _unreadCount

    init {
        observeUnreadCount()
    }

    private fun observeUnreadCount() {
        viewModelScope.launch {
            notificationRepository.getUnreadCountFlow().collect { count ->
                _unreadCount.value = count
            }
        }
    }

    private var loadJob: Job? = null

    fun loadHomeData() {
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            _uiState.value = HomeUiState.Loading

            // Parallelize data fetching
            val userDeferred = async { userRepository.getCurrentUser() }
            val gamesDeferred = async { gameRepository.getConfirmedUpcomingGamesForUser() }

            val userResult = userDeferred.await()
            val statsDeferred = async { statisticsRepository.getUserStatistics(userResult.getOrNull()?.id ?: "") }

            val gamesResult = gamesDeferred.await()
            val statsResult = statsDeferred.await()

            userResult.fold(
                onSuccess = { user ->
                    val games = gamesResult.getOrDefault(emptyList())
                    val statistics = statsResult.getOrNull()
                    
                    // Fetch League info
                    var leagueDivision = LeagueDivision.BRONZE
                    try {
                        val seasonResult = gamificationRepository.getActiveSeason()
                        seasonResult.getOrNull()?.let { season ->
                            val participationResult = gamificationRepository.getUserParticipation(user.id, season.id)
                            participationResult.getOrNull()?.let { participation ->
                                leagueDivision = participation.division
                            }
                        }
                    } catch (e: Exception) {
                        AppLogger.e(TAG, "Erro ao carregar dados da liga", e)
                    }
                    
                    // Calculate Gamification Summary
                    val (progressXp, neededXp) = com.futebadosparcas.data.model.LevelTable.getXpProgress(user.experiencePoints)
                    val isMaxLevel = user.level >= 10
                    
                    val percent = if (isMaxLevel) 100 else {
                        if (neededXp > 0L) (progressXp * 100L / neededXp).toInt() else 100
                    }
                    
                    val summary = GamificationSummary(
                        level = user.level,
                        levelName = com.futebadosparcas.data.model.LevelTable.getLevelName(user.level),
                        nextLevelXp = neededXp - progressXp,
                        nextLevelName = if (isMaxLevel) "" else com.futebadosparcas.data.model.LevelTable.getLevelName(user.level + 1),
                        progressPercent = percent,
                        isMaxLevel = isMaxLevel,
                        division = leagueDivision
                    )

                    _uiState.value = HomeUiState.Success(user, games, summary, statistics)
                },
                onFailure = { error ->
                    _uiState.value = HomeUiState.Error(error.message ?: "Erro ao carregar perfil")
                }
            )
        }
    }
    
    fun getCurrentUserId(): String? {
        return userRepository.getCurrentUserId()
    }

    companion object {
        private const val TAG = "HomeViewModel"
    }
}

data class GamificationSummary(
    val level: Int,
    val levelName: String,
    val nextLevelXp: Long,
    val nextLevelName: String,
    val progressPercent: Int,
    val isMaxLevel: Boolean,
    val division: LeagueDivision
)

sealed class HomeUiState {
    object Loading : HomeUiState()
    data class Success(
        val user: com.futebadosparcas.data.model.User, 
        val games: List<Game>,
        val gamificationSummary: GamificationSummary,
        val statistics: com.futebadosparcas.data.model.UserStatistics? = null
    ) : HomeUiState()
    data class Error(val message: String) : HomeUiState()
}
