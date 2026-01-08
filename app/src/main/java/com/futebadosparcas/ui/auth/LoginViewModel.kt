package com.futebadosparcas.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.User
import com.futebadosparcas.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _loginState = MutableStateFlow<LoginState>(LoginState.Idle)
    val loginState: StateFlow<LoginState> = _loginState

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

    fun onGoogleSignInSuccess() {
        viewModelScope.launch {
            android.util.Log.d("LoginViewModel", "=== onGoogleSignInSuccess called ===")
            _loginState.value = LoginState.Loading

            android.util.Log.d("LoginViewModel", "Calling authRepository.getCurrentUser()")
            val result = authRepository.getCurrentUser()
            result.fold(
                onSuccess = { user ->
                    android.util.Log.d("LoginViewModel", "getCurrentUser SUCCESS - User: ${user.name} (${user.email})")
                    _loginState.value = LoginState.Success(user)
                },
                onFailure = { error ->
                    android.util.Log.e("LoginViewModel", "getCurrentUser FAILURE: ${error.message}", error)
                    _loginState.value = LoginState.Error(error.message ?: "Erro ao fazer login")
                }
            )
        }
    }

    fun onGoogleSignInError(message: String) {
        _loginState.value = LoginState.Error(message)
    }

    fun resetState() {
        _loginState.value = LoginState.Idle
    }
}

sealed class LoginState {
    object Idle : LoginState()
    object Loading : LoginState()
    data class Success(val user: User) : LoginState()
    data class Error(val message: String) : LoginState()
}
