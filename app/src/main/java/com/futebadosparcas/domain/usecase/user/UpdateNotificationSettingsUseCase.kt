package com.futebadosparcas.domain.usecase.user

import com.futebadosparcas.domain.usecase.SuspendUseCase
import com.futebadosparcas.util.AppLogger
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ServerTimestamp
import kotlinx.coroutines.tasks.await
import java.util.Date
import javax.inject.Inject

/**
 * Update Notification Settings Use Case
 *
 * Atualiza as preferências de notificação do usuário, permitindo controlar quais tipos de notificações
 * e através de quais canais o usuário deseja receber (push, email, in-app, etc).
 *
 * Responsabilidades:
 * - Buscar configurações de notificação atuais do usuário
 * - Validar novos valores de configuração
 * - Atualizar documento de preferências no Firestore
 * - Retornar as configurações atualizadas
 *
 * Uso:
 * ```kotlin
 * val result = updateNotificationSettingsUseCase(UpdateNotificationSettingsParams(
 *     userId = "user-123",
 *     enablePushNotifications = true,
 *     enableGameReminders = true,
 *     enableGroupNotifications = false,
 *     enableAchievements = true,
 *     reminderTimeMinutes = 60
 * ))
 *
 * result.fold(
 *     onSuccess = { settings ->
 *         println("Configurações atualizadas: push=${settings.enablePushNotifications}")
 *     },
 *     onFailure = { error ->
 *         println("Erro: ${error.message}")
 *     }
 * )
 * ```
 */
class UpdateNotificationSettingsUseCase @Inject constructor(
    private val firestore: FirebaseFirestore
) : SuspendUseCase<UpdateNotificationSettingsParams, NotificationSettings>() {

    companion object {
        private const val TAG = "UpdateNotificationSettingsUseCase"
        private const val COLLECTION_NOTIFICATION_SETTINGS = "notification_settings"
        private const val MIN_REMINDER_MINUTES = 5
        private const val MAX_REMINDER_MINUTES = 1440 // 24 hours
    }

    override suspend fun execute(params: UpdateNotificationSettingsParams): NotificationSettings {
        AppLogger.d(TAG) {
            "Atualizando configurações de notificação: userId=${params.userId}"
        }

        // Validar parâmetros
        validateParams(params)

        // Buscar configurações atuais ou criar novas
        val currentSettings = fetchCurrentSettings(params.userId)
            ?: NotificationSettings()

        // Aplicar atualizações
        val updatedSettings = currentSettings.copy(
            userId = params.userId,
            enablePushNotifications = params.enablePushNotifications
                ?: currentSettings.enablePushNotifications,
            enableEmailNotifications = params.enableEmailNotifications
                ?: currentSettings.enableEmailNotifications,
            enableInAppNotifications = params.enableInAppNotifications
                ?: currentSettings.enableInAppNotifications,
            enableGameReminders = params.enableGameReminders
                ?: currentSettings.enableGameReminders,
            enableGroupNotifications = params.enableGroupNotifications
                ?: currentSettings.enableGroupNotifications,
            enableInviteNotifications = params.enableInviteNotifications
                ?: currentSettings.enableInviteNotifications,
            enableAchievementNotifications = params.enableAchievementNotifications
                ?: currentSettings.enableAchievementNotifications,
            enableCashboxNotifications = params.enableCashboxNotifications
                ?: currentSettings.enableCashboxNotifications,
            reminderTimeMinutes = params.reminderTimeMinutes
                ?: currentSettings.reminderTimeMinutes,
            muteUntilTime = params.muteUntilTime
                ?: currentSettings.muteUntilTime,
            updatedAt = Date()
        )

        // Salvar no Firestore
        firestore.collection(COLLECTION_NOTIFICATION_SETTINGS)
            .document(params.userId)
            .set(updatedSettings)
            .await()

        AppLogger.d(TAG) {
            "Configurações de notificação atualizadas com sucesso: userId=${params.userId}"
        }

        return updatedSettings
    }

    private suspend fun fetchCurrentSettings(userId: String): NotificationSettings? {
        return try {
            val snapshot = firestore.collection(COLLECTION_NOTIFICATION_SETTINGS)
                .document(userId)
                .get()
                .await()

            snapshot.toObject(NotificationSettings::class.java)
        } catch (e: Exception) {
            AppLogger.w(TAG) {
                "Erro ao buscar configurações atuais: ${e.message}, usando valores padrão"
            }
            null
        }
    }

    private fun validateParams(params: UpdateNotificationSettingsParams) {
        // Validar userId
        require(params.userId.isNotBlank()) {
            "ID do usuário é obrigatório"
        }

        // Validar reminderTimeMinutes se fornecido
        params.reminderTimeMinutes?.let { reminderTime ->
            require(reminderTime in MIN_REMINDER_MINUTES..MAX_REMINDER_MINUTES) {
                "Tempo de lembrete deve estar entre $MIN_REMINDER_MINUTES e $MAX_REMINDER_MINUTES minutos"
            }
        }

        // Validar muteUntilTime se fornecido
        params.muteUntilTime?.let { muteTime ->
            val now = Date()
            require(muteTime.time >= now.time) {
                "Tempo de silêncio não pode ser no passado"
            }
        }
    }
}

/**
 * Parâmetros para atualizar configurações de notificação
 *
 * @param userId ID do usuário cujas configurações serão atualizadas
 * @param enablePushNotifications Se as notificações push devem estar ativas (opcional)
 * @param enableEmailNotifications Se as notificações por email devem estar ativas (opcional)
 * @param enableInAppNotifications Se as notificações in-app devem estar ativas (opcional)
 * @param enableGameReminders Se os lembretes de jogo devem estar ativos (opcional)
 * @param enableGroupNotifications Se as notificações de grupo devem estar ativas (opcional)
 * @param enableInviteNotifications Se as notificações de convite devem estar ativas (opcional)
 * @param enableAchievementNotifications Se as notificações de conquistas devem estar ativas (opcional)
 * @param enableCashboxNotifications Se as notificações do caixa devem estar ativas (opcional)
 * @param reminderTimeMinutes Quantos minutos antes do jogo o lembrete deve ser enviado (5-1440) (opcional)
 * @param muteUntilTime Data/hora até a qual as notificações devem estar silenciadas (opcional)
 */
data class UpdateNotificationSettingsParams(
    val userId: String,
    val enablePushNotifications: Boolean? = null,
    val enableEmailNotifications: Boolean? = null,
    val enableInAppNotifications: Boolean? = null,
    val enableGameReminders: Boolean? = null,
    val enableGroupNotifications: Boolean? = null,
    val enableInviteNotifications: Boolean? = null,
    val enableAchievementNotifications: Boolean? = null,
    val enableCashboxNotifications: Boolean? = null,
    val reminderTimeMinutes: Int? = null,
    val muteUntilTime: Date? = null
)

/**
 * Configurações de notificação do usuário
 *
 * Armazenadas na coleção "notification_settings" do Firestore.
 * Cada usuário tem um documento com suas preferências de notificação.
 *
 * @param userId ID do usuário (document ID)
 * @param enablePushNotifications Se notificações push estão habilitadas
 * @param enableEmailNotifications Se notificações por email estão habilitadas
 * @param enableInAppNotifications Se notificações in-app estão habilitadas
 * @param enableGameReminders Se lembretes de jogo estão habilitados
 * @param enableGroupNotifications Se notificações de grupo estão habilitadas
 * @param enableInviteNotifications Se notificações de convite estão habilitadas
 * @param enableAchievementNotifications Se notificações de conquistas estão habilitadas
 * @param enableCashboxNotifications Se notificações do caixa estão habilitadas
 * @param reminderTimeMinutes Minutos antes do jogo para enviar lembrete (padrão: 60)
 * @param muteUntilTime Data/hora até a qual as notificações estão silenciadas (null = não silenciado)
 * @param createdAt Data de criação das configurações
 * @param updatedAt Data da última atualização
 */
data class NotificationSettings(
    val userId: String = "",
    val enablePushNotifications: Boolean = true,
    val enableEmailNotifications: Boolean = false,
    val enableInAppNotifications: Boolean = true,
    val enableGameReminders: Boolean = true,
    val enableGroupNotifications: Boolean = true,
    val enableInviteNotifications: Boolean = true,
    val enableAchievementNotifications: Boolean = true,
    val enableCashboxNotifications: Boolean = true,
    val reminderTimeMinutes: Int = 60,
    val muteUntilTime: Date? = null,
    @ServerTimestamp
    val createdAt: Date? = null,
    val updatedAt: Date? = null
) {
    /**
     * Verifica se alguma forma de notificação está habilitada.
     */
    fun hasAnyNotificationEnabled(): Boolean {
        return enablePushNotifications || enableEmailNotifications || enableInAppNotifications
    }

    /**
     * Verifica se as notificações estão atualmente silenciadas.
     */
    fun isMuted(): Boolean {
        if (muteUntilTime == null) return false
        return muteUntilTime.time > Date().time
    }

    /**
     * Retorna quanto tempo falta para sair do silêncio, em minutos.
     * Retorna 0 se não estiver silenciado ou já passou o tempo.
     */
    fun minutesUntilUnmuted(): Long {
        if (!isMuted()) return 0
        val muteEnd = muteUntilTime ?: return 0
        return (muteEnd.time - Date().time) / (1000 * 60)
    }

    /**
     * Verifica se uma notificação de um tipo específico deve ser entregue
     * considerando as configurações gerais e específicas do tipo.
     */
    fun shouldDeliverNotification(type: NotificationType): Boolean {
        // Se está silenciado, não entrega
        if (isMuted()) return false

        // Verificar se notificações gerais estão habilitadas
        if (!enableInAppNotifications && !enablePushNotifications && !enableEmailNotifications) {
            return false
        }

        // Verificar configuração específica do tipo
        return when (type) {
            NotificationType.GAME_REMINDER -> enableGameReminders
            NotificationType.GROUP_INVITE,
            NotificationType.GROUP_INVITE_ACCEPTED,
            NotificationType.GROUP_INVITE_DECLINED,
            NotificationType.MEMBER_JOINED,
            NotificationType.MEMBER_LEFT -> enableGroupNotifications

            NotificationType.GAME_SUMMON,
            NotificationType.GAME_CANCELLED,
            NotificationType.GAME_CONFIRMED -> enableInviteNotifications

            NotificationType.ACHIEVEMENT -> enableAchievementNotifications

            NotificationType.CASHBOX_ENTRY,
            NotificationType.CASHBOX_EXIT -> enableCashboxNotifications

            NotificationType.ADMIN_MESSAGE,
            NotificationType.SYSTEM,
            NotificationType.GENERAL -> true
        }
    }

    enum class NotificationType {
        GROUP_INVITE,
        GROUP_INVITE_ACCEPTED,
        GROUP_INVITE_DECLINED,
        GAME_SUMMON,
        GAME_REMINDER,
        GAME_CANCELLED,
        GAME_CONFIRMED,
        MEMBER_JOINED,
        MEMBER_LEFT,
        CASHBOX_ENTRY,
        CASHBOX_EXIT,
        ACHIEVEMENT,
        ADMIN_MESSAGE,
        SYSTEM,
        GENERAL
    }
}
