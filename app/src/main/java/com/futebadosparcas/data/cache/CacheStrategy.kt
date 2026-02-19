package com.futebadosparcas.data.cache

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlin.time.Duration
import kotlin.time.Duration.Companion.minutes

/**
 * Cache Strategy for Repository Layer
 *
 * Provides different caching strategies for data fetching:
 * - CacheFirst: Returns cache immediately, fetch in background
 * - NetworkFirst: Fetch network first, fallback to cache
 * - CacheOnly: Returns cache only (offline mode)
 * - NetworkOnly: Always fetch from network
 *
 * Usage:
 * ```kotlin
 * class UserRepository constructor(
 *     private val cacheStrategy: CacheStrategy
 * ) {
 *     fun getUser(id: String) = cacheStrategy.cacheFirst(
 *         cacheKey = "user_$id",
 *         cacheDuration = 5.minutes,
 *         fetchFromCache = { userDao.getUser(id) },
 *         fetchFromNetwork = { userApi.getUser(id) },
 *         saveToCache = { userDao.insertUser(it) }
 *     )
 * }
 * ```
 */
class CacheStrategy {

    /**
     * Cache-First: Returns cache immediately, then fetches from network
     *
     * Best for: Frequent reads, data that changes rarely
     */
    fun <T> cacheFirst(
        cacheKey: String,
        cacheDuration: Duration = 5.minutes,
        fetchFromCache: suspend () -> CachedData<T>?,
        fetchFromNetwork: suspend () -> T,
        saveToCache: suspend (T) -> Unit
    ): Flow<DataState<T>> = flow {
        // 1. Emit cached data immediately if valid
        val cached = fetchFromCache()
        if (cached != null && !cached.isExpired(cacheDuration)) {
            emit(DataState.Success(cached.data, fromCache = true))
        } else if (cached != null) {
            // Emit stale cache while fetching
            emit(DataState.Success(cached.data, fromCache = true, isStale = true))
        } else {
            emit(DataState.Loading)
        }

        // 2. Fetch from network and update cache
        try {
            val networkData = fetchFromNetwork()
            saveToCache(networkData)
            emit(DataState.Success(networkData, fromCache = false))
        } catch (e: Exception) {
            // If network fails, keep showing cache
            if (cached != null) {
                emit(DataState.Success(cached.data, fromCache = true, isStale = true))
            } else {
                emit(DataState.Error(e))
            }
        }
    }

    /**
     * Network-First: Fetches from network, fallback to cache on error
     *
     * Best for: Critical data that must be up-to-date
     */
    fun <T> networkFirst(
        cacheKey: String,
        fetchFromCache: suspend () -> CachedData<T>?,
        fetchFromNetwork: suspend () -> T,
        saveToCache: suspend (T) -> Unit
    ): Flow<DataState<T>> = flow {
        emit(DataState.Loading)

        try {
            // Try network first
            val networkData = fetchFromNetwork()
            saveToCache(networkData)
            emit(DataState.Success(networkData, fromCache = false))
        } catch (e: Exception) {
            // Fallback to cache
            val cached = fetchFromCache()
            if (cached != null) {
                emit(DataState.Success(cached.data, fromCache = true, isStale = true))
            } else {
                emit(DataState.Error(e))
            }
        }
    }

    /**
     * Cache-Only: Returns only cached data (offline mode)
     *
     * Best for: Offline-first features
     */
    fun <T> cacheOnly(
        cacheKey: String,
        fetchFromCache: suspend () -> CachedData<T>?
    ): Flow<DataState<T>> = flow {
        val cached = fetchFromCache()
        if (cached != null) {
            emit(DataState.Success(cached.data, fromCache = true))
        } else {
            emit(DataState.Error(CacheNotFoundException(cacheKey)))
        }
    }

    /**
     * Network-Only: Always fetches from network (bypasses cache)
     *
     * Best for: Write operations, real-time data
     */
    fun <T> networkOnly(
        fetchFromNetwork: suspend () -> T,
        saveToCache: suspend (T) -> Unit = {}
    ): Flow<DataState<T>> = flow {
        emit(DataState.Loading)

        try {
            val networkData = fetchFromNetwork()
            saveToCache(networkData)
            emit(DataState.Success(networkData, fromCache = false))
        } catch (e: Exception) {
            emit(DataState.Error(e))
        }
    }
}

/**
 * Cached data wrapper with timestamp
 */
data class CachedData<T>(
    val data: T,
    val timestamp: Long = System.currentTimeMillis()
) {
    fun isExpired(duration: Duration): Boolean {
        val now = System.currentTimeMillis()
        val age = now - timestamp
        return age > duration.inWholeMilliseconds
    }

    fun age(): Duration {
        val now = System.currentTimeMillis()
        return Duration.parse("${now - timestamp}ms")
    }
}

/**
 * Data state for UI
 */
sealed class DataState<out T> {
    object Loading : DataState<Nothing>()

    data class Success<T>(
        val data: T,
        val fromCache: Boolean = false,
        val isStale: Boolean = false
    ) : DataState<T>()

    data class Error(val exception: Throwable) : DataState<Nothing>()

    val isLoading: Boolean get() = this is Loading
    val isSuccess: Boolean get() = this is Success
    val isError: Boolean get() = this is Error

    fun getOrNull(): T? = (this as? Success)?.data
}

/**
 * Exception for cache not found
 */
class CacheNotFoundException(val cacheKey: String) : Exception("Cache not found for key: $cacheKey")
