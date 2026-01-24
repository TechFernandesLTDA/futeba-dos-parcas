package com.futebadosparcas.data.model

import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentId
import com.google.firebase.firestore.Exclude
import com.google.firebase.firestore.IgnoreExtraProperties
import com.google.firebase.firestore.PropertyName
import com.google.firebase.firestore.ServerTimestamp
import java.util.Date

/**
 * Representa uma notificacao in-app para o usuario.
 * Colecao: notifications
 */
@IgnoreExtraProperties
data class AppNotification(
    @DocumentId
    var id: String = "",

    @get:PropertyName("user_id")
    @set:PropertyName("user_id")
    var userId: String = "",

    val type: String = NotificationType.GENERAL.name,

    val title: String = "",

    val message: String = "",

    @get:PropertyName("sender_id")
    @set:PropertyName("sender_id")
    var senderId: String? = null,

    @get:PropertyName("sender_name")
    @set:PropertyName("sender_name")
    var senderName: String? = null,

    @get:PropertyName("sender_photo")
    @set:PropertyName("sender_photo")
    var senderPhoto: String? = null,

    @get:PropertyName("reference_id")
    @set:PropertyName("reference_id")
    var referenceId: String? = null,

    @get:PropertyName("reference_type")
    @set:PropertyName("reference_type")
    var referenceType: String? = null,

    // Referência ao grupo para filtros (#13 - Validação Firebase)
    @get:PropertyName("group_id")
    @set:PropertyName("group_id")
    var groupId: String? = null,

    @get:PropertyName("action_type")
    @set:PropertyName("action_type")
    var actionType: String? = null,

    var read: Boolean = false,

    @get:PropertyName("read_at")
    @set:PropertyName("read_at")
    var readAt: Date? = null,

    // Campo interno que recebe Timestamp ou Date do Firestore
    @ServerTimestamp
    @get:PropertyName("created_at")
    @set:PropertyName("created_at")
    var createdAtRaw: Any? = null,

    @get:PropertyName("expires_at")
    @set:PropertyName("expires_at")
    var expiresAtRaw: Any? = null
) {
    constructor() : this(id = "")

    /**
     * Converte o campo raw para Date, tratando Timestamp e Date
     */
    val createdAt: Date?
        @Exclude
        get() = when (val raw = createdAtRaw) {
            is Date -> raw
            is Timestamp -> raw.toDate()
            is Long -> Date(raw)
            else -> null
        }

    /**
     * Converte o campo raw para Date, tratando Timestamp e Date
     */
    val expiresAt: Date?
        @Exclude
        get() = when (val raw = expiresAtRaw) {
            is Date -> raw
            is Timestamp -> raw.toDate()
            is Long -> Date(raw)
            else -> null
        }

    @Exclude
    fun getTypeEnum(): NotificationType = try {
        NotificationType.valueOf(type)
    } catch (e: Exception) {
        NotificationType.GENERAL
    }

    @Exclude
    fun getActionTypeEnum(): NotificationAction = try {
        actionType?.let { NotificationAction.valueOf(it) } ?: NotificationAction.VIEW_DETAILS
    } catch (e: Exception) {
        NotificationAction.VIEW_DETAILS
    }

    @Exclude
    fun checkIfRead(): Boolean = read

    @Exclude
    fun hasAction(): Boolean = getActionTypeEnum() != NotificationAction.NONE

    @Exclude
    fun requiresResponse(): Boolean = getActionTypeEnum() == NotificationAction.ACCEPT_DECLINE ||
        getActionTypeEnum() == NotificationAction.CONFIRM_POSITION

    /**
     * Retorna o icone apropriado baseado no tipo de notificacao.
     */
    @Exclude
    fun getIconResource(): Int {
        return when (getTypeEnum()) {
            NotificationType.GROUP_INVITE -> com.futebadosparcas.R.drawable.ic_group
            NotificationType.GROUP_INVITE_ACCEPTED -> com.futebadosparcas.R.drawable.ic_group
            NotificationType.GROUP_INVITE_DECLINED -> com.futebadosparcas.R.drawable.ic_group
            NotificationType.GAME_SUMMON -> com.futebadosparcas.R.drawable.ic_football
            NotificationType.GAME_REMINDER -> com.futebadosparcas.R.drawable.ic_football
            NotificationType.GAME_CANCELLED -> com.futebadosparcas.R.drawable.ic_football
            NotificationType.GAME_CONFIRMED -> com.futebadosparcas.R.drawable.ic_football
            NotificationType.GAME_VACANCY -> com.futebadosparcas.R.drawable.ic_football
            NotificationType.MEMBER_JOINED -> com.futebadosparcas.R.drawable.ic_group
            NotificationType.MEMBER_LEFT -> com.futebadosparcas.R.drawable.ic_group
            NotificationType.CASHBOX_ENTRY -> com.futebadosparcas.R.drawable.ic_notifications
            NotificationType.CASHBOX_EXIT -> com.futebadosparcas.R.drawable.ic_notifications
            NotificationType.ACHIEVEMENT -> com.futebadosparcas.R.drawable.ic_star
            NotificationType.ADMIN_MESSAGE -> com.futebadosparcas.R.drawable.ic_notifications
            NotificationType.SYSTEM -> com.futebadosparcas.R.drawable.ic_notifications
            NotificationType.GENERAL -> com.futebadosparcas.R.drawable.ic_notifications
        }
    }

    companion object {
        /**
         * Cria notificacao de convite de grupo.
         */
        fun createGroupInviteNotification(
            userId: String,
            inviteId: String,
            groupName: String,
            invitedByName: String,
            invitedById: String
        ): AppNotification {
            return AppNotification(
                userId = userId,
                type = NotificationType.GROUP_INVITE.name,
                title = "Convite para grupo",
                message = "$invitedByName convidou voce para o grupo $groupName",
                senderId = invitedById,
                senderName = invitedByName,
                referenceId = inviteId,
                referenceType = "invite",
                actionType = NotificationAction.ACCEPT_DECLINE.name,
                createdAtRaw = Date(),
                expiresAtRaw = Date(System.currentTimeMillis() + GroupInvite.EXPIRATION_TIME_MS)
            )
        }

        /**
         * Cria notificacao de convocacao de jogo.
         */
        fun createGameSummonNotification(
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
                type = NotificationType.GAME_SUMMON.name,
                title = "Convocacao para jogo",
                message = "Voce foi convocado para $gameName ($gameDate) - Grupo $groupName",
                senderId = summonedById,
                senderName = summonedByName,
                referenceId = gameId,
                referenceType = "game",
                actionType = NotificationAction.CONFIRM_POSITION.name,
                createdAtRaw = Date()
            )
        }

        /**
         * Cria notificacao de lembrete de jogo.
         */
        fun createGameReminderNotification(
            userId: String,
            gameId: String,
            gameName: String,
            gameDate: String,
            hoursUntil: Int
        ): AppNotification {
            val timeText = if (hoursUntil == 1) "1 hora" else "$hoursUntil horas"
            return AppNotification(
                userId = userId,
                type = NotificationType.GAME_REMINDER.name,
                title = "Lembrete de jogo",
                message = "$gameName comeca em $timeText ($gameDate)",
                referenceId = gameId,
                referenceType = "game",
                actionType = NotificationAction.VIEW_DETAILS.name,
                createdAtRaw = Date()
            )
        }

        /**
         * Cria notificacao de novo membro no grupo.
         */
        fun createMemberJoinedNotification(
            userId: String,
            groupId: String,
            groupName: String,
            memberName: String,
            memberId: String
        ): AppNotification {
            return AppNotification(
                userId = userId,
                type = NotificationType.MEMBER_JOINED.name,
                title = "Novo membro",
                message = "$memberName entrou no grupo $groupName",
                senderId = memberId,
                senderName = memberName,
                referenceId = groupId,
                referenceType = "group",
                actionType = NotificationAction.VIEW_DETAILS.name,
                createdAtRaw = Date()
            )
        }
    }
}

/**
 * Tipos de notificacao.
 */
enum class NotificationType(val displayName: String) {
    GROUP_INVITE("Convite de grupo"),
    GROUP_INVITE_ACCEPTED("Convite aceito"),
    GROUP_INVITE_DECLINED("Convite recusado"),
    GAME_SUMMON("Convocacao de jogo"),
    GAME_REMINDER("Lembrete de jogo"),
    GAME_CANCELLED("Jogo cancelado"),
    GAME_CONFIRMED("Jogo confirmado"),
    GAME_VACANCY("Vaga disponivel"),
    MEMBER_JOINED("Novo membro"),
    MEMBER_LEFT("Membro saiu"),
    CASHBOX_ENTRY("Entrada no caixa"),
    CASHBOX_EXIT("Saida do caixa"),
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
 * Acoes disponiveis na notificacao.
 */
enum class NotificationAction(val displayName: String) {
    ACCEPT_DECLINE("Aceitar/Recusar"),
    CONFIRM_POSITION("Confirmar Posicao"),
    VIEW_DETAILS("Ver Detalhes"),
    NONE("Sem acao");

    companion object {
        fun fromString(value: String?): NotificationAction {
            return entries.find { it.name == value } ?: VIEW_DETAILS
        }
    }
}
