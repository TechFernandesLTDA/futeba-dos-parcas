package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.Schedule
import kotlinx.coroutines.flow.Flow

interface ScheduleRepository {
    fun getSchedules(ownerId: String): Flow<Result<List<Schedule>>>
    suspend fun createSchedule(schedule: Schedule): Result<String>
    suspend fun updateSchedule(schedule: Schedule): Result<Unit>
    suspend fun deleteSchedule(scheduleId: String): Result<Unit>
    suspend fun getScheduleById(scheduleId: String): Result<Schedule>
}
