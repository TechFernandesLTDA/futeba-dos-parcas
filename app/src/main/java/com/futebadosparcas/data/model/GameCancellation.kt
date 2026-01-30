package com.futebadosparcas.data.model

import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.Exclude
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

/**
 * Representa um registro de cancelamento de presenca em um jogo.
 * Armazena o motivo do cancelamento para fins de historico e confiabilidade.
 *
 * Colecao: games/{gameId}/cancellations
 */
@IgnoreExtraProperties
data class GameCancellation(
    @DocumentId
    var id: String = "",

    @get:PropertyName("game_id")
    @set:PropertyName("game_id")
    var gameId: String = "",

    @get:PropertyName("user_id")
    @set:PropertyName("user_id")
    var userId: String = "",

    @get:PropertyName("user_name")
    @set:PropertyName("user_name")
    var userName: String = "",

    @get:PropertyName("reason")
    @set:PropertyName("reason")
    var reason: String = CancellationReason.OTHER.name,

    @get:PropertyName("reason_text")
    @set:PropertyName("reason_text")
    var reasonText: String? = null,

    // Data/hora de quando cancelou
    @ServerTimestamp
    @get:PropertyName("cancelled_at")
    @set:PropertyName("cancelled_at")
    var cancelledAtRaw: Any? = null,

    // Horas antes do jogo que cancelou (para calcular confiabilidade)
    @get:PropertyName("hours_before_game")
    @set:PropertyName("hours_before_game")
    var hoursBeforeGame: Double = 0.0
) {
    constructor() : this(id = "")

    val cancelledAt: Date?
        @Exclude
        get() = when (val raw = cancelledAtRaw) {
            is Date -> raw
            is Timestamp -> raw.toDate()
            is Long -> Date(raw)
            else -> null
        }

    @Exclude
    fun getReasonEnum(): CancellationReason = try {
        CancellationReason.valueOf(reason)
    } catch (e: Exception) {
        CancellationReason.OTHER
    }

    @Exclude
    fun getDisplayReason(): String {
        return if (reason == CancellationReason.OTHER.name && !reasonText.isNullOrBlank()) {
            reasonText ?: getReasonEnum().displayName
        } else {
            getReasonEnum().displayName
        }
    }

    /**
     * Retorna true se o cancelamento foi feito em cima da hora (< 2h)
     */
    @Exclude
    fun isLastMinute(): Boolean = hoursBeforeGame < 2.0
}

/**
 * Motivos pre-definidos para cancelamento.
 */
enum class CancellationReason(val displayName: String) {
    UNEXPECTED("Imprevisto"),
    INJURY("Lesao"),
    WORK("Trabalho"),
    FAMILY("Familia"),
    WEATHER("Clima"),
    TRANSPORT("Transporte"),
    FINANCIAL("Financeiro"),
    OTHER("Outro")
}
