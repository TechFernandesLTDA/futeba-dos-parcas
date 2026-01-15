package com.futebadosparcas.domain.model

import kotlinx.datetime.Clock

/**
 * Representa uma notificação in-app para o usuário.
 * Coleção: notifications
 *
 * @property id ID único da notificação
 * @property userId ID do usuário destinatário
 * @property type Tipo da notificação (veja NotificationType)
 * @property title Título da notificação
 * @property message Corpo da mensagem
 * @property senderId ID do usuário remetente (opcional)
 * @property senderName Nome do remetente (opcional)
 * @property senderPhoto URL da foto do remetente (opcional)
 * @property referenceId ID do documento relacionado (gameId, groupId, etc)
 * @property referenceType Tipo do documento referenciado ("game", "group", "invite")
 * @property actionType Tipo de ação que a notificação requer (veja NotificationAction)
 * @property read Indica se a notificação foi lida
 * @property readAt Timestamp de leitura (null se não lida)
 * @property createdAt Timestamp de criação da notificação
 * @property expiresAt Timestamp de expiração (para convites, convocações)
 */
data class AppNotification(
    val id: String = "",
    val userId: String = "",
    val type: NotificationType = NotificationType.GENERAL,
    val title: String = "",
    val message: String = "",
    val senderId: String? = null,
    val senderName: String? = null,
    val senderPhoto: String? = null,
    val referenceId: String? = null,
    val referenceType: String? = null,
    val actionType: NotificationAction = NotificationAction.VIEW_DETAILS,
    val read: Boolean = false,
    val readAt: Long? = null,
    val createdAt: Long? = null,
    val expiresAt: Long? = null
) {
    /**
     * Verifica se a notificação requer resposta do usuário.
     */
    fun requiresResponse(): Boolean {
        return actionType == NotificationAction.ACCEPT_DECLINE ||
            actionType == NotificationAction.CONFIRM_POSITION
    }

    /**
     * Verifica se a notificação possui uma ação associada.
     */
    fun hasAction(): Boolean {
        return actionType != NotificationAction.NONE
    }

    /**
     * Verifica se a notificação está expirada.
     */
    fun isExpired(): Boolean {
        return expiresAt != null && expiresAt!! < Clock.System.now().toEpochMilliseconds()
    }

    companion object {
        /**
         * Cria notificação de convite de grupo.
         */
        fun createGroupInvite(
            userId: String,
            inviteId: String,
            groupName: String,
            invitedByName: String,
            invitedById: String
        ): AppNotification {
            return AppNotification(
                userId = userId,
                type = NotificationType.GROUP_INVITE,
                title = "Convite para grupo",
                message = "$invitedByName convidou você para o grupo $groupName",
                senderId = invitedById,
                senderName = invitedByName,
                referenceId = inviteId,
                referenceType = "invite",
                actionType = NotificationAction.ACCEPT_DECLINE,
                createdAt = Clock.System.now().toEpochMilliseconds(),
                expiresAt = Clock.System.now().toEpochMilliseconds() + (7 * 24 * 60 * 60 * 1000L) // 7 dias
            )
        }

        /**
         * Cria notificação de convocação de jogo.
         */
        fun createGameSummon(
            userId: String,
            gameId: String,
            gameName: String,
            gameDate: String,
            groupName: String,
            summonedById: String,
            summonedByName: String
        ): AppNotification {
            return AppNotification(
                userId = userId,
                type = NotificationType.GAME_SUMMON,
                title = "Convocação para jogo",
                message = "Você foi convocado para $gameName ($gameDate) - Grupo $groupName",
                senderId = summonedById,
                senderName = summonedByName,
                referenceId = gameId,
                referenceType = "game",
                actionType = NotificationAction.CONFIRM_POSITION,
                createdAt = Clock.System.now().toEpochMilliseconds()
            )
        }

        /**
         * Cria notificação de lembrete de jogo.
         */
        fun createGameReminder(
            userId: String,
            gameId: String,
            gameName: String,
            gameDate: String,
            hoursUntil: Int
        ): AppNotification {
            val timeText = if (hoursUntil == 1) "1 hora" else "$hoursUntil horas"
            return AppNotification(
                userId = userId,
                type = NotificationType.GAME_REMINDER,
                title = "Lembrete de jogo",
                message = "$gameName começa em $timeText ($gameDate)",
                referenceId = gameId,
                referenceType = "game",
                actionType = NotificationAction.VIEW_DETAILS,
                createdAt = Clock.System.now().toEpochMilliseconds()
            )
        }

        /**
         * Cria notificação de novo membro no grupo.
         */
        fun createMemberJoined(
            userId: String,
            groupId: String,
            groupName: String,
            memberName: String,
            memberId: String
        ): AppNotification {
            return AppNotification(
                userId = userId,
                type = NotificationType.MEMBER_JOINED,
                title = "Novo membro",
                message = "$memberName entrou no grupo $groupName",
                senderId = memberId,
                senderName = memberName,
                referenceId = groupId,
                referenceType = "group",
                actionType = NotificationAction.VIEW_DETAILS,
                createdAt = Clock.System.now().toEpochMilliseconds()
            )
        }
    }
}

/**
 * Tipos de notificação disponíveis no sistema.
 *
 * Usado para categorizar e determinar a apresentação das notificações.
 */
enum class NotificationType(val displayName: String) {
    GROUP_INVITE("Convite de grupo"),
    GROUP_INVITE_ACCEPTED("Convite aceito"),
    GROUP_INVITE_DECLINED("Convite recusado"),
    GAME_SUMMON("Convocação de jogo"),
    GAME_REMINDER("Lembrete de jogo"),
    GAME_CANCELLED("Jogo cancelado"),
    GAME_CONFIRMED("Jogo confirmado"),
    MEMBER_JOINED("Novo membro"),
    MEMBER_LEFT("Membro saiu"),
    CASHBOX_ENTRY("Entrada no caixa"),
    CASHBOX_EXIT("Saída do caixa"),
    ACHIEVEMENT("Conquista"),
    ADMIN_MESSAGE("Mensagem do Admin"),
    SYSTEM("Sistema"),
    GENERAL("Geral");

    companion object {
        fun fromString(value: String?): NotificationType {
            return entries.find { it.name == value } ?: GENERAL
        }
    }
}

/**
 * Ações disponíveis que uma notificação pode requerer.
 *
 * Define o tipo de interação esperada do usuário.
 */
enum class NotificationAction(val displayName: String) {
    ACCEPT_DECLINE("Aceitar/Recusar"),
    CONFIRM_POSITION("Confirmar Posição"),
    VIEW_DETAILS("Ver Detalhes"),
    NONE("Sem ação");

    companion object {
        fun fromString(value: String?): NotificationAction {
            return entries.find { it.name == value } ?: VIEW_DETAILS
        }
    }
}
