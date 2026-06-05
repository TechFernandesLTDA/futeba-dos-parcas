package com.futebadosparcas.domain.usecase.group

import com.futebadosparcas.domain.model.Group
import com.futebadosparcas.domain.usecase.ValidateGroupDescriptionUseCase
import com.futebadosparcas.domain.usecase.ValidateGroupNameUseCase
import com.futebadosparcas.data.repository.GroupRepository

/**
 * Use Case para criação de grupos
 */
class CreateGroupUseCase constructor(
    private val groupRepository: GroupRepository
) {
    suspend operator fun invoke(
        name: String,
        description: String,
        photoUri: String? = null,
        defaultGender: String? = null
    ): Result<Group> {
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

        return groupRepository.createGroup(validatedName, validatedDesc, photoUri, defaultGender)
    }
}

class GroupValidationException(message: String) : Exception(message)
