package com.futebadosparcas.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.User
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class RegisterViewModel(
    // TODO: FALTA_CONTRATO — AuthRepository não expõe criação de conta no contrato atual.
    // Idealmente usar authRepository.createUserWithEmailAndPassword(email, password, name)
    // Por enquanto, a chamada real é substituída por TODO.
) : ViewModel() {

    private val _registerState = MutableStateFlow<RegisterState>(RegisterState.Idle)
    val registerState: StateFlow<RegisterState> = _registerState

    private var registerJob: Job? = null

    fun registerWithEmailAndPassword(email: String, password: String, name: String) {
        registerJob?.cancel()
        registerJob = viewModelScope.launch {
            _registerState.value = RegisterState.Loading
            TODO("FALTA_CONTRATO: AuthRepository.createUserWithEmailAndPassword não disponível")
            // Exemplo do que seria a chamada com a interface desejada:
            // val result = authRepository.createUserWithEmailAndPassword(email, password, name)
            // result.fold(
            //     onSuccess = { user -> _registerState.value = RegisterState.Success(user) },
            //     onFailure = { error -> _registerState.value = RegisterState.Error(error.message ?: "Erro ao criar conta") }
            // )
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