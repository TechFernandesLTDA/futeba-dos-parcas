package com.futebadosparcas.domain.usecase.group

import com.futebadosparcas.domain.usecase.ValidateGroupDescriptionUseCase
import com.futebadosparcas.domain.usecase.ValidateGroupNameUseCase
import com.futebadosparcas.data.repository.GroupRepository

/**
 * Use Case para atualizar informações do grupo
 */
class UpdateGroupUseCase constructor(
    private val groupRepository: GroupRepository
) {
    suspend operator fun invoke(
        groupId: String,
        name: String,
        description: String,
        photoUri: String? = null,
        defaultGender: String? = null
    ): Result<Unit> {
        val nameResult = ValidateGroupNameUseCase(name)
        if (nameResult.isError()) {
            return Result.failure(GroupValidationException(nameResult.getErrorOrNull() ?: "Nome inválido"))
        }

        val descResult = ValidateGroupDescriptionUseCase(description)
        if (descResult.isError()) {
            return Result.failure(GroupValidationException(descResult.getErrorOrNull() ?: "Descrição inválida"))
        }

        val validatedName = nameResult.getOrNull() ?: name
        val validatedDesc = descResult.getOrNull() ?: description

        return groupRepository.updateGroup(groupId, validatedName, validatedDesc, photoUri, defaultGender)
    }
}
