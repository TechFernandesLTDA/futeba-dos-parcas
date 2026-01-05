package com.futebadosparcas.domain.repository

import com.futebadosparcas.domain.model.Group
import com.futebadosparcas.domain.model.GroupMember
import com.futebadosparcas.domain.model.GroupMemberRole
import com.futebadosparcas.domain.model.UserGroup
import kotlinx.coroutines.flow.Flow

/**
 * Interface de repositorio de grupos.
 * Implementacoes especificas de plataforma em androidMain/iosMain.
 */
interface GroupRepository {

    /**
     * Busca grupos do usuario atual.
     */
    suspend fun getUserGroups(): Result<List<UserGroup>>

    /**
     * Observa grupos do usuario em tempo real.
     */
    fun observeUserGroups(): Flow<List<UserGroup>>

    /**
     * Busca um grupo por ID.
     */
    suspend fun getGroupById(groupId: String): Result<Group>

    /**
     * Observa um grupo em tempo real.
     */
    fun observeGroup(groupId: String): Flow<Group?>

    /**
     * Cria um novo grupo.
     */
    suspend fun createGroup(group: Group): Result<String>

    /**
     * Atualiza um grupo.
     */
    suspend fun updateGroup(group: Group): Result<Unit>

    /**
     * Busca membros de um grupo.
     */
    suspend fun getGroupMembers(groupId: String): Result<List<GroupMember>>

    /**
     * Observa membros em tempo real.
     */
    fun observeGroupMembers(groupId: String): Flow<List<GroupMember>>

    /**
     * Adiciona membro ao grupo.
     */
    suspend fun addMember(
        groupId: String,
        userId: String,
        role: GroupMemberRole = GroupMemberRole.MEMBER
    ): Result<Unit>

    /**
     * Remove membro do grupo.
     */
    suspend fun removeMember(groupId: String, userId: String): Result<Unit>

    /**
     * Atualiza role do membro.
     */
    suspend fun updateMemberRole(
        groupId: String,
        userId: String,
        role: GroupMemberRole
    ): Result<Unit>

    /**
     * Entra em um grupo por codigo de convite.
     */
    suspend fun joinByInviteCode(inviteCode: String): Result<String>

    /**
     * Gera novo codigo de convite.
     */
    suspend fun generateInviteCode(groupId: String): Result<String>

    /**
     * Sai do grupo.
     */
    suspend fun leaveGroup(groupId: String): Result<Unit>
}
