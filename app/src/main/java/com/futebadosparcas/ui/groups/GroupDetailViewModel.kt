package com.futebadosparcas.ui.groups

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.data.model.Group
import com.futebadosparcas.data.model.GroupMember
import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.data.repository.GroupRepository
import com.futebadosparcas.domain.usecase.group.ArchiveGroupUseCase
import com.futebadosparcas.domain.usecase.group.DeleteGroupUseCase
import com.futebadosparcas.domain.usecase.group.LeaveGroupUseCase
import com.futebadosparcas.domain.usecase.group.ManageMembersUseCase
import com.futebadosparcas.domain.usecase.group.TransferOwnershipUseCase
import com.futebadosparcas.domain.usecase.group.UpdateGroupUseCase
import com.google.firebase.auth.FirebaseAuth
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import javax.inject.Inject
import com.futebadosparcas.util.AppLogger

/**
 * ViewModel para detalhes do grupo
 */
@HiltViewModel
class GroupDetailViewModel @Inject constructor(
    private val groupRepository: GroupRepository,
    private val userRepository: com.futebadosparcas.data.repository.UserRepository, // Injected
    private val auth: FirebaseAuth,
    private val updateGroupUseCase: UpdateGroupUseCase,
    private val archiveGroupUseCase: ArchiveGroupUseCase,
    private val deleteGroupUseCase: DeleteGroupUseCase,
    private val leaveGroupUseCase: LeaveGroupUseCase,
    private val manageMembersUseCase: ManageMembersUseCase,
    private val transferOwnershipUseCase: TransferOwnershipUseCase,
    private val cashboxSeeder: com.futebadosparcas.util.CashboxSeeder
) : ViewModel() {

    // ... (existing code)

    fun seedTestHistory(groupId: String) {
        viewModelScope.launch {
            val user = auth.currentUser
            if (user != null) {
                cashboxSeeder.seedHistory(groupId, user.uid, user.displayName ?: "User")
                _actionState.value = GroupActionState.Success("Histórico de teste inserido!")
            }
        }
    }

    private val _uiState = MutableStateFlow<GroupDetailUiState>(GroupDetailUiState.Loading)
    val uiState: StateFlow<GroupDetailUiState> = _uiState.asStateFlow()

    private val _actionState = MutableStateFlow<GroupActionState>(GroupActionState.Idle)
    val actionState: StateFlow<GroupActionState> = _actionState.asStateFlow()

    private var currentGroupId: String? = null

    /**
     * Carrega os dados do grupo e seus membros em tempo real
     * Membros são ordenados por role (Owner > Admin > Member) e depois por nome
     * Enriquecido com dados atualizados do usuário (foto/nome)
     */
    fun loadGroup(groupId: String) {
        currentGroupId = groupId
        _uiState.value = GroupDetailUiState.Loading

        // Combina o flow do grupo com o flow de membros
        combine(
            groupRepository.getGroupFlow(groupId).map { result ->
                result.getOrNull()
            },
            groupRepository.getOrderedGroupMembersFlow(groupId).map { members ->
                // "Smarter" loading: Buscar dados atualizados dos usuários (fotos/nomes)
                val userIds = members.map { it.userId }
                if (userIds.isNotEmpty()) {
                    val freshUsersResult = userRepository.getUsersByIds(userIds)
                    val freshUsers = freshUsersResult.getOrNull() ?: emptyList()
                    
                    AppLogger.d("GroupDetailVM") { "Enriching members. Found ${freshUsers.size} users. User IDs: $userIds" }

                    members.map { member ->
                        val user = freshUsers.find { it.id == member.userId }
                        if (user != null) {
                            AppLogger.d("GroupDetailVM") { "Enriched member ${member.userId}: photo=${user.photoUrl}" }
                            member.copy(
                                userName = user.name, // Garante nome atualizado
                                userPhoto = user.photoUrl // Garante foto atualizada
                            )
                        } else {
                            member
                        }
                    }
                } else {
                    members
                }
            }
        ) { group: Group?, members: List<GroupMember> ->
            if (group != null) {
                val currentUserId = auth.currentUser?.uid
                val currentUserMember = members.find { it.userId == currentUserId }
                GroupDetailUiState.Success(
                    group = group,
                    members = members, // Agora com fotos atualizadas
                    myRole = currentUserMember?.getRoleEnum()
                )
            } else {
                GroupDetailUiState.Error("Grupo não encontrado")
            }
        }
        .catch { e ->
            _uiState.value = GroupDetailUiState.Error(e.message ?: "Erro ao carregar grupo")
        }
        .onEach { state ->
            _uiState.value = state
        }
        .launchIn(viewModelScope)
    }

    /**
     * Atualiza informações do grupo
     */
    fun updateGroup(name: String, description: String, photoUri: Uri? = null) {
        viewModelScope.launch {
            val groupId = currentGroupId ?: return@launch
            _actionState.value = GroupActionState.Loading

            val result = updateGroupUseCase(groupId, name, description, photoUri)

            result.fold(
                onSuccess = {
                    _actionState.value = GroupActionState.Success("Grupo atualizado com sucesso")
                },
                onFailure = { e ->
                    _actionState.value = GroupActionState.Error(e.message ?: "Erro ao atualizar grupo")
                }
            )
        }
    }

    /**
     * Arquiva o grupo
     */
    fun archiveGroup() {
        viewModelScope.launch {
            val groupId = currentGroupId ?: return@launch
            _actionState.value = GroupActionState.Loading

            val result = archiveGroupUseCase(groupId)

            result.fold(
                onSuccess = {
                    _actionState.value = GroupActionState.Success("Grupo arquivado com sucesso")
                },
                onFailure = { e ->
                    _actionState.value = GroupActionState.Error(e.message ?: "Erro ao arquivar grupo")
                }
            )
        }
    }

    /**
     * Exclui o grupo (soft delete)
     */
    fun deleteGroup() {
        viewModelScope.launch {
            val groupId = currentGroupId ?: return@launch
            _actionState.value = GroupActionState.Loading

            val result = deleteGroupUseCase(groupId)

            result.fold(
                onSuccess = {
                    _actionState.value = GroupActionState.GroupDeleted
                },
                onFailure = { e ->
                    _actionState.value = GroupActionState.Error(e.message ?: "Erro ao excluir grupo")
                }
            )
        }
    }

    /**
     * Promove um membro a admin
     */
    fun promoteMember(member: GroupMember) {
        viewModelScope.launch {
            val groupId = currentGroupId ?: return@launch
            _actionState.value = GroupActionState.Loading

            val result = manageMembersUseCase.promoteMember(groupId, member)

            result.fold(
                onSuccess = {
                    _actionState.value = GroupActionState.Success("${member.getDisplayName()} promovido a administrador")
                },
                onFailure = { e ->
                    _actionState.value = GroupActionState.Error(e.message ?: "Erro ao promover membro")
                }
            )
        }
    }

    /**
     * Rebaixa um admin a membro
     */
    fun demoteMember(member: GroupMember) {
        viewModelScope.launch {
            val groupId = currentGroupId ?: return@launch
            _actionState.value = GroupActionState.Loading

            val result = manageMembersUseCase.demoteMember(groupId, member)

            result.fold(
                onSuccess = {
                    _actionState.value = GroupActionState.Success("${member.getDisplayName()} rebaixado a membro")
                },
                onFailure = { e ->
                    _actionState.value = GroupActionState.Error(e.message ?: "Erro ao rebaixar membro")
                }
            )
        }
    }

    /**
     * Remove um membro do grupo
     */
    fun removeMember(member: GroupMember) {
        viewModelScope.launch {
            val groupId = currentGroupId ?: return@launch
            _actionState.value = GroupActionState.Loading

            val result = manageMembersUseCase.removeMember(groupId, member)

            result.fold(
                onSuccess = {
                    _actionState.value = GroupActionState.Success("${member.getDisplayName()} removido do grupo")
                },
                onFailure = { e ->
                    _actionState.value = GroupActionState.Error(e.message ?: "Erro ao remover membro")
                }
            )
        }
    }

    /**
     * Sai do grupo (usuário atual)
     */
    fun leaveGroup() {
        viewModelScope.launch {
            val groupId = currentGroupId ?: return@launch
            _actionState.value = GroupActionState.Loading

            val result = leaveGroupUseCase(groupId)

            result.fold(
                onSuccess = {
                    _uiState.value = GroupDetailUiState.LeftGroup
                },
                onFailure = { e ->
                    _actionState.value = GroupActionState.Error(e.message ?: "Erro ao sair do grupo")
                }
            )
        }
    }

    /**
     * Transfere a propriedade do grupo para outro membro
     */
    fun transferOwnership(newOwner: GroupMember) {
        viewModelScope.launch {
            val groupId = currentGroupId ?: return@launch
            _actionState.value = GroupActionState.Loading

            val result = transferOwnershipUseCase(groupId, newOwner)

            result.fold(
                onSuccess = {
                    _actionState.value = GroupActionState.Success(
                        "Propriedade transferida para ${newOwner.getDisplayName()}"
                    )
                },
                onFailure = { e ->
                    _actionState.value = GroupActionState.Error(e.message ?: "Erro ao transferir propriedade")
                }
            )
        }
    }

    /**
     * Reseta o estado de ação
     */
    fun resetActionState() {
        _actionState.value = GroupActionState.Idle
    }
}
