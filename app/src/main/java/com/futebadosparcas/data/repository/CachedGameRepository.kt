package com.futebadosparcas.data.repository

import com.futebadosparcas.data.local.dao.GameDao
import com.futebadosparcas.data.local.model.GameEntity
import com.futebadosparcas.data.local.model.toDomain
import com.futebadosparcas.data.local.model.toEntity
import com.futebadosparcas.data.model.Game
import com.futebadosparcas.util.AppLogger
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

/**
 * CachedGameRepository - Camada de cache para games
 *
 * Estratégia de cache:
 * 1. Check cache (Room)
 * 2. Se expirado ou não existe, busca do Firestore
 * 3. Atualiza cache com dados novos
 *
 * TTL:
 * - Games futuros/live: 1 hora
 * - Games finalizados: 7 dias
 * - Cache LRU: 200 entries (gerenciado por Room)
 *
 * Funciona offline: Se não houver rede, retorna dados em cache mesmo expirados
 */
@Singleton
class CachedGameRepository @Inject constructor(
    private val gameDao: GameDao,
    private val networkRepository: GameRepository // Repository que busca do Firestore
) {
    companion object {
        private const val TAG = "CachedGameRepository"

        // TTL configs
        private const val TTL_GAMES_LIVE_MS = 60 * 60 * 1000L // 1 hora
        private const val TTL_GAMES_FINISHED_MS = 7L * 24 * 60 * 60 * 1000L // 7 dias
    }

    /**
     * Busca um jogo por ID com cache
     *
     * Fluxo:
     * 1. Verifica cache local
     * 2. Se não expirado, retorna do cache
     * 3. Se expirado ou não existe, busca do Firestore
     * 4. Atualiza cache e retorna
     */
    suspend fun getGameById(gameId: String): Result<Game> {
        return try {
            // 1. Check cache
            val cachedGame = gameDao.getGameById(gameId)
            val now = System.currentTimeMillis()

            // 2. Validar TTL
            if (cachedGame != null && !isCacheExpired(cachedGame, now)) {
                AppLogger.d(TAG) { "Cache HIT: Game $gameId" }
                return Result.success(cachedGame.toDomain())
            }

            // 3. Cache miss ou expirado - buscar do Firestore
            AppLogger.d(TAG) { "Cache MISS: Game $gameId - fetching from network" }
            val networkResult = networkRepository.getGameDetails(gameId)

            if (networkResult.isSuccess) {
                val game = networkResult.getOrThrow()
                // 4. Atualizar cache
                gameDao.insertGame(game.toEntity())
                Result.success(game)
            } else {
                // Se falhou a busca de rede mas tem cache (mesmo expirado), retorna do cache
                if (cachedGame != null) {
                    AppLogger.d(TAG) { "Network failed, returning stale cache for game $gameId" }
                    Result.success(cachedGame.toDomain())
                } else {
                    networkResult
                }
            }
        } catch (e: Exception) {
            AppLogger.e(TAG, "Error fetching game $gameId", e)
            Result.failure(e)
        }
    }

    /**
     * Busca jogos próximos com cache
     *
     * Flow reativo que:
     * 1. Emite dados do cache imediatamente (se existir)
     * 2. Busca dados do Firestore em background
     * 3. Emite dados atualizados quando receber do Firestore
     */
    fun getUpcomingGamesFlow(): Flow<Result<List<Game>>> = flow {
        try {
            // 1. Emit cache imediatamente (offline-first)
            val cachedGames = gameDao.getUpcomingGamesSnapshot()
            if (cachedGames.isNotEmpty()) {
                AppLogger.d(TAG) { "Emitting ${cachedGames.size} games from cache" }
                emit(Result.success(cachedGames.map { it.toDomain() }))
            }

            // 2. Buscar do Firestore (background)
            val networkResult = networkRepository.getUpcomingGames()

            if (networkResult.isSuccess) {
                val games = networkResult.getOrThrow()

                // 3. Atualizar cache
                if (games.isNotEmpty()) {
                    gameDao.insertGames(games.map { it.toEntity() })
                    AppLogger.d(TAG) { "Updated cache with ${games.size} games from network" }
                }

                // 4. Emit dados atualizados
                emit(Result.success(games))
            } else {
                // Se falhou network mas já emitiu cache, não precisa fazer nada
                if (cachedGames.isEmpty()) {
                    emit(networkResult)
                }
            }
        } catch (e: Exception) {
            AppLogger.e(TAG, "Error in getUpcomingGamesFlow", e)
            emit(Result.failure(e))
        }
    }

    /**
     * Busca todos os jogos com cache
     */
    fun getAllGamesFlow(): Flow<List<Game>> {
        return gameDao.getAllGames().map { entities ->
            entities.map { it.toDomain() }
        }
    }

    /**
     * Limpa cache expirado
     *
     * Deve ser chamado periodicamente (via WorkManager)
     */
    suspend fun clearExpiredCache() {
        val now = System.currentTimeMillis()

        // Remove jogos expirados (> 1 hora para live, > 7 dias para finished)
        val expiredTime = now - TTL_GAMES_LIVE_MS
        gameDao.deleteExpiredGames(expiredTime)

        // Remove jogos finalizados antigos (> 7 dias)
        val oldFinishedTime = now - TTL_GAMES_FINISHED_MS
        gameDao.deleteOldFinishedGames(oldFinishedTime)

        AppLogger.d(TAG) { "Cleared expired cache" }
    }

    /**
     * Invalida cache de um jogo específico
     */
    suspend fun invalidateGame(gameId: String) {
        gameDao.deleteGame(gameId)
        AppLogger.d(TAG) { "Invalidated cache for game $gameId" }
    }

    /**
     * Limpa todo o cache
     */
    suspend fun clearAllCache() {
        gameDao.clearAll()
        AppLogger.d(TAG) { "Cleared all game cache" }
    }

    /**
     * Verifica se o cache expirou baseado no status do jogo
     */
    private fun isCacheExpired(cachedGame: GameEntity, now: Long): Boolean {
        val age = now - cachedGame.cachedAt

        return when (cachedGame.status) {
            "FINISHED" -> age > TTL_GAMES_FINISHED_MS
            else -> age > TTL_GAMES_LIVE_MS
        }
    }

    /**
     * Retorna estatísticas do cache
     */
    suspend fun getCacheStats(): CacheStats {
        val allGames = gameDao.getAllGamesSnapshot()
        val upcomingGames = gameDao.getUpcomingGamesSnapshot()

        return CacheStats(
            totalGames = allGames.size,
            upcomingGames = upcomingGames.size,
            finishedGames = allGames.count { it.status == "FINISHED" }
        )
    }

    data class CacheStats(
        val totalGames: Int,
        val upcomingGames: Int,
        val finishedGames: Int
    )
}
