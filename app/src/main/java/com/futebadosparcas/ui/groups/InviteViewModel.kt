package com.futebadosparcas.ui.groups

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.GroupInvite
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.data.repository.GroupRepository
import com.futebadosparcas.domain.repository.InviteRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.util.toAndroidLocation
import com.futebadosparcas.util.toAndroidField
import com.futebadosparcas.util.toAndroidFields
import com.futebadosparcas.util.toAndroidLocationReview
import com.futebadosparcas.util.toAndroidLocationReviews
import com.futebadosparcas.util.toAndroidCashboxEntry
import com.futebadosparcas.util.toAndroidCashboxEntries
import com.futebadosparcas.util.toAndroidGroupInvites
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch

class InviteViewModel(
    private val inviteRepository: InviteRepository,
    private val userRepository: UserRepository,
    private val groupRepository: GroupRepository
) : ViewModel() {

    companion object {
        private const val SEARCH_DEBOUNCE_MS = 300L
    }

    // Job tracking para cancelar buscas anteriores
    private var searchJob: Job? = null

    private val _pendingInvitesState = MutableStateFlow<PendingInvitesState>(PendingInvitesState.Loading)
    val pendingInvitesState: StateFlow<PendingInvitesState> = _pendingInvitesState

    private val _searchUsersState = MutableStateFlow<SearchUsersState>(SearchUsersState.Idle)
    val searchUsersState: StateFlow<SearchUsersState> = _searchUsersState

    private val _inviteActionState = MutableStateFlow<InviteActionState>(InviteActionState.Idle)
    val inviteActionState: StateFlow<InviteActionState> = _inviteActionState

    private val _pendingCount = MutableStateFlow(0)
    val pendingCount: StateFlow<Int> = _pendingCount
    
    // Estados para convites pendentes do grupo
    private val _groupPendingInvitesState = MutableStateFlow<GroupPendingInvitesState>(GroupPendingInvitesState.Idle)
    val groupPendingInvitesState: StateFlow<GroupPendingInvitesState> = _groupPendingInvitesState
    
    // Estados para membros do grupo
    private val _groupMembersState = MutableStateFlow<GroupMembersState>(GroupMembersState.Idle)
    val groupMembersState: StateFlow<GroupMembersState> = _groupMembersState

    init {
        observePendingInvites()
    }

    private fun observePendingInvites() {
        inviteRepository.getMyPendingInvitesFlow()
            .onEach { kmpInvites ->
                val invites = kmpInvites.toAndroidGroupInvites()
                _pendingCount.value = invites.size
                _pendingInvitesState.value = if (invites.isEmpty()) {
                    PendingInvitesState.Empty
                } else {
                    PendingInvitesState.Success(invites)
                }
            }
            .catch { e ->
                _pendingInvitesState.value = PendingInvitesState.Error(
                    e.message ?: "Erro ao carregar convites"
                )
            }
            .launchIn(viewModelScope)
    }

    fun loadPendingInvites() {
        viewModelScope.launch {
            _pendingInvitesState.value = PendingInvitesState.Loading

            val result = inviteRepository.getMyPendingInvites()

            result.fold(
                onSuccess = { kmpInvites ->
                    val invites = kmpInvites.toAndroidGroupInvites()
                    _pendingCount.value = invites.size
                    _pendingInvitesState.value = if (invites.isEmpty()) {
                        PendingInvitesState.Empty
                    } else {
                        PendingInvitesState.Success(invites)
                    }
                },
                onFailure = { error ->
                    _pendingInvitesState.value = PendingInvitesState.Error(
                        error.message ?: "Erro ao carregar convites"
                    )
                }
            )
        }
    }

    /**
     * Busca usuários com debounce para evitar requisições excessivas.
     * Cancela buscas anteriores antes de iniciar uma nova.
     */
    fun searchUsers(query: String) {
        // Cancelar busca anterior para evitar race conditions
        searchJob?.cancel()

        searchJob = viewModelScope.launch {
            // Debounce: aguardar antes de executar a busca
            delay(SEARCH_DEBOUNCE_MS)

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
                onFailure = { error ->
                    _searchUsersState.value = SearchUsersState.Error(
                        error.message ?: "Erro ao buscar jogadores"
                    )
                }
            )
        }
    }

    fun inviteUser(groupId: String, userId: String) {
        viewModelScope.launch {
            _inviteActionState.value = InviteActionState.Loading

            val result = inviteRepository.createInvite(groupId, userId)

            result.fold(
                onSuccess = { invite ->
                    _inviteActionState.value = InviteActionState.InviteSent(
                        "Convite enviado para ${invite.invitedUserName}"
                    )
                },
                onFailure = { error ->
                    _inviteActionState.value = InviteActionState.Error(
                        error.message ?: "Erro ao enviar convite"
                    )
                }
            )
        }
    }

    fun acceptInvite(inviteId: String) {
        viewModelScope.launch {
            _inviteActionState.value = InviteActionState.Loading

            val result = inviteRepository.acceptInvite(inviteId)

            result.fold(
                onSuccess = {
                    _inviteActionState.value = InviteActionState.InviteAccepted(
                        "Você entrou no grupo!"
                    )
                },
                onFailure = { error ->
                    _inviteActionState.value = InviteActionState.Error(
                        error.message ?: "Erro ao aceitar convite"
                    )
                }
            )
        }
    }

    fun declineInvite(inviteId: String) {
        viewModelScope.launch {
            _inviteActionState.value = InviteActionState.Loading

            val result = inviteRepository.declineInvite(inviteId)

            result.fold(
                onSuccess = {
                    _inviteActionState.value = InviteActionState.InviteDeclined(
                        "Convite recusado"
                    )
                },
                onFailure = { error ->
                    _inviteActionState.value = InviteActionState.Error(
                        error.message ?: "Erro ao recusar convite"
                    )
                }
            )
        }
    }

    fun cancelInvite(inviteId: String) {
        viewModelScope.launch {
            _inviteActionState.value = InviteActionState.Loading

            val result = inviteRepository.cancelInvite(inviteId)

            result.fold(
                onSuccess = {
                    _inviteActionState.value = InviteActionState.InviteCancelled(
                        "Convite cancelado"
                    )
                },
                onFailure = { error ->
                    _inviteActionState.value = InviteActionState.Error(
                        error.message ?: "Erro ao cancelar convite"
                    )
                }
            )
        }
    }

    fun resetActionState() {
        _inviteActionState.value = InviteActionState.Idle
    }
    
    /**
     * Carrega convites pendentes de um grupo específico
     */
    fun loadGroupPendingInvites(groupId: String) {
        viewModelScope.launch {
            _groupPendingInvitesState.value = GroupPendingInvitesState.Loading

            val result = inviteRepository.getGroupPendingInvites(groupId)

            result.fold(
                onSuccess = { kmpInvites ->
                    val invites = kmpInvites.toAndroidGroupInvites()
                    _groupPendingInvitesState.value = GroupPendingInvitesState.Success(invites)
                },
                onFailure = { error ->
                    _groupPendingInvitesState.value = GroupPendingInvitesState.Error(
                        error.message ?: "Erro ao carregar convites pendentes"
                    )
                }
            )
        }
    }
    
    /**
     * Carrega membros de um grupo específico
     */
    fun loadGroupMembers(groupId: String) {
        viewModelScope.launch {
            _groupMembersState.value = GroupMembersState.Loading
            
            val result = groupRepository.getGroupMembers(groupId)
            
            result.fold(
                onSuccess = { members ->
                    _groupMembersState.value = GroupMembersState.Success(members)
                },
                onFailure = { error ->
                    _groupMembersState.value = GroupMembersState.Error(
                        error.message ?: "Erro ao carregar membros do grupo"
                    )
                }
            )
        }
    }

    fun clearSearch() {
        searchJob?.cancel()
        _searchUsersState.value = SearchUsersState.Idle
    }

    override fun onCleared() {
        super.onCleared()
        searchJob?.cancel()
    }
}

sealed class PendingInvitesState {
    object Loading : PendingInvitesState()
    object Empty : PendingInvitesState()
    data class Success(val invites: List<GroupInvite>) : PendingInvitesState()
    data class Error(val message: String) : PendingInvitesState()
}

sealed class SearchUsersState {
    object Idle : SearchUsersState()
    object Loading : SearchUsersState()
    object Empty : SearchUsersState()
    data class Success(val users: List<User>) : SearchUsersState()
    data class Error(val message: String) : SearchUsersState()
}

sealed class InviteActionState {
    object Idle : InviteActionState()
    object Loading : InviteActionState()
    data class InviteSent(val message: String) : InviteActionState()
    data class InviteAccepted(val message: String) : InviteActionState()
    data class InviteDeclined(val message: String) : InviteActionState()
    data class InviteCancelled(val message: String) : InviteActionState()
    data class Error(val message: String) : InviteActionState()
}

sealed class GroupPendingInvitesState {
    object Idle : GroupPendingInvitesState()
    object Loading : GroupPendingInvitesState()
    data class Success(val invites: List<com.futebadosparcas.data.model.GroupInvite>) : GroupPendingInvitesState()
    data class Error(val message: String) : GroupPendingInvitesState()
}

sealed class GroupMembersState {
    object Idle : GroupMembersState()
    object Loading : GroupMembersState()
    data class Success(val members: List<com.futebadosparcas.data.model.GroupMember>) : GroupMembersState()
    data class Error(val message: String) : GroupMembersState()
}
