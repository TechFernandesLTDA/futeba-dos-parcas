package com.futebadosparcas.domain.usecase.user

import com.futebadosparcas.data.repository.UserRepository
import com.futebadosparcas.domain.model.User

/**
 * Use case para buscar usuário por ID.
 *
 * NOTA: Use cases em KMP não usam @Inject (Hilt é Android-only).
 * Injeção manual via construtor ou factory pattern.
 */
class GetUserByIdUseCase(
    private val userRepository: UserRepository
) {
    suspend operator fun invoke(userId: String): Result<User> {
        return userRepository.getUserById(userId)
    }
}
