package com.futebadosparcas.ui.auth

import androidx.annotation.StringRes
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.repository.AuthRepository as AndroidAuthRepository
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.util.AuthErrorMapper
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class RegisterViewModel(
    private val androidAuthRepository: AndroidAuthRepository
) : ViewModel() {

    private val _registerState = MutableStateFlow<RegisterState>(RegisterState.Idle)
    val registerState: StateFlow<RegisterState> = _registerState

    private var registerJob: Job? = null

    fun registerWithEmailAndPassword(email: String, password: String, name: String) {
        registerJob?.cancel()
        registerJob = viewModelScope.launch {
            _registerState.value = RegisterState.Loading
            val normalizedEmail = email.trim().lowercase()
            val result = androidAuthRepository.createUserWithEmailAndPassword(normalizedEmail, password, name)
            result.fold(
                onSuccess = { user ->
                    _registerState.value = RegisterState.Success(user)
                },
                onFailure = { error ->
                    // Mapeia o erro bruto do Firebase para mensagem amigável PT-BR (#3184)
                    _registerState.value = RegisterState.Error(AuthErrorMapper.mapAuthError(error))
                }
            )
        }
    }

    fun resetState() {
        _registerState.value = RegisterState.Idle
    }

    override fun onCleared() {
        super.onCleared()
        registerJob?.cancel()
    }
}

sealed class RegisterState {
    object Idle : RegisterState()
    object Loading : RegisterState()
    data class Success(val user: User) : RegisterState()

    /** Erro no registro - resolvido na UI via stringResource */
    data class Error(@StringRes val errorResId: Int) : RegisterState()
}
