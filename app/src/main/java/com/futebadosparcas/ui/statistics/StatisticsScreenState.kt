package com.futebadosparcas.ui.statistics

import com.futebadosparcas.data.model.LevelTable
import com.futebadosparcas.data.model.MilestoneType
import com.futebadosparcas.data.model.SeasonParticipationV2
import com.futebadosparcas.data.model.UserStatistics
import com.futebadosparcas.domain.model.PlayerRankingItem
import com.futebadosparcas.domain.model.RankingCategory
import com.futebadosparcas.domain.model.RankingPeriod
import com.futebadosparcas.domain.model.XpLog

data class CombinedStatistics(
    val myStats: UserStatistics,
    val topScorers: List<PlayerRankingItem>,
    val topGoalkeepers: List<PlayerRankingItem>,
    val bestPlayers: List<PlayerRankingItem>,
    val goalEvolution: Map<String, Int> = emptyMap()
)

sealed class StatisticsUiState {
    object Loading : StatisticsUiState()
    data class Success(val statistics: CombinedStatistics) : StatisticsUiState()
    data class Error(val message: String) : StatisticsUiState()
}

// ========== NOVO: Estados para Ranking e Evolucao ==========

/**
 * Estado da tela de ranking com filtros.
 */
data class RankingUiState(
    val isLoading: Boolean = true,
    val rankings: List<PlayerRankingItem> = emptyList(),
    val selectedCategory: RankingCategory = RankingCategory.GOALS,
    val selectedPeriod: RankingPeriod = RankingPeriod.ALL_TIME,
    val myPosition: Int = 0,
    val error: String? = null
)

/**
 * Dados de evolucao do jogador.
 */
data class PlayerEvolutionData(
    val currentXp: Long = 0L,
    val currentLevel: Int = 1,
    val levelName: String = "Novato",
    val xpProgress: Long = 0L, // XP acumulado no nivel atual
    val xpNeeded: Long = 100L, // XP total para proximo nivel
    val progressPercentage: Float = 0f,
    val xpHistory: List<XpLog> = emptyList(),
    val xpEvolution: Map<String, Long> = emptyMap(), // Mes -> XP ganho
    val achievedMilestones: List<MilestoneType> = emptyList(),
    val nextMilestones: List<MilestoneProgress> = emptyList(),
    val leagueData: SeasonParticipationV2? = null
)

data class MilestoneProgress(
    val milestone: MilestoneType,
    val current: Int,
    val target: Int,
    val percentage: Float
)

sealed class EvolutionUiState {
    object Loading : EvolutionUiState()
    data class Success(val data: PlayerEvolutionData) : EvolutionUiState()
    data class Error(val message: String) : EvolutionUiState()
}

/**
 * Dados do resumo pos-jogo.
 */
data class PostGameSummary(
    val gameId: String,
    val xpEarned: Long,
    val xpBreakdown: Map<String, Long>, // "Participacao" -> 25, "Gols" -> 30, etc
    val previousXp: Long,
    val newXp: Long,
    val previousLevel: Int,
    val newLevel: Int,
    val leveledUp: Boolean,
    val newLevelName: String = "",
    val milestonesUnlocked: List<MilestoneType> = emptyList(),
    val gameResult: String, // WIN, LOSS, DRAW
    val goals: Int = 0,
    val assists: Int = 0,
    val saves: Int = 0
) {
    val progressToNextLevel: Float
        get() {
            val (progress, needed) = LevelTable.getXpProgress(newXp)
            return if (needed > 0L) progress.toFloat() / needed else 1f
        }
}
