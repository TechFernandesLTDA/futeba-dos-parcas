package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Niveis de confiabilidade do jogador baseado na taxa de presenca.
 */
// NOTA: ReliabilityLevel nao usa @Serializable para evitar bug do
// compilador Kotlin 2.2.x com enums + companion object.
// O campo e serializado como String quando necessario.
enum class ReliabilityLevel(val displayName: String) {
    EXCELLENT("Excelente"),
    GOOD("Bom"),
    MODERATE("Regular"),
    LOW("Baixo");

    companion object {
        /**
         * Determina o nivel de confiabilidade baseado na taxa de presenca.
         */
        fun fromAttendanceRate(rate: Double): ReliabilityLevel = when {
            rate >= 0.90 -> EXCELLENT
            rate >= 0.75 -> GOOD
            rate >= 0.50 -> MODERATE
            else -> LOW
        }
    }
}

/**
 * Representa o historico de presenca de um jogador (versao KMP).
 *
 * Usado para calcular o badge de confiabilidade e exibir estatisticas
 * de presenca nos ultimos 90 dias.
 *
 * Colecao Firestore: users/{userId}/attendance_history
 */
@Serializable
data class PlayerAttendance(
    val id: String = "",
    @SerialName("user_id") val userId: String = "",
    @SerialName("total_confirmed") val totalConfirmed: Int = 0,
    @SerialName("total_attended") val totalAttended: Int = 0,
    @SerialName("total_cancelled") val totalCancelled: Int = 0,
    @SerialName("last_minute_cancellations") val lastMinuteCancellations: Int = 0,
    @SerialName("total_no_shows") val totalNoShows: Int = 0,
    @SerialName("attendance_rate") val attendanceRate: Double = 1.0,
    @SerialName("last_updated") val lastUpdated: Long? = null
) {
    /**
     * Retorna o nivel de confiabilidade baseado na taxa de presenca.
     */
    fun getReliabilityLevel(): ReliabilityLevel =
        ReliabilityLevel.fromAttendanceRate(attendanceRate)

    /**
     * Retorna a taxa de presenca como percentual inteiro (0-100).
     */
    fun getAttendancePercentage(): Int = (attendanceRate * 100).toInt()

    /**
     * Verifica se o jogador e confiavel (>= 75% de presenca).
     */
    fun isReliable(): Boolean = attendanceRate >= 0.75

    /**
     * Verifica se o jogador tem baixa confiabilidade (< 50%).
     */
    fun hasLowReliability(): Boolean = attendanceRate < 0.50

    /**
     * Recalcula a taxa de presenca com base nos dados atuais.
     */
    fun recalculateRate(): Double {
        if (totalConfirmed == 0) return 1.0
        return totalAttended.toDouble() / totalConfirmed.toDouble()
    }

    companion object {
        /** Peso para cancelamentos de ultima hora no calculo de confiabilidade */
        const val LAST_MINUTE_PENALTY = 0.5
    }
}
