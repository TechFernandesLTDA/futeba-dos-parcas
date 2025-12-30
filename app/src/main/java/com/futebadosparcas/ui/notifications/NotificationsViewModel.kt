package com.futebadosparcas.ui.notifications

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.AppNotification
import com.futebadosparcas.data.model.NotificationType
import com.futebadosparcas.data.repository.InviteRepository
import com.futebadosparcas.data.repository.NotificationRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class NotificationsViewModel @Inject constructor(
    private val notificationRepository: NotificationRepository,
    private val inviteRepository: InviteRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<NotificationsUiState>(NotificationsUiState.Loading)
    val uiState: StateFlow<NotificationsUiState> = _uiState

    private val _unreadCount = MutableStateFlow(0)
    val unreadCount: StateFlow<Int> = _unreadCount

    private val _actionState = MutableStateFlow<NotificationActionState>(NotificationActionState.Idle)
    val actionState: StateFlow<NotificationActionState> = _actionState

    init {
        observeNotifications()
        observeUnreadCount()
    }

    private fun observeNotifications() {
        notificationRepository.getMyNotificationsFlow()
            .onEach { notifications ->
                _uiState.value = if (notifications.isEmpty()) {
                    NotificationsUiState.Empty
                } else {
                    NotificationsUiState.Success(notifications)
                }
            }
            .catch { e ->
                _uiState.value = NotificationsUiState.Error(
                    e.message ?: "Erro ao carregar notificações"
                )
            }
            .launchIn(viewModelScope)
    }

    private fun observeUnreadCount() {
        notificationRepository.getUnreadCountFlow()
            .onEach { count ->
                _unreadCount.value = count
            }
            .catch { /* Ignore errors */ }
            .launchIn(viewModelScope)
    }

    fun loadNotifications() {
        viewModelScope.launch {
            _uiState.value = NotificationsUiState.Loading

            val result = notificationRepository.getMyNotifications()

            result.fold(
                onSuccess = { notifications ->
                    _uiState.value = if (notifications.isEmpty()) {
                        NotificationsUiState.Empty
                    } else {
                        NotificationsUiState.Success(notifications)
                    }
                },
                onFailure = { error ->
                    _uiState.value = NotificationsUiState.Error(
                        error.message ?: "Erro ao carregar notificações"
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

    fun markAllAsRead() {
        viewModelScope.launch {
            val result = notificationRepository.markAllAsRead()

            result.fold(
                onSuccess = {
                    _actionState.value = NotificationActionState.Success(
                        "Todas as notificações foram marcadas como lidas"
                    )
                },
                onFailure = { error ->
                    _actionState.value = NotificationActionState.Error(
                        error.message ?: "Erro ao marcar notificações"
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
                    _actionState.value = NotificationActionState.Success("Notificação removida")
                },
                onFailure = { error ->
                    _actionState.value = NotificationActionState.Error(
                        error.message ?: "Erro ao remover notificação"
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
                            "$count notificações antigas removidas"
                        )
                    }
                },
                onFailure = { /* Ignore */ }
            )
        }
    }

    fun handleNotificationAction(notification: AppNotification, accept: Boolean) {
        when (notification.getTypeEnum()) {
            NotificationType.GROUP_INVITE -> {
                handleGroupInvite(notification, accept)
            }
            NotificationType.GAME_SUMMON -> {
                // Handled by GameSummonViewModel
                _actionState.value = NotificationActionState.NavigateToGame(
                    notification.referenceId ?: ""
                )
            }
            else -> {
                // Just mark as read for other types
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
                        NotificationActionState.InviteAccepted("Você entrou no grupo!")
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

    fun getNotificationsByType(type: NotificationType) {
        viewModelScope.launch {
            _uiState.value = NotificationsUiState.Loading

            val result = notificationRepository.getNotificationsByType(type)

            result.fold(
                onSuccess = { notifications ->
                    _uiState.value = if (notifications.isEmpty()) {
                        NotificationsUiState.Empty
                    } else {
                        NotificationsUiState.Success(notifications)
                    }
                },
                onFailure = { error ->
                    _uiState.value = NotificationsUiState.Error(
                        error.message ?: "Erro ao filtrar notificações"
                    )
                }
            )
        }
    }

    fun resetActionState() {
        _actionState.value = NotificationActionState.Idle
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
