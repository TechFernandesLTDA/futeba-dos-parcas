package com.futebadosparcas.ui.statistics

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.LevelTable
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
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class RankingViewModel @Inject constructor(
    private val rankingRepository: RankingRepository,
    private val statisticsRepository: StatisticsRepository,
    private val userRepository: UserRepository,
    private val leagueService: LeagueService,
    private val gamificationRepository: com.futebadosparcas.domain.repository.GamificationRepository,
    private val auth: FirebaseAuth
) : ViewModel() {

    companion object {
        private const val TAG = "RankingViewModel"
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
     */
    fun loadRanking() {
        rankingJob?.cancel()
        rankingJob = viewModelScope.launch {
            _rankingState.update { it.copy(isLoading = true, error = null) }

            try {
                val category = _rankingState.value.selectedCategory
                val period = _rankingState.value.selectedPeriod

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
                val items = rankings


                // Buscar posicao do usuario atual
                val myPosition = currentUserId?.let { uid ->
                    items.indexOfFirst { it.userId == uid }.let { if (it >= 0) it + 1 else 0 }
                } ?: 0

                _rankingState.update {
                    it.copy(
                        isLoading = false,
                        rankings = items,
                        myPosition = myPosition
                    )
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

                // Buscar dados do usuario
                val userResult = userRepository.getCurrentUser()
                if (userResult.isFailure) {
                    _evolutionState.value = EvolutionUiState.Error("Erro ao carregar usuario")
                    return@launch
                }
                val user = userResult.getOrNull()!!

                // Buscar estatisticas
                val statsResult = statisticsRepository.getMyStatistics()
                val stats = statsResult.getOrNull()

                // Buscar historico de XP
                val historyResult = rankingRepository.getUserXpHistory(uid, 20)
                val xpHistory = historyResult.getOrNull() ?: emptyList()

                // Buscar evolucao de XP por mes
                val evolutionResult = rankingRepository.getXpEvolution(uid, 6)
                val xpEvolution = evolutionResult.getOrNull()?.monthlyXp ?: emptyMap()

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
                    val dataStats = stats.toDataModel(uid)
                    MilestoneChecker.getNextMilestones(dataStats, achievedMilestones.map { it.name })
                        .map { milestone ->
                            val (current, target) = MilestoneChecker.getProgress(dataStats, milestone)
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

                // Buscar dados da liga (temporada ativa)
                val activeSeasonResult = gamificationRepository.getActiveSeason()
                val activeSeason = activeSeasonResult.getOrNull()
                
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
