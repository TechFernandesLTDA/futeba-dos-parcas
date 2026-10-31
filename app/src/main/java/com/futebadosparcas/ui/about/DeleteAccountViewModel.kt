package com.futebadosparcas.ui.about

import androidx.annotation.StringRes
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.R
import com.futebadosparcas.data.repository.AuthRepository
import com.futebadosparcas.data.repository.BlockingGroup
import com.futebadosparcas.data.repository.DeleteAccountError
import com.futebadosparcas.data.repository.mapDeleteAccountError
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Estado do fluxo de exclusão de conta (#4391). */
data class DeleteAccountUiState(
    val isDeleting: Boolean = false,
    val isReauthenticating: Boolean = false,
    /** Grupos que bloqueiam a exclusão; não nulo = mostrar diálogo. */
    val blockingGroups: List<BlockingGroup>? = null,
    /** Precisa reautenticar; não nulo = mostrar diálogo com os provedores aceitos. */
    val reauthProviders: List<String>? = null,
    @StringRes val errorRes: Int? = null,
    @StringRes val reauthErrorRes: Int? = null,
    /** Conta excluída: a tela deve ir para o login. */
    val deleted: Boolean = false,
)

class DeleteAccountViewModel(
    private val authRepository: AuthRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(DeleteAccountUiState())
    val uiState: StateFlow<DeleteAccountUiState> = _uiState.asStateFlow()

    private var job: Job? = null

    fun deleteAccount() {
        job?.cancel()
        job = viewModelScope.launch { performDelete() }
    }

    private suspend fun performDelete() {
        _uiState.update {
            it.copy(isDeleting = true, errorRes = null, reauthErrorRes = null)
        }
        val result = authRepository.deleteAccount()
        if (result.isSuccess) {
            _uiState.update { it.copy(isDeleting = false, deleted = true) }
            return
        }
        when (val error = mapDeleteAccountError(result.exceptionOrNull() ?: Exception())) {
            is DeleteAccountError.RequiresRecentLogin -> _uiState.update {
                it.copy(
                    isDeleting = false,
                    reauthProviders = authRepository.getReauthProviders(),
                    isReauthenticating = false,
                )
            }
            is DeleteAccountError.SoleOwnerGroups -> _uiState.update {
                it.copy(isDeleting = false, blockingGroups = error.groups)
            }
            is DeleteAccountError.Generic -> _uiState.update {
                it.copy(isDeleting = false, errorRes = R.string.delete_account_error_generic)
            }
        }
    }

    /** Reautentica com um Google ID token e, se der certo, repete a exclusão. */
    fun reauthenticateWithGoogle(idToken: String) = reauthenticate {
        authRepository.reauthenticateWithGoogle(idToken)
    }

    /** Reautentica com a senha e, se der certo, repete a exclusão. */
    fun reauthenticateWithPassword(password: String) = reauthenticate {
        authRepository.reauthenticateWithPassword(password)
    }

    /** Falha ao obter o token do Google (não cancelamento). */
    fun onGoogleCredentialFailed() {
        _uiState.update { it.copy(reauthErrorRes = R.string.delete_account_reauth_google_error) }
    }

    private fun reauthenticate(block: suspend () -> Result<Unit>) {
        job?.cancel()
        job = viewModelScope.launch {
            _uiState.update { it.copy(isReauthenticating = true, reauthErrorRes = null) }
            val result = block()
            if (result.isSuccess) {
                _uiState.update { it.copy(isReauthenticating = false, reauthProviders = null) }
                performDelete()
            } else {
                _uiState.update {
                    it.copy(
                        isReauthenticating = false,
                        reauthErrorRes = R.string.delete_account_reauth_error,
                    )
                }
            }
        }
    }

    fun dismissReauth() {
        _uiState.update {
            it.copy(reauthProviders = null, reauthErrorRes = null, isReauthenticating = false)
        }
    }

    fun dismissBlockingGroups() {
        _uiState.update { it.copy(blockingGroups = null) }
    }

    fun dismissError() {
        _uiState.update { it.copy(errorRes = null) }
    }
}
