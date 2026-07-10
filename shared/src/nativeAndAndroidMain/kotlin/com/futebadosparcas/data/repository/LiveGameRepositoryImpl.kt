package com.futebadosparcas.data.repository

import com.futebadosparcas.domain.model.GameEvent
import com.futebadosparcas.domain.model.GameEventType
import com.futebadosparcas.domain.model.LivePlayerStats
import com.futebadosparcas.domain.model.LiveScore
import com.futebadosparcas.domain.repository.LiveGameRepository
import com.futebadosparcas.platform.UuidGenerator
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

internal interface LiveGameDataSource {
    suspend fun startLiveGame(gameId: String, team1Id: String, team2Id: String): Result<LiveScore>
    fun getLiveScoreFlow(gameId: String): Flow<Result<LiveScore?>>
    suspend fun addGameEvent(gameId: String, event: GameEvent): Result<GameEvent>
    suspend fun deleteGameEvent(gameId: String, eventId: String): Result<Unit>
    fun getGameEventsFlow(gameId: String): Flow<Result<List<GameEvent>>>
    fun getLivePlayerStatsFlow(gameId: String): Flow<Result<List<LivePlayerStats>>>
    suspend fun finishGame(gameId: String): Result<Unit>
    suspend fun getLivePlayerStats(gameId: String): Result<List<LivePlayerStats>>
    suspend fun clearAllLiveGameData(): Result<Unit>
    fun getCurrentAuthUserId(): String?
}

private class FirebaseLiveGameDataSource(
    private val delegate: FirebaseDataSource
) : LiveGameDataSource {
    override suspend fun startLiveGame(
        gameId: String,
        team1Id: String,
        team2Id: String
    ): Result<LiveScore> = delegate.startLiveGame(gameId, team1Id, team2Id)

    override fun getLiveScoreFlow(gameId: String): Flow<Result<LiveScore?>> =
        delegate.getLiveScoreFlow(gameId)

    override suspend fun addGameEvent(gameId: String, event: GameEvent): Result<GameEvent> =
        delegate.addGameEvent(gameId, event)

    override suspend fun deleteGameEvent(gameId: String, eventId: String): Result<Unit> =
        delegate.deleteGameEvent(gameId, eventId)

    override fun getGameEventsFlow(gameId: String): Flow<Result<List<GameEvent>>> =
        delegate.getGameEventsFlow(gameId)

    override fun getLivePlayerStatsFlow(gameId: String): Flow<Result<List<LivePlayerStats>>> =
        delegate.getLivePlayerStatsFlow(gameId)

    override suspend fun finishGame(gameId: String): Result<Unit> = delegate.finishGame(gameId)

    override suspend fun getLivePlayerStats(gameId: String): Result<List<LivePlayerStats>> =
        delegate.getLivePlayerStats(gameId)

    override suspend fun clearAllLiveGameData(): Result<Unit> = delegate.clearAllLiveGameData()

    override fun getCurrentAuthUserId(): String? = delegate.getCurrentAuthUserId()
}

/**
 * Implementação única Android+iOS apoiada no Firebase GitLive.
 * Os flows mantêm o listener remoto enquanto coletados e propagam falhas,
 * permitindo que a UI apresente erro/retry em vez de dados fictícios.
 */
class LiveGameRepositoryImpl internal constructor(
    private val dataSource: LiveGameDataSource,
    private val requestIdFactory: () -> String
) : LiveGameRepository {

    constructor(dataSource: FirebaseDataSource) : this(
        dataSource = FirebaseLiveGameDataSource(dataSource),
        requestIdFactory = UuidGenerator::generate
    )

    private val requestIdMutex = Mutex()
    private val pendingRequestIds = mutableMapOf<String, String>()

    override suspend fun startLiveGame(
        gameId: String,
        team1Id: String,
        team2Id: String
    ): Result<LiveScore> = dataSource.startLiveGame(gameId, team1Id, team2Id)

    override fun observeLiveScore(gameId: String): Flow<LiveScore?> =
        dataSource.getLiveScoreFlow(gameId).map { it.getOrThrow() }

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
        val eventKey = listOf(
            gameId,
            eventType.name,
            playerId,
            teamId,
            assistedById.orEmpty(),
            minute.toString()
        ).joinToString("|")
        val requestId = requestIdMutex.withLock {
            pendingRequestIds.getOrPut(eventKey, requestIdFactory)
        }
        val event = GameEvent(
            id = requestId,
            gameId = gameId,
            eventType = eventType.name,
            playerId = playerId,
            playerName = playerName,
            teamId = teamId,
            assistedById = assistedById,
            assistedByName = assistedByName,
            minute = minute,
            createdBy = dataSource.getCurrentAuthUserId().orEmpty()
        )
        val result = dataSource.addGameEvent(gameId, event)
        if (result.isSuccess) {
            requestIdMutex.withLock {
                if (pendingRequestIds[eventKey] == requestId) {
                    pendingRequestIds.remove(eventKey)
                }
            }
        }
        return result
    }

    override suspend fun deleteGameEvent(gameId: String, eventId: String): Result<Unit> =
        dataSource.deleteGameEvent(gameId, eventId)

    override fun observeGameEvents(gameId: String): Flow<List<GameEvent>> =
        dataSource.getGameEventsFlow(gameId).map { it.getOrThrow() }

    override fun observeLivePlayerStats(gameId: String): Flow<List<LivePlayerStats>> =
        dataSource.getLivePlayerStatsFlow(gameId).map { it.getOrThrow() }

    override suspend fun finishGame(gameId: String): Result<Unit> = dataSource.finishGame(gameId)

    override suspend fun getFinalStats(gameId: String): Result<List<LivePlayerStats>> =
        dataSource.getLivePlayerStats(gameId)

    override suspend fun clearAll(): Result<Unit> = dataSource.clearAllLiveGameData()
}
