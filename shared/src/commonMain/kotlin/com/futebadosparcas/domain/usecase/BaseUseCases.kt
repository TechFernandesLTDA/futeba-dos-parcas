package com.futebadosparcas.domain.usecase

import com.futebadosparcas.platform.logging.PlatformLogger
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.withContext

/**
 * Base Use Cases compartilhaveis entre Android e iOS.
 *
 * Usa PlatformLogger para logging multiplataforma em vez de AppLogger (Android-only).
 * Usa Dispatchers.Default como padrao (IO nao existe em todas as plataformas KMP).
 *
 * Para use cases que precisam de IO (rede, disco), passe Dispatchers.IO
 * explicitamente no androidMain ou use o dispatcher adequado no iosMain.
 */

/**
 * Base use case para funcoes suspend que retornam Result<R>.
 *
 * @param P Tipo do parametro de entrada
 * @param R Tipo do resultado
 * @param dispatcher Dispatcher para execucao (padrao: Default)
 */
abstract class SharedSuspendUseCase<in P, out R>(
    private val dispatcher: CoroutineDispatcher = Dispatchers.Default
) {
    /**
     * Executa o use case com parametros.
     */
    suspend operator fun invoke(params: P): Result<R> = withContext(dispatcher) {
        try {
            Result.success(execute(params))
        } catch (e: Exception) {
            PlatformLogger.e("UseCase", "Erro ao executar ${this@SharedSuspendUseCase::class.simpleName}: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Implementacao da logica do use case.
     */
    protected abstract suspend fun execute(params: P): R
}

/**
 * Base use case para funcoes suspend sem parametros.
 *
 * @param R Tipo do resultado
 */
abstract class SharedSuspendNoParamsUseCase<out R>(
    private val dispatcher: CoroutineDispatcher = Dispatchers.Default
) {
    /**
     * Executa o use case sem parametros.
     */
    suspend operator fun invoke(): Result<R> = withContext(dispatcher) {
        try {
            Result.success(execute())
        } catch (e: Exception) {
            PlatformLogger.e("UseCase", "Erro ao executar ${this@SharedSuspendNoParamsUseCase::class.simpleName}: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Implementacao da logica do use case.
     */
    protected abstract suspend fun execute(): R
}

/**
 * Base use case para operacoes Flow com parametros.
 *
 * @param P Tipo do parametro
 * @param R Tipo do resultado emitido pelo Flow
 */
abstract class SharedFlowUseCase<in P, out R>(
    private val dispatcher: CoroutineDispatcher = Dispatchers.Default
) {
    /**
     * Executa o use case e retorna Flow com tratamento de erros.
     */
    operator fun invoke(params: P): Flow<Result<R>> {
        return execute(params)
            .catch { e ->
                PlatformLogger.e("UseCase", "Erro no flow ${this@SharedFlowUseCase::class.simpleName}: ${e.message}", e)
                emit(Result.failure(e))
            }
            .flowOn(dispatcher)
    }

    /**
     * Implementacao da logica do use case.
     */
    protected abstract fun execute(params: P): Flow<Result<R>>
}

/**
 * Base use case para operacoes Flow sem parametros.
 *
 * @param R Tipo do resultado emitido pelo Flow
 */
abstract class SharedFlowNoParamsUseCase<out R>(
    private val dispatcher: CoroutineDispatcher = Dispatchers.Default
) {
    /**
     * Executa o use case e retorna Flow com tratamento de erros.
     */
    operator fun invoke(): Flow<Result<R>> {
        return execute()
            .catch { e ->
                PlatformLogger.e("UseCase", "Erro no flow ${this@SharedFlowNoParamsUseCase::class.simpleName}: ${e.message}", e)
                emit(Result.failure(e))
            }
            .flowOn(dispatcher)
    }

    /**
     * Implementacao da logica do use case.
     */
    protected abstract fun execute(): Flow<Result<R>>
}

/**
 * Base use case para operacoes que nao retornam dados (apenas sucesso/falha).
 *
 * @param P Tipo do parametro de entrada
 */
abstract class SharedCompletableUseCase<in P>(
    private val dispatcher: CoroutineDispatcher = Dispatchers.Default
) {
    /**
     * Executa o use case com parametros.
     */
    suspend operator fun invoke(params: P): Result<Unit> = withContext(dispatcher) {
        try {
            execute(params)
            Result.success(Unit)
        } catch (e: Exception) {
            PlatformLogger.e("UseCase", "Erro ao executar ${this@SharedCompletableUseCase::class.simpleName}: ${e.message}", e)
            Result.failure(e)
        }
    }

    /**
     * Implementacao da logica do use case.
     */
    protected abstract suspend fun execute(params: P)
}
