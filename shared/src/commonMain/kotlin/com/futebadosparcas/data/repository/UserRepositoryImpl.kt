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
                firebaseDataSource.getCurrentUser().also { result ->
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
        private const val CURRENT_USER_CACHE_TTL_MS = 15 * 60 * 1000L // 15 minutos para usuário atual
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

                firebaseDataSource.getUserById(userId).also { result ->
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
                firebaseDataSource.getUsersByIds(userIds)
            } catch (e: Exception) {
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
                // Tenta atualizar o cache em background ao começar a observar
                try {
                    getCurrentUser()
                } catch (e: Exception) {
                    // Ignore errors silently in flow trigger
                }
            }
    }

    override suspend fun updateUser(user: User): Result<Unit> {
        return withContext(Dispatchers.Default) {
            try {
                // Converter User para Map
                // Nota: Idealmente teriamos um mapper, aqui faremos simplificado para update basico
                // Ou chamamos um updateField especifico. 
                // O Datasource tem updateUser(id, map).
                
                val updates = mutableMapOf<String, Any>()
                if (user.name.isNotBlank()) updates["name"] = user.name
                user.nickname?.let { updates["nickname"] = it }
                user.photoUrl?.let { updates["photo_url"] = it }
                // Adicione outros campos conforme necessidade

                firebaseDataSource.updateUser(user.id, updates).also {
                    if (it.isSuccess) {
                        cacheUser(user) // Atualiza cache local ja com os dados novos
                    }
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }

    override suspend fun updateUserXp(userId: String, newXp: Long, newLevel: Int): Result<Unit> {
         return withContext(Dispatchers.Default) {
            try {
                firebaseDataSource.updateUserLevel(userId, newLevel, newXp).onSuccess {
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
                firebaseDataSource.unlockMilestone(userId, milestoneId).onSuccess {
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

    override fun isLoggedIn(): Boolean {
        return getCurrentUserId() != null
    }

    override fun getCurrentUserId(): String? {
        return firebaseDataSource.getCurrentUserId()
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
        milestonesAchieved = milestones
    )
}
