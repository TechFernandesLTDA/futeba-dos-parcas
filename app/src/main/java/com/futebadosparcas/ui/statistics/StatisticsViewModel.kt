package com.futebadosparcas.ui.statistics

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.repository.IStatisticsRepository
import com.futebadosparcas.data.repository.UserRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class StatisticsViewModel @Inject constructor(
    private val statisticsRepository: IStatisticsRepository,
    private val userRepository: UserRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<StatisticsUiState>(StatisticsUiState.Loading)
    val uiState: StateFlow<StatisticsUiState> = _uiState

    fun loadStatistics() {
        viewModelScope.launch {
            _uiState.value = StatisticsUiState.Loading

            try {
                val myStatsDeferred = async { statisticsRepository.getMyStatistics() }
                val topScorersDeferred = async { statisticsRepository.getTopScorers(5) }
                val topGoalkeepersDeferred = async { statisticsRepository.getTopGoalkeepers(5) }
                val bestPlayersDeferred = async { statisticsRepository.getBestPlayers(5) }
                // Use default if repository doesn't have the method yet (to be safe) or add it
                // Assuming I will update interface next
                val goalsHistoryResult = statisticsRepository.getGoalsHistory(myStatsDeferred.await().getOrNull()?.id ?: "")

                val myStatsResult = myStatsDeferred.await()
                val topScorersResult = topScorersDeferred.await()
                val topGoalkeepersResult = topGoalkeepersDeferred.await()
                val bestPlayersResult = bestPlayersDeferred.await()

                val myStats = myStatsResult.getOrThrow()
                val topScorers = topScorersResult.getOrThrow()
                val topGoalkeepers = topGoalkeepersResult.getOrThrow()
                val bestPlayers = bestPlayersResult.getOrThrow()
                val goalsHistory = goalsHistoryResult.getOrNull() ?: emptyMap()

                val allUserIds = (topScorers.map { it.id } + topGoalkeepers.map { it.id } + bestPlayers.map { it.id }).distinct()
                val userMap = userRepository.getUsersByIds(allUserIds).getOrNull()?.associateBy { it.id } ?: emptyMap()

                val combined = CombinedStatistics(
                    myStats = myStats,
                    topScorers = topScorers.mapIndexed { index, stats ->
                        PlayerRankingItem(index + 1, userMap[stats.id]?.name ?: "Jogador", stats.totalGoals.toLong(), userMap[stats.id]?.photoUrl)
                    },
                    topGoalkeepers = topGoalkeepers.mapIndexed { index, stats ->
                        PlayerRankingItem(index + 1, userMap[stats.id]?.name ?: "Jogador", stats.totalSaves.toLong(), userMap[stats.id]?.photoUrl)
                    },
                    bestPlayers = bestPlayers.mapIndexed { index, stats ->
                        PlayerRankingItem(index + 1, userMap[stats.id]?.name ?: "Jogador", stats.bestPlayerCount.toLong(), userMap[stats.id]?.photoUrl)
                    },
                    goalEvolution = goalsHistory
                )

                _uiState.value = StatisticsUiState.Success(combined)

            } catch (e: Exception) {
                _uiState.value = StatisticsUiState.Error(e.message ?: "Erro ao carregar estatísticas")
            }
        }
    }
}