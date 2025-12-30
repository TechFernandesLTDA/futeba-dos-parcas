package com.futebadosparcas.domain.usecase.group

import com.futebadosparcas.data.model.GroupMember
import com.futebadosparcas.data.model.GroupMemberRole
import com.futebadosparcas.data.repository.GroupRepository
import javax.inject.Inject

/**
 * Use Case para transferir propriedade do grupo
 */
class TransferOwnershipUseCase @Inject constructor(
    private val groupRepository: GroupRepository
) {
    suspend operator fun invoke(groupId: String, newOwner: GroupMember): Result<Unit> {
        // Validar que o novo owner não é o owner atual
        if (newOwner.getRoleEnum() == GroupMemberRole.OWNER) {
            return Result.failure(TransferOwnershipException("Este membro já é o dono do grupo"))
        }

        // Validar que o membro está ativo
        if (!newOwner.isActive()) {
            return Result.failure(TransferOwnershipException("O membro precisa estar ativo para receber a propriedade"))
        }

        return groupRepository.transferOwnership(groupId, newOwner.userId)
    }
}

class TransferOwnershipException(message: String) : Exception(message)
