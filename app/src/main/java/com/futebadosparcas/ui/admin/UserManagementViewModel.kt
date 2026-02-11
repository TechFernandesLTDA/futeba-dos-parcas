package com.futebadosparcas.ui.admin

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.repository.UserRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class UserManagementViewModel @Inject constructor(
    private val userRepository: UserRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<UserManagementUiState>(UserManagementUiState.Loading)
    val uiState: StateFlow<UserManagementUiState> = _uiState

    private var allUsers: List<User> = emptyList()

    // Rastrear jobs para cancelamento adequado
    private var loadJob: Job? = null
    private var updateRoleJob: Job? = null

    init {
        loadUsers()
    }

    fun loadUsers() {
        // Cancelar carregamento anterior para evitar race conditions
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            _uiState.value = UserManagementUiState.Loading
            userRepository.getAllUsers().fold(
                onSuccess = { users ->
                    allUsers = users
                    _uiState.value = if (users.isEmpty()) {
                        UserManagementUiState.Empty
                    } else {
                        UserManagementUiState.Success(users)
                    }
                },
                onFailure = { error ->
                    _uiState.value = UserManagementUiState.Error(error.message ?: "Erro ao carregar usuários")
                }
            )
        }
    }

    fun searchUsers(query: String) {
        if (query.isBlank()) {
            _uiState.value = if (allUsers.isEmpty()) {
                UserManagementUiState.Empty
            } else {
                UserManagementUiState.Success(allUsers)
            }
            return
        }
        val lowerQuery = query.lowercase().trim()
        val filtered = allUsers.filter {
            it.name.lowercase().contains(lowerQuery) ||
            it.email.lowercase().contains(lowerQuery)
        }
        _uiState.value = if (filtered.isEmpty()) {
            UserManagementUiState.Empty
        } else {
            UserManagementUiState.Success(filtered)
        }
    }

    fun updateUserRole(user: User, newRole: String) {
        // Validar role antes de enviar para o backend
        val validRoles = setOf("ADMIN", "PLAYER", "MODERATOR")
        if (newRole !in validRoles) {
            _uiState.value = UserManagementUiState.Error("Role inválida: $newRole")
            return
        }

        // Cancelar atualização anterior para evitar race conditions
        updateRoleJob?.cancel()
        updateRoleJob = viewModelScope.launch {
            userRepository.updateUserRole(user.id, newRole).fold(
                onSuccess = {
                    loadUsers() // Recarregar para refletir mudanças
                },
                onFailure = { error ->
                    _uiState.value = UserManagementUiState.Error(error.message ?: "Erro ao atualizar permissão")
                }
            )
        }
    }

    override fun onCleared() {
        super.onCleared()
        loadJob?.cancel()
        updateRoleJob?.cancel()
    }
}

sealed class UserManagementUiState {
    object Loading : UserManagementUiState()
    object Empty : UserManagementUiState()
    data class Success(val users: List<User>) : UserManagementUiState()
    data class Error(val message: String) : UserManagementUiState()
}
