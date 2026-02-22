package com.futebadosparcas.domain.usecase.group

import android.net.Uri
import com.futebadosparcas.domain.model.Group
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
        photoUri: Uri? = null
    ): Result<Group> {
        // Validações
        val trimmedName = name.trim()
        val trimmedDescription = description.trim()

        if (trimmedName.isEmpty()) {
            return Result.failure(GroupValidationException("Nome do grupo é obrigatório"))
        }

        if (trimmedName.length < 3) {
            return Result.failure(GroupValidationException("Nome deve ter pelo menos 3 caracteres"))
        }

        if (trimmedName.length > 50) {
            return Result.failure(GroupValidationException("Nome deve ter no máximo 50 caracteres"))
        }

        if (trimmedDescription.length > 200) {
            return Result.failure(GroupValidationException("Descrição deve ter no máximo 200 caracteres"))
        }

        // Validar caracteres especiais no nome
        if (!trimmedName.matches(Regex("^[\\p{L}\\p{N}\\s\\-_']+$"))) {
            return Result.failure(GroupValidationException("Nome contém caracteres inválidos"))
        }

        return groupRepository.createGroup(trimmedName, trimmedDescription, photoUri)
    }
}

class GroupValidationException(message: String) : Exception(message)
