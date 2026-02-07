package com.futebadosparcas.domain.usecase

import com.futebadosparcas.domain.model.PlayerAttendance
import com.futebadosparcas.domain.model.ReliabilityLevel

/**
 * Use Case para calculo de taxa de presenca e confiabilidade de jogadores.
 * Logica pura, compartilhavel entre plataformas.
 *
 * Usado para:
 * - Calcular badge de confiabilidade
 * - Exibir estatisticas de presenca
 * - Determinar prioridade na lista de espera
 */
object CalculateAttendanceRateUseCase {

    /**
     * Resultado do calculo de presenca com detalhamento.
     */
    data class AttendanceResult(
        val attendanceRate: Double,
        val reliabilityLevel: ReliabilityLevel,
        val attendancePercentage: Int,
        val isReliable: Boolean,
        val penaltyApplied: Boolean,
        val adjustedRate: Double
    )

    /**
     * Calcula a taxa de presenca ajustada considerando cancelamentos de ultima hora.
     *
     * Formula:
     *   baseRate = attended / confirmed
     *   penalty = lastMinuteCancellations * LAST_MINUTE_PENALTY * penaltyFactor
     *   adjustedRate = max(0.0, baseRate - penalty)
     *
     * @param totalConfirmed Total de jogos confirmados
     * @param totalAttended Total de jogos que compareceu
     * @param totalCancelled Total de cancelamentos
     * @param lastMinuteCancellations Cancelamentos de ultima hora (< 2h)
     * @param totalNoShows Confirmou mas nao apareceu
     * @return Resultado detalhado do calculo
     */
    operator fun invoke(
        totalConfirmed: Int,
        totalAttended: Int,
        totalCancelled: Int = 0,
        lastMinuteCancellations: Int = 0,
        totalNoShows: Int = 0
    ): AttendanceResult {
        // Taxa base: presencas / confirmacoes
        val baseRate = if (totalConfirmed > 0) {
            totalAttended.toDouble() / totalConfirmed.toDouble()
        } else {
            1.0 // Sem historico = 100%
        }

        // Penalidade por cancelamentos de ultima hora
        // Cada cancelamento de ultima hora reduz 5% da taxa
        val penaltyFactor = 0.05
        val penalty = lastMinuteCancellations * penaltyFactor
        val penaltyApplied = penalty > 0.0

        // Penalidade por no-shows (mais grave: 10% cada)
        val noShowPenalty = totalNoShows * 0.10

        // Taxa ajustada (nunca abaixo de 0)
        val adjustedRate = (baseRate - penalty - noShowPenalty).coerceIn(0.0, 1.0)

        val reliabilityLevel = ReliabilityLevel.fromAttendanceRate(adjustedRate)

        return AttendanceResult(
            attendanceRate = baseRate,
            reliabilityLevel = reliabilityLevel,
            attendancePercentage = (adjustedRate * 100).toInt(),
            isReliable = adjustedRate >= 0.75,
            penaltyApplied = penaltyApplied || noShowPenalty > 0,
            adjustedRate = adjustedRate
        )
    }

    /**
     * Calcula a taxa de presenca a partir de um PlayerAttendance existente.
     */
    fun fromAttendance(attendance: PlayerAttendance): AttendanceResult {
        return invoke(
            totalConfirmed = attendance.totalConfirmed,
            totalAttended = attendance.totalAttended,
            totalCancelled = attendance.totalCancelled,
            lastMinuteCancellations = attendance.lastMinuteCancellations,
            totalNoShows = attendance.totalNoShows
        )
    }

    /**
     * Determina se um jogador deve receber prioridade na lista de espera
     * baseado na sua confiabilidade.
     *
     * Jogadores com taxa >= 90% tem prioridade maxima.
     * Jogadores com taxa < 50% tem prioridade minima.
     *
     * @return Valor de prioridade de 0 (mais baixa) a 100 (mais alta)
     */
    fun calculateWaitlistPriority(attendance: PlayerAttendance): Int {
        val result = fromAttendance(attendance)
        return (result.adjustedRate * 100).toInt()
    }
}
