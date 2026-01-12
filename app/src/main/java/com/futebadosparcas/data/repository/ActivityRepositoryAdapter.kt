package com.futebadosparcas.data.repository

import com.futebadosparcas.data.mapper.ActivityMapper
import com.futebadosparcas.data.model.Activity as AndroidActivity
import com.futebadosparcas.domain.repository.ActivityRepository as KmpActivityRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject

/**
 * Adaptador que converte entre modelos Android e KMP para ActivityRepository.
 * Mantém compatibilidade com ViewModels que usam o modelo Android.
 */
class ActivityRepositoryAdapter @Inject constructor(
    private val kmpRepository: KmpActivityRepository
) : ActivityRepository {

    override suspend fun getRecentActivities(limit: Int): Result<List<AndroidActivity>> {
        return kmpRepository.getRecentActivities(limit)
            .map { kmpActivities -> ActivityMapper.toAndroidActivities(kmpActivities) }
    }

    override fun getRecentActivitiesFlow(limit: Int): Flow<List<AndroidActivity>> {
        return kmpRepository.getRecentActivitiesFlow(limit)
            .map { kmpActivities -> ActivityMapper.toAndroidActivities(kmpActivities) }
    }

    override suspend fun createActivity(activity: AndroidActivity): Result<Unit> {
        return kmpRepository.createActivity(ActivityMapper.toDomainActivity(activity))
    }

    override suspend fun getUserActivities(userId: String, limit: Int): Result<List<AndroidActivity>> {
        return kmpRepository.getUserActivities(userId, limit)
            .map { kmpActivities -> ActivityMapper.toAndroidActivities(kmpActivities) }
    }
}
