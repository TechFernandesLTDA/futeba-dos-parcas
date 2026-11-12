package com.futebadosparcas.ui.core

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.repository.AuthRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/**
 * ViewModel da tela de login, portado para KMP.
 * Utiliza apenas AuthRepository (compartilhado) para verificação de estado e obtenção de usuário.
 */
class LoginViewModel(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _loginState = MutableStateFlow<LoginState>(LoginState.Idle)
    val loginState: StateFlow<LoginState> = _loginState

    private val _passwordResetMessage = MutableStateFlow<String?>(null)
    val passwordResetMessage: StateFlow<String?> = _passwordResetMessage

    private var loginJob: Job? = null

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
            // log: onGoogleSignInSuccess called
            _loginState.value = LoginState.Loading

            // log: Calling authRepository.getCurrentUser()
            val result = authRepository.getCurrentUser()
            result.fold(
                onSuccess = { user ->
                    // log: getCurrentUser SUCCESS - userId: ${user.id}
                    _loginState.value = LoginState.Success(user)
                },
                onFailure = { error ->
                    // log: getCurrentUser FAILURE: ${error.message}
                    _loginState.value = LoginState.Error(
                        friendlyAuthError(error.message, "Erro ao fazer login")
                    )
                }
            )
        }
    }

    /**
     * Tenta fazer login com email e senha via contrato KMP AuthRepository.
     */
    fun signInWithEmailAndPassword(email: String, password: String) {
        loginJob?.cancel()
        loginJob = viewModelScope.launch {
            _loginState.value = LoginState.Loading
            authRepository.signIn(email, password).fold(
                onSuccess = {
                    authRepository.getCurrentUser().fold(
                        onSuccess = { user -> _loginState.value = LoginState.Success(user) },
                        onFailure = { error ->
                            _loginState.value = LoginState.Error(
                                friendlyAuthError(error.message, "Login efetuado, mas falha ao carregar perfil")
                            )
                        }
                    )
                },
                onFailure = { error ->
                    _loginState.value = LoginState.Error(
                        friendlyAuthError(error.message, "Erro ao fazer login")
                    )
                }
            )
        }
    }

    fun sendPasswordResetEmail(email: String) {
        val trimmed = email.trim()
        if (trimmed.isBlank()) {
            _loginState.value = LoginState.Error("Informe seu e-mail para recuperar a senha.")
            return
        }
        loginJob?.cancel()
        loginJob = viewModelScope.launch {
            _passwordResetMessage.value = null
            _loginState.value = LoginState.Loading
            authRepository.sendPasswordResetEmail(trimmed).fold(
                onSuccess = {
                    _loginState.value = LoginState.Idle
                    _passwordResetMessage.value =
                        "E-mail de redefinição enviado para $trimmed. Verifique sua caixa de entrada."
                },
                onFailure = { error ->
                    _loginState.value = LoginState.Error(
                        friendlyAuthError(error.message, "Não foi possível enviar o e-mail de recuperação.")
                    )
                }
            )
        }
    }

    fun onGoogleSignInUnavailable() {
        _passwordResetMessage.value = null
        _loginState.value = LoginState.Error(
            "O login com Google ainda não está configurado no iOS. Entre com e-mail e senha ou crie uma conta."
        )
    }

    fun clearPasswordResetMessage() {
        _passwordResetMessage.value = null
    }

    fun onGoogleSignInError(message: String) {
        _loginState.value = LoginState.Error(message)
    }

    fun resetState() {
        _passwordResetMessage.value = null
        _loginState.value = LoginState.Idle
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

    /** Erro no login */
    data class Error(val message: String) : LoginState()
}