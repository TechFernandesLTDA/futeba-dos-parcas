package com.futebadosparcas.ui.auth

import androidx.lifecycle.ViewModel
import com.futebadosparcas.data.model.User
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject

/**
 * ViewModel para o fluxo de registro.
 *
 * Nota: O registro agora e feito via Google Sign-In.
 * Este ViewModel e mantido para compatibilidade futura.
 */
@HiltViewModel
class RegisterViewModel @Inject constructor() : ViewModel() {

    private val _registerState = MutableStateFlow<RegisterState>(RegisterState.Idle)
    val registerState: StateFlow<RegisterState> = _registerState

    /**
     * Reseta o estado para Idle.
     */
    fun resetState() {
        _registerState.value = RegisterState.Idle
    }
}

/**
 * Estados do fluxo de registro.
 */
sealed class RegisterState {
    /** Estado inicial */
    object Idle : RegisterState()

    /** Processando registro */
    object Loading : RegisterState()

    /** Registro realizado com sucesso */
    data class Success(val user: User) : RegisterState()

    /** Erro no registro */
    data class Error(val message: String) : RegisterState()
}
