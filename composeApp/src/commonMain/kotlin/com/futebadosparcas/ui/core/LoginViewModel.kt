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
                        error.message ?: "Erro ao fazer login"
                    )
                }
            )
        }
    }

    /**
     * Tenta fazer login com email e senha.
     * @note O contrato KMP de AuthRepository não expõe signInWithEmailAndPassword,
     *        portanto retorna erro informativo.
     */
    fun signInWithEmailAndPassword(email: String, password: String) {
        loginJob?.cancel()
        loginJob = viewModelScope.launch {
            _loginState.value = LoginState.Loading
            // log: signInWithEmailAndPassword not implemented
            _loginState.value = LoginState.Error(
                "Login por email/senha ainda não disponível nesta versão."
            )
        }
    }

    fun sendPasswordResetEmail(email: String) {
        // log: sendPasswordResetEmail not available in KMP AuthRepository
        // Sem efeito no momento.
    }

    fun onGoogleSignInError(message: String) {
        _loginState.value = LoginState.Error(message)
    }

    fun resetState() {
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