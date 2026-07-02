package com.futebadosparcas.ui.auth

import androidx.annotation.StringRes
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.R
import com.futebadosparcas.data.repository.AuthRepository as AndroidAuthRepository
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.repository.AuthRepository
import com.futebadosparcas.util.AppLogger
import com.futebadosparcas.util.AuthErrorMapper
import com.google.firebase.auth.FirebaseAuthException
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class LoginViewModel(
    private val authRepository: AuthRepository,
    private val androidAuthRepository: AndroidAuthRepository
) : ViewModel() {

    private val _loginState = MutableStateFlow<LoginState>(LoginState.Idle)
    val loginState: StateFlow<LoginState> = _loginState

    // Estado dedicado do fluxo de recuperação de senha (#3184):
    // não polui o _loginState (que controla a navegação/loading do login)
    private val _resetState = MutableStateFlow<ResetState>(ResetState.Idle)
    val resetState: StateFlow<ResetState> = _resetState

    private var loginJob: Job? = null
    private var resetJob: Job? = null

    fun checkExistingUser() {
        loginJob?.cancel()
        loginJob = viewModelScope.launch {
            if (authRepository.isLoggedIn()) {
                val result = authRepository.getCurrentUser()
                result.fold(
                    onSuccess = { user ->
                        _loginState.value = LoginState.Success(user)
                    },
                    onFailure = {
                        _loginState.value = LoginState.Idle
                    }
                )
            }
        }
    }

    fun onGoogleSignInSuccess() {
        loginJob?.cancel()
        loginJob = viewModelScope.launch {
            AppLogger.d(TAG) { "=== onGoogleSignInSuccess called ===" }
            _loginState.value = LoginState.Loading

            AppLogger.d(TAG) { "Calling authRepository.getCurrentUser()" }
            val result = authRepository.getCurrentUser()
            result.fold(
                onSuccess = { user ->
                    AppLogger.d(TAG) { "getCurrentUser SUCCESS - userId: ${user.id}" }
                    _loginState.value = LoginState.Success(user)
                },
                onFailure = { error ->
                    AppLogger.e(TAG, "getCurrentUser FAILURE: ${error.message}", error)
                    _loginState.value = LoginState.Error(AuthErrorMapper.mapAuthError(error))
                }
            )
        }
    }

    fun signInWithEmailAndPassword(email: String, password: String) {
        loginJob?.cancel()
        loginJob = viewModelScope.launch {
            _loginState.value = LoginState.Loading
            val result = androidAuthRepository.signInWithEmailAndPassword(email, password)
            result.fold(
                onSuccess = { user ->
                    _loginState.value = LoginState.Success(user)
                },
                onFailure = { error ->
                    // Mapeia o erro bruto do Firebase para mensagem amigável PT-BR (#3184)
                    _loginState.value = LoginState.Error(AuthErrorMapper.mapAuthError(error))
                }
            )
        }
    }

    /**
     * Envia email de recuperação de senha.
     *
     * Anti-enumeração: em caso de falha, emitimos [ResetState.EmailSent] mesmo assim
     * (espelha o comportamento da tela de recuperação do web), EXCETO quando o erro
     * é de formato de email inválido — nesse caso o usuário precisa corrigir o input.
     */
    fun sendPasswordResetEmail(email: String) {
        resetJob?.cancel()
        resetJob = viewModelScope.launch {
            _resetState.value = ResetState.Loading
            val result = androidAuthRepository.sendPasswordResetEmail(email)
            result.fold(
                onSuccess = {
                    _resetState.value = ResetState.EmailSent
                },
                onFailure = { error ->
                    val errorCode = (error as? FirebaseAuthException)?.errorCode
                    _resetState.value = if (errorCode == "ERROR_INVALID_EMAIL") {
                        ResetState.Error(R.string.auth_error_invalid_email)
                    } else {
                        // Não revelar se o email existe ou não na base
                        ResetState.EmailSent
                    }
                }
            )
        }
    }

    fun onGoogleSignInError(@StringRes errorResId: Int) {
        _loginState.value = LoginState.Error(errorResId)
    }

    fun resetState() {
        _loginState.value = LoginState.Idle
    }

    /** Consome o estado de recuperação de senha após exibir o feedback na UI. */
    fun consumeResetState() {
        _resetState.value = ResetState.Idle
    }

    override fun onCleared() {
        super.onCleared()
        loginJob?.cancel()
        resetJob?.cancel()
    }

    private companion object {
        private const val TAG = "LoginViewModel"
    }
}

/**
 * Estados do fluxo de login.
 */
sealed class LoginState {
    /** Estado inicial */
    object Idle : LoginState()

    /** Carregando dados do usuario */
    object Loading : LoginState()

    /** Login realizado com sucesso */
    data class Success(val user: User) : LoginState()

    /** Erro no login - resolvido na UI via stringResource */
    data class Error(@StringRes val errorResId: Int) : LoginState()
}

/**
 * Estados do fluxo de recuperação de senha (#3184).
 */
sealed class ResetState {
    /** Estado inicial */
    object Idle : ResetState()

    /** Enviando email de recuperação */
    object Loading : ResetState()

    /** Email enviado (ou falha mascarada por anti-enumeração) */
    object EmailSent : ResetState()

    /** Erro de input (ex: email com formato inválido) */
    data class Error(@StringRes val errorResId: Int) : ResetState()
}
