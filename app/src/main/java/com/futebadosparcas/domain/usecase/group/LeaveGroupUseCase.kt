package com.futebadosparcas.domain.usecase.group

import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.data.repository.GroupRepository
import javax.inject.Inject

/**
 * Use Case para sair de um grupo
 */
class LeaveGroupUseCase @Inject constructor(
    private val groupRepository: GroupRepository
) {
    suspend operator fun invoke(groupId: String): Result<Unit> {
        // Verificar se o usuário é owner
        val roleResult = groupRepository.getMyRoleInGroup(groupId)

        if (roleResult.isFailure) {
            return Result.failure(roleResult.exceptionOrNull() ?: Exception("Erro ao verificar permissão"))
        }

        val role = roleResult.getOrNull()

        if (role == GroupMemberRole.OWNER) {
            return Result.failure(
                LeaveGroupException("O dono não pode sair do grupo. Transfira a propriedade primeiro.")
            )
        }

        if (role == null) {
            return Result.failure(LeaveGroupException("Você não é membro deste grupo"))
        }

        return groupRepository.leaveGroup(groupId)
    }
}

class LeaveGroupException(message: String) : Exception(message)
