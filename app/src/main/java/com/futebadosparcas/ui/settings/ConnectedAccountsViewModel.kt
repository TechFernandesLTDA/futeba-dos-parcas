package com.futebadosparcas.ui.settings

import androidx.annotation.StringRes
import com.futebadosparcas.R
import com.futebadosparcas.data.repository.AuthRepository
import com.futebadosparcas.util.AppLogger
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.launch

/**
 * #3190: Estado da tela "Contas conectadas".
 */
sealed interface ConnectedAccountsUiState {
    data object Loading : ConnectedAccountsUiState
    data class Success(
        val providers: List<String>,
        val isLinking: Boolean = false,
        val isUnlinking: Boolean = false,
    ) : ConnectedAccountsUiState
}

/** Eventos transitórios (snackbar/toast). */
sealed interface ConnectedAccountsEvent {
    data class ShowSuccess(@StringRes val messageRes: Int) : ConnectedAccountsEvent
    data class ShowError(@StringRes val messageRes: Int) : ConnectedAccountsEvent
}

/**
 * #3190: ViewModel da tela "Contas conectadas" — vincular/desvincular Google.
 * Usa o AndroidAuthRepository (data.repository.AuthRepository) que tem acesso
 * direto ao FirebaseAuth para linkWithCredential/unlink.
 */
class ConnectedAccountsViewModel(
    private val authRepository: AuthRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow<ConnectedAccountsUiState>(
        ConnectedAccountsUiState.Loading,
    )
    val uiState: StateFlow<ConnectedAccountsUiState> = _uiState.asStateFlow()

    private val _events = Channel<ConnectedAccountsEvent>(Channel.BUFFERED)
    val events = _events.receiveAsFlow()

    init {
        refreshProviders()
    }

    /** Lista atual de provedores vinculados a partir do FirebaseUser. */
    private fun refreshProviders() {
        val providers = authRepository.getLinkedProviders()
        _uiState.value = ConnectedAccountsUiState.Success(
            providers = providers,
            isLinking = false,
            isUnlinking = false,
        )
    }

    /**
     * Vincula conta Google usando o idToken obtido via Credential Manager.
     */
    fun linkGoogleAccount(idToken: String) {
        val current = _uiState.value
        val providers = (current as? ConnectedAccountsUiState.Success)?.providers ?: emptyList()
        _uiState.value = ConnectedAccountsUiState.Success(providers, isLinking = true)
        viewModelScope.launch {
            val result = authRepository.linkGoogleAccount(idToken)
            if (result.isSuccess) {
                _events.send(ConnectedAccountsEvent.ShowSuccess(R.string.connected_accounts_link_success))
            } else {
                AppLogger.e(TAG, "linkGoogleAccount falhou", result.exceptionOrNull())
                _events.send(ConnectedAccountsEvent.ShowError(R.string.connected_accounts_link_error))
            }
            refreshProviders()
        }
    }

    /**
     * Desvincula conta Google (guard de método primário no repositório).
     */
    fun unlinkGoogleAccount() {
        val current = _uiState.value
        val providers = (current as? ConnectedAccountsUiState.Success)?.providers ?: emptyList()
        _uiState.value = ConnectedAccountsUiState.Success(providers, isUnlinking = true)
        viewModelScope.launch {
            val result = authRepository.unlinkGoogleAccount()
            if (result.isSuccess) {
                _events.send(ConnectedAccountsEvent.ShowSuccess(R.string.connected_accounts_unlink_success))
            } else {
                AppLogger.e(TAG, "unlinkGoogleAccount falhou", result.exceptionOrNull())
                val msgRes = if ((result.exceptionOrNull()?.message) == "app/require-primary-method") {
                    R.string.connected_accounts_cannot_unlink
                } else {
                    R.string.connected_accounts_unlink_error
                }
                _events.send(ConnectedAccountsEvent.ShowError(msgRes))
            }
            refreshProviders()
        }
    }

    companion object {
        private const val TAG = "ConnectedAccountsVM"
    }
}
