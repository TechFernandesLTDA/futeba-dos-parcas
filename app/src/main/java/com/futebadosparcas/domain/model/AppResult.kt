package com.futebadosparcas.domain.model

/**
 * #005 - Custom Result Monad with Loading state
 *
 * Replaces Kotlin's built-in Result<T> with a more UI-friendly version
 * that includes Loading state and typed error messages.
 *
 * Usage:
 * ```kotlin
 * suspend fun getUser(id: String): AppResult<User> {
 *     return try {
 *         AppResult.Loading
 *         val user = repository.getUser(id)
 *         AppResult.Success(user)
 *     } catch (e: Exception) {
 *         AppResult.Error(e.message ?: "Unknown error", e)
 *     }
 * }
 * ```
 */
sealed class AppResult<out T> {
    /**
     * Loading state - operation in progress
     */
    data object Loading : AppResult<Nothing>()

    /**
     * Success state with data
     */
    data class Success<T>(val data: T) : AppResult<T>()

    /**
     * Error state with message and optional exception
     */
    data class Error(
        val message: String,
        val exception: Throwable? = null,
        val errorCode: String? = null
    ) : AppResult<Nothing>()

    // ============================================
    // Convenience Properties
    // ============================================

    val isLoading: Boolean get() = this is Loading
    val isSuccess: Boolean get() = this is Success
    val isError: Boolean get() = this is Error

    /**
     * Returns data if Success, null otherwise
     */
    fun getOrNull(): T? = when (this) {
        is Success -> data
        else -> null
    }

    /**
     * Returns data if Success, throws exception if Error, null if Loading
     */
    fun getOrThrow(): T? = when (this) {
        is Success -> data
        is Error -> throw exception ?: Exception(message)
        is Loading -> null
    }

    // ============================================
    // Transformation Functions
    // ============================================

    /**
     * Maps Success data to another type
     */
    inline fun <R> map(transform: (T) -> R): AppResult<R> = when (this) {
        is Success -> Success(transform(data))
        is Error -> Error(message, exception, errorCode)
        is Loading -> Loading
    }

    /**
     * FlatMap for chaining async operations
     */
    inline fun <R> flatMap(transform: (T) -> AppResult<R>): AppResult<R> = when (this) {
        is Success -> transform(data)
        is Error -> Error(message, exception, errorCode)
        is Loading -> Loading
    }

    /**
     * Execute block on Success
     */
    inline fun onSuccess(block: (T) -> Unit): AppResult<T> {
        if (this is Success) block(data)
        return this
    }

    /**
     * Execute block on Error
     */
    inline fun onError(block: (String, Throwable?) -> Unit): AppResult<T> {
        if (this is Error) block(message, exception)
        return this
    }

    /**
     * Execute block on Loading
     */
    inline fun onLoading(block: () -> Unit): AppResult<T> {
        if (this is Loading) block()
        return this
    }

    companion object {
        /**
         * Creates Success from nullable value, or Error if null
         */
        fun <T> fromNullable(
            value: T?,
            errorMessage: String = "Value is null"
        ): AppResult<T> {
            return value?.let { Success(it) } ?: Error(errorMessage)
        }

        /**
         * Wraps suspend function call in try-catch
         */
        suspend fun <T> catching(
            errorMessage: String = "Operation failed",
            block: suspend () -> T
        ): AppResult<T> {
            return try {
                Success(block())
            } catch (e: Exception) {
                Error(errorMessage, e)
            }
        }

        /**
         * Combines multiple AppResults into one
         * Returns Success only if all are Success
         */
        fun <T> combine(results: List<AppResult<T>>): AppResult<List<T>> {
            val data = mutableListOf<T>()
            for (result in results) {
                when (result) {
                    is Success -> data.add(result.data)
                    is Error -> return Error(result.message, result.exception)
                    is Loading -> return Loading
                }
            }
            return Success(data)
        }
    }
}

// ============================================
// Extension Functions for Kotlin Result
// ============================================

/**
 * Converts Kotlin Result to AppResult
 */
fun <T> Result<T>.toAppResult(): AppResult<T> {
    return fold(
        onSuccess = { AppResult.Success(it) },
        onFailure = { AppResult.Error(it.message ?: "Unknown error", it) }
    )
}

/**
 * Converts AppResult to Kotlin Result
 */
fun <T> AppResult<T>.toResult(): Result<T>? {
    return when (this) {
        is AppResult.Success -> Result.success(data)
        is AppResult.Error -> Result.failure(exception ?: Exception(message))
        is AppResult.Loading -> null
    }
}
