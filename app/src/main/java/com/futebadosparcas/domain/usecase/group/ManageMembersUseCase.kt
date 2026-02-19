package com.futebadosparcas.domain.usecase.group

import com.futebadosparcas.data.model.GroupMember
import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.data.repository.GroupRepository

/**
 * Use Case para gerenciamento de membros do grupo
 */
class ManageMembersUseCase constructor(
    private val groupRepository: GroupRepository
) {
    /**
     * Promove um membro a administrador
     */
    suspend fun promoteMember(groupId: String, member: GroupMember): Result<Unit> {
        // Validar se é um membro comum
        if (member.getRoleEnum() != GroupMemberRole.MEMBER) {
            return Result.failure(MemberManagementException("Apenas membros podem ser promovidos a administrador"))
        }

        return groupRepository.promoteMemberToAdmin(groupId, member.userId)
    }

    /**
     * Rebaixa um administrador a membro
     */
    suspend fun demoteMember(groupId: String, member: GroupMember): Result<Unit> {
        // Validar se é admin
        if (member.getRoleEnum() != GroupMemberRole.ADMIN) {
            return Result.failure(MemberManagementException("Apenas administradores podem ser rebaixados"))
        }

        return groupRepository.demoteAdminToMember(groupId, member.userId)
    }

    /**
     * Remove um membro do grupo
     */
    suspend fun removeMember(groupId: String, member: GroupMember): Result<Unit> {
        // Não pode remover owner
        if (member.getRoleEnum() == GroupMemberRole.OWNER) {
            return Result.failure(MemberManagementException("Não é possível remover o dono do grupo"))
        }

        return groupRepository.removeMember(groupId, member.userId)
    }

    /**
     * Obtém membros do grupo ordenados por role
     */
    suspend fun getOrderedMembers(groupId: String): Result<List<GroupMember>> {
        val result = groupRepository.getGroupMembers(groupId)

        return result.map { members ->
            members.sortedWith(
                compareBy<GroupMember> { member ->
                    when (member.getRoleEnum()) {
                        GroupMemberRole.OWNER -> 0
                        GroupMemberRole.ADMIN -> 1
                        GroupMemberRole.MEMBER -> 2
                    }
                }.thenBy { it.userName.lowercase() }
            )
        }
    }
}

class MemberManagementException(message: String) : Exception(message)
