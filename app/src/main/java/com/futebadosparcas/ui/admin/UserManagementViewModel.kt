package com.futebadosparcas.ui.admin

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.repository.UserRepository
import dagger.hilt.android.lifecycle.HiltViewModel
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

    init {
        loadUsers()
    }

    fun loadUsers() {
        viewModelScope.launch {
            _uiState.value = UserManagementUiState.Loading
            userRepository.getAllUsers().fold(
                onSuccess = { users ->
                    allUsers = users
                    _uiState.value = UserManagementUiState.Success(users)
                },
                onFailure = { error ->
                    _uiState.value = UserManagementUiState.Error(error.message ?: "Erro ao carregar usuários")
                }
            )
        }
    }

    fun searchUsers(query: String) {
        if (query.isBlank()) {
            _uiState.value = UserManagementUiState.Success(allUsers)
            return
        }
        val filtered = allUsers.filter {
            it.name.contains(query, ignoreCase = true) ||
            it.email.contains(query, ignoreCase = true)
        }
        _uiState.value = UserManagementUiState.Success(filtered)
    }

    fun updateUserRole(user: User, newRole: String) {
        viewModelScope.launch {
            userRepository.updateUserRole(user.id, newRole).fold(
                onSuccess = {
                    loadUsers() // Reload to reflect changes
                },
                onFailure = { error ->
                    _uiState.value = UserManagementUiState.Error(error.message ?: "Erro ao atualizar permissão")
                }
            )
        }
    }
}

sealed class UserManagementUiState {
    object Loading : UserManagementUiState()
    data class Success(val users: List<User>) : UserManagementUiState()
    data class Error(val message: String) : UserManagementUiState()
}
