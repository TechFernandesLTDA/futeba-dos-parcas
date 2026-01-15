package com.futebadosparcas.domain.repository

import com.futebadosparcas.domain.model.Schedule
import kotlinx.coroutines.flow.Flow

/**
 * Interface de repositorio de horarios recorrentes (schedules).
 * Implementacoes especificas de plataforma em androidMain/iosMain.
 */
interface ScheduleRepository {
    /**
     * Busca horarios de um proprietario via Flow (real-time).
     */
    fun getSchedules(ownerId: String): Flow<Result<List<Schedule>>>

    /**
     * Cria um novo horario recorrente.
     */
    suspend fun createSchedule(schedule: Schedule): Result<String>

    /**
     * Atualiza um horario existente.
     */
    suspend fun updateSchedule(schedule: Schedule): Result<Unit>

    /**
     * Exclui um horario.
     */
    suspend fun deleteSchedule(scheduleId: String): Result<Unit>

    /**
     * Busca um horario por ID.
     */
    suspend fun getScheduleById(scheduleId: String): Result<Schedule>
}
