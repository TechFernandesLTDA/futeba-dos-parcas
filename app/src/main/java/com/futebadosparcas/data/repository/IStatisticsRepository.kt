package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.UserStatistics

interface IStatisticsRepository {
    suspend fun getMyStatistics(): Result<UserStatistics>
    suspend fun getUserStatistics(userId: String): Result<UserStatistics>
    suspend fun updateStatistics(
        userId: String,
        goals: Int = 0,
        assists: Int = 0,
        saves: Int = 0,
        yellowCards: Int = 0,
        redCards: Int = 0,
        isBestPlayer: Boolean = false,
        isWorstPlayer: Boolean = false,
        hasBestGoal: Boolean = false,
        gameResult: GameResult = GameResult.DRAW
    ): Result<UserStatistics>
    suspend fun getTopScorers(limit: Int = 10): Result<List<UserStatistics>>
    suspend fun getTopGoalkeepers(limit: Int = 10): Result<List<UserStatistics>>
    suspend fun getBestPlayers(limit: Int = 10): Result<List<UserStatistics>>
    suspend fun getGoalsHistory(userId: String): Result<Map<String, Int>>
}

enum class GameResult {
    WIN, LOSS, DRAW
}
