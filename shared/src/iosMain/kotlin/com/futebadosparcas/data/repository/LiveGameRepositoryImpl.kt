package com.futebadosparcas.data.repository

import com.futebadosparcas.domain.model.GameEvent
import com.futebadosparcas.domain.model.GameEventType
import com.futebadosparcas.domain.model.LivePlayerStats
import com.futebadosparcas.domain.model.LiveScore
import com.futebadosparcas.domain.repository.LiveGameRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flowOf

/**
 * iOS stub para LiveGameRepository.
 *
 * Jogos ao vivo não são suportados no iOS ainda.
 * Todas as operações retornam Result.failure com mensagem descritiva.
 *
 * TODO(iOS): Implementar quando o suporte a jogos ao vivo for adicionado ao iOS.
 */
class LiveGameRepositoryImpl : LiveGameRepository {

    companion object {
        private const val ERROR_MESSAGE = "LiveGameRepository não implementado para iOS"
    }

    override suspend fun startLiveGame(
        gameId: String,
        team1Id: String,
        team2Id: String
    ): Result<LiveScore> {
        return Result.failure(UnsupportedOperationException(ERROR_MESSAGE))
    }

    override fun observeLiveScore(gameId: String): Flow<LiveScore?> {
        return flowOf(null)
    }

    override suspend fun addGameEvent(
        gameId: String,
        eventType: GameEventType,
        playerId: String,
        playerName: String,
        teamId: String,
        assistedById: String?,
        assistedByName: String?,
        minute: Int
    ): Result<GameEvent> {
        return Result.failure(UnsupportedOperationException(ERROR_MESSAGE))
    }

    override suspend fun deleteGameEvent(gameId: String, eventId: String): Result<Unit> {
        return Result.failure(UnsupportedOperationException(ERROR_MESSAGE))
    }

    override fun observeGameEvents(gameId: String): Flow<List<GameEvent>> {
        return flowOf(emptyList())
    }

    override fun observeLivePlayerStats(gameId: String): Flow<List<LivePlayerStats>> {
        return flowOf(emptyList())
    }

    override suspend fun finishGame(gameId: String): Result<Unit> {
        return Result.failure(UnsupportedOperationException(ERROR_MESSAGE))
    }

    override suspend fun getFinalStats(gameId: String): Result<List<LivePlayerStats>> {
        return Result.failure(UnsupportedOperationException(ERROR_MESSAGE))
    }

    override suspend fun clearAll(): Result<Unit> {
        return Result.failure(UnsupportedOperationException(ERROR_MESSAGE))
    }
}
