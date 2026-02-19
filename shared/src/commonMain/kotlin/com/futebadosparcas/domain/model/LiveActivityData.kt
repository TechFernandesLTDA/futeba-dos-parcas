package com.futebadosparcas.domain.model

import kotlinx.datetime.Clock
import kotlinx.serialization.Serializable

/**
 * Dados para Live Activity (iOS) e Widgets dinâmicos
 * Preparado para suporte futuro via KMP
 *
 * Live Activities no iOS permitem mostrar informações em tempo real
 * na tela de bloqueio e Dynamic Island. Este modelo é compatível
 * com ambas as plataformas.
 */
@Serializable
data class LiveActivityData(
    /**
     * Identificador único da activity
     */
    val activityId: String,

    /**
     * Tipo da activity
     */
    val type: LiveActivityType,

    /**
     * Dados do jogo ao vivo
     */
    val gameData: LiveGameActivityData? = null,

    /**
     * Dados de check-in
     */
    val checkInData: CheckInActivityData? = null,

    /**
     * Timestamp de criação
     */
    val createdAt: Long = Clock.System.now().toEpochMilliseconds(),

    /**
     * Timestamp de expiração (para limpeza automática)
     */
    val expiresAt: Long? = null,

    /**
     * Prioridade da notificação (para ordenação)
     */
    val priority: ActivityPriority = ActivityPriority.NORMAL
)

/**
 * Tipos de Live Activity suportados
 */
@Serializable
enum class LiveActivityType {
    /**
     * Jogo ao vivo com placar em tempo real
     */
    LIVE_GAME,

    /**
     * Check-in em andamento
     */
    CHECK_IN,

    /**
     * Votação MVP ativa
     */
    MVP_VOTING,

    /**
     * Countdown para próximo jogo
     */
    GAME_COUNTDOWN,

    /**
     * Formação de times
     */
    TEAM_FORMATION
}

/**
 * Prioridade da activity (afeta posição e persistência)
 */
@Serializable
enum class ActivityPriority {
    LOW,
    NORMAL,
    HIGH,
    CRITICAL
}

/**
 * Dados específicos para jogo ao vivo
 */
@Serializable
data class LiveGameActivityData(
    /**
     * ID do jogo no Firestore
     */
    val gameId: String,

    /**
     * Nome do local
     */
    val locationName: String,

    /**
     * Nome da quadra
     */
    val fieldName: String,

    /**
     * Dados do Time 1
     */
    val team1: TeamActivityData,

    /**
     * Dados do Time 2
     */
    val team2: TeamActivityData,

    /**
     * Tempo de jogo formatado (ex: "45:32")
     */
    val gameTime: String,

    /**
     * Período atual (1, 2, etc.)
     */
    val period: Int = 1,

    /**
     * Total de períodos configurados
     */
    val totalPeriods: Int = 2,

    /**
     * Status do jogo
     */
    val status: LiveGameStatus = LiveGameStatus.IN_PROGRESS,

    /**
     * Último evento (gol, cartão, etc.)
     */
    val lastEvent: GameEventBrief? = null,

    /**
     * Timestamp da última atualização
     */
    val updatedAt: Long = Clock.System.now().toEpochMilliseconds()
)

/**
 * Dados resumidos de um time para a activity
 */
@Serializable
data class TeamActivityData(
    /**
     * Nome do time
     */
    val name: String,

    /**
     * Abreviação (3 letras)
     */
    val abbreviation: String,

    /**
     * Cor do time em hex (ex: "#FF5722")
     */
    val color: String,

    /**
     * Placar atual
     */
    val score: Int,

    /**
     * URL do logo/avatar (opcional)
     */
    val logoUrl: String? = null
)

/**
 * Status do jogo ao vivo
 */
@Serializable
enum class LiveGameStatus {
    NOT_STARTED,
    IN_PROGRESS,
    HALFTIME,
    PAUSED,
    FINISHED,
    CANCELLED
}

/**
 * Resumo breve de um evento do jogo
 */
@Serializable
data class GameEventBrief(
    /**
     * Tipo do evento
     */
    val type: GameEventType,

    /**
     * Nome do jogador envolvido
     */
    val playerName: String,

    /**
     * Nome do time
     */
    val teamName: String,

    /**
     * Minuto do evento
     */
    val minute: Int,

    /**
     * Timestamp do evento
     */
    val timestamp: Long
)

// GameEventType está definido em LiveGame.kt

/**
 * Dados para activity de check-in
 */
@Serializable
data class CheckInActivityData(
    /**
     * ID do jogo
     */
    val gameId: String,

    /**
     * Nome do local
     */
    val locationName: String,

    /**
     * Horário do jogo
     */
    val gameTime: String,

    /**
     * Distância até o local em metros
     */
    val distanceMeters: Int?,

    /**
     * ETA em minutos
     */
    val etaMinutes: Int?,

    /**
     * Status do check-in
     */
    val status: CheckInStatus,

    /**
     * Progresso percentual para o local (0-100)
     */
    val progressPercent: Int = 0
)

/**
 * Status do check-in
 */
@Serializable
enum class CheckInStatus {
    /**
     * Ainda não saiu de casa
     */
    NOT_STARTED,

    /**
     * A caminho do local
     */
    ON_THE_WAY,

    /**
     * Próximo ao local (dentro do raio)
     */
    NEARBY,

    /**
     * Check-in realizado com sucesso
     */
    CHECKED_IN,

    /**
     * Check-in expirado (jogo já começou)
     */
    EXPIRED
}

/**
 * Dados para widget de countdown
 */
@Serializable
data class GameCountdownData(
    /**
     * ID do jogo
     */
    val gameId: String,

    /**
     * Nome do local
     */
    val locationName: String,

    /**
     * Timestamp do início do jogo
     */
    val gameStartTimestamp: Long,

    /**
     * Total de jogadores confirmados
     */
    val confirmedPlayers: Int,

    /**
     * Máximo de jogadores
     */
    val maxPlayers: Int,

    /**
     * Se o usuário atual está confirmado
     */
    val isUserConfirmed: Boolean
)

/**
 * Extensões para cálculos comuns
 */

/**
 * Calcula tempo restante até o jogo em formato legível
 */
fun GameCountdownData.getTimeRemaining(): String {
    val now = Clock.System.now().toEpochMilliseconds()
    val diff = gameStartTimestamp - now

    if (diff <= 0) return "Agora"

    val hours = diff / (1000 * 60 * 60)
    val minutes = (diff % (1000 * 60 * 60)) / (1000 * 60)

    return when {
        hours >= 24 -> "${hours / 24}d ${hours % 24}h"
        hours >= 1 -> "${hours}h ${minutes}min"
        else -> "${minutes}min"
    }
}

/**
 * Verifica se a activity expirou
 */
fun LiveActivityData.isExpired(): Boolean {
    val expiry = expiresAt ?: return false
    return Clock.System.now().toEpochMilliseconds() > expiry
}

/**
 * Obtém placar formatado
 */
fun LiveGameActivityData.getFormattedScore(): String {
    return "${team1.score} × ${team2.score}"
}

/**
 * Verifica se está no intervalo
 */
fun LiveGameActivityData.isHalftime(): Boolean {
    return status == LiveGameStatus.HALFTIME
}
