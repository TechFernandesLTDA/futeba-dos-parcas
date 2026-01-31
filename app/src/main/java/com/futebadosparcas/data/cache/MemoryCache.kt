package com.futebadosparcas.data.cache

import android.util.LruCache
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
        // Cache size: 20% of available memory (in KB)
        private val MAX_CACHE_SIZE = (Runtime.getRuntime().maxMemory() / 1024 / 5).toInt()

        // Default TTL: 5 minutes
        private val DEFAULT_TTL = 5.minutes
    }

    private val cache = object : LruCache<String, CacheEntry<Any>>(MAX_CACHE_SIZE) {
        override fun sizeOf(key: String, value: CacheEntry<Any>): Int {
            // Rough size estimation: object overhead + string length
            return 1 + key.length / 100
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
                "evictions=$evictionCount, hitRate=${String.format("%.2f%%", hitRate * 100)})"
    }
}
