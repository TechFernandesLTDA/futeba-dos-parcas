package com.futebadosparcas.ui.core

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.GroupInvite
import com.futebadosparcas.domain.model.GroupMember
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.repository.GroupRepository
import com.futebadosparcas.domain.repository.InviteRepository
import com.futebadosparcas.domain.repository.UserRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

// Estados da tela
sealed class SearchUsersState {
    object Idle : SearchUsersState()
    object Loading : SearchUsersState()
    data class Success(val users: List<User>) : SearchUsersState()
    data class Error(val message: String) : SearchUsersState()
    object Empty : SearchUsersState()
}

sealed class GroupPendingInvitesState {
    object Idle : GroupPendingInvitesState()
    object Loading : GroupPendingInvitesState()
    data class Success(val invites: List<GroupInvite>) : GroupPendingInvitesState()
    data class Error(val message: String) : GroupPendingInvitesState()
}

sealed class GroupMembersState {
    object Idle : GroupMembersState()
    object Loading : GroupMembersState()
    data class Success(val members: List<GroupMember>) : GroupMembersState()
    data class Error(val message: String) : GroupMembersState()
}

sealed class InviteActionState {
    object Idle : InviteActionState()
    data class InviteSent(val message: String) : InviteActionState()
    data class Error(val message: String) : InviteActionState()
}

class InviteViewModel(
    private val userRepository: UserRepository,
    private val inviteRepository: InviteRepository,
    private val groupRepository: GroupRepository
) : ViewModel() {

    private val _searchUsersState = MutableStateFlow<SearchUsersState>(SearchUsersState.Idle)
    val searchUsersState: StateFlow<SearchUsersState> = _searchUsersState.asStateFlow()

    private val _groupPendingInvitesState = MutableStateFlow<GroupPendingInvitesState>(GroupPendingInvitesState.Idle)
    val groupPendingInvitesState: StateFlow<GroupPendingInvitesState> = _groupPendingInvitesState.asStateFlow()

    private val _groupMembersState = MutableStateFlow<GroupMembersState>(GroupMembersState.Idle)
    val groupMembersState: StateFlow<GroupMembersState> = _groupMembersState.asStateFlow()

    private val _inviteActionState = MutableStateFlow<InviteActionState>(InviteActionState.Idle)
    val inviteActionState: StateFlow<InviteActionState> = _inviteActionState.asStateFlow()

    fun searchUsers(query: String) {
        viewModelScope.launch {
            _searchUsersState.value = SearchUsersState.Loading
            val result = userRepository.searchUsers(query)
            result.fold(
                onSuccess = { users ->
                    _searchUsersState.value = if (users.isEmpty()) {
                        SearchUsersState.Empty
                    } else {
                        SearchUsersState.Success(users)
                    }
                },
                onFailure = { e ->
                    _searchUsersState.value = SearchUsersState.Error(
                        e.message ?: "Erro ao buscar usuários"
                    )
                }
            )
        }
    }

    fun loadGroupPendingInvites(groupId: String) {
        viewModelScope.launch {
            _groupPendingInvitesState.value = GroupPendingInvitesState.Loading
            val result = inviteRepository.getGroupPendingInvites(groupId)
            result.fold(
                onSuccess = { invites ->
                    _groupPendingInvitesState.value = GroupPendingInvitesState.Success(invites)
                },
                onFailure = { e ->
                    _groupPendingInvitesState.value = GroupPendingInvitesState.Error(
                        e.message ?: "Erro ao carregar convites pendentes"
                    )
                }
            )
        }
    }

    fun loadGroupMembers(groupId: String) {
        viewModelScope.launch {
            _groupMembersState.value = GroupMembersState.Loading
            val result = groupRepository.getGroupMembers(groupId)
            result.fold(
                onSuccess = { members ->
                    _groupMembersState.value = GroupMembersState.Success(members)
                },
                onFailure = { e ->
                    _groupMembersState.value = GroupMembersState.Error(
                        e.message ?: "Erro ao carregar membros do grupo"
                    )
                }
            )
        }
    }

    fun inviteUser(groupId: String, invitedUserId: String) {
        viewModelScope.launch {
            val result = inviteRepository.createInvite(groupId, invitedUserId)
            result.fold(
                onSuccess = {
                    _inviteActionState.value = InviteActionState.InviteSent("Convite enviado com sucesso!")
                },
                onFailure = { e ->
                    _inviteActionState.value = InviteActionState.Error(
                        e.message ?: "Erro ao enviar convite"
                    )
                }
            )
        }
    }

    fun resetActionState() {
        _inviteActionState.value = InviteActionState.Idle
    }
}