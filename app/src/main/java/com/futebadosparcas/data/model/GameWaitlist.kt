package com.futebadosparcas.data.model

import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.Exclude
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

/**
 * Representa uma entrada na lista de espera de um jogo.
 * Quando o jogo atinge o limite de jogadores, novos jogadores
 * sao adicionados a lista de espera.
 *
 * Colecao: games/{gameId}/waitlist
 */
@IgnoreExtraProperties
data class GameWaitlist(
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

    @get:PropertyName("user_photo")
    @set:PropertyName("user_photo")
    var userPhoto: String? = null,

    @get:PropertyName("position")
    @set:PropertyName("position")
    var position: String = PlayerPosition.FIELD.name,

    @get:PropertyName("queue_position")
    @set:PropertyName("queue_position")
    var queuePosition: Int = 0,

    @get:PropertyName("status")
    @set:PropertyName("status")
    var status: String = WaitlistStatus.WAITING.name,

    // Data/hora de quando foi adicionado a lista de espera
    @ServerTimestamp
    @get:PropertyName("added_at")
    @set:PropertyName("added_at")
    var addedAtRaw: Any? = null,

    // Data/hora de quando foi notificado sobre vaga
    @get:PropertyName("notified_at")
    @set:PropertyName("notified_at")
    var notifiedAtRaw: Any? = null,

    // Data/hora limite para responder a vaga
    @get:PropertyName("response_deadline")
    @set:PropertyName("response_deadline")
    var responseDeadlineRaw: Any? = null
) {
    constructor() : this(id = "")

    val addedAt: Date?
        @Exclude
        get() = when (val raw = addedAtRaw) {
            is Date -> raw
            is Timestamp -> raw.toDate()
            is Long -> Date(raw)
            else -> null
        }

    val notifiedAt: Date?
        @Exclude
        get() = when (val raw = notifiedAtRaw) {
            is Date -> raw
            is Timestamp -> raw.toDate()
            is Long -> Date(raw)
            else -> null
        }

    val responseDeadline: Date?
        @Exclude
        get() = when (val raw = responseDeadlineRaw) {
            is Date -> raw
            is Timestamp -> raw.toDate()
            is Long -> Date(raw)
            else -> null
        }

    @Exclude
    fun getStatusEnum(): WaitlistStatus = try {
        WaitlistStatus.valueOf(status)
    } catch (e: Exception) {
        WaitlistStatus.WAITING
    }

    @Exclude
    fun getPositionEnum(): PlayerPosition = try {
        PlayerPosition.valueOf(position)
    } catch (e: Exception) {
        PlayerPosition.FIELD
    }

    @Exclude
    fun isExpired(): Boolean {
        val deadline = responseDeadline ?: return false
        return Date().after(deadline)
    }

    @Exclude
    fun hasBeenNotified(): Boolean = notifiedAt != null

    companion object {
        // Tempo padrao para responder a vaga: 30 minutos
        const val DEFAULT_RESPONSE_TIME_MS = 30L * 60 * 1000
    }
}

/**
 * Status da entrada na lista de espera.
 */
enum class WaitlistStatus {
    WAITING,        // Aguardando vaga
    NOTIFIED,       // Notificado sobre vaga disponivel
    PROMOTED,       // Promovido para lista de confirmados
    EXPIRED,        // Nao respondeu no tempo limite
    CANCELLED       // Cancelado pelo usuario
}
