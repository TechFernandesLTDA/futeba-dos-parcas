package com.futebadosparcas.ui.statistics

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.repository.StatisticsRepository
import com.futebadosparcas.domain.model.PlayerRankingItem
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.util.toDataModel
import com.futebadosparcas.util.AppLogger
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class StatisticsViewModel @Inject constructor(
    private val statisticsRepository: StatisticsRepository,
    private val userRepository: UserRepository
) : ViewModel() {

    companion object {
        private const val TAG = "StatisticsViewModel"
        private const val CACHE_DURATION_MS = 120_000L // 2 minutos de cache
    }

    private val _uiState = MutableStateFlow<StatisticsUiState>(StatisticsUiState.Loading)
    val uiState: StateFlow<StatisticsUiState> = _uiState

    private var loadJob: Job? = null

    // P2 #28: Cache in-memory para evitar queries repetidas ao navegar de volta
    private var cachedState: StatisticsUiState.Success? = null
    private var lastLoadTime: Long = 0

    init {
        loadStatistics()
    }

    /**
     * Carrega estatisticas com cache in-memory.
     * Se dados recentes (<2min) estiverem em cache, usa-os diretamente.
     *
     * @param forceRefresh Se true, ignora o cache e busca dados frescos.
     */
    fun loadStatistics(forceRefresh: Boolean = false) {
        // Verificar cache antes de buscar do servidor
        val now = System.currentTimeMillis()
        val cached = cachedState
        if (!forceRefresh && cached != null && (now - lastLoadTime) < CACHE_DURATION_MS) {
            AppLogger.d(TAG) { "Cache HIT para estatisticas (age=${now - lastLoadTime}ms)" }
            _uiState.value = cached
            return
        }

        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            _uiState.value = StatisticsUiState.Loading

            try {
                // OTIMIZAÇÃO: Todas as queries independentes em paralelo
                val myStatsDeferred = async { statisticsRepository.getMyStatistics() }
                val topScorersDeferred = async { statisticsRepository.getTopScorers(5) }
                val topGoalkeepersDeferred = async { statisticsRepository.getTopGoalkeepers(5) }
                val bestPlayersDeferred = async { statisticsRepository.getBestPlayers(5) }

                // Aguardar todos os resultados paralelos
                val myStatsResult = myStatsDeferred.await()
                val topScorersResult = topScorersDeferred.await()
                val topGoalkeepersResult = topGoalkeepersDeferred.await()
                val bestPlayersResult = bestPlayersDeferred.await()

                val myStats = myStatsResult.getOrThrow()
                val topScorers = topScorersResult.getOrThrow()
                val topGoalkeepers = topGoalkeepersResult.getOrThrow()
                val bestPlayers = bestPlayersResult.getOrThrow()

                // Queries dependentes em paralelo: goalsHistory depende de myStats.id,
                // userMap depende de topScorers/topGoalkeepers/bestPlayers
                val allUserIds = (topScorers.map { it.id } + topGoalkeepers.map { it.id } + bestPlayers.map { it.id }).distinct()

                val goalsHistoryDeferred = async {
                    statisticsRepository.getGoalsHistory(myStats.id ?: "")
                }
                val userMapDeferred = async {
                    userRepository.getUsersByIds(allUserIds)
                }

                val goalsHistory = goalsHistoryDeferred.await().getOrNull() ?: emptyMap()
                val userMap = userMapDeferred.await().getOrNull()?.associateBy { it.id } ?: emptyMap()

                // Se o usuario nao tem jogos, emitir estado Empty
                val dataMyStats = myStats.toDataModel(myStats.userId)
                if (dataMyStats.totalGames <= 0 && topScorers.isEmpty() && bestPlayers.isEmpty()) {
                    _uiState.value = StatisticsUiState.Empty
                    return@launch
                }

                val combined = CombinedStatistics(
                    myStats = dataMyStats,
                    topScorers = topScorers.mapIndexed { index, stats ->
                        PlayerRankingItem(
                            rank = index + 1,
                            playerName = userMap[stats.id]?.name ?: "Jogador",
                            value = stats.totalGoals.toLong(),
                            photoUrl = userMap[stats.id]?.photoUrl,
                            userId = stats.id,
                            gamesPlayed = stats.totalGames,
                            average = if (stats.totalGames > 0) stats.totalGoals.toDouble() / stats.totalGames else 0.0,
                            nickname = userMap[stats.id]?.nickname,
                            level = userMap[stats.id]?.level ?: 0
                        )
                    },
                    topGoalkeepers = topGoalkeepers.mapIndexed { index, stats ->
                        PlayerRankingItem(
                            rank = index + 1,
                            playerName = userMap[stats.id]?.name ?: "Jogador",
                            value = stats.totalSaves.toLong(),
                            photoUrl = userMap[stats.id]?.photoUrl,
                            userId = stats.id,
                            gamesPlayed = stats.totalGames,
                            average = if (stats.totalGames > 0) stats.totalSaves.toDouble() / stats.totalGames else 0.0,
                            nickname = userMap[stats.id]?.nickname,
                            level = userMap[stats.id]?.level ?: 0
                        )
                    },
                    bestPlayers = bestPlayers.mapIndexed { index, stats ->
                        PlayerRankingItem(
                            rank = index + 1,
                            playerName = userMap[stats.id]?.name ?: "Jogador",
                            value = stats.mvpCount.toLong(),
                            photoUrl = userMap[stats.id]?.photoUrl,
                            userId = stats.id,
                            gamesPlayed = stats.totalGames,
                            average = if (stats.totalGames > 0) stats.mvpCount.toDouble() / stats.totalGames else 0.0,
                            nickname = userMap[stats.id]?.nickname,
                            level = userMap[stats.id]?.level ?: 0
                        )
                    },
                    goalEvolution = goalsHistory
                )

                val successState = StatisticsUiState.Success(combined)
                _uiState.value = successState

                // P2 #28: Salvar no cache
                cachedState = successState
                lastLoadTime = System.currentTimeMillis()
                AppLogger.d(TAG) { "Cache PUT para estatisticas" }

            } catch (e: Exception) {
                AppLogger.e(TAG, "Erro ao carregar estatísticas: ${e.message}", e)
                _uiState.value = StatisticsUiState.Error(e.message ?: "Erro ao carregar estatísticas")
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        loadJob?.cancel()
    }
}
