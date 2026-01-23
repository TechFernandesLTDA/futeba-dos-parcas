package com.futebadosparcas.ui.groups

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.Group
import com.futebadosparcas.data.model.GroupMember
import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.data.model.UserGroup
import com.futebadosparcas.data.repository.GroupRepository
import com.futebadosparcas.domain.usecase.group.ArchiveGroupUseCase
import com.futebadosparcas.domain.usecase.group.CreateGroupUseCase
import com.futebadosparcas.domain.usecase.group.DeleteGroupUseCase
import com.futebadosparcas.domain.usecase.group.GetGroupsUseCase
import com.futebadosparcas.domain.usecase.group.LeaveGroupParams
import com.futebadosparcas.domain.usecase.group.LeaveGroupUseCase
import com.futebadosparcas.domain.usecase.group.ManageMembersUseCase
import com.futebadosparcas.domain.usecase.group.TransferOwnershipUseCase
import com.futebadosparcas.domain.usecase.group.UpdateGroupUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class GroupsViewModel @Inject constructor(
    private val groupRepository: GroupRepository,
    private val createGroupUseCase: CreateGroupUseCase,
    private val updateGroupUseCase: UpdateGroupUseCase,
    private val archiveGroupUseCase: ArchiveGroupUseCase,
    private val deleteGroupUseCase: DeleteGroupUseCase,
    private val leaveGroupUseCase: LeaveGroupUseCase,
    private val manageMembersUseCase: ManageMembersUseCase,
    private val transferOwnershipUseCase: TransferOwnershipUseCase,
    private val getGroupsUseCase: GetGroupsUseCase
) : ViewModel() {

    // Estado da lista de grupos
    private val _uiState = MutableStateFlow<GroupsUiState>(GroupsUiState.Loading)
    val uiState: StateFlow<GroupsUiState> = _uiState.asStateFlow()

    // Estado de criação de grupo
    private val _createGroupState = MutableStateFlow<CreateGroupUiState>(CreateGroupUiState.Idle)
    val createGroupState: StateFlow<CreateGroupUiState> = _createGroupState.asStateFlow()

    // Estado de ações gerais
    private val _actionState = MutableStateFlow<GroupActionState>(GroupActionState.Idle)
    val actionState: StateFlow<GroupActionState> = _actionState.asStateFlow()

    // Filtro de busca
    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    // Estado de refresh
    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    // Job do flow para cancelar ao fazer refresh
    private var groupsFlowJob: Job? = null

    // Cache dos grupos para filtragem
    private var allGroups: List<UserGroup> = emptyList()

    init {
        loadMyGroups()
    }

    fun loadMyGroups() {
        // Cancela o job anterior para evitar múltiplos listeners
        groupsFlowJob?.cancel()

        groupsFlowJob = getGroupsUseCase.getGroupsFlow()
            .onStart {
                // Só mostra loading se não for refresh e não tiver dados
                if (allGroups.isEmpty()) {
                    _uiState.value = GroupsUiState.Loading
                }
            }
            .onEach { groups ->
                allGroups = groups
                _isRefreshing.value = false
                updateFilteredGroups()
            }
            .catch { e ->
                _isRefreshing.value = false
                _uiState.value = GroupsUiState.Error(e.message ?: "Erro ao carregar grupos")
            }
            .launchIn(viewModelScope)
    }

    fun refreshGroups() {
        _isRefreshing.value = true
        // Cancela e reinicia o listener para forçar nova busca
        groupsFlowJob?.cancel()
        loadMyGroups()
    }

    fun searchGroups(query: String) {
        _searchQuery.value = query
        updateFilteredGroups()
    }

    private fun updateFilteredGroups() {
        val filteredGroups = filterGroups(allGroups, _searchQuery.value)
        _uiState.value = if (filteredGroups.isEmpty() && _searchQuery.value.isEmpty()) {
            GroupsUiState.Empty
        } else {
            GroupsUiState.Success(filteredGroups)
        }
    }

    private fun filterGroups(groups: List<UserGroup>, query: String): List<UserGroup> {
        return if (query.isBlank()) {
            groups
        } else {
            val lowerQuery = query.lowercase().trim()
            groups.filter { it.groupName.lowercase().contains(lowerQuery) }
        }
    }

    fun createGroup(name: String, description: String, photoUri: Uri? = null) {
        viewModelScope.launch {
            _createGroupState.value = CreateGroupUiState.Loading

            val result = createGroupUseCase(name, description, photoUri)

            result.fold(
                onSuccess = { group ->
                    _createGroupState.value = CreateGroupUiState.Success(group)
                },
                onFailure = { error ->
                    _createGroupState.value = CreateGroupUiState.Error(
                        error.message ?: "Erro ao criar grupo"
                    )
                }
            )
        }
    }

    fun updateGroup(groupId: String, name: String, description: String, photoUri: Uri? = null) {
        viewModelScope.launch {
            _actionState.value = GroupActionState.Loading

            val result = updateGroupUseCase(groupId, name, description, photoUri)

            result.fold(
                onSuccess = {
                    _actionState.value = GroupActionState.Success("Grupo atualizado com sucesso")
                },
                onFailure = { error ->
                    _actionState.value = GroupActionState.Error(
                        error.message ?: "Erro ao atualizar grupo"
                    )
                }
            )
        }
    }

    fun archiveGroup(groupId: String) {
        viewModelScope.launch {
            _actionState.value = GroupActionState.Loading

            val result = archiveGroupUseCase(groupId)

            result.fold(
                onSuccess = {
                    _actionState.value = GroupActionState.Success("Grupo arquivado com sucesso")
                },
                onFailure = { error ->
                    _actionState.value = GroupActionState.Error(
                        error.message ?: "Erro ao arquivar grupo"
                    )
                }
            )
        }
    }

    fun deleteGroup(groupId: String) {
        viewModelScope.launch {
            _actionState.value = GroupActionState.Loading

            val result = deleteGroupUseCase(groupId)

            result.fold(
                onSuccess = {
                    _actionState.value = GroupActionState.GroupDeleted
                },
                onFailure = { error ->
                    _actionState.value = GroupActionState.Error(
                        error.message ?: "Erro ao excluir grupo"
                    )
                }
            )
        }
    }

    fun restoreGroup(groupId: String) {
        viewModelScope.launch {
            _actionState.value = GroupActionState.Loading

            val result = groupRepository.restoreGroup(groupId)

            result.fold(
                onSuccess = {
                    _actionState.value = GroupActionState.Success("Grupo restaurado com sucesso")
                },
                onFailure = { error ->
                    _actionState.value = GroupActionState.Error(
                        error.message ?: "Erro ao restaurar grupo"
                    )
                }
            )
        }
    }

    fun leaveGroup(groupId: String) {
        viewModelScope.launch {
            _actionState.value = GroupActionState.Loading

            val result = leaveGroupUseCase(LeaveGroupParams(groupId))

            result.fold(
                onSuccess = {
                    _actionState.value = GroupActionState.LeftGroup
                },
                onFailure = { error ->
                    _actionState.value = GroupActionState.Error(
                        error.message ?: "Erro ao sair do grupo"
                    )
                }
            )
        }
    }

    fun transferOwnership(groupId: String, newOwner: GroupMember) {
        viewModelScope.launch {
            _actionState.value = GroupActionState.Loading

            val result = transferOwnershipUseCase(groupId, newOwner)

            result.fold(
                onSuccess = {
                    _actionState.value = GroupActionState.Success(
                        "Propriedade transferida para ${newOwner.getDisplayName()}"
                    )
                },
                onFailure = { error ->
                    _actionState.value = GroupActionState.Error(
                        error.message ?: "Erro ao transferir propriedade"
                    )
                }
            )
        }
    }

    fun promoteMember(groupId: String, member: GroupMember) {
        viewModelScope.launch {
            _actionState.value = GroupActionState.Loading

            val result = manageMembersUseCase.promoteMember(groupId, member)

            result.fold(
                onSuccess = {
                    _actionState.value = GroupActionState.Success("${member.getDisplayName()} promovido a administrador")
                },
                onFailure = { error ->
                    _actionState.value = GroupActionState.Error(
                        error.message ?: "Erro ao promover membro"
                    )
                }
            )
        }
    }

    fun demoteMember(groupId: String, member: GroupMember) {
        viewModelScope.launch {
            _actionState.value = GroupActionState.Loading

            val result = manageMembersUseCase.demoteMember(groupId, member)

            result.fold(
                onSuccess = {
                    _actionState.value = GroupActionState.Success("${member.getDisplayName()} rebaixado a membro")
                },
                onFailure = { error ->
                    _actionState.value = GroupActionState.Error(
                        error.message ?: "Erro ao rebaixar membro"
                    )
                }
            )
        }
    }

    fun removeMember(groupId: String, member: GroupMember) {
        viewModelScope.launch {
            _actionState.value = GroupActionState.Loading

            val result = manageMembersUseCase.removeMember(groupId, member)

            result.fold(
                onSuccess = {
                    _actionState.value = GroupActionState.Success("${member.getDisplayName()} removido do grupo")
                },
                onFailure = { error ->
                    _actionState.value = GroupActionState.Error(
                        error.message ?: "Erro ao remover membro"
                    )
                }
            )
        }
    }

    suspend fun getValidGroupsForGame(): List<UserGroup> {
        return getGroupsUseCase.getValidGroupsForGame().getOrDefault(emptyList())
    }

    suspend fun canCreateGames(): Boolean {
        return getGroupsUseCase.canCreateGames().getOrDefault(false)
    }

    fun resetCreateGroupState() {
        _createGroupState.value = CreateGroupUiState.Idle
    }

    fun resetActionState() {
        _actionState.value = GroupActionState.Idle
    }

    override fun onCleared() {
        super.onCleared()
        groupsFlowJob?.cancel()
    }
}

sealed class GroupsUiState {
    object Loading : GroupsUiState()
    object Empty : GroupsUiState()
    data class Success(val groups: List<UserGroup>) : GroupsUiState()
    data class Error(val message: String) : GroupsUiState()
}

sealed class GroupDetailUiState {
    object Loading : GroupDetailUiState()
    object LeftGroup : GroupDetailUiState()
    data class Success(
        val group: Group,
        val members: List<GroupMember>,
        val myRole: GroupMemberRole?
    ) : GroupDetailUiState()
    data class Error(val message: String) : GroupDetailUiState()
}

sealed class CreateGroupUiState {
    object Idle : CreateGroupUiState()
    object Loading : CreateGroupUiState()
    data class Success(val group: Group) : CreateGroupUiState()
    data class Error(val message: String) : CreateGroupUiState()
}

sealed class GroupActionState {
    object Idle : GroupActionState()
    object Loading : GroupActionState()
    object LeftGroup : GroupActionState()
    object GroupDeleted : GroupActionState()
    data class Success(val message: String) : GroupActionState()
    data class Error(val message: String) : GroupActionState()
}
