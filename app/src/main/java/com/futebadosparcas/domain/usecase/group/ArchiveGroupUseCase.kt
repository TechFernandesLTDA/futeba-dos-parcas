package com.futebadosparcas.domain.usecase.group

import com.futebadosparcas.data.repository.GroupRepository

/**
 * Use Case para arquivar um grupo
 */
class ArchiveGroupUseCase constructor(
    private val groupRepository: GroupRepository
) {
    suspend operator fun invoke(groupId: String): Result<Unit> {
        return groupRepository.archiveGroup(groupId)
    }
}
