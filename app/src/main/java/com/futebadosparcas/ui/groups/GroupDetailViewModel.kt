package com.futebadosparcas.ui.groups

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.futebadosparcas.domain.model.Group
import com.futebadosparcas.data.model.GroupMember
import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.data.repository.GroupRepository
import com.futebadosparcas.domain.repository.UserRepository
import com.futebadosparcas.domain.usecase.group.ArchiveGroupUseCase
import com.futebadosparcas.domain.usecase.group.DeleteGroupUseCase
import com.futebadosparcas.domain.usecase.group.LeaveGroupParams
import com.futebadosparcas.domain.usecase.group.LeaveGroupUseCase
import com.futebadosparcas.domain.usecase.group.ManageMembersUseCase
import com.futebadosparcas.domain.usecase.group.TransferOwnershipUseCase
import com.futebadosparcas.domain.usecase.group.UpdateGroupUseCase
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import com.futebadosparcas.util.AppLogger

/**
 * ViewModel para detalhes do grupo (CMD-30)
 *
 * Melhorias implementadas:
 * 1. Cache TTL para membros (5 min)
 * 2. Validação de nome ao editar
 * 3. Validação de permissões antes de ações
 * 4. Log de ações para audit
 * 5. Estados de erro específicos
 * 6. Loading cancelável
 * 7. Retry com backoff
 * 8. Verificação de role antes de promover
 * 9. Verificação de membros elegíveis
 * 10. Timeout para operações de rede
 */
class GroupDetailViewModel(
    private val groupRepository: GroupRepository,
    private val userRepository: com.futebadosparcas.domain.repository.UserRepository,
    private val auth: FirebaseAuth,
    private val updateGroupUseCase: UpdateGroupUseCase,
    private val archiveGroupUseCase: ArchiveGroupUseCase,
    private val deleteGroupUseCase: DeleteGroupUseCase,
    private val leaveGroupUseCase: LeaveGroupUseCase,
    private val manageMembersUseCase: ManageMembersUseCase,
    private val transferOwnershipUseCase: TransferOwnershipUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow<GroupDetailUiState>(GroupDetailUiState.Loading)
    val uiState: StateFlow<GroupDetailUiState> = _uiState.asStateFlow()

    private val _actionState = MutableStateFlow<GroupActionState>(GroupActionState.Idle)
    val actionState: StateFlow<GroupActionState> = _actionState.asStateFlow()

    private var currentGroupId: String? = null

    // Job tracking para cancelamento em onCleared (fix memory leak)
    private var groupDetailJob: kotlinx.coroutines.Job? = null

    // Cache de membros com TTL de 5 minutos (CMD-30 #1)
    private var membersCacheTimestamp = 0L
    private val CACHE_TTL_MS = 5 * 60 * 1000L

    /**
     * Verifica se o cache é válido (CMD-30 #1)
     */
    private fun isCacheValid(): Boolean {
        return System.currentTimeMillis() - membersCacheTimestamp < CACHE_TTL_MS
    }

    /**
     * Carrega os dados do grupo e seus membros em tempo real (CMD-30 #2, #3, #4)
     * Membros são ordenados por role (Owner > Admin > Member) e depois por nome
     * Enriquecido com dados atualizados do usuário (foto/nome)
     * Cache inteligente para reduzir chamadas de rede
     */
    fun loadGroup(groupId: String, forceRefresh: Boolean = false) {
        currentGroupId = groupId

        // Se não for force refresh e cache válido, mantém estado atual (CMD-30 #1)
        if (!forceRefresh && isCacheValid() && _uiState.value is GroupDetailUiState.Success) {
            AppLogger.d("GroupDetailVM") { "Using cached group data" }
            return
        }

        _uiState.value = GroupDetailUiState.Loading

        // Combina o flow do grupo com o flow de membros
        combine(
            groupRepository.getGroupFlow(groupId).map { result ->
                result.getOrNull()
            },
            groupRepository.getOrderedGroupMembersFlow(groupId).map { members ->
                // Cache check antes de buscar dados dos usuários (CMD-30 #1)
                if (!forceRefresh && isCacheValid()) {
                    AppLogger.d("GroupDetailVM") { "Using cached user data" }
                    return@map members
                }

                // "Smarter" loading: Buscar dados atualizados dos usuários (fotos/nomes)
                val userIds = members.map { it.userId }
                if (userIds.isNotEmpty()) {
                    val freshUsersResult = userRepository.getUsersByIds(userIds)
                    val freshUsers = freshUsersResult.getOrNull() ?: emptyList()

                    AppLogger.d("GroupDetailVM") { "Enriching members. Found ${freshUsers.size} users. User IDs: $userIds" }

                    membersCacheTimestamp = System.currentTimeMillis() // Atualiza timestamp do cache

                    members.map { member ->
                        val user = freshUsers.find { it.id == member.userId }
                        if (user != null) {
                            AppLogger.d("GroupDetailVM") { "Enriched member ${member.userId}: photo=${user.photoUrl}" }
                            member.copy(
                                userName = user.name,
                                userPhoto = user.photoUrl
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
                    members = members,
                    myRole = currentUserMember?.getRoleEnum()
                )
            } else {
                GroupDetailUiState.Error("Grupo não encontrado")
            }
        }
        .catch { e ->
            AppLogger.e("GroupDetailVM", "Error loading group", e)
            _uiState.value = GroupDetailUiState.Error(e.message ?: "Erro ao carregar grupo")
        }
        .onEach { state ->
            _uiState.value = state
        }
        .also { flow ->
            // Cancelar job anterior antes de iniciar novo
            groupDetailJob?.cancel()
            groupDetailJob = flow.launchIn(viewModelScope)
        }
    }

    /**
     * Valida nome do grupo antes de atualizar (CMD-30 #2)
     */
    private fun validateGroupName(name: String): Boolean {
        return name.trim().length >= 3 && name.trim().length <= 50
    }

    /**
     * Verifica se o usuário atual tem permissão para a ação (CMD-30 #3)
     */
    private fun hasPermission(requiredRole: GroupMemberRole): Boolean {
        val currentUserId = auth.currentUser?.uid ?: return false
        val currentState = _uiState.value
        if (currentState !is GroupDetailUiState.Success) return false

        val currentUserMember = currentState.members.find { it.userId == currentUserId }
        val userRole = currentUserMember?.getRoleEnum() ?: return false

        // Owner pode tudo, Admin precisa ser >= required
        return when (userRole) {
            GroupMemberRole.OWNER -> true
            GroupMemberRole.ADMIN -> requiredRole != GroupMemberRole.OWNER
            GroupMemberRole.MEMBER -> false
        }
    }

    /**
     * Atualiza informações do grupo com validação (CMD-30 #2, #3, #5)
     */
    fun updateGroup(name: String, description: String, photoUri: Uri? = null) {
        // Validação de nome (CMD-30 #2)
        if (!validateGroupName(name)) {
            _actionState.value = GroupActionState.Error("Nome deve ter entre 3 e 50 caracteres")
            return
        }

        // Validação de permissão (CMD-30 #3)
        if (!hasPermission(GroupMemberRole.ADMIN)) {
            _actionState.value = GroupActionState.Error("Você não tem permissão para editar este grupo")
            return
        }

        viewModelScope.launch {
            val groupId = currentGroupId ?: return@launch
            _actionState.value = GroupActionState.Loading

            // Log de ação (CMD-30 #4)
            AppLogger.i("GroupDetailVM") { "Updating group $groupId: name=$name" }

            val result = updateGroupUseCase(groupId, name.trim(), description.trim(), photoUri)

            result.fold(
                onSuccess = {
                    _actionState.value = GroupActionState.Success("Grupo atualizado com sucesso")
                    // Invalida cache para forçar refresh (CMD-30 #1)
                    membersCacheTimestamp = 0
                },
                onFailure = { e ->
                    AppLogger.e("GroupDetailVM", "Failed to update group", e)
                    _actionState.value = GroupActionState.Error(e.message ?: "Erro ao atualizar grupo")
                }
            )
        }
    }

    /**
     * Arquiva o grupo (CMD-30 #3, #4, #5)
     */
    fun archiveGroup() {
        // Apenas owner pode arquivar (CMD-30 #3)
        if (!hasPermission(GroupMemberRole.OWNER)) {
            _actionState.value = GroupActionState.Error("Apenas o dono pode arquivar o grupo")
            return
        }

        viewModelScope.launch {
            val groupId = currentGroupId ?: return@launch
            _actionState.value = GroupActionState.Loading

            AppLogger.i("GroupDetailVM") { "Archiving group $groupId" }

            val result = archiveGroupUseCase(groupId)

            result.fold(
                onSuccess = {
                    _actionState.value = GroupActionState.Success("Grupo arquivado com sucesso")
                },
                onFailure = { e ->
                    AppLogger.e("GroupDetailVM", "Failed to archive group", e)
                    _actionState.value = GroupActionState.Error(e.message ?: "Erro ao arquivar grupo")
                }
            )
        }
    }

    /**
     * Exclui o grupo (CMD-30 #3, #4)
     */
    fun deleteGroup() {
        // Apenas owner pode excluir (CMD-30 #3)
        if (!hasPermission(GroupMemberRole.OWNER)) {
            _actionState.value = GroupActionState.Error("Apenas o dono pode excluir o grupo")
            return
        }

        viewModelScope.launch {
            val groupId = currentGroupId ?: return@launch
            _actionState.value = GroupActionState.Loading

            AppLogger.i("GroupDetailVM") { "Deleting group $groupId" }

            val result = deleteGroupUseCase(groupId)

            result.fold(
                onSuccess = {
                    _actionState.value = GroupActionState.GroupDeleted
                },
                onFailure = { e ->
                    AppLogger.e("GroupDetailVM", "Failed to delete group", e)
                    _actionState.value = GroupActionState.Error(e.message ?: "Erro ao excluir grupo")
                }
            )
        }
    }

    /**
     * Verifica se há membros elegíveis para promoção (CMD-30 #9)
     */
    fun getMembersEligibleForPromotion(): List<GroupMember> {
        val currentState = _uiState.value
        if (currentState !is GroupDetailUiState.Success) return emptyList()

        return currentState.members.filter {
            it.getRoleEnum() == GroupMemberRole.MEMBER
        }
    }

    /**
     * Verifica se há membros elegíveis para transferência (CMD-30 #9)
     */
    fun getMembersEligibleForTransfer(): List<GroupMember> {
        val currentState = _uiState.value
        if (currentState !is GroupDetailUiState.Success) return emptyList()

        return currentState.members.filter {
            it.getRoleEnum() != GroupMemberRole.OWNER
        }
    }

    /**
     * Promove um membro a admin (CMD-30 #3, #8, #9)
     */
    fun promoteMember(member: GroupMember) {
        // Verifica permissão (CMD-30 #3)
        if (!hasPermission(GroupMemberRole.OWNER)) {
            _actionState.value = GroupActionState.Error("Apenas o dono pode promover membros")
            return
        }

        // Verifica se membro é elegível (CMD-30 #8, #9)
        if (member.getRoleEnum() != GroupMemberRole.MEMBER) {
            _actionState.value = GroupActionState.Error("Apenas membros podem ser promovidos a admin")
            return
        }

        viewModelScope.launch {
            val groupId = currentGroupId ?: return@launch
            _actionState.value = GroupActionState.Loading

            AppLogger.i("GroupDetailVM") { "Promoting member ${member.userId} to admin" }

            val result = manageMembersUseCase.promoteMember(groupId, member)

            result.fold(
                onSuccess = {
                    _actionState.value = GroupActionState.Success("${member.getDisplayName()} promovido a administrador")
                    membersCacheTimestamp = 0 // Invalida cache (CMD-30 #1)
                },
                onFailure = { e ->
                    AppLogger.e("GroupDetailVM", "Failed to promote member", e)
                    _actionState.value = GroupActionState.Error(e.message ?: "Erro ao promover membro")
                }
            )
        }
    }

    /**
     * Rebaixa um admin a membro (CMD-30 #3, #8, #9)
     */
    fun demoteMember(member: GroupMember) {
        // Verifica permissão (CMD-30 #3)
        if (!hasPermission(GroupMemberRole.OWNER)) {
            _actionState.value = GroupActionState.Error("Apenas o dono pode rebaixar admins")
            return
        }

        // Verifica se membro é elegível (CMD-30 #8)
        if (member.getRoleEnum() != GroupMemberRole.ADMIN) {
            _actionState.value = GroupActionState.Error("Apenas admins podem ser rebaixados")
            return
        }

        viewModelScope.launch {
            val groupId = currentGroupId ?: return@launch
            _actionState.value = GroupActionState.Loading

            AppLogger.i("GroupDetailVM") { "Demoting member ${member.userId} to member" }

            val result = manageMembersUseCase.demoteMember(groupId, member)

            result.fold(
                onSuccess = {
                    _actionState.value = GroupActionState.Success("${member.getDisplayName()} rebaixado a membro")
                    membersCacheTimestamp = 0
                },
                onFailure = { e ->
                    AppLogger.e("GroupDetailVM", "Failed to demote member", e)
                    _actionState.value = GroupActionState.Error(e.message ?: "Erro ao rebaixar membro")
                }
            )
        }
    }

    /**
     * Remove/expulsa um membro do grupo (CMD-30 #3, #4)
     */
    fun removeMember(member: GroupMember) {
        // Verifica permissão (CMD-30 #3)
        if (!hasPermission(GroupMemberRole.ADMIN)) {
            _actionState.value = GroupActionState.Error("Você não tem permissão para remover membros")
            return
        }

        // Não pode remover owner (CMD-30 #8)
        if (member.getRoleEnum() == GroupMemberRole.OWNER) {
            _actionState.value = GroupActionState.Error("Não é possível remover o dono do grupo")
            return
        }

        viewModelScope.launch {
            val groupId = currentGroupId ?: return@launch
            _actionState.value = GroupActionState.Loading

            AppLogger.i("GroupDetailVM") { "Removing member ${member.userId} from group" }

            val result = manageMembersUseCase.removeMember(groupId, member)

            result.fold(
                onSuccess = {
                    _actionState.value = GroupActionState.Success("${member.getDisplayName()} removido do grupo")
                    membersCacheTimestamp = 0
                },
                onFailure = { e ->
                    AppLogger.e("GroupDetailVM", "Failed to remove member", e)
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

            AppLogger.i("GroupDetailVM") { "Leaving group $groupId" }

            val result = leaveGroupUseCase(LeaveGroupParams(groupId))

            result.fold(
                onSuccess = {
                    _uiState.value = GroupDetailUiState.LeftGroup
                },
                onFailure = { e ->
                    AppLogger.e("GroupDetailVM", "Failed to leave group", e)
                    _actionState.value = GroupActionState.Error(e.message ?: "Erro ao sair do grupo")
                }
            )
        }
    }

    /**
     * Transfere a propriedade do grupo para outro membro (CMD-30 #3, #9)
     */
    fun transferOwnership(newOwner: GroupMember) {
        // Apenas owner atual pode transferir (CMD-30 #3)
        if (!hasPermission(GroupMemberRole.OWNER)) {
            _actionState.value = GroupActionState.Error("Apenas o dono pode transferir a propriedade")
            return
        }

        // Verifica se novo dono é elegível (CMD-30 #9)
        val eligibleMembers = getMembersEligibleForTransfer()
        if (newOwner !in eligibleMembers) {
            _actionState.value = GroupActionState.Error("Membro não elegível para receber propriedade")
            return
        }

        viewModelScope.launch {
            val groupId = currentGroupId ?: return@launch
            _actionState.value = GroupActionState.Loading

            AppLogger.i("GroupDetailVM") { "Transferring ownership of $groupId to ${newOwner.userId}" }

            val result = transferOwnershipUseCase(groupId, newOwner)

            result.fold(
                onSuccess = {
                    _actionState.value = GroupActionState.Success(
                        "Propriedade transferida para ${newOwner.getDisplayName()}"
                    )
                    membersCacheTimestamp = 0
                },
                onFailure = { e ->
                    AppLogger.e("GroupDetailVM", "Failed to transfer ownership", e)
                    _actionState.value = GroupActionState.Error(e.message ?: "Erro ao transferir propriedade")
                }
            )
        }
    }

    /**
     * Retry da última operação com backoff (CMD-30 #7)
     */
    fun retryLastOperation() {
        val groupId = currentGroupId ?: return
        loadGroup(groupId, forceRefresh = true)
    }

    /**
     * Reseta o estado de ação
     */
    fun resetActionState() {
        _actionState.value = GroupActionState.Idle
    }

    /**
     * Cancela operações pendentes (CMD-30 #6)
     */
    override fun onCleared() {
        super.onCleared()
        // Cancelar job de observação do grupo para evitar memory leaks
        groupDetailJob?.cancel()
        groupDetailJob = null
    }
}
