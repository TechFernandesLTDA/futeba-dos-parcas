package com.futebadosparcas.domain.repository

import com.futebadosparcas.domain.model.User
import kotlinx.coroutines.flow.Flow

/**
 * Interface de repositorio de usuarios.
 * Implementacoes especificas de plataforma em androidMain/iosMain.
 */
interface UserRepository {

    /**
     * Retorna o usuario atual logado.
     */
    suspend fun getCurrentUser(): Result<User>

    /**
     * Retorna o ID do usuario atual.
     */
    fun getCurrentUserId(): String?

    /**
     * Busca um usuario por ID.
     */
    suspend fun getUserById(userId: String): Result<User>

    /**
     * Busca multiplos usuarios por IDs.
     */
    suspend fun getUsersByIds(userIds: List<String>): Result<List<User>>

    /**
     * Observa o usuario atual em tempo real.
     */
    fun observeCurrentUser(): Flow<User?>

    /**
     * Atualiza dados do usuario.
     */
    suspend fun updateUser(user: User): Result<Unit>

    /**
     * Atualiza o XP e nivel do usuario.
     */
    suspend fun updateUserXp(
        userId: String,
        newXp: Long,
        newLevel: Int
    ): Result<Unit>

    /**
     * Adiciona milestone conquistado.
     */
    suspend fun addMilestone(userId: String, milestoneId: String): Result<Unit>

    /**
     * Busca usuarios por nome (pesquisa).
     */
    suspend fun searchUsers(query: String, limit: Int = 20): Result<List<User>>

    /**
     * Verifica se o usuario esta logado.
     */
    fun isLoggedIn(): Boolean

    /**
     * Atualiza o token FCM do usuario para push notifications.
     */
    suspend fun updateFcmToken(token: String): Result<Unit>

    /**
     * Busca todos os usuarios sem paginacao (uso interno).
     * @deprecated Preferir searchUsers() para melhor performance.
     */
    @Deprecated("Use searchUsers() for better performance")
    suspend fun getAllUsersUnpaginated(): Result<List<User>>

    /**
     * Atualiza o role (permissão) do usuario.
     */
    suspend fun updateUserRole(userId: String, newRole: String): Result<Unit>

    /**
     * Busca todos os usuarios que são donos de quadra.
     */
    suspend fun getFieldOwners(): Result<List<User>>

    /**
     * Atualiza a visibilidade do perfil do usuario para busca.
     */
    suspend fun updateProfileVisibility(isSearchable: Boolean): Result<Unit>
}
