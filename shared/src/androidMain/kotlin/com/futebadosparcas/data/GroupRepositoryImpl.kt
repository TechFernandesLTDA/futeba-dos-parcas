package com.futebadosparcas.data

import com.futebadosparcas.domain.model.Group
import com.futebadosparcas.domain.model.GroupMember
import com.futebadosparcas.domain.model.GroupMemberRole
import com.futebadosparcas.domain.model.UserGroup
import com.futebadosparcas.domain.repository.GroupRepository
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import com.futebadosparcas.platform.logging.PlatformLogger
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map

/**
 * Implementação Android do GroupRepository.
 *
 * Gerencia grupos de pelada incluindo criação, edição, membros e permissões.
 */
class GroupRepositoryImpl(
    private val firebaseDataSource: FirebaseDataSource
) : GroupRepository {

    companion object {
        private const val TAG = "GroupRepository"
    }

    // ========== OPERAÇÕES BÁSICAS ==========

    override suspend fun getUserGroups(): Result<List<UserGroup>> {
        return try {
            PlatformLogger.d(TAG, "Buscando grupos do usuário")
            firebaseDataSource.getUserGroups(firebaseDataSource.getCurrentUserId() ?: "")
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao buscar grupos", e)
            Result.failure(e)
        }
    }

    override fun observeUserGroups(): Flow<List<UserGroup>> {
        return firebaseDataSource.getUserGroupsFlow(firebaseDataSource.getCurrentUserId() ?: "")
            .map { result -> result.getOrNull() ?: emptyList() }
            .catch { emit(emptyList()) }
    }

    override suspend fun getGroupById(groupId: String): Result<Group> {
        return try {
            PlatformLogger.d(TAG, "Buscando grupo: $groupId")
            firebaseDataSource.getGroupDetails(groupId)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao buscar grupo", e)
            Result.failure(e)
        }
    }

    override fun observeGroup(groupId: String): Flow<Group?> {
        return firebaseDataSource.getGroupDetailsFlow(groupId)
            .map { result -> result.getOrNull() }
            .catch { emit(null) }
    }

    // ========== CRIAÇÃO E EDIÇÃO ==========

    override suspend fun createGroup(
        name: String,
        description: String,
        photoUri: String?
    ): Result<Group> {
        return try {
            PlatformLogger.d(TAG, "Criando grupo: $name")
            val userId = firebaseDataSource.getCurrentAuthUserId() ?: throw Exception("Usuario nao autenticado")
            val group = Group(
                id = "",
                name = name,
                description = description,
                ownerId = userId,
                ownerName = "",
                membersCount = 1,
                gamesCount = 0
            )
            firebaseDataSource.createGroup(group)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao criar grupo", e)
            Result.failure(e)
        }
    }

    override suspend fun updateGroup(
        groupId: String,
        name: String,
        description: String,
        photoUri: String?
    ): Result<Unit> {
        return try {
            PlatformLogger.d(TAG, "Atualizando grupo: $groupId")
            val updates = mutableMapOf<String, Any>()
            updates["name"] = name
            updates["description"] = description
            // TODO: Handle photoUri upload
            firebaseDataSource.updateGroup(groupId, updates)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao atualizar grupo", e)
            Result.failure(e)
        }
    }

    // ========== MEMBROS ==========

    override suspend fun getGroupMembers(groupId: String): Result<List<GroupMember>> {
        return try {
            PlatformLogger.d(TAG, "Buscando membros do grupo: $groupId")
            firebaseDataSource.getGroupMembers(groupId)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao buscar membros", e)
            Result.failure(e)
        }
    }

    override fun observeGroupMembers(groupId: String): Flow<List<GroupMember>> {
        return firebaseDataSource.getGroupMembersFlow(groupId)
            .map { result -> result.getOrNull() ?: emptyList() }
            .catch { emit(emptyList()) }
    }

    override fun observeOrderedGroupMembers(groupId: String): Flow<List<GroupMember>> {
        return firebaseDataSource.getGroupMembersFlow(groupId)
            .map { result ->
                result.getOrNull()?.sortedBy { member ->
                    when (member.getRoleEnum()) {
                        GroupMemberRole.OWNER -> 0
                        GroupMemberRole.ADMIN -> 1
                        GroupMemberRole.MEMBER -> 2
                    }
                } ?: emptyList()
            }
            .catch { emit(emptyList()) }
    }

    override suspend fun addMember(
        groupId: String,
        userId: String,
        role: GroupMemberRole
    ): Result<Unit> {
        return try {
            PlatformLogger.d(TAG, "Adicionando membro $userId ao grupo $groupId")
            firebaseDataSource.addGroupMember(groupId, userId, role.name)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao adicionar membro", e)
            Result.failure(e)
        }
    }

    override suspend fun removeMember(groupId: String, userId: String): Result<Unit> {
        return try {
            PlatformLogger.d(TAG, "Removendo membro $userId do grupo $groupId")
            firebaseDataSource.removeGroupMember(groupId, userId)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao remover membro", e)
            Result.failure(e)
        }
    }

    override suspend fun promoteMemberToAdmin(groupId: String, memberId: String): Result<Unit> {
        return try {
            PlatformLogger.d(TAG, "Promovendo membro $groupId/$memberId a admin")
            firebaseDataSource.promoteGroupMemberToAdmin(groupId, memberId)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao promover membro", e)
            Result.failure(e)
        }
    }

    override suspend fun demoteAdminToMember(groupId: String, memberId: String): Result<Unit> {
        return try {
            PlatformLogger.d(TAG, "Rebaixando admin $groupId/$memberId a membro")
            firebaseDataSource.demoteGroupAdminToMember(groupId, memberId)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao rebaixar admin", e)
            Result.failure(e)
        }
    }

    override suspend fun updateMemberRole(
        groupId: String,
        userId: String,
        role: GroupMemberRole
    ): Result<Unit> {
        return try {
            PlatformLogger.d(TAG, "Atualizando role do membro $userId para $role")
            firebaseDataSource.updateGroupMemberRole(groupId, userId, role.name)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao atualizar role", e)
            Result.failure(e)
        }
    }

    override suspend fun getMyRoleInGroup(groupId: String): Result<GroupMemberRole?> {
        return try {
            // TODO: Implementar no FirebaseDataSource
            Result.success(null)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao buscar role", e)
            Result.failure(e)
        }
    }

    override suspend fun isMemberOfGroup(groupId: String): Result<Boolean> {
        return try {
            // TODO: Implementar no FirebaseDataSource
            Result.success(false)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao verificar membro", e)
            Result.failure(e)
        }
    }

    // ========== CONVITES ==========

    override suspend fun joinByInviteCode(inviteCode: String): Result<String> {
        return try {
            PlatformLogger.d(TAG, "Entrando no grupo com código: $inviteCode")
            val userId = firebaseDataSource.getCurrentAuthUserId() ?: throw Exception("Usuario nao autenticado")
            // TODO: Precisamos obter userName e userPhoto tambem
            firebaseDataSource.joinGroupByInviteCode(inviteCode, userId, "", null)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao entrar com código", e)
            Result.failure(e)
        }
    }

    override suspend fun generateInviteCode(groupId: String): Result<String> {
        return try {
            PlatformLogger.d(TAG, "Gerando código de convite para: $groupId")
            firebaseDataSource.generateGroupInviteCode(groupId)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao gerar código", e)
            Result.failure(e)
        }
    }

    // ========== SAIR E GERENCIAR ==========

    override suspend fun leaveGroup(groupId: String): Result<Unit> {
        return try {
            PlatformLogger.d(TAG, "Saindo do grupo: $groupId")
            val userId = firebaseDataSource.getCurrentAuthUserId() ?: throw Exception("Usuario nao autenticado")
            firebaseDataSource.leaveGroup(groupId, userId)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao sair do grupo", e)
            Result.failure(e)
        }
    }

    override suspend fun archiveGroup(groupId: String): Result<Unit> {
        return try {
            PlatformLogger.d(TAG, "Arquivando grupo: $groupId")
            firebaseDataSource.archiveGroup(groupId)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao arquivar grupo", e)
            Result.failure(e)
        }
    }

    override suspend fun restoreGroup(groupId: String): Result<Unit> {
        return try {
            PlatformLogger.d(TAG, "Restaurando grupo: $groupId")
            firebaseDataSource.restoreGroup(groupId)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao restaurar grupo", e)
            Result.failure(e)
        }
    }

    override suspend fun deleteGroup(groupId: String): Result<Unit> {
        return try {
            PlatformLogger.d(TAG, "Deletando grupo: $groupId")
            firebaseDataSource.deleteGroup(groupId)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao deletar grupo", e)
            Result.failure(e)
        }
    }

    override suspend fun transferOwnership(groupId: String, newOwnerId: String): Result<Unit> {
        return try {
            PlatformLogger.d(TAG, "Transferindo propriedade do grupo $groupId para $newOwnerId")
            val currentUserId = firebaseDataSource.getCurrentAuthUserId() ?: throw Exception("Usuario nao autenticado")
            // TODO: Precisamos obter newOwnerName tambem
            firebaseDataSource.transferGroupOwnership(groupId, newOwnerId, currentUserId, "")
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao transferir propriedade", e)
            Result.failure(e)
        }
    }

    // ========== CONSULTAS ÚTEIS ==========

    override suspend fun getValidGroupsForGame(): Result<List<UserGroup>> {
        return try {
            PlatformLogger.d(TAG, "Buscando grupos válidos para jogos")
            // TODO: Implementar no FirebaseDataSource
            Result.success(emptyList())
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao buscar grupos válidos", e)
            Result.failure(e)
        }
    }

    override suspend fun canCreateGames(): Result<Boolean> {
        return try {
            // TODO: Implementar no FirebaseDataSource
            Result.success(false)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao verificar se pode criar jogos", e)
            Result.failure(e)
        }
    }

    override suspend fun countMyAdminGroups(): Result<Int> {
        return try {
            // TODO: Implementar no FirebaseDataSource
            Result.success(0)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao contar grupos admin", e)
            Result.failure(e)
        }
    }

    // ========== SINCRONIZAÇÃO ==========

    override suspend fun syncGroupMemberCount(groupId: String): Result<Unit> {
        return try {
            PlatformLogger.d(TAG, "Sincronizando member_count do grupo: $groupId")
            // TODO: Precisamos da lista de userIds
            firebaseDataSource.syncGroupMemberCount(groupId, emptyList())
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao sincronizar member_count", e)
            Result.failure(e)
        }
    }

    override suspend fun syncAllMyGroupsMemberCount(): Result<Unit> {
        return try {
            PlatformLogger.d(TAG, "Sincronizando member_count de todos os grupos")
            // TODO: Implementar no FirebaseDataSource
            Result.success(Unit)
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao sincronizar todos os member_counts", e)
            Result.failure(e)
        }
    }

    // ========== FOTO ==========

    override suspend fun uploadGroupPhoto(groupId: String, photoPath: String): Result<String> {
        return try {
            PlatformLogger.d(TAG, "Fazendo upload de foto do grupo: $groupId")
            // TODO: Implementar no FirebaseDataSource
            Result.success("")
        } catch (e: Exception) {
            PlatformLogger.e(TAG, "Erro ao fazer upload de foto", e)
            Result.failure(e)
        }
    }
}
