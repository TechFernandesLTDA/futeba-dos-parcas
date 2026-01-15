package com.futebadosparcas.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel para o fluxo de login.
 *
 * Gerencia o estado de autenticacao e recupera os dados do usuario
 * apos o login com Google.
 */
@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _loginState = MutableStateFlow<LoginState>(LoginState.Idle)
    val loginState: StateFlow<LoginState> = _loginState

    /**
     * Verifica se ha um usuario logado e carrega seus dados.
     */
    fun checkExistingUser() {
        viewModelScope.launch {
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

    /**
     * Processa o sucesso do login com Google.
     * Recupera os dados do usuario do repositorio.
     */
    fun onGoogleSignInSuccess() {
        viewModelScope.launch {
            android.util.Log.d(TAG, "=== onGoogleSignInSuccess called ===")
            _loginState.value = LoginState.Loading

            android.util.Log.d(TAG, "Calling authRepository.getCurrentUser()")
            val result = authRepository.getCurrentUser()
            result.fold(
                onSuccess = { user ->
                    android.util.Log.d(TAG, "getCurrentUser SUCCESS - User: ${user.name} (${user.email})")
                    _loginState.value = LoginState.Success(user)
                },
                onFailure = { error ->
                    android.util.Log.e(TAG, "getCurrentUser FAILURE: ${error.message}", error)
                    _loginState.value = LoginState.Error(
                        error.message ?: "Erro ao fazer login"
                    )
                }
            )
        }
    }

    /**
     * Processa erro no login com Google.
     */
    fun onGoogleSignInError(message: String) {
        _loginState.value = LoginState.Error(message)
    }

    /**
     * Reseta o estado para Idle.
     */
    fun resetState() {
        _loginState.value = LoginState.Idle
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

    /** Erro no login */
    data class Error(val message: String) : LoginState()
}
