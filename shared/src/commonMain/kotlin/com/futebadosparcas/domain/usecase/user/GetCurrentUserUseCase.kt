package com.futebadosparcas.domain.usecase.user

import com.futebadosparcas.data.repository.UserRepository
import com.futebadosparcas.domain.model.User

/**
 * Use case para buscar usuário atual autenticado.
 *
 * Exemplo de uso compartilhado entre Android e iOS.
 */
class GetCurrentUserUseCase(
    private val userRepository: UserRepository
) {
    suspend operator fun invoke(): Result<User> {
        return userRepository.getCurrentUser()
    }
}
