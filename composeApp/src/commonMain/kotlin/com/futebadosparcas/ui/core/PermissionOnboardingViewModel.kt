package com.futebadosparcas.ui.core

import androidx.lifecycle.ViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

/**
 * Interface para solicitar permissões do sistema.
 * Será implementada por cada plataforma (Android/iOS).
 */
interface PermissionHandler {
    fun requestNotificationPermission(onResult: (Boolean) -> Unit)
    fun requestLocationPermission(onResult: (Boolean) -> Unit)
}

/**
 * Estado da tela de permissões de onboarding.
 */
data class PermissionScreenState(
    val notificationGranted: Boolean = false,
    val locationGranted: Boolean = false,
    val showNotificationPermission: Boolean = true // será ajustado pela plataforma (ex: Android 13+)
)

/**
 * ViewModel que gerencia o estado das permissões e delega as solicitações à plataforma.
 */
class PermissionOnboardingViewModel(
    private val permissionHandler: PermissionHandler
) : ViewModel() {

    private val _state = MutableStateFlow(PermissionScreenState())
    val state: StateFlow<PermissionScreenState> = _state.asStateFlow()

    fun requestNotification() {
        permissionHandler.requestNotificationPermission { granted ->
            _state.update { it.copy(notificationGranted = granted) }
        }
    }

    fun requestLocation() {
        permissionHandler.requestLocationPermission { granted ->
            _state.update { it.copy(locationGranted = granted) }
        }
    }

    /**
     * Atualização síncrona do estado de uma permissão (usada na inicialização da plataforma).
     */
    fun setPermissionGranted(permission: PermissionType, granted: Boolean) {
        _state.update { current ->
            when (permission) {
                PermissionType.NOTIFICATION -> current.copy(notificationGranted = granted)
                PermissionType.LOCATION -> current.copy(locationGranted = granted)
            }
        }
    }

    fun setShowNotificationPermission(show: Boolean) {
        _state.update { it.copy(showNotificationPermission = show) }
    }
}

enum class PermissionType {
    NOTIFICATION, LOCATION
}