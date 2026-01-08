package com.futebadosparcas.ui.home

import androidx.lifecycle.SavedStateHandle
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
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch
import kotlinx.coroutines.supervisorScope
import kotlinx.coroutines.withTimeout
import javax.inject.Inject
import kotlin.math.pow

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val gameRepository: GameRepository,
    private val userRepository: UserRepository,
    private val notificationRepository: com.futebadosparcas.data.repository.NotificationRepository,
    private val gamificationRepository: GamificationRepository,
    private val statisticsRepository: com.futebadosparcas.data.repository.StatisticsRepository,
    private val activityRepository: com.futebadosparcas.data.repository.ActivityRepository,
    private val connectivityMonitor: ConnectivityMonitor,
    private val savedStateHandle: SavedStateHandle
) : ViewModel() {

    private val _uiState = MutableStateFlow<HomeUiState>(HomeUiState.Loading)
    val uiState: StateFlow<HomeUiState> = _uiState

    private val _loadingState = MutableStateFlow<LoadingState>(LoadingState.Idle)
    val loadingState: StateFlow<LoadingState> = _loadingState

    private val _isOnline = MutableStateFlow(true)
    val isOnline: StateFlow<Boolean> = _isOnline

    private val _unreadCount = MutableStateFlow(0)
    val unreadCount: StateFlow<Int> = _unreadCount

    // SavedState para persistir estado de navegação
    var isGridView: Boolean
        get() = savedStateHandle.get<Boolean>(KEY_IS_GRID_VIEW) ?: false
        set(value) = savedStateHandle.set(KEY_IS_GRID_VIEW, value)

    // Cache para reduzir requisições repetidas
    private var lastLoadTime: Long = 0
    private var cachedSuccessState: HomeUiState.Success? = null

    init {
        observeUnreadCount()
        observeConnectivity()
    }

    private fun observeConnectivity() {
        viewModelScope.launch {
            connectivityMonitor.isConnected
                .catch { e ->
                    // Tratamento de erro: assumir online em caso de falha
                    AppLogger.e(TAG, "Erro ao observar conectividade", e)
                    _isOnline.value = true
                }
                .collect {
                    _isOnline.value = it
                }
        }
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

    private var loadJob: Job? = null
    private var retryCount = 0

    /**
     * Carrega dados da home com timeout, supervisorScope e retry automático
     * - withTimeout(10_000): timeout de 10 segundos nas requisições paralelas
     * - supervisorScope: falha graciosamente se uma requisição falhar
     * - retry automático com exponential backoff (máx 3 tentativas)
     * - Cache de 30 segundos para evitar requisições repetidas
     */
    fun loadHomeData(forceRetry: Boolean = false) {
        if (forceRetry) {
            retryCount = 0
            lastLoadTime = 0
            cachedSuccessState = null
        }

        // Usar cache se disponível e recente (< 30s)
        val currentTime = System.currentTimeMillis()
        if (!forceRetry && cachedSuccessState != null && (currentTime - lastLoadTime) < CACHE_DURATION_MS) {
            _uiState.value = cachedSuccessState!!
            _loadingState.value = LoadingState.Success
            return
        }

        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            _loadingState.value = LoadingState.Loading("Carregando dados...")
            _uiState.value = HomeUiState.Loading

            try {
                _loadingState.value = LoadingState.LoadingProgress(10, 100, "Iniciando...")

                // SupervisorScope para falhar graciosamente
                supervisorScope {
                    // Requisição crítica com timeout
                    val userResult = withTimeout(TIMEOUT_MILLIS) {
                        userRepository.getCurrentUser()
                    }

                    if (userResult.isFailure) {
                        throw userResult.exceptionOrNull() ?: Exception("Erro ao carregar usuário")
                    }

                    val user = userResult.getOrThrow()
                    _loadingState.value = LoadingState.LoadingProgress(30, 100, "Perfil carregado")

                    // Requisições paralelas com timeout e supervisorScope
                    val gamesDeferred = async {
                        runCatching {
                            withTimeout(TIMEOUT_MILLIS) {
                                gameRepository.getConfirmedUpcomingGamesForUser()
                            }
                        }
                    }
                    val statsDeferred = async {
                        runCatching {
                            withTimeout(TIMEOUT_MILLIS) {
                                statisticsRepository.getUserStatistics(user.id)
                            }
                        }
                    }
                    val activitiesDeferred = async {
                        runCatching {
                            withTimeout(TIMEOUT_MILLIS) {
                                activityRepository.getRecentActivities(20) // Reduzido para 20 para melhor performance
                            }
                        }
                    }
                    val publicGamesDeferred = async {
                        runCatching {
                            withTimeout(TIMEOUT_MILLIS) {
                                gameRepository.getPublicGames(10)
                            }
                        }
                    }
                    val streakDeferred = async {
                        runCatching {
                            withTimeout(TIMEOUT_MILLIS) {
                                gamificationRepository.getUserStreak(user.id)
                            }
                        }
                    }
                    val challengesDeferred = async {
                        runCatching {
                            withTimeout(TIMEOUT_MILLIS) {
                                gamificationRepository.getActiveChallenges()
                            }
                        }
                    }
                    val badgesDeferred = async {
                        runCatching {
                            withTimeout(TIMEOUT_MILLIS) {
                                gamificationRepository.getRecentBadges(user.id, limit = 5) // Reduzido para 5 badges
                            }
                        }
                    }

                    _loadingState.value = LoadingState.LoadingProgress(60, 100, "Carregando dados...")

                    // Await all com tratamento de erro gracioso
                    val gamesResult = gamesDeferred.await()
                    val statsResult = statsDeferred.await()
                    val activitiesResult = activitiesDeferred.await()
                    val publicGamesResult = publicGamesDeferred.await()
                    val streakResult = streakDeferred.await()
                    val challengesResult = challengesDeferred.await()
                    val badgesResult = badgesDeferred.await()

                    _loadingState.value = LoadingState.LoadingProgress(70, 100, "Processando...")

                    // Extrair dados com fallback para valores vazios
                    val games = gamesResult.getOrNull()?.getOrDefault(emptyList()) ?: emptyList()
                    val statistics = statsResult.getOrNull()?.getOrNull()
                    val activities = activitiesResult.getOrNull()?.getOrDefault(emptyList()) ?: emptyList()
                    val publicGames = publicGamesResult.getOrNull()?.getOrDefault(emptyList()) ?: emptyList()
                    val streak = streakResult.getOrNull()?.getOrNull()
                    val allChallenges = challengesResult.getOrNull()?.getOrDefault(emptyList()) ?: emptyList()
                    val userBadges = badgesResult.getOrNull()?.getOrDefault(emptyList()) ?: emptyList()

                    // Fetch progress for challenges com timeout
                    val challengeIds = allChallenges.map { it.id }
                    val progressResult = runCatching {
                        withTimeout(TIMEOUT_MILLIS) {
                            gamificationRepository.getChallengesProgress(user.id, challengeIds)
                        }
                    }
                    val progressMap = progressResult.getOrNull()?.getOrDefault(emptyList())?.associateBy { it.challengeId } ?: emptyMap()

                    val challengesWithProgress = allChallenges.map {
                        it to progressMap[it.id]
                    }

                    _loadingState.value = LoadingState.LoadingProgress(85, 100, "Carregando liga...")

                    // Fetch League info com timeout e tratamento de erro
                    var leagueDivision = LeagueDivision.BRONZE
                    try {
                        val seasonResult = withTimeout(TIMEOUT_MILLIS) {
                            gamificationRepository.getActiveSeason()
                        }
                        seasonResult.getOrNull()?.let { season ->
                            val participationResult = withTimeout(TIMEOUT_MILLIS) {
                                gamificationRepository.getUserParticipation(user.id, season.id)
                            }
                            participationResult.getOrNull()?.let { participation ->
                                leagueDivision = participation.division
                            }
                        }
                    } catch (e: Exception) {
                        AppLogger.e(TAG, "Erro ao carregar dados da liga", e)
                    }

                    _loadingState.value = LoadingState.LoadingProgress(95, 100, "Finalizando...")

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

                    _loadingState.value = LoadingState.Success
                    val successState = HomeUiState.Success(
                        user, games, summary, statistics, activities, publicGames, streak, challengesWithProgress, userBadges, isGridView
                    )
                    _uiState.value = successState

                    // Cache do estado de sucesso
                    cachedSuccessState = successState
                    lastLoadTime = System.currentTimeMillis()

                    // Reset retry count on success
                    retryCount = 0
                }
            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro ao carregar dados da home", e)

                // Retry automático com exponential backoff
                if (retryCount < MAX_RETRY_COUNT) {
                    retryCount++
                    val delayMs = calculateBackoffDelay(retryCount)

                    _loadingState.value = LoadingState.Loading("Tentando novamente... (${retryCount}/${MAX_RETRY_COUNT})")
                    AppLogger.d(TAG) { "Retry $retryCount após ${delayMs}ms" }

                    delay(delayMs)
                    loadHomeData()
                } else {
                    val errorMessage = when (e) {
                        is kotlinx.coroutines.TimeoutCancellationException -> "Tempo limite excedido. Verifique sua conexão."
                        else -> e.message ?: "Erro ao carregar dados"
                    }

                    _loadingState.value = LoadingState.Error(errorMessage, retryable = true)
                    _uiState.value = HomeUiState.Error(errorMessage)
                    retryCount = 0
                }
            }
        }
    }

    /**
     * Calcula delay com exponential backoff
     * Tentativa 1: 1s, Tentativa 2: 2s, Tentativa 3: 4s
     */
    private fun calculateBackoffDelay(attempt: Int): Long {
        return (BASE_DELAY_MS * 2.0.pow(attempt - 1)).toLong().coerceAtMost(MAX_DELAY_MS)
    }

    fun toggleViewMode() {
        isGridView = !isGridView
        val currentState = _uiState.value
        if (currentState is HomeUiState.Success) {
            _uiState.value = currentState.copy(isGridView = isGridView)
        }
    }

    fun retryLoad() {
        loadHomeData(forceRetry = true)
    }
    
    fun getCurrentUserId(): String? {
        return userRepository.getCurrentUserId()
    }

    override fun onCleared() {
        super.onCleared()
        loadJob?.cancel()
    }

    companion object {
        private const val TAG = "HomeViewModel"
        private const val TIMEOUT_MILLIS = 8_000L // 8 segundos
        private const val MAX_RETRY_COUNT = 3
        private const val BASE_DELAY_MS = 1000L // 1 segundo
        private const val MAX_DELAY_MS = 4000L // 4 segundos
        private const val CACHE_DURATION_MS = 30_000L // 30 segundos
        private const val KEY_IS_GRID_VIEW = "is_grid_view"
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
        val user: com.futebadosparcas.domain.model.User, 
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
