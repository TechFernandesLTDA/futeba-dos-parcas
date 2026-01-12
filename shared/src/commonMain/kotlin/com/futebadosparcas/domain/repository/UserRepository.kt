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
     * Busca todos os usuarios (uso admin).
     */
    suspend fun getAllUsers(): Result<List<User>>

    /**
     * Atualiza o role de um usuario (uso admin).
     */
    suspend fun updateUserRole(userId: String, newRole: String): Result<Unit>

    /**
     * Atualiza ratings automaticos do usuario.
     */
    suspend fun updateAutoRatings(
        userId: String,
        autoStrikerRating: Double,
        autoMidRating: Double,
        autoDefenderRating: Double,
        autoGkRating: Double,
        autoRatingSamples: Int
    ): Result<Unit>

    /**
     * Verifica se o usuario esta logado.
     */
    fun isLoggedIn(): Boolean

    /**
     * Atualiza visibilidade do perfil (busca).
     */
    suspend fun updateProfileVisibility(userId: String, isSearchable: Boolean): Result<Unit>

    /**
     * Busca todos os donos de quadra (FIELD_OWNER).
     */
    suspend fun getFieldOwners(): Result<List<User>>

    /**
     * Atualiza o token FCM do usuario.
     */
    suspend fun updateFcmToken(token: String): Result<Unit>
}
