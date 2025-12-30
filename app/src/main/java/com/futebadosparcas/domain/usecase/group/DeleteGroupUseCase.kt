package com.futebadosparcas.domain.usecase.group

import com.futebadosparcas.data.repository.GroupRepository
import javax.inject.Inject

/**
 * Use Case para deletar um grupo (soft delete)
 */
class DeleteGroupUseCase @Inject constructor(
    private val groupRepository: GroupRepository
) {
    suspend operator fun invoke(groupId: String): Result<Unit> {
        return groupRepository.deleteGroup(groupId)
    }
}
