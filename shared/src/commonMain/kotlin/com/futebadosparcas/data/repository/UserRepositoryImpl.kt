package com.futebadosparcas.data.repository

import com.futebadosparcas.db.FutebaDatabase
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import com.futebadosparcas.platform.logging.PlatformLogger
import com.futebadosparcas.platform.storage.PreferencesService
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers

import com.futebadosparcas.domain.repository.UserRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onStart
import app.cash.sqldelight.coroutines.asFlow
import app.cash.sqldelight.coroutines.mapToOneOrNull

/**
 * Implementação compartilhada (KMP) do UserRepository.
 */
class UserRepositoryImpl(
    private val firebaseDataSource: FirebaseDataSource,
    private val database: FutebaDatabase,
    private val preferencesService: PreferencesService
) : UserRepository {

    // ... (existing companion object and getCurrentUser/getUserById/getUsersByIds) ...

    override suspend fun getCurrentUser(): Result<User> {
        return withContext(Dispatchers.Default) {
             try {
                // 1. Tentar buscar do cache SQLDelight
                val userId = getCurrentUserId()
                    ?: return@withContext Result.failure(Exception("Usuário não autenticado"))

                val cachedUser = database.futebaDatabaseQueries
                    .selectUserById(userId)
                    .executeAsOneOrNull()

                // 2. Verificar se cache ainda é válido
                if (cachedUser != null && !isCacheExpired(cachedUser.cachedAt, CURRENT_USER_CACHE_TTL_MS)) {
                    return@withContext Result.success(cachedUser.toUser())
                }

                // 3. Buscar do Firebase
                return@withContext firebaseDataSource.getCurrentUser().also { result ->
                    result.getOrNull()?.let { user ->
                        cacheUser(user)
                    }
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }
    
    // ... (keep existing getUserById implementation, just ensuring cachedUser logic uses helper if possible or duplicate) ...
    // Since I'm replacing the whole block, I should output everything.

    companion object {
        private const val TAG = "UserRepository"
        // Cache reduzido para 1 minuto - garante dados frescos para permissões/role
        private const val CURRENT_USER_CACHE_TTL_MS = 60 * 1000L // 1 minuto para usuário atual
        private const val OTHER_USER_CACHE_TTL_MS = 30 * 60 * 1000L // 30 minutos para outros usuários
    }

    override suspend fun getUserById(userId: String): Result<User> {
        return withContext(Dispatchers.Default) {
            try {
                val cachedUser = database.futebaDatabaseQueries
                    .selectUserById(userId)
                    .executeAsOneOrNull()

                if (cachedUser != null && !isCacheExpired(cachedUser.cachedAt, OTHER_USER_CACHE_TTL_MS)) {
                    return@withContext Result.success(cachedUser.toUser())
                }

                return@withContext firebaseDataSource.getUserById(userId).also { result ->
                    result.getOrNull()?.let { user ->
                        cacheUser(user)
                    }
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }

    override suspend fun getUsersByIds(userIds: List<String>): Result<List<User>> {
         return withContext(Dispatchers.Default) {
            try {
                if (userIds.isEmpty()) return@withContext Result.success(emptyList())

                // ✅ OTIMIZAÇÃO: Tentar cache local primeiro
                val cachedUsers = database.futebaDatabaseQueries
                    .selectAllUsers()
                    .executeAsList()
                    .map { it.toUser() }
                    .filter { it.id in userIds }
                    .filterNot { isCacheExpired(it.experiencePoints, OTHER_USER_CACHE_TTL_MS) }

                // Se temos todos no cache, retornar
                if (cachedUsers.size == userIds.size) {
                    PlatformLogger.d(TAG, "getUsersByIds: Cache hit! ${userIds.size} users from local cache")
                    return@withContext Result.success(cachedUsers)
                }

                // Identificar usuários faltantes
                val cachedIds = cachedUsers.map { it.id }.toSet()
                val missingIds = userIds.filter { it !in cachedIds }

                PlatformLogger.d(TAG, "getUsersByIds: ${cachedUsers.size}/${userIds.size} cached, fetching ${missingIds.size} from Firebase")

                // Buscar apenas os faltantes do Firebase
                firebaseDataSource.getUsersByIds(missingIds).onSuccess { newUsers ->
                    // ✅ Cache os novos usuários
                    newUsers.forEach { user ->
                        cacheUser(user)
                        PlatformLogger.d(TAG, "Cached user: ${user.id}")
                    }
                }.getOrNull()?.let { newUsers ->
                    // Retornar cache + novos
                    Result.success(cachedUsers + newUsers)
                } ?: run {
                    // Se Firebase falhar, retornar o que temos no cache
                    Result.success(cachedUsers)
                }
            } catch (e: Exception) {
                PlatformLogger.e(TAG, "Erro ao buscar users por IDs", e)
                Result.failure(e)
            }
        }
    }

    override fun observeCurrentUser(): Flow<User?> {
        val userId = getCurrentUserId() ?: return flowOf(null)

        return database.futebaDatabaseQueries
            .selectUserById(userId)
            .asFlow()
            .mapToOneOrNull(Dispatchers.Default)
            .map { it?.toUser() }
            .onStart {
                // SEMPRE buscar dados frescos do Firebase
                // Isso garante que mudanças de role/permissões sejam refletidas imediatamente
                try {
                    getCurrentUser() // Força atualização do cache
                } catch (e: Exception) {
                    PlatformLogger.w(TAG, "observeCurrentUser: Failed to refresh (using cache): ${e.message}")
                }
            }
    }

    override suspend fun updateUser(user: User): Result<Unit> {
        return withContext(Dispatchers.Default) {
            try {
                PlatformLogger.d(TAG, "updateUser: Starting update for user ${user.id}")

                // Converter User para Map com todos os campos do perfil
                // Incluindo campos pessoais, ratings e preferencias
                val updates = mutableMapOf<String, Any>()

                // Campos basicos
                if (user.name.isNotBlank()) updates["name"] = user.name
                user.nickname?.let { updates["nickname"] = it }
                user.photoUrl?.let { updates["photo_url"] = it }

                // Preferencias de campo (tipo Society, Futsal, Campo)
                updates["preferred_field_types"] = user.preferredFieldTypes.map { it.name }

                // Ratings manuais (0.0 - 5.0)
                updates["striker_rating"] = user.strikerRating
                updates["mid_rating"] = user.midRating
                updates["defender_rating"] = user.defenderRating
                updates["gk_rating"] = user.gkRating

                // Informacoes pessoais
                user.birthDate?.let { updates["birth_date"] = it }
                user.gender?.let { updates["gender"] = it }
                user.heightCm?.let { updates["height_cm"] = it }
                user.weightKg?.let { updates["weight_kg"] = it }
                user.dominantFoot?.let { updates["dominant_foot"] = it }
                user.primaryPosition?.let { updates["primary_position"] = it }
                user.secondaryPosition?.let { updates["secondary_position"] = it }
                user.playStyle?.let { updates["play_style"] = it }
                user.experienceYears?.let { updates["experience_years"] = it }

                PlatformLogger.d(TAG, "updateUser: Sending updates to Firebase: ${updates.keys}")

                return@withContext firebaseDataSource.updateUser(user.id, updates).also { result ->
                    if (result.isSuccess) {
                        // Invalidar cache para forcar recarga do Firebase com dados atualizados
                        database.futebaDatabaseQueries.deleteUserById(user.id)
                        PlatformLogger.d(TAG, "User ${user.id} updated successfully, cache invalidated")
                    } else {
                        val error = result.exceptionOrNull()
                        PlatformLogger.e(TAG, "Failed to update user ${user.id}: ${error?.message}", error)
                    }
                }
            } catch (e: Exception) {
                PlatformLogger.e(TAG, "Exception in updateUser", e)
                Result.failure(e)
            }
        }
    }

    /**
     * Busca o usuário atual SEM usar cache, garantindo dados frescos do Firebase.
     * Use este método após atualizações para garantir que os dados mais recentes sejam retornados.
     */
    suspend fun getCurrentUserFresh(): Result<User> {
        return firebaseDataSource.getCurrentUser().also { result ->
            result.getOrNull()?.let { user ->
                // Atualizar cache com dados frescos
                cacheUser(user)
            }
        }
    }

    override suspend fun updateUserXp(userId: String, newXp: Long, newLevel: Int): Result<Unit> {
         return withContext(Dispatchers.Default) {
            try {
                return@withContext firebaseDataSource.updateUserLevel(userId, newLevel, newXp).onSuccess {
                    // Invalidar ou atualizar cache
                     database.futebaDatabaseQueries.deleteUserById(userId)
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }

    override suspend fun addMilestone(userId: String, milestoneId: String): Result<Unit> {
        return withContext(Dispatchers.Default) {
            try {
                return@withContext firebaseDataSource.unlockMilestone(userId, milestoneId).onSuccess {
                     // Invalidar ou atualizar cache
                     database.futebaDatabaseQueries.deleteUserById(userId)
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }

    override suspend fun searchUsers(query: String, limit: Int): Result<List<User>> {
         return withContext(Dispatchers.Default) {
            try {
                firebaseDataSource.searchUsers(query, limit)
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }

    override suspend fun getAllUsers(): Result<List<User>> {
        return withContext(Dispatchers.Default) {
            try {
                firebaseDataSource.getAllUsers()
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }

    override suspend fun updateUserRole(userId: String, newRole: String): Result<Unit> {
        return withContext(Dispatchers.Default) {
            try {
                return@withContext firebaseDataSource.updateUserRole(userId, newRole).also {
                    if (it.isSuccess) {
                        // Invalidar cache
                        database.futebaDatabaseQueries.deleteUserById(userId)
                    }
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }

    override suspend fun updateAutoRatings(
        userId: String,
        autoStrikerRating: Double,
        autoMidRating: Double,
        autoDefenderRating: Double,
        autoGkRating: Double,
        autoRatingSamples: Int
    ): Result<Unit> {
        return withContext(Dispatchers.Default) {
            try {
                return@withContext firebaseDataSource.updateAutoRatings(
                    userId,
                    autoStrikerRating,
                    autoMidRating,
                    autoDefenderRating,
                    autoGkRating,
                    autoRatingSamples
                ).also {
                    if (it.isSuccess) {
                        // Invalidar cache
                        database.futebaDatabaseQueries.deleteUserById(userId)
                    }
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }

    override fun isLoggedIn(): Boolean {
        return getCurrentUserId() != null
    }

    override fun getCurrentUserId(): String? {
        return firebaseDataSource.getCurrentUserId()
    }

    override suspend fun updateProfileVisibility(userId: String, isSearchable: Boolean): Result<Unit> {
        return withContext(Dispatchers.Default) {
            try {
                return@withContext firebaseDataSource.updateProfileVisibility(userId, isSearchable).also {
                    if (it.isSuccess) {
                        // Invalidar cache
                        database.futebaDatabaseQueries.deleteUserById(userId)
                    }
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }

    override suspend fun getFieldOwners(): Result<List<User>> {
        return withContext(Dispatchers.Default) {
            try {
                firebaseDataSource.getFieldOwners()
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }

    override suspend fun updateFcmToken(token: String): Result<Unit> {
        return withContext(Dispatchers.Default) {
            try {
                return@withContext firebaseDataSource.updateFcmToken(token).also {
                    if (it.isSuccess) {
                        // Invalidar cache do usuário atual
                        getCurrentUserId()?.let { userId ->
                            database.futebaDatabaseQueries.deleteUserById(userId)
                        }
                    }
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }

    // ========== HELPERS ==========

    private fun cacheUser(user: User) {
        val now = currentTimeMillis()
        database.futebaDatabaseQueries.insertUser(
            id = user.id,
            email = user.email,
            name = user.name,
            photoUrl = user.photoUrl,
            fcmToken = user.fcmToken,
            experiencePoints = user.experiencePoints,
            level = user.level.toLong(),
            milestonesAchieved = user.milestonesAchieved.joinToString(","),
            role = user.role,  // ✅ CRITICAL FIX: Cachear role para suportar permissões
            cachedAt = now
        )
    }

    private fun isCacheExpired(cachedAt: Long, ttl: Long): Boolean {
        val now = currentTimeMillis()
        return (now - cachedAt) > ttl
    }

    private fun currentTimeMillis(): Long {
        return kotlinx.datetime.Clock.System.now().toEpochMilliseconds()
    }
}

/**
 * Extensão para converter row do SQLDelight em User (com campos de gamificação).
 */
private fun com.futebadosparcas.db.Users.toUser(): User {
    val milestones: List<String> = if (this.milestonesAchieved.isNotEmpty()) {
        this.milestonesAchieved.split(",")
    } else {
        emptyList()
    }

    return User(
        id = this.id,
        email = this.email,
        name = this.name,
        photoUrl = this.photoUrl,
        fcmToken = this.fcmToken,
        experiencePoints = this.experiencePoints,
        level = this.level.toInt(),
        milestonesAchieved = milestones,
        role = this.role  // ✅ CRITICAL FIX: Mapear role do cache para suportar permissões
    )
}
