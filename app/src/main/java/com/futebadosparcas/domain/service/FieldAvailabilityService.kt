package com.futebadosparcas.domain.service

import com.futebadosparcas.data.model.Game
import com.futebadosparcas.data.repository.GameRepository
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Representa um slot de horario em uma quadra.
 */
data class TimeSlot(
    val startTime: String,
    val endTime: String,
    val isAvailable: Boolean,
    val conflictingGameOwner: String? = null
)

/**
 * Disponibilidade de uma quadra em um dia especifico.
 */
data class DayAvailability(
    val date: LocalDate,
    val slots: List<TimeSlot>,
    val hasAvailableSlots: Boolean
)

/**
 * Servico para verificar disponibilidade de quadras.
 * Fornece dados para exibicao de calendario visual de disponibilidade.
 */
@Singleton
class FieldAvailabilityService @Inject constructor(
    private val gameRepository: GameRepository
) {
    companion object {
        // Horarios padrao para slots (6:00 - 23:00, intervalo de 1 hora)
        val DEFAULT_SLOTS = (6..22).map { hour ->
            val startTime = "%02d:00".format(hour)
            val endTime = "%02d:00".format(hour + 1)
            Pair(startTime, endTime)
        }
    }

    /**
     * Busca a disponibilidade de uma quadra para um dia especifico.
     *
     * @param fieldId ID da quadra
     * @param date Data para verificar
     * @return Disponibilidade do dia com slots marcados
     */
    suspend fun getFieldAvailability(fieldId: String, date: LocalDate): DayAvailability {
        val dateStr = date.format(DateTimeFormatter.ISO_LOCAL_DATE)
        val gamesResult = gameRepository.getGamesByFieldAndDate(fieldId, dateStr)

        val games = gamesResult.getOrNull() ?: emptyList()

        val slots = DEFAULT_SLOTS.map { (start, end) ->
            val startTime = LocalTime.parse(start, DateTimeFormatter.ofPattern("HH:mm"))
            val endTime = LocalTime.parse(end, DateTimeFormatter.ofPattern("HH:mm"))

            val conflictingGame = games.find { game ->
                hasTimeOverlap(game.time, game.endTime, start, end)
            }

            TimeSlot(
                startTime = start,
                endTime = end,
                isAvailable = conflictingGame == null,
                conflictingGameOwner = conflictingGame?.ownerName
            )
        }

        return DayAvailability(
            date = date,
            slots = slots,
            hasAvailableSlots = slots.any { it.isAvailable }
        )
    }

    /**
     * Busca disponibilidade para uma semana a partir de uma data.
     *
     * @param fieldId ID da quadra
     * @param startDate Data inicial
     * @return Lista de disponibilidade para 7 dias
     */
    suspend fun getWeekAvailability(
        fieldId: String,
        startDate: LocalDate
    ): List<DayAvailability> {
        return (0..6).map { daysToAdd ->
            val date = startDate.plusDays(daysToAdd.toLong())
            getFieldAvailability(fieldId, date)
        }
    }

    /**
     * Verifica se um horario especifico esta disponivel.
     *
     * @param fieldId ID da quadra
     * @param date Data do jogo
     * @param startTime Horario de inicio (HH:mm)
     * @param endTime Horario de termino (HH:mm)
     * @param excludeGameId ID de jogo a excluir (para edicao)
     * @return true se disponivel, false se ha conflito
     */
    suspend fun isTimeSlotAvailable(
        fieldId: String,
        date: LocalDate,
        startTime: String,
        endTime: String,
        excludeGameId: String? = null
    ): Boolean {
        val conflicts = gameRepository.checkTimeConflict(
            fieldId = fieldId,
            date = date.format(DateTimeFormatter.ISO_LOCAL_DATE),
            startTime = startTime,
            endTime = endTime,
            excludeGameId = excludeGameId
        )

        return conflicts.getOrNull()?.isEmpty() == true
    }

    /**
     * Verifica sobreposicao de horarios.
     */
    private fun hasTimeOverlap(
        existingStart: String,
        existingEnd: String,
        newStart: String,
        newEnd: String
    ): Boolean {
        if (existingStart.isBlank() || existingEnd.isBlank()) return false

        return try {
            val formatter = DateTimeFormatter.ofPattern("HH:mm")
            val existStartTime = LocalTime.parse(existingStart, formatter)
            val existEndTime = LocalTime.parse(existingEnd, formatter)
            val newStartTime = LocalTime.parse(newStart, formatter)
            val newEndTime = LocalTime.parse(newEnd, formatter)

            // Sobreposicao existe se: newStart < existEnd AND newEnd > existStart
            newStartTime.isBefore(existEndTime) && newEndTime.isAfter(existStartTime)
        } catch (e: Exception) {
            false
        }
    }
}
