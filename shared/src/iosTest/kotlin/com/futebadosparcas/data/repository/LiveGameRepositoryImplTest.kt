package com.futebadosparcas.data.repository

import com.futebadosparcas.domain.model.GameEvent
import com.futebadosparcas.domain.model.GameEventType
import com.futebadosparcas.domain.model.LivePlayerStats
import com.futebadosparcas.domain.model.LiveScore
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class LiveGameRepositoryImplTest {

    @Test
    fun `missing remote score is emitted as explicit absence`() = runBlocking {
        val source = FakeLiveGameDataSource()
        val repository = LiveGameRepositoryImpl(source) { "request-1" }

        val collector = async { repository.observeLiveScore("game-1").first() }
        source.awaitScoreSubscribers(1)
        source.scores.emit(Result.success(null))

        assertNull(collector.await())
        source.awaitScoreSubscribers(0)
    }

    @Test
    fun `remote score reconnects and releases previous listener`() = runBlocking {
        val source = FakeLiveGameDataSource()
        val repository = LiveGameRepositoryImpl(source) { "request-1" }

        val firstCollector = async { repository.observeLiveScore("game-1").first() }
        source.awaitScoreSubscribers(1)
        source.scores.emit(Result.success(score(1)))
        assertEquals(1, firstCollector.await()?.team1Score)
        source.awaitScoreSubscribers(0)

        val reconnectedCollector = async { repository.observeLiveScore("game-1").first() }
        source.awaitScoreSubscribers(1)
        source.scores.emit(Result.success(score(2)))
        assertEquals(2, reconnectedCollector.await()?.team1Score)
        source.awaitScoreSubscribers(0)
    }

    @Test
    fun `events and stats propagate remote emissions without empty fallback`() = runBlocking {
        val source = FakeLiveGameDataSource()
        val repository = LiveGameRepositoryImpl(source) { "request-1" }
        val event = GameEvent(id = "event-1", gameId = "game-1", eventType = "GOAL")
        val stats = LivePlayerStats(id = "stats-1", gameId = "game-1", goals = 1)

        val eventCollector = async { repository.observeGameEvents("game-1").first() }
        val statsCollector = async { repository.observeLivePlayerStats("game-1").first() }
        source.awaitEventSubscribers(1)
        source.awaitStatsSubscribers(1)
        source.events.emit(Result.success(listOf(event)))
        source.stats.emit(Result.success(listOf(stats)))

        assertEquals(listOf(event), eventCollector.await())
        assertEquals(listOf(stats), statsCollector.await())
        source.awaitEventSubscribers(0)
        source.awaitStatsSubscribers(0)
    }

    @Test
    fun `failed callable retry reuses request id and success releases it`() = runBlocking {
        val source = FakeLiveGameDataSource().apply { failNextEvent = true }
        var generated = 0
        val repository = LiveGameRepositoryImpl(source) { "request-${++generated}" }

        val first = repository.addGameEvent(
            gameId = "game-1",
            eventType = GameEventType.GOAL,
            playerId = "player-1",
            playerName = "Jogador",
            teamId = "team-1"
        )
        val retry = repository.addGameEvent(
            gameId = "game-1",
            eventType = GameEventType.GOAL,
            playerId = "player-1",
            playerName = "Jogador",
            teamId = "team-1"
        )
        val nextAction = repository.addGameEvent(
            gameId = "game-1",
            eventType = GameEventType.GOAL,
            playerId = "player-1",
            playerName = "Jogador",
            teamId = "team-1"
        )

        assertTrue(first.isFailure)
        assertTrue(retry.isSuccess)
        assertTrue(nextAction.isSuccess)
        assertEquals(listOf("request-1", "request-1", "request-2"), source.submittedIds)
    }

    private fun score(team1Score: Int) = LiveScore(
        id = "game-1",
        gameId = "game-1",
        team1Id = "team-1",
        team2Id = "team-2",
        team1Score = team1Score
    )
}

private class FakeLiveGameDataSource : LiveGameDataSource {
    val scores = MutableSharedFlow<Result<LiveScore?>>()
    val events = MutableSharedFlow<Result<List<GameEvent>>>()
    val stats = MutableSharedFlow<Result<List<LivePlayerStats>>>()
    val submittedIds = mutableListOf<String>()
    var failNextEvent = false

    suspend fun awaitScoreSubscribers(count: Int) = withTimeout(2_000) {
        scores.subscriptionCount.first { it == count }
    }

    suspend fun awaitEventSubscribers(count: Int) = withTimeout(2_000) {
        events.subscriptionCount.first { it == count }
    }

    suspend fun awaitStatsSubscribers(count: Int) = withTimeout(2_000) {
        stats.subscriptionCount.first { it == count }
    }

    override suspend fun startLiveGame(
        gameId: String,
        team1Id: String,
        team2Id: String
    ): Result<LiveScore> = Result.success(
        LiveScore(id = gameId, gameId = gameId, team1Id = team1Id, team2Id = team2Id)
    )

    override fun getLiveScoreFlow(gameId: String): Flow<Result<LiveScore?>> = scores

    override suspend fun addGameEvent(gameId: String, event: GameEvent): Result<GameEvent> {
        submittedIds += event.id
        if (failNextEvent) {
            failNextEvent = false
            return Result.failure(IllegalStateException("network lost"))
        }
        return Result.success(event)
    }

    override suspend fun deleteGameEvent(gameId: String, eventId: String): Result<Unit> =
        Result.success(Unit)

    override fun getGameEventsFlow(gameId: String): Flow<Result<List<GameEvent>>> = events

    override fun getLivePlayerStatsFlow(gameId: String): Flow<Result<List<LivePlayerStats>>> = stats

    override suspend fun finishGame(gameId: String): Result<Unit> = Result.success(Unit)

    override suspend fun getLivePlayerStats(gameId: String): Result<List<LivePlayerStats>> =
        Result.success(emptyList())

    override suspend fun clearAllLiveGameData(): Result<Unit> = Result.success(Unit)

    override fun getCurrentAuthUserId(): String = "owner-1"
}
