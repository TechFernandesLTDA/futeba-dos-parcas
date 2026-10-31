package com.futebadosparcas.ui.account

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.repository.AuthRepository
import com.futebadosparcas.platform.firebase.CallableException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Estados da exclusão de conta (#4391/#4401, App Store 5.1.1(v)).
 *
 * `Idle` é a tela de explicação + confirmação; `Deleting` bloqueia a interação;
 * `Deleted` dispara a navegação para o início (sessão já encerrada); `Error` traz o
 * motivo, porque cada um pede uma saída diferente para o usuário.
 */
sealed interface DeleteAccountUiState {
    data object Idle : DeleteAccountUiState
    data object Deleting : DeleteAccountUiState
    data object Deleted : DeleteAccountUiState
    data class Error(val reason: DeleteAccountError) : DeleteAccountUiState
}

enum class DeleteAccountError {
    /** `failed-precondition` / `unauthenticated`: login não recente ou sessão expirada. */
    RECENT_LOGIN_REQUIRED,

    /** `not-found`: callable ainda sem deploy; o caminho é a página web de exclusão. */
    BACKEND_UNAVAILABLE,

    /** Rede, timeout ou erro inesperado: tentar de novo. */
    GENERIC
}

/**
 * Chama a exclusão de conta e, só depois do sucesso, encerra a sessão local.
 *
 * O contrato da callable `deleteAccount` (southamerica-east1, sem payload, retorno
 * `{ success: true }`) está em `FirebaseDataSource.deleteAccount`. A função recebe a
 * operação como lambda para ser testável sem Firebase.
 */
class DeleteAccountViewModel(
    private val deleteAccount: suspend () -> Result<Unit>,
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<DeleteAccountUiState>(DeleteAccountUiState.Idle)
    val uiState: StateFlow<DeleteAccountUiState> = _uiState.asStateFlow()

    private var deleteJob: Job? = null

    fun confirmDeletion() {
        if (_uiState.value == DeleteAccountUiState.Deleting) return
        deleteJob?.cancel()
        deleteJob = viewModelScope.launch {
            _uiState.value = DeleteAccountUiState.Deleting
            val result = try {
                deleteAccount()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Result.failure(e)
            }
            result.fold(
                onSuccess = {
                    // A conta já não existe no servidor: logout local só limpa a sessão.
                    runCatching { authRepository.logout() }
                    _uiState.value = DeleteAccountUiState.Deleted
                },
                onFailure = { error ->
                    _uiState.value = DeleteAccountUiState.Error(classify(error))
                }
            )
        }
    }

    /** "Sair e entrar de novo": encerra a sessão para o usuário refazer o login. */
    fun signOutForReauthentication(onSignedOut: () -> Unit) {
        deleteJob?.cancel()
        deleteJob = viewModelScope.launch {
            runCatching { authRepository.logout() }
            onSignedOut()
        }
    }

    fun dismissError() {
        if (_uiState.value is DeleteAccountUiState.Error) {
            _uiState.value = DeleteAccountUiState.Idle
        }
    }

    override fun onCleared() {
        super.onCleared()
        deleteJob?.cancel()
    }

    internal companion object {
        fun classify(error: Throwable): DeleteAccountError =
            when ((error as? CallableException)?.code) {
                CallableException.FAILED_PRECONDITION,
                CallableException.UNAUTHENTICATED -> DeleteAccountError.RECENT_LOGIN_REQUIRED
                CallableException.NOT_FOUND -> DeleteAccountError.BACKEND_UNAVAILABLE
                else -> DeleteAccountError.GENERIC
            }
    }
}
