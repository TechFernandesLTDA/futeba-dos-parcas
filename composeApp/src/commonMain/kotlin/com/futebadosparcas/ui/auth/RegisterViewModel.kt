package com.futebadosparcas.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.repository.AuthRepository
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class RegisterViewModel(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _registerState = MutableStateFlow<RegisterState>(RegisterState.Idle)
    val registerState: StateFlow<RegisterState> = _registerState

    private var registerJob: Job? = null

    fun registerWithEmailAndPassword(email: String, password: String, name: String) {
        registerJob?.cancel()
        registerJob = viewModelScope.launch {
            _registerState.value = RegisterState.Loading
            // Cria a conta de autenticação; o documento do usuário (incl. nome) é
            // criado pela Cloud Function onUserCreated. Atualização de nome/perfil
            // é fluxo de profile separado.
            authRepository.signUp(email, password).fold(
                onSuccess = {
                    authRepository.getCurrentUser().fold(
                        onSuccess = { user -> _registerState.value = RegisterState.Success(user) },
                        onFailure = { error ->
                            _registerState.value = RegisterState.Error(
                                error.message ?: "Conta criada, mas falha ao carregar perfil"
                            )
                        }
                    )
                },
                onFailure = { error ->
                    _registerState.value = RegisterState.Error(
                        error.message ?: "Erro ao criar conta"
                    )
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
    data class Error(val message: String) : RegisterState()
}