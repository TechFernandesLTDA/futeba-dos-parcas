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

    // Fatores de penalidade
    /** Reducao por cancelamento de ultima hora (< 2h antes): 5% cada */
    const val LAST_MINUTE_CANCELLATION_PENALTY = 0.05

    /** Reducao por no-show (confirmou e nao apareceu): 10% cada */
    const val NO_SHOW_PENALTY = 0.10

    /** Taxa minima para ser considerado confiavel */
    const val RELIABLE_THRESHOLD = 0.75

    /** Taxa padrao quando nao ha historico */
    const val DEFAULT_RATE_NO_HISTORY = 1.0

    /** Horas antes do jogo que definem cancelamento de ultima hora */
    const val LAST_MINUTE_HOURS_THRESHOLD = 2.0

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
    ) {
        /**
         * Retorna a taxa ajustada como porcentagem formatada (ex: "85%").
         */
        fun getFormattedRate(): String = "${attendancePercentage}%"
    }

    /**
     * Calcula a taxa de presenca ajustada considerando cancelamentos de ultima hora.
     *
     * Formula:
     *   baseRate = attended / confirmed
     *   penalty = lastMinuteCancellations * LAST_MINUTE_CANCELLATION_PENALTY
     *   noShowPenalty = totalNoShows * NO_SHOW_PENALTY
     *   adjustedRate = max(0.0, baseRate - penalty - noShowPenalty)
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
        // Validar inputs negativos
        val safeConfirmed = totalConfirmed.coerceAtLeast(0)
        val safeAttended = totalAttended.coerceAtLeast(0)
        val safeLastMinute = lastMinuteCancellations.coerceAtLeast(0)
        val safeNoShows = totalNoShows.coerceAtLeast(0)

        // Taxa base: presencas / confirmacoes
        val baseRate = if (safeConfirmed > 0) {
            safeAttended.toDouble() / safeConfirmed.toDouble()
        } else {
            DEFAULT_RATE_NO_HISTORY
        }

        // Penalidade por cancelamentos de ultima hora
        val penalty = safeLastMinute * LAST_MINUTE_CANCELLATION_PENALTY
        val penaltyApplied = penalty > 0.0

        // Penalidade por no-shows (mais grave)
        val noShowPenalty = safeNoShows * NO_SHOW_PENALTY

        // Taxa ajustada (nunca abaixo de 0, nunca acima de 1)
        val adjustedRate = (baseRate - penalty - noShowPenalty).coerceIn(0.0, 1.0)

        val reliabilityLevel = ReliabilityLevel.fromAttendanceRate(adjustedRate)

        return AttendanceResult(
            attendanceRate = baseRate,
            reliabilityLevel = reliabilityLevel,
            attendancePercentage = (adjustedRate * 100).toInt(),
            isReliable = adjustedRate >= RELIABLE_THRESHOLD,
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
