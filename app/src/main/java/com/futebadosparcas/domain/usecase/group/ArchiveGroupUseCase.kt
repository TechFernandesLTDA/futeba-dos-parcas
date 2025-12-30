package com.futebadosparcas.domain.usecase.group

import com.futebadosparcas.data.repository.GroupRepository
import javax.inject.Inject

/**
 * Use Case para arquivar um grupo
 */
class ArchiveGroupUseCase @Inject constructor(
    private val groupRepository: GroupRepository
) {
    suspend operator fun invoke(groupId: String): Result<Unit> {
        return groupRepository.archiveGroup(groupId)
    }
}
