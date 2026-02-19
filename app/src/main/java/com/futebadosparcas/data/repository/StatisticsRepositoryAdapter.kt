package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.UserStatistics
import com.futebadosparcas.domain.repository.StatisticsRepository as KmpStatisticsRepository
import com.futebadosparcas.util.toDataModel

/**
 * Adaptador que converte entre modelos Android e KMP para StatisticsRepository.
 * Mantém compatibilidade com ViewModels que usam o modelo Android.
 */
class StatisticsRepositoryAdapter constructor(
    private val kmpRepository: KmpStatisticsRepository
) : StatisticsRepository {

    override suspend fun getUserStatistics(userId: String): Result<UserStatistics> {
        return kmpRepository.getUserStatistics(userId)
            .map { kmpStats -> kmpStats.toDataModel(userId) }
    }
}
