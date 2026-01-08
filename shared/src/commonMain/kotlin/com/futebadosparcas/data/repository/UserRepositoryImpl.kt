package com.futebadosparcas.data.repository

import com.futebadosparcas.db.FutebaDatabase
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import com.futebadosparcas.platform.logging.PlatformLogger
import com.futebadosparcas.platform.storage.PreferencesService
import kotlinx.coroutines.withContext
import kotlinx.coroutines.Dispatchers

/**
 * Implementação compartilhada (KMP) do UserRepository.
 *
 * Usa:
 * - FirebaseDataSource (expect/actual) para operações remotas
 * - SQLDelight para cache local
 * - PreferencesService para preferências simples
 * - PlatformLogger para logging
 *
 * Esta implementação é **compartilhada** entre Android e iOS!
 */
class UserRepositoryImpl(
    private val firebaseDataSource: FirebaseDataSource,
    private val database: FutebaDatabase,
    private val preferencesService: PreferencesService
) : UserRepository {

    companion object {
        private const val TAG = "UserRepository"
        private const val CACHE_TTL_MS = 5 * 60 * 1000L // 5 minutos
    }

    override suspend fun getCurrentUser(): Result<User> {
        return withContext(Dispatchers.Default) {
            try {
                PlatformLogger.d(TAG, "Buscando usuário atual")

                // 1. Tentar buscar do cache SQLDelight
                val userId = getCurrentUserId()
                    ?: return@withContext Result.failure(Exception("Usuário não autenticado"))

                val cachedUser = database.futebaDatabaseQueries
                    .selectUserById(userId)
                    .executeAsOneOrNull()

                // 2. Verificar se cache ainda é válido
                if (cachedUser != null && !isCacheExpired(cachedUser.cachedAt)) {
                    PlatformLogger.d(TAG, "Retornando usuário do cache")
                    return@withContext Result.success(cachedUser.toUser())
                }

                // 3. Buscar do Firebase
                PlatformLogger.d(TAG, "Cache expirado, buscando do Firebase")
                firebaseDataSource.getCurrentUser().also { result ->
                    result.getOrNull()?.let { user ->
                        // Atualizar cache
                        val now = currentTimeMillis()
                        database.futebaDatabaseQueries.insertUser(
                            id = user.id,
                            email = user.email,
                            name = user.name,
                            photoUrl = user.photoUrl,
                            fcmToken = user.fcmToken,
                            cachedAt = now
                        )
                        PlatformLogger.d(TAG, "Cache atualizado para usuário ${user.id}")
                    }
                }
            } catch (e: Exception) {
                PlatformLogger.e(TAG, "Erro ao buscar usuário atual", e)
                Result.failure(e)
            }
        }
    }

    override suspend fun getUserById(userId: String): Result<User> {
        return withContext(Dispatchers.Default) {
            try {
                // 1. Tentar cache
                val cachedUser = database.futebaDatabaseQueries
                    .selectUserById(userId)
                    .executeAsOneOrNull()

                if (cachedUser != null && !isCacheExpired(cachedUser.cachedAt)) {
                    return@withContext Result.success(cachedUser.toUser())
                }

                // 2. Buscar do Firebase
                firebaseDataSource.getUserById(userId).also { result ->
                    result.getOrNull()?.let { user ->
                        // Atualizar cache
                        database.futebaDatabaseQueries.insertUser(
                            id = user.id,
                            email = user.email,
                            name = user.name,
                            photoUrl = user.photoUrl,
                            fcmToken = user.fcmToken,
                            cachedAt = currentTimeMillis()
                        )
                    }
                }
            } catch (e: Exception) {
                PlatformLogger.e(TAG, "Erro ao buscar usuário $userId", e)
                Result.failure(e)
            }
        }
    }

    override suspend fun getUsersByIds(userIds: List<String>): Result<List<User>> {
        return withContext(Dispatchers.Default) {
            try {
                if (userIds.isEmpty()) {
                    return@withContext Result.success(emptyList())
                }

                // Buscar do Firebase (cache batch seria complexo aqui)
                firebaseDataSource.getUsersByIds(userIds)
            } catch (e: Exception) {
                PlatformLogger.e(TAG, "Erro ao buscar usuários em lote", e)
                Result.failure(e)
            }
        }
    }

    override suspend fun updateUser(userId: String, updates: Map<String, Any>): Result<Unit> {
        return withContext(Dispatchers.Default) {
            try {
                // Atualizar no Firebase
                firebaseDataSource.updateUser(userId, updates).also {
                    if (it.isSuccess) {
                        // Invalidar cache local
                        database.futebaDatabaseQueries.deleteUserById(userId)
                    }
                }
            } catch (e: Exception) {
                PlatformLogger.e(TAG, "Erro ao atualizar usuário", e)
                Result.failure(e)
            }
        }
    }

    override suspend fun searchUsers(query: String, limit: Int): Result<List<User>> {
        return withContext(Dispatchers.Default) {
            try {
                firebaseDataSource.searchUsers(query, limit)
            } catch (e: Exception) {
                PlatformLogger.e(TAG, "Erro ao buscar usuários", e)
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

    private fun isCacheExpired(cachedAt: Long): Boolean {
        val now = currentTimeMillis()
        return (now - cachedAt) > CACHE_TTL_MS
    }

    private fun currentTimeMillis(): Long {
        return kotlinx.datetime.Clock.System.now().toEpochMilliseconds()
    }
}

/**
 * Extensão para converter row do SQLDelight em User.
 */
private fun com.futebadosparcas.db.Users.toUser(): User {
    return User(
        id = this.id,
        email = this.email,
        name = this.name,
        photoUrl = this.photoUrl,
        fcmToken = this.fcmToken
    )
}
