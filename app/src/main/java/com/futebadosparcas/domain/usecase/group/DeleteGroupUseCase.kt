package com.futebadosparcas.domain.usecase.group

import com.futebadosparcas.data.repository.GroupRepository

/**
 * Use Case para deletar um grupo (soft delete)
 */
class DeleteGroupUseCase constructor(
    private val groupRepository: GroupRepository
) {
    suspend operator fun invoke(groupId: String): Result<Unit> {
        return groupRepository.deleteGroup(groupId)
    }
}
