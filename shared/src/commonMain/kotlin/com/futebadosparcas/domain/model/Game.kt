package com.futebadosparcas.domain.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Status do jogo.
 */
@Serializable
enum class GameStatus {
    @SerialName("SCHEDULED")
    SCHEDULED,      // Lista aberta para confirmacoes

    @SerialName("CONFIRMED")
    CONFIRMED,      // Lista fechada, aguardando inicio

    @SerialName("LIVE")
    LIVE,           // Bola rolando - jogo em andamento

    @SerialName("FINISHED")
    FINISHED,       // Jogo finalizado

    @SerialName("CANCELLED")
    CANCELLED       // Jogo cancelado
}

/**
 * Visibilidade do jogo.
 */
@Serializable
enum class GameVisibility(val displayName: String) {
    @SerialName("GROUP_ONLY")
    GROUP_ONLY("Apenas Grupo"),

    @SerialName("PUBLIC_CLOSED")
    PUBLIC_CLOSED("Publico (Lista Fechada)"),

    @SerialName("PUBLIC_OPEN")
    PUBLIC_OPEN("Publico (Aceita Solicitacoes)")
}

/**
 * Status de confirmacao do jogador.
 */
@Serializable
enum class ConfirmationStatus {
    @SerialName("CONFIRMED")
    CONFIRMED,

    @SerialName("CANCELLED")
    CANCELLED,

    @SerialName("PENDING")
    PENDING,

    @SerialName("WAITLIST")
    WAITLIST
}

/**
 * Status de pagamento.
 */
@Serializable
enum class PaymentStatus {
    @SerialName("PENDING")
    PENDING,

    @SerialName("PAID")
    PAID,

    @SerialName("PARTIAL")
    PARTIAL,

    @SerialName("REFUNDED")
    REFUNDED
}

/**
 * Jogo/Partida (versao compartilhada KMP).
 */
@Serializable
data class Game(
    val id: String = "",
    @SerialName("schedule_id") val scheduleId: String = "",
    val date: String = "",
    val time: String = "",
    @SerialName("end_time") val endTime: String = "",
    val status: String = GameStatus.SCHEDULED.name,
    @SerialName("max_players") val maxPlayers: Int = 14,
    @SerialName("max_goalkeepers") val maxGoalkeepers: Int = 3,
    @SerialName("players_count") val playersCount: Int = 0,
    @SerialName("goalkeepers_count") val goalkeepersCount: Int = 0,
    @SerialName("daily_price") val dailyPrice: Double = 0.0,
    @SerialName("total_cost") val totalCost: Double = 0.0,
    @SerialName("pix_key") val pixKey: String = "",
    @SerialName("number_of_teams") val numberOfTeams: Int = 2,
    @SerialName("owner_id") val ownerId: String = "",
    @SerialName("owner_name") val ownerName: String = "",

    // Local
    @SerialName("location_id") val locationId: String = "",
    @SerialName("field_id") val fieldId: String = "",
    @SerialName("location_name") val locationName: String = "",
    @SerialName("location_address") val locationAddress: String = "",
    @SerialName("location_lat") val locationLat: Double? = null,
    @SerialName("location_lng") val locationLng: Double? = null,
    @SerialName("field_name") val fieldName: String = "",

    // Configuracoes
    @SerialName("game_type") val gameType: String = "Society",
    val recurrence: String = "none",
    val visibility: String = GameVisibility.GROUP_ONLY.name,
    @SerialName("created_at") val createdAt: Long? = null,

    // Processamento
    @SerialName("xp_processed") val xpProcessed: Boolean = false,
    @SerialName("mvp_id") val mvpId: String? = null,

    // Placar
    @SerialName("team1_score") val team1Score: Int = 0,
    @SerialName("team2_score") val team2Score: Int = 0,
    @SerialName("team1_name") val team1Name: String = "Time 1",
    @SerialName("team2_name") val team2Name: String = "Time 2",

    // Grupo
    @SerialName("group_id") val groupId: String? = null,
    @SerialName("group_name") val groupName: String? = null,

    // Timestamps adicionais
    @SerialName("updated_at") val updatedAt: Long? = null,
    @SerialName("xp_processed_at") val xpProcessedAt: Long? = null,

    // Co-organizadores
    @SerialName("co_organizers") val coOrganizers: List<String> = emptyList(),

    // Flags de estado
    @SerialName("has_user_voted") val hasUserVoted: Boolean = false,
    @SerialName("is_soft_deleted") val isSoftDeleted: Boolean = false,
    @SerialName("is_public") val isPublic: Boolean = false
) {
    init {
        require(maxPlayers >= 0) { "maxPlayers nao pode ser negativo: $maxPlayers" }
        require(maxGoalkeepers >= 0) { "maxGoalkeepers nao pode ser negativo: $maxGoalkeepers" }
        require(playersCount >= 0) { "playersCount nao pode ser negativo: $playersCount" }
        require(goalkeepersCount >= 0) { "goalkeepersCount nao pode ser negativo: $goalkeepersCount" }
        require(dailyPrice >= 0.0) { "dailyPrice nao pode ser negativo: $dailyPrice" }
        require(totalCost >= 0.0) { "totalCost nao pode ser negativo: $totalCost" }
        require(numberOfTeams >= 1) { "numberOfTeams deve ser >= 1: $numberOfTeams" }
        require(team1Score >= 0) { "team1Score nao pode ser negativo: $team1Score" }
        require(team2Score >= 0) { "team2Score nao pode ser negativo: $team2Score" }
    }

    fun getStatusEnum(): GameStatus = try {
        GameStatus.valueOf(status)
    } catch (e: Exception) {
        GameStatus.SCHEDULED
    }

    fun getVisibilityEnum(): GameVisibility = try {
        GameVisibility.valueOf(visibility)
    } catch (e: Exception) {
        GameVisibility.GROUP_ONLY
    }

    /**
     * Retorna data e hora combinadas para comparacao/ordenacao.
     * Formato: "2024-03-15 14:30"
     */
    val dateTime: String
        get() = "$date $time"

    /**
     * Timestamp bruto da data/hora (Long) para ordenacao.
     * Retorna createdAt como fallback se disponivel.
     */
    val dateTimeRaw: Long
        get() = createdAt ?: 0L

    /**
     * Verifica se o jogo e publicamente visivel.
     * Retorna true se for PUBLIC_OPEN ou PUBLIC_CLOSED.
     */
    fun isPubliclyVisible(): Boolean {
        val vis = getVisibilityEnum()
        return vis == GameVisibility.PUBLIC_OPEN || vis == GameVisibility.PUBLIC_CLOSED
    }

    fun isLive(): Boolean = getStatusEnum() == GameStatus.LIVE
    fun isFinished(): Boolean = getStatusEnum() == GameStatus.FINISHED
    fun isScheduled(): Boolean = getStatusEnum() == GameStatus.SCHEDULED
    fun isCancelled(): Boolean = getStatusEnum() == GameStatus.CANCELLED
    fun isConfirmed(): Boolean = getStatusEnum() == GameStatus.CONFIRMED

    /**
     * Verifica se o jogo esta aberto para confirmacoes.
     * Retorna true se estiver agendado e nao lotado.
     */
    fun isOpenForConfirmations(): Boolean =
        isScheduled() && playersCount < maxPlayers

    /**
     * Retorna o total de gols marcados na partida.
     */
    fun totalGoals(): Int = team1Score + team2Score

    /**
     * Retorna o placar formatado para exibicao. Ex: "3 x 1"
     */
    fun formattedScore(): String = "$team1Score x $team2Score"

    override fun toString(): String =
        "Game(id='$id', status=$status, $team1Name $team1Score x $team2Score $team2Name, " +
            "players=$playersCount/$maxPlayers, group=$groupName)"

    companion object {
        /** Colecao Firestore */
        const val COLLECTION = "games"

        // Limites de jogadores
        const val MIN_PLAYERS = 4
        const val MAX_PLAYERS = 40
        const val DEFAULT_MAX_PLAYERS = 14

        // Limites de goleiros
        const val MIN_GOALKEEPERS = 0
        const val MAX_GOALKEEPERS = 6
        const val DEFAULT_MAX_GOALKEEPERS = 3

        // Limites de times
        const val MIN_TEAMS = 1
        const val MAX_TEAMS = 8
        const val DEFAULT_TEAMS = 2

        // Limites de placar (protecao contra dados invalidos)
        const val MAX_SCORE_PER_TEAM = 99

        // Limites de preco
        const val MAX_DAILY_PRICE = 500.0
    }
}

/**
 * Confirmacao de jogador em um jogo.
 */
@Serializable
data class GameConfirmation(
    val id: String = "",
    @SerialName("game_id") val gameId: String = "",
    @SerialName("user_id") val userId: String = "",
    @SerialName("user_name") val userName: String = "",
    @SerialName("user_photo") val userPhoto: String? = null,
    val position: String = "FIELD",
    @SerialName("team_id") val teamId: String? = null,
    val status: String = ConfirmationStatus.CONFIRMED.name,
    @SerialName("payment_status") val paymentStatus: String = PaymentStatus.PENDING.name,
    @SerialName("is_casual_player") val isCasualPlayer: Boolean = false,

    // Estatisticas do jogo
    val goals: Int = 0,
    val assists: Int = 0,
    val saves: Int = 0,
    @SerialName("yellow_cards") val yellowCards: Int = 0,
    @SerialName("red_cards") val redCards: Int = 0,

    val nickname: String? = null,
    @SerialName("xp_earned") val xpEarned: Int = 0,
    @SerialName("is_mvp") val isMvp: Boolean = false,
    @SerialName("is_best_gk") val isBestGk: Boolean = false,
    @SerialName("is_worst_player") val isWorstPlayer: Boolean = false,
    @SerialName("confirmed_at") val confirmedAt: Long? = null
) {
    init {
        require(goals >= 0) { "goals nao pode ser negativo: $goals" }
        require(assists >= 0) { "assists nao pode ser negativo: $assists" }
        require(saves >= 0) { "saves nao pode ser negativo: $saves" }
        require(yellowCards >= 0) { "yellowCards nao pode ser negativo: $yellowCards" }
        require(redCards >= 0) { "redCards nao pode ser negativo: $redCards" }
        require(xpEarned >= 0) { "xpEarned nao pode ser negativo: $xpEarned" }
    }

    fun getDisplayName(): String = nickname?.takeIf { it.isNotBlank() } ?: userName

    fun getStatusEnum(): ConfirmationStatus = try {
        ConfirmationStatus.valueOf(status)
    } catch (e: Exception) {
        ConfirmationStatus.CONFIRMED
    }

    fun getPaymentStatusEnum(): PaymentStatus = try {
        PaymentStatus.valueOf(paymentStatus)
    } catch (e: Exception) {
        PaymentStatus.PENDING
    }

    fun getPositionEnum(): PlayerPosition = PlayerPosition.fromString(position)
}

/**
 * Time em um jogo.
 */
@Serializable
data class Team(
    val id: String = "",
    @SerialName("game_id") val gameId: String = "",
    val name: String = "",
    val color: String = "",
    @SerialName("player_ids") val playerIds: List<String> = emptyList(),
    val score: Int = 0
)
