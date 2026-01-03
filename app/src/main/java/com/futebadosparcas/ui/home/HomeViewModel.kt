package com.futebadosparcas.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.Activity
import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.model.WeeklyChallenge
import com.futebadosparcas.data.model.UserChallengeProgress
import com.futebadosparcas.data.model.UserBadge
import com.futebadosparcas.data.model.LeagueDivision
import com.futebadosparcas.data.repository.GameRepository
import com.futebadosparcas.data.repository.GamificationRepository
import com.futebadosparcas.data.repository.UserRepository
import com.futebadosparcas.util.AppLogger
import com.futebadosparcas.util.ConnectivityMonitor
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
    private val statisticsRepository: com.futebadosparcas.data.repository.StatisticsRepository,
    private val activityRepository: com.futebadosparcas.data.repository.ActivityRepository,
    private val connectivityMonitor: ConnectivityMonitor
) : ViewModel() {

    private val _uiState = MutableStateFlow<HomeUiState>(HomeUiState.Loading)
    val uiState: StateFlow<HomeUiState> = _uiState

    private val _loadingState = MutableStateFlow<LoadingState>(LoadingState.Idle)
    val loadingState: StateFlow<LoadingState> = _loadingState

    private val _isOnline = MutableStateFlow(true)
    val isOnline: StateFlow<Boolean> = _isOnline

    private val _unreadCount = MutableStateFlow(0)
    val unreadCount: StateFlow<Int> = _unreadCount

    init {
        observeUnreadCount()
        observeConnectivity()
    }

    private fun observeConnectivity() {
        viewModelScope.launch {
            connectivityMonitor.isConnected.collect { 
                _isOnline.value = it 
            }
        }
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
            _loadingState.value = LoadingState.Loading("Carregando dados...")
            _uiState.value = HomeUiState.Loading

            // Simulate progress (optional, or real progress if possible)
            _loadingState.value = LoadingState.LoadingProgress(10, 100, "Iniciando...")

            val userDeferred = async { userRepository.getCurrentUser() }
            val gamesDeferred = async { gameRepository.getConfirmedUpcomingGamesForUser() }

            val userResult = userDeferred.await()
            _loadingState.value = LoadingState.LoadingProgress(40, 100, "Perfil carregado")
            
            val statsDeferred = async { statisticsRepository.getUserStatistics(userResult.getOrNull()?.id ?: "") }
            val activitiesDeferred = async { activityRepository.getRecentActivities(100) }
            val publicGamesDeferred = async { gameRepository.getPublicGames(10) }
            val streakDeferred = async { gamificationRepository.getUserStreak(userResult.getOrNull()?.id ?: "") }
            val challengesDeferred = async { gamificationRepository.getActiveChallenges() }
            val badgesDeferred = async { gamificationRepository.getRecentBadges(userResult.getOrNull()?.id ?: "") }

            val gamesResult = gamesDeferred.await()
            _loadingState.value = LoadingState.LoadingProgress(70, 100, "Jogos carregados")
            
            val statsResult = statsDeferred.await()
            val activitiesResult = activitiesDeferred.await()
            val publicGamesResult = publicGamesDeferred.await()
            val streakResult = streakDeferred.await()
            val challengesResult = challengesDeferred.await()
            val badgesResult = badgesDeferred.await()
            _loadingState.value = LoadingState.LoadingProgress(90, 100, "Finalizando...")

            userResult.fold(
                onSuccess = { user ->
                    val games = gamesResult.getOrDefault(emptyList())
                    val statistics = statsResult.getOrNull()
                    val activities = activitiesResult.getOrDefault(emptyList())
                    val publicGames = publicGamesResult.getOrDefault(emptyList())
                    val streak = streakResult.getOrNull()
                    val allChallenges = challengesResult.getOrDefault(emptyList())
                    val userBadges = badgesResult.getOrDefault(emptyList())
                    
                    // Fetch progress for challenges
                    val challengeIds = allChallenges.map { it.id }
                    val progressResult = gamificationRepository.getChallengesProgress(user.id, challengeIds)
                    val progressMap = progressResult.getOrDefault(emptyList()).associateBy { it.challengeId }
                    
                    val challengesWithProgress = allChallenges.map { 
                        it to progressMap[it.id] 
                    }
                    
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
                    
                    // Add streak logic if needed or just pass it to UI State

                    _loadingState.value = LoadingState.Success
                    _uiState.value = HomeUiState.Success(
                        user, games, summary, statistics, activities, publicGames, streak, challengesWithProgress, userBadges
                    )
                },
                onFailure = { error ->
                    _loadingState.value = LoadingState.Error(error.message ?: "Erro ao carregar perfil")
                    _uiState.value = HomeUiState.Error(error.message ?: "Erro ao carregar perfil")
                }
            )
        }
    }

    fun toggleViewMode() {
        val currentState = _uiState.value
        if (currentState is HomeUiState.Success) {
            _uiState.value = currentState.copy(isGridView = !currentState.isGridView)
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
        val statistics: com.futebadosparcas.data.model.UserStatistics? = null,
        val activities: List<Activity> = emptyList(),
        val publicGames: List<Game> = emptyList(),
        val streak: com.futebadosparcas.data.model.UserStreak? = null,
        val challenges: List<Pair<WeeklyChallenge, UserChallengeProgress?>> = emptyList(),
        val recentBadges: List<UserBadge> = emptyList(),
        val isGridView: Boolean = false
    ) : HomeUiState()
    data class Error(val message: String) : HomeUiState()
}

sealed class LoadingState {
    object Idle : LoadingState()
    data class Loading(val message: String = "Carregando...") : LoadingState()
    data class LoadingProgress(val current: Int, val total: Int, val message: String) : LoadingState()
    object Success : LoadingState()
    data class Error(val message: String, val retryable: Boolean = true) : LoadingState()
}
