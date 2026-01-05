package com.futebadosparcas.data.model

import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.Exclude
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

@IgnoreExtraProperties
data class Game(
    @DocumentId
    var id: String = "",
    @get:PropertyName("schedule_id")
    @set:PropertyName("schedule_id")
    var scheduleId: String = "",
    val date: String = "",
    val time: String = "",
    @get:PropertyName("end_time")
    @set:PropertyName("end_time")
    var endTime: String = "",
    @get:PropertyName("status")
    @set:PropertyName("status")
    var status: String = GameStatus.SCHEDULED.name,
    @get:PropertyName("max_players")
    @set:PropertyName("max_players")
    var maxPlayers: Int = 14,
    @get:PropertyName("max_goalkeepers")
    @set:PropertyName("max_goalkeepers")
    var maxGoalkeepers: Int = 3,
    @get:PropertyName("players_count")
    @set:PropertyName("players_count")
    var playersCount: Int = 0,
    @get:PropertyName("goalkeepers_count")
    @set:PropertyName("goalkeepers_count")
    var goalkeepersCount: Int = 0,
    var players: List<String> = emptyList(),
    @get:PropertyName("daily_price")
    @set:PropertyName("daily_price")
    var dailyPrice: Double = 0.0,
    @get:PropertyName("confirmation_closes_at")
    @set:PropertyName("confirmation_closes_at")
    var confirmationClosesAt: String? = null,
    @get:PropertyName("total_cost")
    @set:PropertyName("total_cost")
    var totalCost: Double = 0.0,
    @get:PropertyName("pix_key")
    @set:PropertyName("pix_key")
    var pixKey: String = "",
    @get:PropertyName("number_of_teams")
    @set:PropertyName("number_of_teams")
    var numberOfTeams: Int = 2,
    @get:PropertyName("owner_id")
    @set:PropertyName("owner_id")
    var ownerId: String = "",
    @get:PropertyName("owner_name")
    @set:PropertyName("owner_name")
    var ownerName: String = "",
    // Referências ao local e quadra (IDs para consultas)
    @get:PropertyName("location_id")
    @set:PropertyName("location_id")
    var locationId: String = "",
    @get:PropertyName("field_id")
    @set:PropertyName("field_id")
    var fieldId: String = "",
    // Dados desnormalizados para exibição (evita joins)
    @get:PropertyName("location_name")
    @set:PropertyName("location_name")
    var locationName: String = "",
    @get:PropertyName("location_address")
    @set:PropertyName("location_address")
    var locationAddress: String = "",
    @get:PropertyName("location_lat")
    @set:PropertyName("location_lat")
    var locationLat: Double? = null,
    @get:PropertyName("location_lng")
    @set:PropertyName("location_lng")
    var locationLng: Double? = null,
    @get:PropertyName("field_name")
    @set:PropertyName("field_name")
    var fieldName: String = "",
    @get:PropertyName("game_type")
    @set:PropertyName("game_type")
    var gameType: String = "Society", // Society, Futsal, Campo
    @get:PropertyName("recurrence")
    @set:PropertyName("recurrence")
    var recurrence: String = "none", // none, weekly, biweekly, monthly
    @get:PropertyName("is_public")
    @set:PropertyName("is_public")
    var isPublic: Boolean = true,

    // Novo sistema de visibilidade (substitui isPublic gradualmente)
    @get:PropertyName("visibility")
    @set:PropertyName("visibility")
    var visibility: String = GameVisibility.GROUP_ONLY.name,

    // Campo raw para aceitar Timestamp ou Date do Firestore
    @get:PropertyName("dateTime")
    @set:PropertyName("dateTime")
    var dateTimeRaw: Any? = null,
    @ServerTimestamp
    @get:PropertyName("created_at")
    @set:PropertyName("created_at")
    var createdAt: Date? = null,
    // Flag para evitar reprocessamento de XP/estatisticas
    @get:PropertyName("xp_processed")
    @set:PropertyName("xp_processed")
    var xpProcessed: Boolean = false,
    // Timestamp de quando o XP foi processado
    @get:PropertyName("xp_processed_at")
    @set:PropertyName("xp_processed_at")
    var xpProcessedAt: Date? = null,
    @get:PropertyName("mvp_id")
    @set:PropertyName("mvp_id")
    var mvpId: String? = null,

    // Denormalized Live Scores
    @get:PropertyName("team1_score")
    @set:PropertyName("team1_score")
    var team1Score: Int = 0,
    @get:PropertyName("team2_score")
    @set:PropertyName("team2_score")
    var team2Score: Int = 0,
    @get:PropertyName("team1_name")
    @set:PropertyName("team1_name")
    var team1Name: String = "Time 1",
    @get:PropertyName("team2_name")
    @set:PropertyName("team2_name")
    var team2Name: String = "Time 2",
    @get:PropertyName("group_id")
    @set:PropertyName("group_id")
    var groupId: String? = null,
    @get:PropertyName("group_name")
    @set:PropertyName("group_name")
    var groupName: String? = null
) {
    constructor() : this(id = "")

    /**
     * Propriedade computada para converter dateTimeRaw (Timestamp/Date/Long) para Date.
     * Resolve problema de deserializacao do Firestore que retorna Timestamp.
     */
    val dateTime: Date?
        @Exclude
        get() = when (val raw = dateTimeRaw) {
            is Date -> raw
            is Timestamp -> raw.toDate()
            is Long -> Date(raw)
            else -> null
        }

    // Helper methods for enum conversion
    @Exclude
    fun getStatusEnum(): GameStatus = try {
        GameStatus.valueOf(status)
    } catch (e: Exception) {
        GameStatus.SCHEDULED
    }

    @Exclude
    fun setStatusEnum(gameStatus: GameStatus) {
        status = gameStatus.name
    }

    /**
     * Retorna o enum de visibilidade do jogo.
     * Compatibilidade: Se visibility não estiver definido, usa isPublic como fallback.
     */
    @Exclude
    fun getVisibilityEnum(): GameVisibility = try {
        GameVisibility.valueOf(visibility)
    } catch (e: Exception) {
        // Compatibilidade com jogos antigos que só têm isPublic
        if (isPublic) GameVisibility.PUBLIC_CLOSED else GameVisibility.GROUP_ONLY
    }

    /**
     * Define a visibilidade do jogo
     */
    @Exclude
    fun setVisibility(gameVisibility: GameVisibility) {
        visibility = gameVisibility.name
        // Manter isPublic sincronizado para compatibilidade
        isPublic = gameVisibility != GameVisibility.GROUP_ONLY
    }

    /**
     * Verifica se o jogo aceita solicitações externas
     */
    @Exclude
    fun acceptsExternalRequests(): Boolean {
        return getVisibilityEnum() == GameVisibility.PUBLIC_OPEN
    }

    /**
     * Verifica se o jogo é visível publicamente
     */
    @Exclude
    fun isPubliclyVisible(): Boolean {
        val vis = getVisibilityEnum()
        return vis == GameVisibility.PUBLIC_CLOSED || vis == GameVisibility.PUBLIC_OPEN
    }
}

enum class GameStatus {
    SCHEDULED,     // Lista aberta para confirmacoes
    CONFIRMED,     // Lista fechada, aguardando inicio
    LIVE,          // Bola rolando - jogo em andamento
    FINISHED,      // Jogo finalizado
    CANCELLED      // Jogo cancelado
}

@IgnoreExtraProperties
data class GameConfirmation(
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
    @get:PropertyName("status")
    @set:PropertyName("status")
    var status: String = ConfirmationStatus.CONFIRMED.name,
    @get:PropertyName("payment_status")
    @set:PropertyName("payment_status")
    var paymentStatus: String = PaymentStatus.PENDING.name,
    @get:PropertyName("is_casual_player")
    @set:PropertyName("is_casual_player")
    var isCasualPlayer: Boolean = false,
    // Live Stats (Transient or persisted, depending on architecture)
    @get:PropertyName("goals")
    @set:PropertyName("goals")
    var goals: Int = 0,
    @get:PropertyName("yellow_cards")
    @set:PropertyName("yellow_cards")
    var yellowCards: Int = 0,
    @get:PropertyName("red_cards")
    @set:PropertyName("red_cards")
    var redCards: Int = 0,
    @get:PropertyName("assists")
    @set:PropertyName("assists")
    var assists: Int = 0,
    @get:PropertyName("saves")
    @set:PropertyName("saves")
    var saves: Int = 0,
    @ServerTimestamp
    @get:PropertyName("confirmed_at")
    @set:PropertyName("confirmed_at")
    var confirmedAt: Date? = null,

    @get:PropertyName("nickname")
    @set:PropertyName("nickname")
    var nickname: String? = null,

    @get:PropertyName("xp_earned")
    @set:PropertyName("xp_earned")
    var xpEarned: Int = 0,
    @get:PropertyName("is_mvp")
    @set:PropertyName("is_mvp")
    var isMvp: Boolean = false,
    @get:PropertyName("is_best_gk")
    @set:PropertyName("is_best_gk")
    var isBestGk: Boolean = false,
    @get:PropertyName("is_worst_player")
    @set:PropertyName("is_worst_player")
    var isWorstPlayer: Boolean = false
) {
    constructor() : this(id = "")

    @Exclude
    fun getDisplayName(): String {
        return if (!nickname.isNullOrBlank()) nickname!! else userName
    }

    @Exclude
    fun getStatusEnum(): ConfirmationStatus = try {
        ConfirmationStatus.valueOf(status)
    } catch (e: Exception) {
        ConfirmationStatus.CONFIRMED
    }

    @Exclude
    fun getPaymentStatusEnum(): PaymentStatus = try {
        PaymentStatus.valueOf(paymentStatus)
    } catch (e: Exception) {
        PaymentStatus.PENDING
    }

    @Exclude
    fun getPositionEnum(): PlayerPosition = try {
        PlayerPosition.valueOf(position)
    } catch (e: Exception) {
        PlayerPosition.FIELD
    }
}

enum class ConfirmationStatus {
    CONFIRMED, CANCELLED, PENDING, WAITLIST
}

@IgnoreExtraProperties
data class Team(
    @DocumentId
    var id: String = "",
    @get:PropertyName("game_id")
    @set:PropertyName("game_id")
    var gameId: String = "",
    val name: String = "",
    val color: String = "",
    @get:PropertyName("player_ids")
    @set:PropertyName("player_ids")
    var playerIds: List<String> = emptyList(),
    var score: Int = 0
) : java.io.Serializable {
    constructor() : this(id = "")
}

@IgnoreExtraProperties
data class PlayerStats(
    @DocumentId
    var id: String = "",
    @get:PropertyName("game_id")
    @set:PropertyName("game_id")
    var gameId: String = "",
    @get:PropertyName("user_id")
    @set:PropertyName("user_id")
    var userId: String = "",
    @get:PropertyName("team_id")
    @set:PropertyName("team_id")
    var teamId: String? = null,
    val goals: Int = 0,
    val saves: Int = 0,
    @get:PropertyName("is_best_player")
    @set:PropertyName("is_best_player")
    var isBestPlayer: Boolean = false,
    @get:PropertyName("is_worst_player")
    @set:PropertyName("is_worst_player")
    var isWorstPlayer: Boolean = false,
    @get:PropertyName("best_goal")
    @set:PropertyName("best_goal")
    var bestGoal: Boolean = false
) {
    constructor() : this(id = "")
}
