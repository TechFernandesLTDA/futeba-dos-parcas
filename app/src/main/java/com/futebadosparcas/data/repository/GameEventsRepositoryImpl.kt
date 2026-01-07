package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.GameEvent
import com.futebadosparcas.data.model.LiveGameScore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class GameEventsRepositoryImpl @Inject constructor(
    private val liveGameRepository: LiveGameRepository
) : GameEventsRepository {

    companion object {
        private const val TAG = "GameEventsRepository"
    }

    override fun getGameEventsFlow(gameId: String): Flow<Result<List<GameEvent>>> = flow {
        liveGameRepository.observeGameEvents(gameId).collect { events ->
            emit(Result.success(events))
        }
    }

    override fun getLiveScoreFlow(gameId: String): Flow<LiveGameScore?> {
        return liveGameRepository.observeLiveScore(gameId)
    }

    override suspend fun sendGameEvent(gameId: String, event: GameEvent): Result<Unit> {
        // Delegate to LiveGameRepository to ensure consistency using Root Collection
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
