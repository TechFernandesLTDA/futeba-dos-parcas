package com.futebadosparcas.data

import com.futebadosparcas.domain.model.GameEvent
import com.futebadosparcas.domain.model.GameEventType
import com.futebadosparcas.domain.model.LiveScore
import com.futebadosparcas.domain.repository.GameEventsRepository
import com.futebadosparcas.domain.repository.LiveGameRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

/**
 * Implementacao Android do GameEventsRepository.
 * Delega para LiveGameRepository para garantir consistencia usando a Root Collection.
 */
class GameEventsRepositoryImpl(
    private val liveGameRepository: LiveGameRepository
) : GameEventsRepository {

    override fun getGameEventsFlow(gameId: String): Flow<Result<List<GameEvent>>> = flow {
        liveGameRepository.observeGameEvents(gameId).collect { events ->
            emit(Result.success(events))
        }
    }

    override fun getLiveScoreFlow(gameId: String): Flow<LiveScore?> {
        return liveGameRepository.observeLiveScore(gameId)
    }

    override suspend fun sendGameEvent(gameId: String, event: GameEvent): Result<Unit> {
        val result = liveGameRepository.addGameEvent(
            gameId = gameId,
            eventType = event.getEventTypeEnum(),
            playerId = event.playerId,
            playerName = event.playerName,
            teamId = event.teamId,
            assistedById = event.assistedById,
            assistedByName = event.assistedByName,
            minute = event.minute
        )
        return if (result.isSuccess) Result.success(Unit) else Result.failure(result.exceptionOrNull()!!)
    }

    override suspend fun deleteGameEvent(gameId: String, eventId: String): Result<Unit> {
        return liveGameRepository.deleteGameEvent(gameId, eventId)
    }
}
