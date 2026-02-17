package com.futebadosparcas.data.model

import com.futebadosparcas.domain.validation.ValidationErrorCode
import com.futebadosparcas.domain.validation.ValidationHelper
import com.futebadosparcas.domain.validation.ValidationResult
import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.Exclude
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.PropertyName
import java.util.Date

/**
 * Representa o historico de presenca de um jogador.
 * Usado para calcular o badge de confiabilidade.
 *
 * Colecao: users/{userId}/attendance_history
 * ou pode ser agregado em users.attendance_stats
 */
@IgnoreExtraProperties
data class PlayerAttendance(
    @DocumentId
    var id: String = "",

    @get:PropertyName("user_id")
    @set:PropertyName("user_id")
    var userId: String = "",

    // Total de jogos confirmados nos ultimos 90 dias
    @get:PropertyName("total_confirmed")
    @set:PropertyName("total_confirmed")
    var totalConfirmed: Int = 0,

    // Total de jogos que realmente compareceu
    @get:PropertyName("total_attended")
    @set:PropertyName("total_attended")
    var totalAttended: Int = 0,

    // Total de cancelamentos
    @get:PropertyName("total_cancelled")
    @set:PropertyName("total_cancelled")
    var totalCancelled: Int = 0,

    // Cancelamentos de ultima hora (< 2h)
    @get:PropertyName("last_minute_cancellations")
    @set:PropertyName("last_minute_cancellations")
    var lastMinuteCancellations: Int = 0,

    // Total de no-shows (confirmou mas nao apareceu)
    @get:PropertyName("total_no_shows")
    @set:PropertyName("total_no_shows")
    var totalNoShows: Int = 0,

    // Taxa de presenca (0.0 - 1.0)
    @get:PropertyName("attendance_rate")
    @set:PropertyName("attendance_rate")
    var attendanceRate: Double = 1.0,

    // Ultima atualizacao
    @get:PropertyName("last_updated")
    @set:PropertyName("last_updated")
    var lastUpdatedRaw: Any? = null
) {
    constructor() : this(id = "")

    val lastUpdated: Date?
        @Exclude
        get() = when (val raw = lastUpdatedRaw) {
            is Date -> raw
            is Timestamp -> raw.toDate()
            is Long -> Date(raw)
            else -> null
        }

    @Exclude
    fun getReliabilityLevel(): ReliabilityLevel {
        return when {
            attendanceRate >= 0.90 -> ReliabilityLevel.EXCELLENT
            attendanceRate >= 0.75 -> ReliabilityLevel.GOOD
            attendanceRate >= 0.50 -> ReliabilityLevel.MODERATE
            else -> ReliabilityLevel.LOW
        }
    }

    @Exclude
    fun getAttendancePercentage(): Int = (attendanceRate * 100).toInt()

    @Exclude
    fun isReliable(): Boolean = attendanceRate >= 0.75

    @Exclude
    fun hasLowReliability(): Boolean = attendanceRate < 0.50

    // ==================== VALIDAÇÃO ====================

    @Exclude
    fun validate(): List<ValidationResult.Invalid> {
        val errors = mutableListOf<ValidationResult.Invalid>()
        val uResult = ValidationHelper.validateRequiredId(userId, "user_id")
        if (uResult is ValidationResult.Invalid) errors.add(uResult)
        if (totalConfirmed < 0) errors.add(ValidationResult.Invalid("total_confirmed", "Confirmados não pode ser negativo", ValidationErrorCode.NEGATIVE_VALUE))
        if (totalAttended < 0) errors.add(ValidationResult.Invalid("total_attended", "Presentes não pode ser negativo", ValidationErrorCode.NEGATIVE_VALUE))
        if (totalCancelled < 0) errors.add(ValidationResult.Invalid("total_cancelled", "Cancelados não pode ser negativo", ValidationErrorCode.NEGATIVE_VALUE))
        if (totalAttended > totalConfirmed && totalConfirmed >= 0) {
            errors.add(ValidationResult.Invalid("total_attended", "Presentes ($totalAttended) não pode exceder confirmados ($totalConfirmed)", ValidationErrorCode.LOGICAL_INCONSISTENCY))
        }
        if (attendanceRate < 0.0 || attendanceRate > 1.0) {
            errors.add(ValidationResult.Invalid("attendance_rate", "Taxa de presença deve estar entre 0.0 e 1.0", ValidationErrorCode.OUT_OF_RANGE))
        }
        return errors
    }

    /**
     * Recalcula a taxa de presenca com base nos dados atuais.
     */
    @Exclude
    fun recalculateRate(): Double {
        if (totalConfirmed == 0) return 1.0
        return totalAttended.toDouble() / totalConfirmed.toDouble()
    }

    companion object {
        // Peso para cancelamentos de ultima hora
        const val LAST_MINUTE_PENALTY = 0.5

        fun calculate(
            userId: String,
            confirmations: List<GameConfirmation>,
            cancellations: List<GameCancellation>
        ): PlayerAttendance {
            val confirmed = confirmations.count { it.status == ConfirmationStatus.CONFIRMED.name }
            val attended = confirmations.count {
                it.status == ConfirmationStatus.CONFIRMED.name
                // && foi marcado como presente via check-in ou pelo organizador
            }
            val cancelled = cancellations.size
            val lastMinute = cancellations.count { it.isLastMinute() }

            val rate = if (confirmed > 0) {
                attended.toDouble() / confirmed.toDouble()
            } else 1.0

            return PlayerAttendance(
                userId = userId,
                totalConfirmed = confirmed,
                totalAttended = attended,
                totalCancelled = cancelled,
                lastMinuteCancellations = lastMinute,
                attendanceRate = rate,
                lastUpdatedRaw = Date()
            )
        }
    }
}

/**
 * Niveis de confiabilidade do jogador.
 */
enum class ReliabilityLevel(val displayName: String, val emoji: String) {
    EXCELLENT("Excelente", "⭐"),
    GOOD("Bom", "✓"),
    MODERATE("Regular", "~"),
    LOW("Baixo", "⚠")
}
