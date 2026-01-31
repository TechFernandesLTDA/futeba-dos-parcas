package com.futebadosparcas.domain.model

import kotlinx.datetime.Clock

/**
 * Status de presença do jogador em um jogo.
 * Suporta estados intermediários como "A Caminho" para comunicação em tempo real.
 *
 * @property code Código único do status
 * @property displayName Nome exibido para o usuário
 * @property emoji Emoji representativo
 * @property priority Prioridade para ordenação (menor = mais importante)
 * @property allowsEta Se permite informar tempo estimado de chegada
 */
enum class PlayerStatus(
    val code: String,
    val displayName: String,
    val emoji: String,
    val priority: Int,
    val allowsEta: Boolean = false
) {
    /**
     * Jogador confirmou presença e está pronto
     */
    CONFIRMED(
        code = "confirmed",
        displayName = "Confirmado",
        emoji = "✅",
        priority = 1
    ),

    /**
     * Jogador está a caminho do local
     */
    ON_THE_WAY(
        code = "on_the_way",
        displayName = "A Caminho",
        emoji = "🚗",
        priority = 2,
        allowsEta = true
    ),

    /**
     * Jogador está atrasado mas virá
     */
    RUNNING_LATE(
        code = "running_late",
        displayName = "Atrasado",
        emoji = "⏰",
        priority = 3,
        allowsEta = true
    ),

    /**
     * Jogador chegou no local
     */
    ARRIVED(
        code = "arrived",
        displayName = "Chegou",
        emoji = "📍",
        priority = 0
    ),

    /**
     * Jogador está em campo jogando
     */
    PLAYING(
        code = "playing",
        displayName = "Jogando",
        emoji = "⚽",
        priority = 0
    ),

    /**
     * Jogador ainda não confirmou (pendente)
     */
    PENDING(
        code = "pending",
        displayName = "Pendente",
        emoji = "⏳",
        priority = 5
    ),

    /**
     * Jogador está na lista de espera
     */
    WAITLIST(
        code = "waitlist",
        displayName = "Lista de Espera",
        emoji = "📋",
        priority = 4
    ),

    /**
     * Jogador cancelou/desistiu
     */
    CANCELLED(
        code = "cancelled",
        displayName = "Desistiu",
        emoji = "❌",
        priority = 6
    ),

    /**
     * Jogador não compareceu (faltou)
     */
    NO_SHOW(
        code = "no_show",
        displayName = "Faltou",
        emoji = "👻",
        priority = 7
    );

    /**
     * Verifica se o jogador está efetivamente confirmado para jogar
     */
    fun isConfirmedToPlay(): Boolean = this in listOf(CONFIRMED, ON_THE_WAY, RUNNING_LATE, ARRIVED, PLAYING)

    /**
     * Verifica se o jogador está presente no local
     */
    fun isPresent(): Boolean = this in listOf(ARRIVED, PLAYING)

    /**
     * Verifica se o status permite transição para outro status
     */
    fun canTransitionTo(newStatus: PlayerStatus): Boolean {
        return when (this) {
            PENDING -> newStatus in listOf(CONFIRMED, WAITLIST, CANCELLED)
            CONFIRMED -> newStatus in listOf(ON_THE_WAY, RUNNING_LATE, ARRIVED, CANCELLED)
            ON_THE_WAY -> newStatus in listOf(RUNNING_LATE, ARRIVED, CANCELLED)
            RUNNING_LATE -> newStatus in listOf(ARRIVED, CANCELLED, NO_SHOW)
            ARRIVED -> newStatus in listOf(PLAYING, CANCELLED)
            PLAYING -> false // Estado final durante o jogo
            WAITLIST -> newStatus in listOf(CONFIRMED, CANCELLED)
            CANCELLED -> newStatus == CONFIRMED // Pode voltar a confirmar
            NO_SHOW -> false // Estado final
        }
    }

    companion object {
        /**
         * Obtém status pelo código
         */
        fun fromCode(code: String?): PlayerStatus {
            return entries.find { it.code == code } ?: PENDING
        }

        /**
         * Lista de status que indicam participação ativa
         */
        val activeStatuses = listOf(CONFIRMED, ON_THE_WAY, RUNNING_LATE, ARRIVED, PLAYING)

        /**
         * Lista de status que indicam ausência
         */
        val absentStatuses = listOf(CANCELLED, NO_SHOW)
    }
}

/**
 * Dados de localização do jogador a caminho.
 *
 * @property status Status atual do jogador
 * @property etaMinutes Tempo estimado de chegada em minutos (null se não disponível)
 * @property lastUpdated Timestamp da última atualização
 * @property distanceMeters Distância em metros até o local (opcional)
 * @property message Mensagem opcional do jogador
 */
data class PlayerLocationStatus(
    val status: PlayerStatus,
    val etaMinutes: Int? = null,
    val lastUpdated: Long = Clock.System.now().toEpochMilliseconds(),
    val distanceMeters: Int? = null,
    val message: String? = null
) {
    /**
     * Formata o ETA para exibição
     */
    fun formatEta(): String? {
        return etaMinutes?.let { minutes ->
            when {
                minutes < 1 -> "Chegando"
                minutes == 1 -> "1 minuto"
                minutes < 60 -> "$minutes minutos"
                else -> {
                    val hours = minutes / 60
                    val remainingMinutes = minutes % 60
                    if (remainingMinutes == 0) {
                        "$hours hora${if (hours > 1) "s" else ""}"
                    } else {
                        "${hours}h${remainingMinutes}min"
                    }
                }
            }
        }
    }

    /**
     * Formata a distância para exibição
     */
    fun formatDistance(): String? {
        return distanceMeters?.let { meters ->
            when {
                meters < 1000 -> "${meters}m"
                else -> String.format("%.1fkm", meters / 1000.0)
            }
        }
    }

    /**
     * Verifica se a localização está desatualizada (mais de 5 minutos)
     */
    fun isStale(): Boolean {
        val now = Clock.System.now().toEpochMilliseconds()
        val fiveMinutesMs = 5 * 60 * 1000L
        return (now - lastUpdated) > fiveMinutesMs
    }
}

/**
 * Ação rápida de status que o jogador pode executar.
 */
data class StatusQuickAction(
    val targetStatus: PlayerStatus,
    val label: String,
    val requiresEta: Boolean = false,
    val requiresConfirmation: Boolean = false
) {
    companion object {
        /**
         * Ações disponíveis para jogador confirmado
         */
        val confirmedActions = listOf(
            StatusQuickAction(PlayerStatus.ON_THE_WAY, "Estou indo", requiresEta = true),
            StatusQuickAction(PlayerStatus.RUNNING_LATE, "Vou atrasar", requiresEta = true),
            StatusQuickAction(PlayerStatus.CANCELLED, "Não vou mais", requiresConfirmation = true)
        )

        /**
         * Ações disponíveis para jogador a caminho
         */
        val onTheWayActions = listOf(
            StatusQuickAction(PlayerStatus.RUNNING_LATE, "Vou atrasar", requiresEta = true),
            StatusQuickAction(PlayerStatus.ARRIVED, "Cheguei!"),
            StatusQuickAction(PlayerStatus.CANCELLED, "Não vou mais", requiresConfirmation = true)
        )

        /**
         * Ações disponíveis para jogador atrasado
         */
        val runningLateActions = listOf(
            StatusQuickAction(PlayerStatus.ARRIVED, "Cheguei!"),
            StatusQuickAction(PlayerStatus.CANCELLED, "Não vou mais", requiresConfirmation = true)
        )
    }
}
