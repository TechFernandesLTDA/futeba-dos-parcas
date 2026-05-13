package com.futebadosparcas.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.repository.AuthRepository as AndroidAuthRepository
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.repository.AuthRepository
import com.futebadosparcas.util.AppLogger
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
                    _loginState.value = LoginState.Error(
                        error.message ?: "Erro ao fazer login"
                    )
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
                    _loginState.value = LoginState.Error(
                        error.message ?: "Erro ao fazer login"
                    )
                }
            )
        }
    }

    fun sendPasswordResetEmail(email: String) {
        viewModelScope.launch {
            androidAuthRepository.sendPasswordResetEmail(email)
        }
    }

    fun onGoogleSignInError(message: String) {
        _loginState.value = LoginState.Error(message)
    }

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
