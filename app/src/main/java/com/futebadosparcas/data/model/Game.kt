package com.futebadosparcas.data.model

import com.futebadosparcas.domain.validation.ValidationHelper
import com.futebadosparcas.domain.validation.ValidationResult
import com.futebadosparcas.util.Identifiable
import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.Exclude
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

@IgnoreExtraProperties
data class Game(
    override var id: String = "",
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

    // Campo de auditoria: última atualização (#1 - Validação Firebase)
    @ServerTimestamp
    @get:PropertyName("updated_at")
    @set:PropertyName("updated_at")
    var updatedAt: Date? = null,

    // Campos de cancelamento (#2, #3 - Validação Firebase)
    @get:PropertyName("cancelled_by")
    @set:PropertyName("cancelled_by")
    var cancelledBy: String? = null,

    @get:PropertyName("cancel_reason")
    @set:PropertyName("cancel_reason")
    var cancelReason: String? = null,

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

    // === MVP VOTING FEATURES (Issues #51-60) ===

    // Voting deadline - quando a votação fecha automaticamente (Issue #54)
    @get:PropertyName("voting_deadline")
    @set:PropertyName("voting_deadline")
    var votingDeadline: Date? = null,

    // ID do melhor goleiro eleito
    @get:PropertyName("best_gk_id")
    @set:PropertyName("best_gk_id")
    var bestGkId: String? = null,

    // ID do pior jogador eleito (bola murcha)
    @get:PropertyName("worst_player_id")
    @set:PropertyName("worst_player_id")
    var worstPlayerId: String? = null,

    // Flag se votação foi encerrada
    @get:PropertyName("voting_concluded")
    @set:PropertyName("voting_concluded")
    var votingConcluded: Boolean = false,

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
    var groupName: String? = null,

    // === GAME OWNER FEATURES (Issues #61-70) ===

    // Co-organizers que podem editar jogo e marcar pagamentos (Issue #63)
    @get:PropertyName("co_organizers")
    @set:PropertyName("co_organizers")
    var coOrganizers: List<String> = emptyList(),

    // Horas antes do jogo para fechar confirmações automaticamente (Issue #65)
    // Valores: null (desabilitado), 1, 2, 4, 12, 24
    @get:PropertyName("auto_close_hours")
    @set:PropertyName("auto_close_hours")
    var autoCloseHours: Int? = null,

    // Flag indicando se confirmações foram fechadas automaticamente
    @get:PropertyName("auto_closed")
    @set:PropertyName("auto_closed")
    var autoClosed: Boolean = false,

    // Regras do jogo/grupo visíveis para todos (Issue #68)
    @get:PropertyName("rules")
    @set:PropertyName("rules")
    var rules: String = "",

    // Relatório pós-jogo gerado (Issue #66)
    @get:PropertyName("post_game_report_generated")
    @set:PropertyName("post_game_report_generated")
    var postGameReportGenerated: Boolean = false,

    // === PRESENCE & CONFIRMATION FEATURES (Issues #31-40) ===

    // Prazo limite para confirmar presenca (em horas antes do jogo) - Issue #31
    // Opcoes: 0 (sem limite), 1, 2, 4, 12, 24 horas
    @get:PropertyName("confirmation_deadline_hours")
    @set:PropertyName("confirmation_deadline_hours")
    var confirmationDeadlineHours: Int = 0,

    // Tipo da chave Pix - Issue #34
    @get:PropertyName("pix_key_type")
    @set:PropertyName("pix_key_type")
    var pixKeyType: String = PixKeyType.RANDOM.name,

    // Nome do beneficiario do Pix - Issue #34
    @get:PropertyName("pix_beneficiary_name")
    @set:PropertyName("pix_beneficiary_name")
    var pixBeneficiaryName: String = "",

    // Permitir pagamento via Pix no app - Issue #34
    @get:PropertyName("pix_payment_enabled")
    @set:PropertyName("pix_payment_enabled")
    var pixPaymentEnabled: Boolean = false,

    // Tempo de auto-promocao da lista de espera em minutos - Issue #33
    // Se o jogador notificado nao responder em X minutos, promove o proximo
    @get:PropertyName("waitlist_auto_promote_minutes")
    @set:PropertyName("waitlist_auto_promote_minutes")
    var waitlistAutoPromoteMinutes: Int = 30,

    // Exigir check-in por GPS ao chegar no local - Issue #36
    @get:PropertyName("require_checkin")
    @set:PropertyName("require_checkin")
    var requireCheckin: Boolean = false,

    // Raio maximo (em metros) para fazer check-in - Issue #36
    @get:PropertyName("checkin_radius_meters")
    @set:PropertyName("checkin_radius_meters")
    var checkinRadiusMeters: Int = 100,

    // === SOFT DELETE (P2 #40) ===

    // Timestamp de quando o jogo foi soft-deletado (null = ativo)
    @get:PropertyName("deleted_at")
    @set:PropertyName("deleted_at")
    var deletedAt: Date? = null,

    // ID do usuario que realizou o soft delete
    @get:PropertyName("deleted_by")
    @set:PropertyName("deleted_by")
    var deletedBy: String? = null
) : Identifiable {
    // Bloco de inicializacao para normalizar valores e garantir integridade
    init {
        // Normaliza scores para valores nao-negativos
        team1Score = team1Score.coerceAtLeast(0)
        team2Score = team2Score.coerceAtLeast(0)

        // Normaliza contadores para valores nao-negativos
        playersCount = playersCount.coerceAtLeast(0)
        goalkeepersCount = goalkeepersCount.coerceAtLeast(0)

        // Garante max_players entre 2 e 50 (#28 - Validação de bounds)
        maxPlayers = maxPlayers.coerceIn(2, 50)
        maxGoalkeepers = maxGoalkeepers.coerceIn(0, 10)

        // Garante numero de times >= 2
        numberOfTeams = numberOfTeams.coerceAtLeast(2)

        // Normaliza precos para valores nao-negativos
        dailyPrice = dailyPrice.coerceAtLeast(0.0)
        totalCost = totalCost.coerceAtLeast(0.0)
    }

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

    // ==================== VOTAÇÃO MVP (Issues #51-60) ====================

    /**
     * Verifica se a votação ainda está aberta (dentro do prazo).
     */
    @Exclude
    fun isVotingOpen(): Boolean {
        if (votingConcluded) return false
        if (status != GameStatus.FINISHED.name) return false

        val deadline = votingDeadline ?: return true // Sem prazo definido = sempre aberto
        return Date().before(deadline)
    }

    /**
     * Calcula o tempo restante para votação em milissegundos.
     * Retorna 0 se a votação já encerrou.
     */
    @Exclude
    fun getVotingTimeRemainingMs(): Long {
        if (votingConcluded) return 0
        val deadline = votingDeadline ?: return Long.MAX_VALUE

        val remaining = deadline.time - System.currentTimeMillis()
        return if (remaining > 0) remaining else 0
    }

    /**
     * Define o prazo de votação baseado no tempo de finalização.
     * @param hoursFromNow Horas a partir de agora para encerrar votação
     */
    @Exclude
    fun setVotingDeadlineFromNow(hoursFromNow: Int) {
        votingDeadline = Date(System.currentTimeMillis() + (hoursFromNow * 60 * 60 * 1000L))
    }

    // ==================== VALIDAÇÃO ====================

    /**
     * Valida todos os campos do jogo antes de salvar.
     *
     * @return Lista de erros de validação (vazia se tudo válido)
     */
    @Exclude
    fun validate(): List<ValidationResult.Invalid> {
        val errors = mutableListOf<ValidationResult.Invalid>()

        // Validação de max_players (2-50) - #28 Validação de bounds
        if (maxPlayers < 2 || maxPlayers > 50) {
            errors.add(ValidationResult.Invalid("max_players", "Número máximo de jogadores deve ser entre 2 e 50"))
        }

        // Validação de max_goalkeepers (0-10)
        if (maxGoalkeepers < 0 || maxGoalkeepers > 10) {
            errors.add(ValidationResult.Invalid("max_goalkeepers", "Número máximo de goleiros deve ser entre 0 e 10"))
        }

        // Validação de scores (>= 0)
        if (team1Score < 0) {
            errors.add(ValidationResult.Invalid("team1_score", "Placar não pode ser negativo"))
        }
        if (team2Score < 0) {
            errors.add(ValidationResult.Invalid("team2_score", "Placar não pode ser negativo"))
        }

        // Validação de contadores (>= 0)
        if (playersCount < 0) {
            errors.add(ValidationResult.Invalid("players_count", "Contagem de jogadores não pode ser negativa"))
        }
        if (goalkeepersCount < 0) {
            errors.add(ValidationResult.Invalid("goalkeepers_count", "Contagem de goleiros não pode ser negativa"))
        }

        // Validação de preços (>= 0)
        if (dailyPrice < 0) {
            errors.add(ValidationResult.Invalid("daily_price", "Preço não pode ser negativo"))
        }
        if (totalCost < 0) {
            errors.add(ValidationResult.Invalid("total_cost", "Custo total não pode ser negativo"))
        }

        // Validação de número de times (>= 2)
        if (numberOfTeams < 2) {
            errors.add(ValidationResult.Invalid("number_of_teams", "Número de times deve ser pelo menos 2"))
        }

        // Validação de owner_id obrigatório
        if (ownerId.isBlank()) {
            errors.add(ValidationResult.Invalid("owner_id", "Jogo deve ter um dono"))
        }

        // Validação de coordenadas (#29 - Validação de coordenadas)
        locationLat?.let { lat ->
            if (lat < -90.0 || lat > 90.0) {
                errors.add(ValidationResult.Invalid("location_lat", "Latitude deve estar entre -90 e 90"))
            }
        }
        locationLng?.let { lng ->
            if (lng < -180.0 || lng > 180.0) {
                errors.add(ValidationResult.Invalid("location_lng", "Longitude deve estar entre -180 e 180"))
            }
        }

        // Validação de raio de check-in (#36)
        if (checkinRadiusMeters < 10 || checkinRadiusMeters > 1000) {
            errors.add(ValidationResult.Invalid("checkin_radius_meters", "Raio de check-in deve ser entre 10 e 1000 metros"))
        }

        // Validação de formato de data (dd/MM/yyyy)
        if (date.isNotBlank() && !date.matches(Regex("^\\d{2}/\\d{2}/\\d{4}$"))) {
            errors.add(ValidationResult.Invalid("date", "Data deve estar no formato dd/MM/yyyy"))
        }

        // Validação de formato de hora (HH:mm)
        if (time.isNotBlank() && !time.matches(Regex("^\\d{2}:\\d{2}$"))) {
            errors.add(ValidationResult.Invalid("time", "Hora deve estar no formato HH:mm"))
        }

        // Validação de nomes de time (não vazio)
        val teamNameResult1 = ValidationHelper.validateLength(team1Name, "team1_name", 1, ValidationHelper.NAME_MAX_LENGTH)
        if (teamNameResult1 is ValidationResult.Invalid) errors.add(teamNameResult1)
        val teamNameResult2 = ValidationHelper.validateLength(team2Name, "team2_name", 1, ValidationHelper.NAME_MAX_LENGTH)
        if (teamNameResult2 is ValidationResult.Invalid) errors.add(teamNameResult2)

        // Validação de regras do jogo (tamanho máximo)
        val rulesResult = ValidationHelper.validateLength(rules, "rules", 0, ValidationHelper.RULES_MAX_LENGTH)
        if (rulesResult is ValidationResult.Invalid) errors.add(rulesResult)

        // Validação de co-organizadores (limite máximo)
        if (coOrganizers.size > ValidationHelper.MAX_CO_ORGANIZERS) {
            errors.add(ValidationResult.Invalid("co_organizers", "Máximo de ${ValidationHelper.MAX_CO_ORGANIZERS} co-organizadores"))
        }

        return errors
    }

    /**
     * Verifica se o jogo é válido para salvar.
     */
    @Exclude
    fun isValid(): Boolean = validate().isEmpty()

    /**
     * Verifica se o usuário é co-organizador do jogo (Issue #63).
     */
    @Exclude
    fun isCoOrganizer(userId: String): Boolean = coOrganizers.contains(userId)

    /**
     * Verifica se o usuário pode gerenciar o jogo (dono ou co-organizador).
     */
    @Exclude
    fun canManage(userId: String): Boolean = ownerId == userId || isCoOrganizer(userId)

    /**
     * Calcula o deadline para confirmacao (Issue #31).
     * @return Date do deadline ou null se nao houver limite
     */
    @Exclude
    fun getConfirmationDeadline(): Date? {
        if (confirmationDeadlineHours <= 0) return null
        val gameDateTime = dateTime ?: return null

        val calendar = java.util.Calendar.getInstance()
        calendar.time = gameDateTime
        calendar.add(java.util.Calendar.HOUR, -confirmationDeadlineHours)
        return calendar.time
    }

    /**
     * Verifica se o prazo para confirmacao ja passou (Issue #31).
     */
    @Exclude
    fun isConfirmationDeadlinePassed(): Boolean {
        val deadline = getConfirmationDeadline() ?: return false
        return Date().after(deadline)
    }

    /**
     * Retorna o tempo restante para o deadline em milissegundos.
     * Retorna 0 se ja passou ou null se nao houver deadline.
     */
    @Exclude
    fun getTimeToDeadlineMs(): Long? {
        val deadline = getConfirmationDeadline() ?: return null
        val remaining = deadline.time - System.currentTimeMillis()
        return if (remaining > 0) remaining else 0
    }

    /**
     * Verifica se o jogo esta lotado.
     */
    @Exclude
    fun isFull(): Boolean = playersCount >= maxPlayers

    /**
     * Verifica se o jogo foi soft-deletado (P2 #40).
     */
    @Exclude
    fun isSoftDeleted(): Boolean = deletedAt != null

    /**
     * Realiza soft delete do jogo (P2 #40).
     *
     * @param userId ID do usuario que esta deletando
     */
    @Exclude
    fun softDelete(userId: String) {
        deletedAt = Date()
        deletedBy = userId
        updatedAt = Date()
    }

    /**
     * Restaura um jogo soft-deletado (P2 #40).
     */
    @Exclude
    fun restore() {
        deletedAt = null
        deletedBy = null
        updatedAt = Date()
    }

    /**
     * Cancela o jogo com motivo e autor (#2, #3 - Campos de cancelamento).
     * Valida a máquina de estados do status (#39).
     *
     * @param userId ID do usuário que está cancelando
     * @param reason Motivo do cancelamento
     * @return true se o cancelamento foi válido, false se transição inválida
     */
    @Exclude
    fun cancel(userId: String, reason: String): Boolean {
        val currentStatus = getStatusEnum()

        // Apenas jogos SCHEDULED ou CONFIRMED podem ser cancelados (#39 - State machine)
        if (currentStatus != GameStatus.SCHEDULED && currentStatus != GameStatus.CONFIRMED) {
            return false
        }

        status = GameStatus.CANCELLED.name
        cancelledBy = userId
        cancelReason = reason
        updatedAt = Date()
        return true
    }

    /**
     * Valida se a transição de status é permitida (#39 - State machine).
     *
     * Transições válidas:
     * SCHEDULED -> CONFIRMED, CANCELLED
     * CONFIRMED -> LIVE, CANCELLED
     * LIVE -> FINISHED
     * FINISHED -> (nenhuma)
     * CANCELLED -> (nenhuma)
     */
    @Exclude
    fun canTransitionTo(newStatus: GameStatus): Boolean {
        val currentStatus = getStatusEnum()
        return when (currentStatus) {
            GameStatus.SCHEDULED -> newStatus in listOf(GameStatus.CONFIRMED, GameStatus.CANCELLED)
            GameStatus.CONFIRMED -> newStatus in listOf(GameStatus.LIVE, GameStatus.CANCELLED)
            GameStatus.LIVE -> newStatus == GameStatus.FINISHED
            GameStatus.FINISHED -> false
            GameStatus.CANCELLED -> false
        }
    }

    /**
     * Atualiza o status validando a máquina de estados.
     *
     * @return true se a transição foi válida, false caso contrário
     */
    @Exclude
    fun transitionTo(newStatus: GameStatus): Boolean {
        if (!canTransitionTo(newStatus)) {
            return false
        }
        status = newStatus.name
        updatedAt = Date()
        return true
    }

    /**
     * Gera o payload Pix para pagamento (Issue #34).
     */
    @Exclude
    fun generatePixPayload(): String? {
        if (!pixPaymentEnabled || pixKey.isBlank()) return null
        // Formato simplificado - implementacao completa usaria BR Code EMV
        return "Pix: $pixKey | R$ $dailyPrice | ${locationName.take(30)}"
    }
}

/**
 * Tipos de chave Pix (Issue #34).
 */
enum class PixKeyType(val displayName: String) {
    CPF("CPF"),
    CNPJ("CNPJ"),
    EMAIL("E-mail"),
    PHONE("Telefone"),
    RANDOM("Aleatoria")
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
    var isWorstPlayer: Boolean = false,

    // === GAME OWNER FEATURES (Issues #61, #69) ===

    // Valor pago parcialmente pelo jogador (Issue #69)
    @get:PropertyName("partial_payment")
    @set:PropertyName("partial_payment")
    var partialPayment: Double = 0.0,

    // Indica se o jogador esteve presente no jogo (para relatório pós-jogo)
    @get:PropertyName("was_present")
    @set:PropertyName("was_present")
    var wasPresent: Boolean = false,

    // === PRESENCE & CONFIRMATION FEATURES (Issues #35, #36, #38, #40) ===

    // Status "A caminho" - Issue #35
    @get:PropertyName("is_on_the_way")
    @set:PropertyName("is_on_the_way")
    var isOnTheWay: Boolean = false,

    // Horario estimado de chegada (ETA) - Issue #35
    @get:PropertyName("eta_minutes")
    @set:PropertyName("eta_minutes")
    var etaMinutes: Int? = null,

    // Timestamp de quando marcou "a caminho" - Issue #35
    @get:PropertyName("on_the_way_at")
    @set:PropertyName("on_the_way_at")
    var onTheWayAt: Date? = null,

    // Status de check-in por GPS - Issue #36
    @get:PropertyName("checked_in")
    @set:PropertyName("checked_in")
    var checkedIn: Boolean = false,

    // Timestamp do check-in - Issue #36
    @get:PropertyName("checked_in_at")
    @set:PropertyName("checked_in_at")
    var checkedInAt: Date? = null,

    // Indica se eh um convidado externo (via link) - Issue #38
    @get:PropertyName("is_guest")
    @set:PropertyName("is_guest")
    var isGuest: Boolean = false,

    // ID do link de convite usado - Issue #38
    @get:PropertyName("invite_link_id")
    @set:PropertyName("invite_link_id")
    var inviteLinkId: String? = null,

    // Ordem de confirmacao (1, 2, 3...) - Issue #40
    @get:PropertyName("confirmation_order")
    @set:PropertyName("confirmation_order")
    var confirmationOrder: Int = 0,

    // Taxa de presenca do jogador (cache) - Issue #37
    @get:PropertyName("player_attendance_rate")
    @set:PropertyName("player_attendance_rate")
    var playerAttendanceRate: Double? = null
) {
    // Sanitização defensiva: corrigir valores negativos de dados corrompidos do Firestore
    // em vez de crashar com require() que derruba o app inteiro
    init {
        goals = goals.coerceAtLeast(0)
        assists = assists.coerceAtLeast(0)
        saves = saves.coerceAtLeast(0)
        yellowCards = yellowCards.coerceAtLeast(0)
        redCards = redCards.coerceAtLeast(0)
    }

    constructor() : this(id = "")

    @Exclude
    fun getDisplayName(): String {
        return nickname?.takeIf { it.isNotBlank() } ?: userName
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

    /**
     * Retorna se o pagamento foi parcial (Issue #69).
     */
    @Exclude
    fun hasPartialPayment(): Boolean = partialPayment > 0 && paymentStatus != PaymentStatus.PAID.name

    /**
     * Calcula valor restante a pagar.
     */
    @Exclude
    fun getRemainingPayment(totalPrice: Double): Double {
        return if (paymentStatus == PaymentStatus.PAID.name) 0.0
        else (totalPrice - partialPayment).coerceAtLeast(0.0)
    }

    /**
     * Verifica se o jogador esta a caminho - Issue #35.
     */
    @Exclude
    fun isComingToGame(): Boolean = isOnTheWay && !checkedIn

    /**
     * Verifica se o jogador ja fez check-in - Issue #36.
     */
    @Exclude
    fun hasCheckedIn(): Boolean = checkedIn

    /**
     * Retorna o tempo formatado do ETA - Issue #35.
     */
    @Exclude
    fun getEtaDisplay(): String? {
        val eta = etaMinutes ?: return null
        return when {
            eta < 1 -> "Chegando"
            eta == 1 -> "1 minuto"
            eta < 60 -> "$eta minutos"
            else -> {
                val hours = eta / 60
                val mins = eta % 60
                if (mins > 0) "${hours}h${mins}min" else "${hours}h"
            }
        }
    }

    /**
     * Verifica se o jogador tem baixa confiabilidade - Issue #37.
     */
    @Exclude
    fun hasLowReliability(): Boolean {
        return playerAttendanceRate?.let { it < 0.50 } ?: false
    }
}

enum class ConfirmationStatus {
    CONFIRMED,      // Confirmado
    CANCELLED,      // Cancelado
    PENDING,        // Aguardando resposta (convite)
    WAITLIST,       // Na lista de espera
    ON_THE_WAY,     // A caminho (Issue #35)
    CHECKED_IN      // Check-in realizado (Issue #36)
}

@IgnoreExtraProperties
data class Team(
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
