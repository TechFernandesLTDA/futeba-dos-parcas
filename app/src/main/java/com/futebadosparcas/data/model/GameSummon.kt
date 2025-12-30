package com.futebadosparcas.data.model

import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

/**
 * Representa uma convocação de jogador para um jogo específico
 * Coleção: game_summons
 * ID do documento: {gameId}_{userId}
 */
@IgnoreExtraProperties
data class GameSummon(
    @DocumentId
    var id: String = "",

    @get:PropertyName("game_id")
    @set:PropertyName("game_id")
    var gameId: String = "",

    @get:PropertyName("group_id")
    @set:PropertyName("group_id")
    var groupId: String = "",

    @get:PropertyName("user_id")
    @set:PropertyName("user_id")
    var userId: String = "",

    @get:PropertyName("user_name")
    @set:PropertyName("user_name")
    var userName: String = "",

    @get:PropertyName("user_photo")
    @set:PropertyName("user_photo")
    var userPhoto: String? = null,

    val status: String = SummonStatus.PENDING.name,

    val position: String? = null,

    @get:PropertyName("summoned_by")
    @set:PropertyName("summoned_by")
    var summonedBy: String = "",

    @get:PropertyName("summoned_by_name")
    @set:PropertyName("summoned_by_name")
    var summonedByName: String = "",

    @ServerTimestamp
    @get:PropertyName("summoned_at")
    @set:PropertyName("summoned_at")
    var summonedAt: Date? = null,

    @get:PropertyName("responded_at")
    @set:PropertyName("responded_at")
    var respondedAt: Date? = null
) {
    constructor() : this(id = "")

    fun getStatusEnum(): SummonStatus = try {
        SummonStatus.valueOf(status)
    } catch (e: Exception) {
        SummonStatus.PENDING
    }

    fun getPositionEnum(): PlayerPosition? = try {
        position?.let { PlayerPosition.valueOf(it) }
    } catch (e: Exception) {
        null
    }

    fun isPending(): Boolean = getStatusEnum() == SummonStatus.PENDING

    fun isConfirmed(): Boolean = getStatusEnum() == SummonStatus.CONFIRMED

    fun isDeclined(): Boolean = getStatusEnum() == SummonStatus.DECLINED

    fun canRespond(): Boolean = isPending()

    companion object {
        /**
         * Gera o ID do documento no formato {gameId}_{userId}
         */
        fun generateId(gameId: String, userId: String): String {
            return "${gameId}_${userId}"
        }
    }
}

/**
 * Status da convocação
 */
enum class SummonStatus(val displayName: String) {
    PENDING("Pendente"),     // Aguardando resposta
    CONFIRMED("Confirmado"), // Confirmou presença
    DECLINED("Recusado"),    // Recusou participação
    CANCELLED("Cancelado");  // Jogo foi cancelado

    companion object {
        fun fromString(value: String?): SummonStatus {
            return entries.find { it.name == value } ?: PENDING
        }
    }
}

/**
 * Representa um jogo na agenda do usuário (próximas 2 semanas)
 * Subcoleção: users/{userId}/upcoming_games
 */
@IgnoreExtraProperties
data class UpcomingGame(
    @DocumentId
    var id: String = "",

    @get:PropertyName("game_id")
    @set:PropertyName("game_id")
    var gameId: String = "",

    @get:PropertyName("group_id")
    @set:PropertyName("group_id")
    var groupId: String? = null,

    @get:PropertyName("group_name")
    @set:PropertyName("group_name")
    var groupName: String? = null,

    @get:PropertyName("date_time")
    @set:PropertyName("date_time")
    var dateTime: Date = Date(),

    @get:PropertyName("location_name")
    @set:PropertyName("location_name")
    var locationName: String = "",

    @get:PropertyName("location_address")
    @set:PropertyName("location_address")
    var locationAddress: String = "",

    @get:PropertyName("field_name")
    @set:PropertyName("field_name")
    var fieldName: String = "",

    val status: String = GameStatus.SCHEDULED.name,

    @get:PropertyName("my_position")
    @set:PropertyName("my_position")
    var myPosition: String? = null,

    @get:PropertyName("confirmed_count")
    @set:PropertyName("confirmed_count")
    var confirmedCount: Int = 0,

    @get:PropertyName("max_players")
    @set:PropertyName("max_players")
    var maxPlayers: Int = 0
) {
    constructor() : this(id = "")

    fun getStatusEnum(): GameStatus = try {
        GameStatus.valueOf(status)
    } catch (e: Exception) {
        GameStatus.SCHEDULED
    }

    fun getPositionEnum(): PlayerPosition? = try {
        myPosition?.let { PlayerPosition.valueOf(it) }
    } catch (e: Exception) {
        null
    }

    fun isFromGroup(): Boolean = !groupId.isNullOrEmpty()

    /**
     * Formata a data para exibição
     */
    fun getFormattedDate(): String {
        val sdf = java.text.SimpleDateFormat("dd/MM - HH:mm", java.util.Locale("pt", "BR"))
        return sdf.format(dateTime)
    }

    /**
     * Formata a lotação para exibição
     */
    fun getCapacityText(): String {
        return "$confirmedCount/$maxPlayers"
    }
}
