package com.futebadosparcas.domain

import com.futebadosparcas.domain.model.ReliabilityLevel
import com.futebadosparcas.domain.usecase.CalculateAttendanceRateUseCase
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Testes compartilhados para CalculateAttendanceRateUseCase.
 * Logica pura — executam em Android (JVM) e iOS (Native).
 *
 * Cobre: taxa base, penalidades (cancelamento de ultima hora + no-show),
 * niveis de confiabilidade e truncamento de porcentagem.
 */
class CalculateAttendanceRateUseCaseTest {

    private val tolerance = 0.001

    @Test
    fun invoke_semHistorico_retornaTaxaPadraoUm() {
        val result = CalculateAttendanceRateUseCase(totalConfirmed = 0, totalAttended = 0)
        assertEquals(1.0, result.adjustedRate, tolerance)
        assertEquals(ReliabilityLevel.EXCELLENT, result.reliabilityLevel)
        assertTrue(result.isReliable)
    }

    @Test
    fun invoke_presencaPerfeita_taxaUm() {
        val result = CalculateAttendanceRateUseCase(totalConfirmed = 10, totalAttended = 10)
        assertEquals(1.0, result.adjustedRate, tolerance)
        assertEquals(100, result.attendancePercentage)
        assertTrue(result.isReliable)
    }

    @Test
    fun invoke_metadeDasPresencas_taxaMeio() {
        val result = CalculateAttendanceRateUseCase(totalConfirmed = 10, totalAttended = 5)
        assertEquals(0.5, result.adjustedRate, tolerance)
        assertEquals(ReliabilityLevel.MODERATE, result.reliabilityLevel)
        assertFalse(result.isReliable) // 0.5 < RELIABLE_THRESHOLD (0.75)
    }

    @Test
    fun invoke_cancelamentoUltimaHora_aplicaPenalidade() {
        // baseRate = 1.0, penalty = 2 * 0.05 = 0.10 -> adjusted = 0.90
        val result = CalculateAttendanceRateUseCase(
            totalConfirmed = 10,
            totalAttended = 10,
            lastMinuteCancellations = 2
        )
        assertEquals(0.90, result.adjustedRate, tolerance)
        assertTrue(result.penaltyApplied)
        assertEquals(ReliabilityLevel.EXCELLENT, result.reliabilityLevel) // >= 0.90
    }

    @Test
    fun invoke_noShow_aplicaPenalidadeMaisGrave() {
        // baseRate = 1.0, noShowPenalty = 2 * 0.10 = 0.20 -> adjusted = 0.80
        val result = CalculateAttendanceRateUseCase(
            totalConfirmed = 10,
            totalAttended = 10,
            totalNoShows = 2
        )
        assertEquals(0.80, result.adjustedRate, tolerance)
        assertTrue(result.penaltyApplied)
        assertEquals(ReliabilityLevel.GOOD, result.reliabilityLevel) // >= 0.75
    }

    @Test
    fun invoke_taxaNuncaAbaixoDeZero() {
        // Penalidades excedem a taxa base -> coerce em 0.0.
        val result = CalculateAttendanceRateUseCase(
            totalConfirmed = 10,
            totalAttended = 5,
            lastMinuteCancellations = 20,
            totalNoShows = 20
        )
        assertEquals(0.0, result.adjustedRate, tolerance)
        assertEquals(ReliabilityLevel.LOW, result.reliabilityLevel)
    }

    @Test
    fun invoke_inputsNegativos_tratadosComoZero() {
        val result = CalculateAttendanceRateUseCase(
            totalConfirmed = -5,
            totalAttended = -3
        )
        // Sem confirmacoes validas -> taxa padrao 1.0.
        assertEquals(1.0, result.adjustedRate, tolerance)
    }

    @Test
    fun invoke_porcentagemEhTruncada() {
        // baseRate = 6/7 ≈ 0.857 -> (0.857 * 100).toInt() = 85 (truncado, nao arredondado).
        val result = CalculateAttendanceRateUseCase(totalConfirmed = 7, totalAttended = 6)
        assertEquals(85, result.attendancePercentage)
    }

    @Test
    fun getFormattedRate_incluiSimboloPorcentagem() {
        val result = CalculateAttendanceRateUseCase(totalConfirmed = 10, totalAttended = 8)
        assertEquals("80%", result.getFormattedRate())
    }
}
