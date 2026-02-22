package com.futebadosparcas.ui.statistics

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.LevelTable
import com.futebadosparcas.data.model.MilestoneType
import com.futebadosparcas.domain.repository.StatisticsRepository
import com.futebadosparcas.domain.model.PlayerRankingItem
import com.futebadosparcas.util.toDataModel
import com.futebadosparcas.domain.model.RankingCategory
import com.futebadosparcas.domain.model.RankingPeriod
import com.futebadosparcas.domain.repository.RankingRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.domain.ranking.LeagueService
import com.futebadosparcas.domain.ranking.MilestoneChecker
import com.futebadosparcas.data.cache.MemoryCache
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlin.time.Duration.Companion.minutes

class RankingViewModel(
    private val rankingRepository: RankingRepository,
    private val statisticsRepository: StatisticsRepository,
    private val userRepository: UserRepository,
    private val leagueService: LeagueService,
    private val gamificationRepository: com.futebadosparcas.domain.repository.GamificationRepository,
    private val auth: FirebaseAuth,
    private val memoryCache: MemoryCache
) : ViewModel() {

    companion object {
        private const val TAG = "RankingViewModel"
        private const val CACHE_KEY_PREFIX = "ranking_"
        private val CACHE_TTL = 5.minutes // Cache de 5 minutos para leaderboard
    }

    private val _rankingState = MutableStateFlow(RankingUiState())
    val rankingState: StateFlow<RankingUiState> = _rankingState

    private val _evolutionState = MutableStateFlow<EvolutionUiState>(EvolutionUiState.Loading)
    val evolutionState: StateFlow<EvolutionUiState> = _evolutionState

    private val currentUserId: String?
        get() = auth.currentUser?.uid

    private var rankingJob: Job? = null
    private var evolutionJob: Job? = null

    init {
        loadRanking()
    }

    /**
     * Carrega ranking com filtros atuais.
     * Utiliza cache in-memory de 5 minutos para evitar queries repetidas (P2 #28).
     *
     * @param forceRefresh Se true, ignora o cache e busca dados frescos do servidor.
     */
    fun loadRanking(forceRefresh: Boolean = false) {
        rankingJob?.cancel()
        rankingJob = viewModelScope.launch {
            _rankingState.update { it.copy(isLoading = true, error = null) }

            try {
                val category = _rankingState.value.selectedCategory
                val period = _rankingState.value.selectedPeriod
                val cacheKey = "${CACHE_KEY_PREFIX}${category.name}_${period.name}"

                // P2 #28: Verificar cache antes de buscar do servidor
                if (!forceRefresh) {
                    val cachedRankings = memoryCache.get<List<PlayerRankingItem>>(cacheKey)
                    if (cachedRankings != null) {
                        AppLogger.d(TAG) { "Cache HIT para ranking: $cacheKey (${cachedRankings.size} itens)" }

                        val myPosition = currentUserId?.let { uid ->
                            cachedRankings.indexOfFirst { it.userId == uid }.let { if (it >= 0) it + 1 else 0 }
                        } ?: 0

                        _rankingState.update {
                            it.copy(
                                isLoading = false,
                                rankings = cachedRankings,
                                myPosition = myPosition
                            )
                        }
                        return@launch
                    }
                    AppLogger.d(TAG) { "Cache MISS para ranking: $cacheKey" }
                } else {
                    AppLogger.d(TAG) { "Force refresh: ignorando cache para $cacheKey" }
                }

                val rankingResult = if (period == RankingPeriod.ALL_TIME) {
                    rankingRepository.getRanking(category)
                } else {
                    rankingRepository.getRankingByPeriod(category, period)
                }

                if (rankingResult.isFailure) {
                    _rankingState.update {
                        it.copy(
                            isLoading = false,
                            error = rankingResult.exceptionOrNull()?.message
                        )
                    }
                    return@launch
                }

                val rankings = rankingResult.getOrNull() ?: emptyList()

                // P2 #28: Salvar no cache com TTL de 5 minutos
                memoryCache.put(cacheKey, rankings, CACHE_TTL)
                AppLogger.d(TAG) { "Cache PUT para ranking: $cacheKey (${rankings.size} itens, TTL=${CACHE_TTL})" }

                // Buscar posicao do usuario atual
                val myPosition = currentUserId?.let { uid ->
                    rankings.indexOfFirst { it.userId == uid }.let { if (it >= 0) it + 1 else 0 }
                } ?: 0

                _rankingState.update {
                    it.copy(
                        isLoading = false,
                        rankings = rankings,
                        myPosition = myPosition
                    )
                }

                if (rankings.isEmpty()) {
                    AppLogger.d(TAG) { "Ranking vazio para categoria=${category.name}, periodo=${period.name}" }
                }

            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro ao carregar ranking: ${e.message}", e)
                _rankingState.update {
                    it.copy(isLoading = false, error = e.message)
                }
            }
        }
    }

    /**
     * Força refresh do ranking (usado no pull-to-refresh).
     * Invalida o cache e busca dados frescos do servidor.
     */
    fun refreshRanking() {
        loadRanking(forceRefresh = true)
    }

    /**
     * Altera a categoria do ranking.
     */
    fun selectCategory(category: RankingCategory) {
        _rankingState.update { it.copy(selectedCategory = category) }
        loadRanking()
    }

    /**
     * Altera o periodo do ranking.
     */
    fun selectPeriod(period: RankingPeriod) {
        _rankingState.update { it.copy(selectedPeriod = period) }
        loadRanking()
    }

    /**
     * Invalida todo o cache de ranking (P2 #28).
     * Usado quando sabemos que os dados mudaram (ex: jogo finalizado).
     */
    fun invalidateRankingCache() {
        memoryCache.removeByPattern(CACHE_KEY_PREFIX)
        AppLogger.d(TAG) { "Cache de ranking invalidado" }
    }

    /**
     * Carrega dados de evolucao do jogador atual.
     */
    fun loadEvolution() {
        evolutionJob?.cancel()
        evolutionJob = viewModelScope.launch {
            _evolutionState.value = EvolutionUiState.Loading

            try {
                val uid = currentUserId ?: run {
                    _evolutionState.value = EvolutionUiState.Error("Usuario nao autenticado")
                    return@launch
                }

                // OTIMIZAÇÃO: Queries independentes em paralelo com async
                val userDeferred = async { userRepository.getCurrentUser() }
                val statsDeferred = async { statisticsRepository.getMyStatistics() }
                val historyDeferred = async { rankingRepository.getUserXpHistory(uid, 20) }
                val evolutionDeferred = async { rankingRepository.getXpEvolution(uid, 6) }
                val seasonDeferred = async { gamificationRepository.getActiveSeason() }

                // Aguardar usuario (critico - falha se nao encontrar)
                val user = userDeferred.await().getOrElse {
                    _evolutionState.value = EvolutionUiState.Error("Erro ao carregar usuario")
                    return@launch
                }

                // Aguardar demais queries paralelas
                val stats = statsDeferred.await().getOrNull()
                val xpHistory = historyDeferred.await().getOrNull() ?: emptyList()
                val xpEvolution = evolutionDeferred.await().getOrNull()?.monthlyXp ?: emptyMap()

                // Calcular progresso de nivel
                val currentXp = user.experiencePoints
                val currentLevel = user.level
                val (xpProgress, xpNeeded) = LevelTable.getXpProgress(currentXp)
                val progressPercentage = if (xpNeeded > 0L) xpProgress.toFloat() / xpNeeded else 1f

                // Buscar milestones
                val achievedMilestones = user.milestonesAchieved
                    .mapNotNull { name ->
                        try {
                            MilestoneType.valueOf(name)
                        } catch (e: Exception) {
                            null
                        }
                    }
                    .toMutableList()

                // Calcular proximos milestones
                val nextMilestones = if (stats != null) {
                    MilestoneChecker.getNextMilestones(stats, achievedMilestones.map { it.name })
                        .map { milestone ->
                            val (current, target) = MilestoneChecker.getProgress(stats, milestone)
                            MilestoneProgress(
                                milestone = milestone,
                                current = current,
                                target = target,
                                percentage = if (target > 0) current.toFloat() / target else 0f
                            )
                        }
                        .take(5)
                } else {
                    emptyList()
                }

                // Buscar dados da liga (depende do resultado da season)
                val activeSeason = seasonDeferred.await().getOrNull()

                val leagueData = if (activeSeason != null) {
                    leagueService.getParticipation(uid, activeSeason.id).getOrNull()
                } else {
                    null
                }

                _evolutionState.value = EvolutionUiState.Success(
                    PlayerEvolutionData(
                        currentXp = currentXp,
                        currentLevel = currentLevel,
                        levelName = LevelTable.getLevelName(currentLevel),
                        xpProgress = xpProgress,
                        xpNeeded = xpNeeded,
                        progressPercentage = progressPercentage,
                        xpHistory = xpHistory,
                        xpEvolution = xpEvolution,
                        achievedMilestones = achievedMilestones,
                        nextMilestones = nextMilestones,
                        leagueData = leagueData
                    )
                )

            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro ao carregar evolução: ${e.message}", e)
                _evolutionState.value = EvolutionUiState.Error(e.message ?: "Erro desconhecido")
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        rankingJob?.cancel()
        evolutionJob?.cancel()
    }
}
