package com.futebadosparcas.data.repository

import com.futebadosparcas.domain.model.User

/**
 * Interface do repositório de usuários (KMP).
 *
 * Define contrato para operações de usuário, permitindo implementações
 * específicas de plataforma enquanto mantém a lógica compartilhada.
 */
interface UserRepository {
    suspend fun getCurrentUser(): Result<User>
    suspend fun getUserById(userId: String): Result<User>
    suspend fun getUsersByIds(userIds: List<String>): Result<List<User>>
    suspend fun updateUser(userId: String, updates: Map<String, Any>): Result<Unit>
    suspend fun searchUsers(query: String, limit: Int = 20): Result<List<User>>

    // Helpers
    fun isLoggedIn(): Boolean
    fun getCurrentUserId(): String?
}

/**
 * Resultado paginado de usuários.
 */
data class PaginatedUsers(
    val users: List<User>,
    val nextCursor: String?,
    val hasNextPage: Boolean
)
