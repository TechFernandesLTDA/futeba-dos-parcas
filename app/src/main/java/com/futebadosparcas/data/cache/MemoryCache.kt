package com.futebadosparcas.data.cache

import android.util.LruCache
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.time.Duration
import kotlin.time.Duration.Companion.minutes

/**
 * In-Memory LRU Cache
 *
 * Provides fast in-memory caching with LRU eviction policy.
 * Useful for frequently accessed data (user profiles, game details, etc.)
 *
 * Features:
 * - LRU eviction (Least Recently Used)
 * - TTL (Time To Live) support
 * - Size-based eviction
 * - Thread-safe
 *
 * Usage:
 * ```kotlin
 * @Inject lateinit var memoryCache: MemoryCache
 *
 * // Put
 * memoryCache.put("user_123", user, ttl = 5.minutes)
 *
 * // Get
 * val user = memoryCache.get<User>("user_123")
 *
 * // Remove
 * memoryCache.remove("user_123")
 * ```
 */
@Singleton
class MemoryCache @Inject constructor() {

    companion object {
        /** Fração da memória disponível usada para cache (1/5 = 20%) */
        private const val MEMORY_FRACTION = 5

        /** Cache size: 20% da memória disponível (em KB) */
        private val MAX_CACHE_SIZE = (Runtime.getRuntime().maxMemory() / 1024 / MEMORY_FRACTION).toInt()

        /** TTL padrão para entradas de cache */
        private val DEFAULT_TTL = 5.minutes

        /** Overhead base por entrada para estimativa de tamanho */
        private const val ENTRY_BASE_OVERHEAD = 1

        /** Divisor para estimativa de tamanho proporcional ao key */
        private const val KEY_SIZE_DIVISOR = 100
    }

    private val cache = object : LruCache<String, CacheEntry<Any>>(MAX_CACHE_SIZE) {
        override fun sizeOf(key: String, value: CacheEntry<Any>): Int {
            // Estimativa aproximada: overhead do objeto + tamanho proporcional à chave
            return ENTRY_BASE_OVERHEAD + key.length / KEY_SIZE_DIVISOR
        }
    }

    /**
     * Put data in cache with optional TTL
     */
    fun <T : Any> put(key: String, value: T, ttl: Duration = DEFAULT_TTL) {
        val entry = CacheEntry(
            data = value,
            timestamp = System.currentTimeMillis(),
            ttl = ttl
        )
        cache.put(key, entry as CacheEntry<Any>)
    }

    /**
     * Get data from cache (null if not found or expired)
     */
    @Suppress("UNCHECKED_CAST")
    fun <T : Any> get(key: String): T? {
        val entry = cache.get(key) ?: return null

        // Check if expired
        if (entry.isExpired()) {
            cache.remove(key)
            return null
        }

        return entry.data as? T
    }

    /**
     * Get cached data with metadata
     */
    fun <T : Any> getWithMetadata(key: String): CachedData<T>? {
        val entry = cache.get(key) ?: return null

        if (entry.isExpired()) {
            cache.remove(key)
            return null
        }

        @Suppress("UNCHECKED_CAST")
        return CachedData(
            data = entry.data as T,
            timestamp = entry.timestamp
        )
    }

    /**
     * Check if key exists and is not expired
     */
    fun contains(key: String): Boolean {
        val entry = cache.get(key) ?: return false

        if (entry.isExpired()) {
            cache.remove(key)
            return false
        }

        return true
    }

    /**
     * Remove specific key
     */
    fun remove(key: String) {
        cache.remove(key)
    }

    /**
     * Remove all keys matching pattern
     */
    fun removeByPattern(pattern: String) {
        val snapshot = cache.snapshot()
        snapshot.keys.filter { it.contains(pattern) }.forEach { cache.remove(it) }
    }

    /**
     * Clear all cache
     */
    fun clear() {
        cache.evictAll()
    }

    /**
     * Get cache statistics
     */
    fun stats(): MemoryCacheStats {
        return MemoryCacheStats(
            size = cache.size(),
            maxSize = cache.maxSize(),
            hitCount = cache.hitCount(),
            missCount = cache.missCount(),
            evictionCount = cache.evictionCount()
        )
    }

    /**
     * Cache entry with TTL
     */
    private data class CacheEntry<T>(
        val data: T,
        val timestamp: Long,
        val ttl: Duration
    ) {
        fun isExpired(): Boolean {
            val now = System.currentTimeMillis()
            val age = now - timestamp
            return age > ttl.inWholeMilliseconds
        }
    }
}

/**
 * Cache statistics
 */
data class MemoryCacheStats(
    val size: Int,
    val maxSize: Int,
    val hitCount: Int,
    val missCount: Int,
    val evictionCount: Int
) {
    val hitRate: Float
        get() = if (hitCount + missCount > 0) {
            hitCount.toFloat() / (hitCount + missCount)
        } else 0f

    override fun toString(): String {
        return "CacheStats(size=$size/$maxSize, hits=$hitCount, misses=$missCount, " +
                "evictions=$evictionCount, hitRate=${String.format(Locale.getDefault(), "%.2f%%", hitRate * 100)})"
    }
}
