package com.futebadosparcas.domain.usecase

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.withContext

/**
 * Base Use Case
 *
 * Provides base functionality for use cases with proper threading and error handling.
 *
 * Usage:
 * ```kotlin
 * class GetUserUseCase @Inject constructor(
 *     private val userRepository: UserRepository
 * ) : FlowUseCase<String, User>() {
 *
 *     override suspend fun execute(params: String): Flow<Result<User>> {
 *         return userRepository.getUser(params)
 *     }
 * }
 * ```
 */

/**
 * Base use case for suspend functions
 */
abstract class SuspendUseCase<in P, out R>(
    private val dispatcher: CoroutineDispatcher = Dispatchers.IO
) {
    /**
     * Execute use case with parameters
     */
    suspend operator fun invoke(params: P): Result<R> = withContext(dispatcher) {
        try {
            Result.success(execute(params))
        } catch (e: Exception) {
            com.futebadosparcas.util.AppLogger.e("UseCase", "Error executing use case: ${this::class.simpleName}: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Execute use case logic
     */
    protected abstract suspend fun execute(params: P): R
}

/**
 * Base use case for suspend functions without parameters
 */
abstract class SuspendNoParamsUseCase<out R>(
    private val dispatcher: CoroutineDispatcher = Dispatchers.IO
) {
    /**
     * Execute use case without parameters
     */
    suspend operator fun invoke(): Result<R> = withContext(dispatcher) {
        try {
            Result.success(execute())
        } catch (e: Exception) {
            com.futebadosparcas.util.AppLogger.e("UseCase", "Error executing use case: ${this::class.simpleName}: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Execute use case logic
     */
    protected abstract suspend fun execute(): R
}

/**
 * Base use case for Flow operations
 */
abstract class FlowUseCase<in P, out R>(
    private val dispatcher: CoroutineDispatcher = Dispatchers.IO
) {
    /**
     * Execute use case with parameters and return Flow
     */
    operator fun invoke(params: P): Flow<Result<R>> {
        return execute(params)
            .catch { e ->
                com.futebadosparcas.util.AppLogger.e("UseCase", "Error in flow use case: ${this::class.simpleName}: ${e.message}", e)
                emit(Result.failure(e))
            }
            .flowOn(dispatcher)
    }

    /**
     * Execute use case logic and return Flow
     */
    protected abstract fun execute(params: P): Flow<Result<R>>
}

/**
 * Base use case for Flow operations without parameters
 */
abstract class FlowNoParamsUseCase<out R>(
    private val dispatcher: CoroutineDispatcher = Dispatchers.IO
) {
    /**
     * Execute use case without parameters and return Flow
     */
    operator fun invoke(): Flow<Result<R>> {
        return execute()
            .catch { e ->
                com.futebadosparcas.util.AppLogger.e("UseCase", "Error in flow use case: ${this::class.simpleName}: ${e.message}", e)
                emit(Result.failure(e))
            }
            .flowOn(dispatcher)
    }

    /**
     * Execute use case logic and return Flow
     */
    protected abstract fun execute(): Flow<Result<R>>
}

/**
 * Use case for operations that don't return data
 */
abstract class CompletableUseCase<in P>(
    private val dispatcher: CoroutineDispatcher = Dispatchers.IO
) {
    /**
     * Execute use case with parameters
     */
    suspend operator fun invoke(params: P): Result<Unit> = withContext(dispatcher) {
        try {
            execute(params)
            Result.success(Unit)
        } catch (e: Exception) {
            com.futebadosparcas.util.AppLogger.e("UseCase", "Error executing completable use case: ${this::class.simpleName}: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Execute use case logic
     */
    protected abstract suspend fun execute(params: P)
}

/**
 * Use case for batch operations
 */
abstract class BatchUseCase<in P, out R>(
    private val dispatcher: CoroutineDispatcher = Dispatchers.IO,
    private val chunkSize: Int = 10
) {
    /**
     * Execute batch operation
     */
    suspend operator fun invoke(items: List<P>): Result<List<R>> = withContext(dispatcher) {
        try {
            val results = items.chunked(chunkSize).flatMap { chunk ->
                executeBatch(chunk)
            }
            Result.success(results)
        } catch (e: Exception) {
            com.futebadosparcas.util.AppLogger.e("UseCase", "Error executing batch use case: ${this::class.simpleName}: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Execute batch of items
     */
    protected abstract suspend fun executeBatch(items: List<P>): List<R>
}

/**
 * Use case parameters marker interface
 */
interface UseCaseParams

/**
 * No parameters marker
 */
object NoParams : UseCaseParams
