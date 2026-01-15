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

    // ========== OPERAÇÕES BÁSICAS ==========

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

    // ========== CRIAÇÃO E EDIÇÃO ==========

    /**
     * Cria um novo grupo com o usuário atual como owner.
     * @param name Nome do grupo
     * @param description Descrição do grupo
     * @param photoUri URI da foto (opcional, plataforma-específico)
     * @return Group criado com ID
     */
    suspend fun createGroup(
        name: String,
        description: String,
        photoUri: String? = null
    ): Result<Group>

    /**
     * Atualiza um grupo (nome, descrição, foto).
     * @param groupId ID do grupo
     * @param name Novo nome
     * @param description Nova descrição
     * @param photoUri URI da nova foto (opcional, plataforma-específico)
     */
    suspend fun updateGroup(
        groupId: String,
        name: String,
        description: String,
        photoUri: String? = null
    ): Result<Unit>

    // ========== MEMBROS ==========

    /**
     * Busca membros de um grupo (apenas ativos).
     */
    suspend fun getGroupMembers(groupId: String): Result<List<GroupMember>>

    /**
     * Observa membros em tempo real.
     */
    fun observeGroupMembers(groupId: String): Flow<List<GroupMember>>

    /**
     * Observa membros ordenados por role (Owner > Admin > Member).
     */
    fun observeOrderedGroupMembers(groupId: String): Flow<List<GroupMember>>

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
     * Promove um membro a admin (apenas owner).
     */
    suspend fun promoteMemberToAdmin(groupId: String, memberId: String): Result<Unit>

    /**
     * Rebaixa um admin a membro (apenas owner).
     */
    suspend fun demoteAdminToMember(groupId: String, memberId: String): Result<Unit>

    /**
     * Atualiza role do membro.
     */
    suspend fun updateMemberRole(
        groupId: String,
        userId: String,
        role: GroupMemberRole
    ): Result<Unit>

    /**
     * Busca o papel do usuário atual em um grupo.
     */
    suspend fun getMyRoleInGroup(groupId: String): Result<GroupMemberRole?>

    /**
     * Verifica se o usuário é membro ativo de um grupo.
     */
    suspend fun isMemberOfGroup(groupId: String): Result<Boolean>

    // ========== CONVITES ==========

    /**
     * Entra em um grupo por codigo de convite.
     */
    suspend fun joinByInviteCode(inviteCode: String): Result<String>

    /**
     * Gera novo codigo de convite.
     */
    suspend fun generateInviteCode(groupId: String): Result<String>

    // ========== SAIR E GERENCIAR ==========

    /**
     * Sai do grupo (nao pode ser owner).
     */
    suspend fun leaveGroup(groupId: String): Result<Unit>

    /**
     * Arquiva o grupo (apenas owner).
     */
    suspend fun archiveGroup(groupId: String): Result<Unit>

    /**
     * Restaura um grupo arquivado (apenas owner).
     */
    suspend fun restoreGroup(groupId: String): Result<Unit>

    /**
     * Deleta o grupo - soft delete (apenas owner).
     */
    suspend fun deleteGroup(groupId: String): Result<Unit>

    /**
     * Transfere a propriedade do grupo para outro membro.
     */
    suspend fun transferOwnership(groupId: String, newOwnerId: String): Result<Unit>

    // ========== CONSULTAS ÚTEIS ==========

    /**
     * Busca grupos válidos para criar jogos (>= 2 membros ativos e usuario é admin).
     */
    suspend fun getValidGroupsForGame(): Result<List<UserGroup>>

    /**
     * Verifica se o usuário pode criar jogos (tem grupo válido).
     */
    suspend fun canCreateGames(): Result<Boolean>

    /**
     * Conta quantos grupos o usuário possui onde é admin.
     */
    suspend fun countMyAdminGroups(): Result<Int>

    // ========== SINCRONIZAÇÃO ==========

    /**
     * Sincroniza o member_count de um grupo específico em todos os UserGroups.
     * Útil para corrigir dados inconsistentes.
     */
    suspend fun syncGroupMemberCount(groupId: String): Result<Unit>

    /**
     * Sincroniza o member_count de todos os grupos do usuário atual.
     */
    suspend fun syncAllMyGroupsMemberCount(): Result<Unit>

    // ========== FOTO (Plataforma-Específico) ==========

    /**
     * Faz upload da foto do grupo (plataforma-específico).
     * No Android, recebe Uri. No iOS, recebe caminho de arquivo.
     * Implementação deve retornar URL pública.
     */
    suspend fun uploadGroupPhoto(groupId: String, photoPath: String): Result<String>
}
