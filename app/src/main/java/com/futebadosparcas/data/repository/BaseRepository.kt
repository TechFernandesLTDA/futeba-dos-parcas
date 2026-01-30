package com.futebadosparcas.data.repository

import com.futebadosparcas.data.cache.CacheStrategy
import com.futebadosparcas.data.cache.CachedData
import com.futebadosparcas.data.cache.DataState
import com.futebadosparcas.data.cache.MemoryCache
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject
import kotlin.time.Duration
import kotlin.time.Duration.Companion.minutes

/**
 * Base Repository
 *
 * Provides common repository functionality with caching, error handling, and data state management.
 *
 * Usage:
 * ```kotlin
 * class UserRepository @Inject constructor(
 *     private val firestore: FirebaseFirestore,
 *     memoryCache: MemoryCache,
 *     cacheStrategy: CacheStrategy
 * ) : BaseRepository(memoryCache, cacheStrategy) {
 *
 *     fun getUser(userId: String): Flow<DataState<User>> = cacheFirst(
 *         cacheKey = "user_$userId",
 *         fetchFromNetwork = { firestore.collection("users").document(userId).get().await() }
 *     )
 * }
 * ```
 */
abstract class BaseRepository(
    private val memoryCache: MemoryCache,
    private val cacheStrategy: CacheStrategy
) {

    /**
     * Execute operation with cache-first strategy
     */
    protected fun <T : Any> cacheFirst(
        cacheKey: String,
        cacheDuration: Duration = 5.minutes,
        fetchFromNetwork: suspend () -> T
    ): Flow<DataState<T>> = cacheStrategy.cacheFirst(
        cacheKey = cacheKey,
        cacheDuration = cacheDuration,
        fetchFromCache = { memoryCache.get<CachedData<T>>(cacheKey) },
        fetchFromNetwork = fetchFromNetwork,
        saveToCache = { data: T -> memoryCache.put(cacheKey, CachedData(data), cacheDuration) }
    )

    /**
     * Execute operation with network-first strategy
     */
    protected fun <T : Any> networkFirst(
        cacheKey: String,
        cacheDuration: Duration = 5.minutes,
        fetchFromNetwork: suspend () -> T
    ): Flow<DataState<T>> = cacheStrategy.networkFirst(
        cacheKey = cacheKey,
        fetchFromCache = { memoryCache.get<CachedData<T>>(cacheKey) },
        fetchFromNetwork = fetchFromNetwork,
        saveToCache = { data: T -> memoryCache.put(cacheKey, CachedData(data), cacheDuration) }
    )

    /**
     * Execute operation with cache-only strategy
     */
    protected fun <T : Any> cacheOnly(
        cacheKey: String
    ): Flow<DataState<T>> = cacheStrategy.cacheOnly(
        cacheKey = cacheKey,
        fetchFromCache = { memoryCache.get<CachedData<T>>(cacheKey) }
    )

    /**
     * Execute operation with network-only strategy
     */
    protected fun <T : Any> networkOnly(
        fetchFromNetwork: suspend () -> T
    ): Flow<DataState<T>> = cacheStrategy.networkOnly(
        fetchFromNetwork = fetchFromNetwork
    )

    /**
     * Execute operation with error handling
     */
    protected suspend fun <T> executeWithErrorHandling(
        operation: suspend () -> T
    ): Result<T> = try {
        Result.success(operation())
    } catch (e: Exception) {
        android.util.Log.e("Repository", "Error executing operation", e)
        Result.failure(e)
    }

    /**
     * Execute operation with retry logic
     */
    protected suspend fun <T> executeWithRetry(
        maxAttempts: Int = 3,
        delayMs: Long = 1000,
        operation: suspend () -> T
    ): Result<T> {
        var lastException: Exception? = null

        repeat(maxAttempts) { attempt ->
            try {
                return Result.success(operation())
            } catch (e: Exception) {
                lastException = e
                android.util.Log.w("Repository", "Attempt ${attempt + 1} failed", e)
                if (attempt < maxAttempts - 1) {
                    kotlinx.coroutines.delay(delayMs * (attempt + 1))
                }
            }
        }

        return Result.failure(lastException ?: Exception("Operation failed after $maxAttempts attempts"))
    }

    /**
     * Clear cache for specific key
     */
    protected fun clearCache(cacheKey: String) {
        memoryCache.remove(cacheKey)
    }

    /**
     * Clear all cache
     */
    protected fun clearAllCache() {
        memoryCache.clear()
    }

    /**
     * Get cached data
     */
    protected fun <T : Any> getCached(cacheKey: String): CachedData<T>? {
        return memoryCache.get(cacheKey)
    }

    /**
     * Put data in cache
     */
    protected fun <T : Any> putInCache(cacheKey: String, data: T, ttl: Duration = 5.minutes) {
        memoryCache.put(cacheKey, CachedData(data), ttl)
    }

    /**
     * Execute operation and emit flow
     */
    protected fun <T> flowOf(operation: suspend () -> T): Flow<Result<T>> = flow {
        emit(executeWithErrorHandling(operation))
    }

    /**
     * Execute multiple operations in parallel
     */
    protected suspend fun <T> executeParallel(
        operations: List<suspend () -> T>
    ): List<Result<T>> = coroutineScope {
        operations.map { operation ->
            async {
                executeWithErrorHandling(operation)
            }
        }.awaitAll()
    }

    /**
     * Batch operations with chunk size
     */
    protected suspend fun <T, R> batchOperation(
        items: List<T>,
        chunkSize: Int = 10,
        operation: suspend (List<T>) -> R
    ): List<Result<R>> {
        return items.chunked(chunkSize).map { chunk ->
            executeWithErrorHandling { operation(chunk) }
        }
    }
}
