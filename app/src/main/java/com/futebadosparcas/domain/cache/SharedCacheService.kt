package com.futebadosparcas.domain.cache

import android.util.LruCache
import com.futebadosparcas.domain.model.User
import com.futebadosparcas.domain.model.Game
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Cache global compartilhado entre ViewModels para evitar requisições duplicadas.
 * Implementa LRU com TTL e invalidação inteligente.
 *
 * Features:
 * - Thread-safe com Mutex
 * - TTL configurável (padrão 5 min)
 * - LRU eviction automático
 * - Reactive updates via StateFlow
 * - Batch operations
 */
class SharedCacheService constructor() {

    // User cache: 500 usuários (aprox. 50KB cada = 25MB total)
    private val userCache = LruCache<String, CachedValue<User>>(500)
    private val userMutex = Mutex()

    // Game cache: 200 jogos (aprox. 10KB cada = 2MB total)
    private val gameCache = LruCache<String, CachedValue<Game>>(200)
    private val gameMutex = Mutex()

    // Reactive updates para observar mudanças
    private val userUpdates = MutableStateFlow<Pair<String, User?>>(Pair("", null))
    private val gameUpdates = MutableStateFlow<Pair<String, Game?>>(Pair("", null))

    // TTL padrão: 5 minutos
    private val defaultTtlMs = 5 * 60 * 1000L

    // ===========================
    // === USER CACHE OPERATIONS ===
    // ===========================

    /**
     * Busca um usuário do cache.
     * Retorna null se não estiver em cache ou estiver expirado.
     */
    suspend fun getUser(userId: String): User? = userMutex.withLock {
        val cached = userCache.get(userId)
        if (cached != null && !cached.isExpired()) {
            return cached.value
        }
        null
    }

    /**
     * Armazena um usuário no cache com TTL.
     */
    suspend fun putUser(userId: String, user: User, ttlMs: Long = defaultTtlMs) = userMutex.withLock {
        userCache.put(userId, CachedValue(user, System.currentTimeMillis() + ttlMs))
        userUpdates.value = Pair(userId, user)
    }

    /**
     * Busca múltiplos usuários do cache.
     * Retorna apenas os que estão em cache e não expirados.
     */
    suspend fun getBatchUsers(userIds: List<String>): Map<String, User> = userMutex.withLock {
        buildMap {
            userIds.forEach { userId ->
                val cached = userCache.get(userId)
                if (cached != null && !cached.isExpired()) {
                    put(userId, cached.value)
                }
            }
        }
    }

    /**
     * Armazena múltiplos usuários no cache em batch.
     */
    suspend fun putBatchUsers(users: Map<String, User>, ttlMs: Long = defaultTtlMs) = userMutex.withLock {
        users.forEach { (userId, user) ->
            userCache.put(userId, CachedValue(user, System.currentTimeMillis() + ttlMs))
        }
    }

    /**
     * Remove um usuário do cache (invalidação).
     */
    suspend fun invalidateUser(userId: String) = userMutex.withLock {
        userCache.remove(userId)
        userUpdates.value = Pair(userId, null)
    }

    /**
     * Observa atualizações de usuários em tempo real.
     */
    fun observeUserUpdates(): StateFlow<Pair<String, User?>> = userUpdates

    // ===========================
    // === GAME CACHE OPERATIONS ===
    // ===========================

    /**
     * Busca um jogo do cache.
     * Retorna null se não estiver em cache ou estiver expirado.
     */
    suspend fun getGame(gameId: String): Game? = gameMutex.withLock {
        val cached = gameCache.get(gameId)
        if (cached != null && !cached.isExpired()) {
            return cached.value
        }
        null
    }

    /**
     * Armazena um jogo no cache com TTL.
     */
    suspend fun putGame(gameId: String, game: Game, ttlMs: Long = defaultTtlMs) = gameMutex.withLock {
        gameCache.put(gameId, CachedValue(game, System.currentTimeMillis() + ttlMs))
        gameUpdates.value = Pair(gameId, game)
    }

    /**
     * Busca múltiplos jogos do cache.
     * Retorna apenas os que estão em cache e não expirados.
     */
    suspend fun getBatchGames(gameIds: List<String>): Map<String, Game> = gameMutex.withLock {
        buildMap {
            gameIds.forEach { gameId ->
                val cached = gameCache.get(gameId)
                if (cached != null && !cached.isExpired()) {
                    put(gameId, cached.value)
                }
            }
        }
    }

    /**
     * Remove um jogo do cache (invalidação).
     */
    suspend fun invalidateGame(gameId: String) = gameMutex.withLock {
        gameCache.remove(gameId)
        gameUpdates.value = Pair(gameId, null)
    }

    /**
     * Observa atualizações de jogos em tempo real.
     */
    fun observeGameUpdates(): StateFlow<Pair<String, Game?>> = gameUpdates

    // ===========================
    // === CACHE MANAGEMENT ===
    // ===========================

    /**
     * Limpa todos os caches.
     */
    suspend fun clearAll() {
        userMutex.withLock { userCache.evictAll() }
        gameMutex.withLock { gameCache.evictAll() }
    }

    /**
     * Remove entradas expiradas dos caches.
     */
    suspend fun clearExpired() {
        userMutex.withLock {
            val keysToRemove = mutableListOf<String>()
            userCache.snapshot().forEach { (key, value) ->
                if (value.isExpired()) keysToRemove.add(key)
            }
            keysToRemove.forEach { userCache.remove(it) }
        }

        gameMutex.withLock {
            val keysToRemove = mutableListOf<String>()
            gameCache.snapshot().forEach { (key, value) ->
                if (value.isExpired()) keysToRemove.add(key)
            }
            keysToRemove.forEach { gameCache.remove(it) }
        }
    }

    /**
     * Retorna estatísticas sobre os caches.
     */
    fun getCacheStats(): CacheStats {
        return CacheStats(
            userCacheSize = userCache.size(),
            userCacheMaxSize = 500,
            gameCacheSize = gameCache.size(),
            gameCacheMaxSize = 200
        )
    }

    /**
     * Data class para estatísticas de cache.
     */
    data class CacheStats(
        val userCacheSize: Int,
        val userCacheMaxSize: Int,
        val gameCacheSize: Int,
        val gameCacheMaxSize: Int
    )

    /**
     * Wrapper para valores em cache com timestamp de expiração.
     */
    private data class CachedValue<T>(
        val value: T,
        val expiresAt: Long
    ) {
        /**
         * Verifica se o valor expirou.
         */
        fun isExpired(): Boolean = System.currentTimeMillis() > expiresAt
    }
}
