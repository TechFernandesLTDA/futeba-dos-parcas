package com.futebadosparcas.ui.notifications

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.AppNotification
import com.futebadosparcas.domain.model.NotificationType
import com.futebadosparcas.domain.repository.InviteRepository
import com.futebadosparcas.domain.repository.NotificationRepository
import com.futebadosparcas.util.AppLogger
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch

class NotificationsViewModel(
    private val notificationRepository: NotificationRepository,
    private val inviteRepository: InviteRepository,
    private val gameSummonRepository: GameSummonRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<NotificationsUiState>(NotificationsUiState.Loading)
    val uiState: StateFlow<NotificationsUiState> = _uiState

    private val _unreadCount = MutableStateFlow(0)
    val unreadCount: StateFlow<Int> = _unreadCount

    private val _actionState = MutableStateFlow<NotificationActionState>(NotificationActionState.Idle)
    val actionState: StateFlow<NotificationActionState> = _actionState

    private var notificationsJob: Job? = null
    private var unreadCountJob: Job? = null

    init {
        observeNotifications()
        observeUnreadCount()
    }

    private fun observeNotifications() {
        notificationsJob?.cancel()
        notificationsJob = notificationRepository.getMyNotificationsFlow()
            .onEach { notifications ->
                val sortedNotifications = sortNotifications(notifications)
                _uiState.value = if (sortedNotifications.isEmpty()) {
                    NotificationsUiState.Empty
                } else {
                    NotificationsUiState.Success(sortedNotifications)
                }
            }
            .catch { e ->
                _uiState.value = NotificationsUiState.Error(
                    e.message ?: "Erro ao carregar notificacoes"
                )
            }
            .launchIn(viewModelScope)
    }

    private fun observeUnreadCount() {
        unreadCountJob?.cancel()
        unreadCountJob = notificationRepository.getUnreadCountFlow()
            .onEach { count ->
                _unreadCount.value = count
            }
            .catch { e ->
                // Erro ao observar contagem - mantém último valor conhecido
                AppLogger.w("NotificationsVM") { "Erro ao observar unread count: ${e.message}" }
            }
            .launchIn(viewModelScope)
    }

    override fun onCleared() {
        super.onCleared()
        notificationsJob?.cancel()
        unreadCountJob?.cancel()
    }

    fun loadNotifications() {
        viewModelScope.launch {
            _uiState.value = NotificationsUiState.Loading

            val result = notificationRepository.getMyNotifications()

            result.fold(
                onSuccess = { notifications ->
                    val sortedNotifications = sortNotifications(notifications)
                    _uiState.value = if (sortedNotifications.isEmpty()) {
                        NotificationsUiState.Empty
                    } else {
                        NotificationsUiState.Success(sortedNotifications)
                    }
                },
                onFailure = { error ->
                    _uiState.value = NotificationsUiState.Error(
                        error.message ?: "Erro ao carregar notificacoes"
                    )
                }
            )
        }
    }

    fun markAsRead(notificationId: String) {
        viewModelScope.launch {
            notificationRepository.markAsRead(notificationId)
        }
    }

    /**
     * Melhoria 3: Marca uma notificação como não lida
     */
    fun markAsUnread(notificationId: String) {
        viewModelScope.launch {
            notificationRepository.markAsUnread(notificationId)
        }
    }

    fun markAllAsRead() {
        viewModelScope.launch {
            val result = notificationRepository.markAllAsRead()

            result.fold(
                onSuccess = {
                    _actionState.value = NotificationActionState.Success(
                        "Todas as notificacoes foram marcadas como lidas"
                    )
                },
                onFailure = { error ->
                    _actionState.value = NotificationActionState.Error(
                        error.message ?: "Erro ao marcar notificacoes"
                    )
                }
            )
        }
    }

    fun deleteNotification(notificationId: String) {
        viewModelScope.launch {
            val result = notificationRepository.deleteNotification(notificationId)

            result.fold(
                onSuccess = {
                    // Não mostra mensagem aqui - a tela mostra snackbar com undo
                },
                onFailure = { error ->
                    _actionState.value = NotificationActionState.Error(
                        error.message ?: "Erro ao remover notificacao"
                    )
                }
            )
        }
    }

    /**
     * Restaura uma notificação deletada (undo).
     */
    fun restoreNotification(notification: AppNotification) {
        viewModelScope.launch {
            // Notification já é KMP model (domain.model.AppNotification)
            val kmpNotification = notification.copy(read = false)

            val result = notificationRepository.createNotification(kmpNotification)

            result.fold(
                onSuccess = {
                    _actionState.value = NotificationActionState.Success("Notificação restaurada")
                },
                onFailure = { error ->
                    _actionState.value = NotificationActionState.Error(
                        error.message ?: "Erro ao restaurar notificação"
                    )
                }
            )
        }
    }

    fun deleteOldNotifications() {
        viewModelScope.launch {
            val result = notificationRepository.deleteOldNotifications()

            result.fold(
                onSuccess = { count ->
                    if (count > 0) {
                        _actionState.value = NotificationActionState.Success(
                            "$count notificacoes antigas removidas"
                        )
                    }
                },
                onFailure = { /* Ignore */ }
            )
        }
    }

    fun handleNotificationAction(notification: AppNotification, accept: Boolean) {
        when (notification.type) {
            NotificationType.GROUP_INVITE -> {
                handleGroupInvite(notification, accept)
            }
            NotificationType.GAME_SUMMON -> {
                if (accept) {
                    _actionState.value = NotificationActionState.NavigateToGame(
                        notification.referenceId ?: ""
                    )
                } else {
                    handleGameSummonDecline(notification)
                }
            }
            else -> {
                markAsRead(notification.id)
            }
        }
    }

    private fun handleGroupInvite(notification: AppNotification, accept: Boolean) {
        val inviteId = notification.referenceId ?: return

        viewModelScope.launch {
            _actionState.value = NotificationActionState.Loading

            val result = if (accept) {
                inviteRepository.acceptInvite(inviteId)
            } else {
                inviteRepository.declineInvite(inviteId)
            }

            result.fold(
                onSuccess = {
                    markAsRead(notification.id)
                    _actionState.value = if (accept) {
                        NotificationActionState.InviteAccepted("Voce entrou no grupo!")
                    } else {
                        NotificationActionState.InviteDeclined("Convite recusado")
                    }
                },
                onFailure = { error ->
                    _actionState.value = NotificationActionState.Error(
                        error.message ?: "Erro ao processar convite"
                    )
                }
            )
        }
    }

    private fun handleGameSummonDecline(notification: AppNotification) {
        val gameId = notification.referenceId
        if (gameId.isNullOrBlank()) {
            _actionState.value = NotificationActionState.Error("Jogo invalido na notificacao")
            return
        }

        viewModelScope.launch {
            _actionState.value = NotificationActionState.Loading
            val result = gameSummonRepository.declineSummon(gameId)

            result.fold(
                onSuccess = {
                    markAsRead(notification.id)
                    _actionState.value = NotificationActionState.Success("Convocacao recusada")
                },
                onFailure = { error ->
                    _actionState.value = NotificationActionState.Error(
                        error.message ?: "Erro ao recusar convocacao"
                    )
                }
            )
        }
    }

    fun getNotificationsByType(type: NotificationType) {
        viewModelScope.launch {
            _uiState.value = NotificationsUiState.Loading

            val result = notificationRepository.getNotificationsByType(type.toKmpNotificationType())

            result.fold(
                onSuccess = { notifications ->
                    val sortedNotifications = sortNotifications(notifications)
                    _uiState.value = if (sortedNotifications.isEmpty()) {
                        NotificationsUiState.Empty
                    } else {
                        NotificationsUiState.Success(sortedNotifications)
                    }
                },
                onFailure = { error ->
                    _uiState.value = NotificationsUiState.Error(
                        error.message ?: "Erro ao filtrar notificacoes"
                    )
                }
            )
        }
    }

    fun resetActionState() {
        _actionState.value = NotificationActionState.Idle
    }

    private fun sortNotifications(notifications: List<AppNotification>): List<AppNotification> {
        // Notificações com data vêm primeiro (ordenadas por data desc)
        // Notificações sem data vão para o final (ordenadas por ID desc)
        return notifications.sortedWith(
            compareByDescending<AppNotification> { it.createdAt != null }
                .thenByDescending { it.createdAt?.time ?: 0L }
                .thenByDescending { it.id }
        )
    }
}

sealed class NotificationsUiState {
    object Loading : NotificationsUiState()
    object Empty : NotificationsUiState()
    data class Success(val notifications: List<AppNotification>) : NotificationsUiState()
    data class Error(val message: String) : NotificationsUiState()
}

sealed class NotificationActionState {
    object Idle : NotificationActionState()
    object Loading : NotificationActionState()
    data class Success(val message: String) : NotificationActionState()
    data class InviteAccepted(val message: String) : NotificationActionState()
    data class InviteDeclined(val message: String) : NotificationActionState()
    data class NavigateToGame(val gameId: String) : NotificationActionState()
    data class Error(val message: String) : NotificationActionState()
}
