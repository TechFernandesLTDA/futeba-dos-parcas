package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.Activity
import kotlinx.coroutines.flow.Flow

interface ActivityRepository {
    suspend fun getRecentActivities(limit: Int = 20): Result<List<Activity>>
    fun getRecentActivitiesFlow(limit: Int = 20): Flow<List<Activity>>
    suspend fun createActivity(activity: Activity): Result<Unit>
    suspend fun getUserActivities(userId: String, limit: Int = 20): Result<List<Activity>>
}
