package com.futebadosparcas.domain.repository

import com.futebadosparcas.domain.model.AppNotification
import com.futebadosparcas.domain.model.NotificationAction
import com.futebadosparcas.domain.model.NotificationType
import kotlinx.coroutines.flow.Flow

/**
 * Interface de repositório de notificações in-app.
 * Implementações específicas de plataforma em androidMain/iosMain.
 */
interface NotificationRepository {

    /**
     * Busca todas as notificações do usuário atual.
     *
     * @param limit Número máximo de notificações (padrão 50)
     * @return Lista de notificações ordenada por data (mais recentes primeiro)
     */
    suspend fun getMyNotifications(limit: Int = 50): Result<List<AppNotification>>

    /**
     * Observa notificações do usuário em tempo real.
     *
     * @param limit Número máximo de notificações (padrão 50)
     * @return Flow que emite a lista de notificações atualizada
     */
    fun getMyNotificationsFlow(limit: Int = 50): Flow<List<AppNotification>>

    /**
     * Busca apenas notificações não lidas do usuário atual.
     *
     * @return Lista de notificações não lidas
     */
    suspend fun getUnreadNotifications(): Result<List<AppNotification>>

    /**
     * Observa contagem de notificações não lidas em tempo real.
     *
     * @return Flow que emite o número de notificações não lidas
     */
    fun getUnreadCountFlow(): Flow<Int>

    /**
     * Conta notificações não lidas do usuário atual.
     *
     * @return Número de notificações não lidas
     */
    suspend fun getUnreadCount(): Result<Int>

    /**
     * Marca uma notificação como lida.
     *
     * @param notificationId ID da notificação
     * @return Result<Unit> indicando sucesso ou falha
     */
    suspend fun markAsRead(notificationId: String): Result<Unit>

    /**
     * Marca uma notificação como não lida.
     *
     * @param notificationId ID da notificação
     * @return Result<Unit> indicando sucesso ou falha
     */
    suspend fun markAsUnread(notificationId: String): Result<Unit>

    /**
     * Marca todas as notificações do usuário como lidas.
     *
     * @return Result<Unit> indicando sucesso ou falha
     */
    suspend fun markAllAsRead(): Result<Unit>

    /**
     * Busca uma notificação específica por ID.
     *
     * @param notificationId ID da notificação
     * @return Notificação encontrada ou erro
     */
    suspend fun getNotificationById(notificationId: String): Result<AppNotification>

    /**
     * Cria uma nova notificação.
     *
     * @param notification Dados da notificação (id pode ser vazio para auto-gerar)
     * @return ID da notificação criada
     */
    suspend fun createNotification(notification: AppNotification): Result<String>

    /**
     * Cria múltiplas notificações em lote.
     *
     * @param notifications Lista de notificações (ids podem ser vazios para auto-gerar)
     * @return Result<Unit> indicando sucesso ou falha
     */
    suspend fun batchCreateNotifications(notifications: List<AppNotification>): Result<Unit>

    /**
     * Deleta uma notificação.
     *
     * @param notificationId ID da notificação
     * @return Result<Unit> indicando sucesso ou falha
     */
    suspend fun deleteNotification(notificationId: String): Result<Unit>

    /**
     * Deleta notificações antigas (mais de 30 dias) ou com data nula/ausente.
     *
     * @return Número de notificações deletadas
     */
    suspend fun deleteOldNotifications(): Result<Int>

    /**
     * Busca notificações por tipo.
     *
     * @param type Tipo de notificação
     * @param limit Número máximo de notificações (padrão 20)
     * @return Lista de notificações do tipo especificado
     */
    suspend fun getNotificationsByType(type: NotificationType, limit: Int = 20): Result<List<AppNotification>>

    /**
     * Busca notificações com ação pendente (convites, convocações).
     *
     * Filtra não lidas que requerem resposta e não estão expiradas.
     *
     * @return Lista de notificações com ação pendente
     */
    suspend fun getPendingActionNotifications(): Result<List<AppNotification>>
}
