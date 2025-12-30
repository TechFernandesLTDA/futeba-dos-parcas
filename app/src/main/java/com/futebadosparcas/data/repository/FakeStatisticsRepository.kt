package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.UserStatistics
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class FakeStatisticsRepository @Inject constructor() : IStatisticsRepository {

    private val stats = mutableListOf<UserStatistics>()

    override suspend fun getMyStatistics(): Result<UserStatistics> {
        val myStats = stats.find { it.id == "mock_user_id" }
        return if (myStats != null) {
            Result.success(myStats)
        } else {
            val newStats = UserStatistics(id = "mock_user_id", totalGames = 10, totalGoals = 5, bestPlayerCount = 2)
            stats.add(newStats)
            Result.success(newStats)
        }
    }

    override suspend fun getUserStatistics(userId: String): Result<UserStatistics> {
        val userStats = stats.find { it.id == userId }
        return if (userStats != null) Result.success(userStats) else Result.failure(Exception("User not found"))
    }

    override suspend fun updateStatistics(
        userId: String,
        goals: Int,
        assists: Int,
        saves: Int,
        yellowCards: Int,
        redCards: Int,
        isBestPlayer: Boolean,
        isWorstPlayer: Boolean,
        hasBestGoal: Boolean,
        gameResult: GameResult
    ): Result<UserStatistics> {
        val currentStats = stats.find { it.id == userId } ?: UserStatistics(id = userId)
        val updatedStats = currentStats.copy(
            totalGames = currentStats.totalGames + 1,
            totalGoals = currentStats.totalGoals + goals,
            totalAssists = currentStats.totalAssists + assists,
            totalSaves = currentStats.totalSaves + saves,
            totalYellowCards = currentStats.totalYellowCards + yellowCards,
            totalRedCards = currentStats.totalRedCards + redCards,
            bestPlayerCount = currentStats.bestPlayerCount + if (isBestPlayer) 1 else 0,
            worstPlayerCount = currentStats.worstPlayerCount + if (isWorstPlayer) 1 else 0,
            bestGoalCount = currentStats.bestGoalCount + if (hasBestGoal) 1 else 0,
            gamesWon = currentStats.gamesWon + if (gameResult == GameResult.WIN) 1 else 0,
            gamesLost = currentStats.gamesLost + if (gameResult == GameResult.LOSS) 1 else 0,
            gamesDraw = currentStats.gamesDraw + if (gameResult == GameResult.DRAW) 1 else 0
        )
        stats.removeAll { it.id == userId }
        stats.add(updatedStats)
        return Result.success(updatedStats)
    }

    override suspend fun getTopScorers(limit: Int): Result<List<UserStatistics>> {
        val top = stats.sortedByDescending { it.totalGoals }.take(limit)
        return Result.success(top)
    }

    override suspend fun getTopGoalkeepers(limit: Int): Result<List<UserStatistics>> {
        val top = stats.sortedByDescending { it.totalSaves }.take(limit)
        return Result.success(top)
    }

    override suspend fun getBestPlayers(limit: Int): Result<List<UserStatistics>> {
        val top = stats.sortedByDescending { it.bestPlayerCount }.take(limit)
        return Result.success(top)
    }

    override suspend fun getGoalsHistory(userId: String): Result<Map<String, Int>> {
        // Retorna dados mock para histórico de gols dos últimos 6 meses
        val mockHistory = LinkedHashMap<String, Int>()
        val cal = java.util.Calendar.getInstance()
        cal.add(java.util.Calendar.MONTH, -5)
        
        for (i in 0 until 6) {
            val key = "${cal.get(java.util.Calendar.MONTH) + 1}/${cal.get(java.util.Calendar.YEAR)}"
            mockHistory[key] = (0..5).random()
            cal.add(java.util.Calendar.MONTH, 1)
        }
        
        return Result.success(mockHistory)
    }

    // Helper to populate from DeveloperViewModel
    fun populate(mockStats: List<UserStatistics>) {
        stats.clear()
        stats.addAll(mockStats)
    }
}