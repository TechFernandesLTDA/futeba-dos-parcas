package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.UserStatistics

interface StatisticsRepository {
    suspend fun getUserStatistics(userId: String): Result<UserStatistics>
}
