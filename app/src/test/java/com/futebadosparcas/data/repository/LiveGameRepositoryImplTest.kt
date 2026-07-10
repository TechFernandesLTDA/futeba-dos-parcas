package com.futebadosparcas.data.repository

import com.futebadosparcas.domain.model.GameEvent
import com.futebadosparcas.domain.model.GameEventType
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.test.runTest
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class LiveGameRepositoryImplTest {

    private val dataSource = mockk<FirebaseDataSource>()
    private val repository = LiveGameRepositoryImpl(dataSource)

    @Test
    fun `addGameEvent cria request id estavel antes do callable`() = runTest {
        val eventSlot = slot<GameEvent>()
        every { dataSource.getCurrentAuthUserId() } returns "user-1"
        coEvery {
            dataSource.addGameEvent("game-1", capture(eventSlot))
        } answers {
            Result.success(eventSlot.captured)
        }

        val result = repository.addGameEvent(
            gameId = "game-1",
            eventType = GameEventType.GOAL,
            playerId = "player-1",
            playerName = "Jordi",
            teamId = "team-1",
            assistedById = null,
            assistedByName = null,
            minute = 12
        )

        assertTrue(result.isSuccess)
        assertTrue(eventSlot.captured.id.matches(Regex("^[A-Za-z0-9_-]{8,128}$")))
        assertEquals(eventSlot.captured.id, result.getOrThrow().id)
    }

    @Test
    fun `retry apos resposta perdida reutiliza o mesmo request id`() = runTest {
        val requestIds = mutableListOf<String>()
        var attempt = 0
        every { dataSource.getCurrentAuthUserId() } returns "user-1"
        coEvery { dataSource.addGameEvent("game-retry", any()) } answers {
            val event = arg<GameEvent>(1)
            requestIds += event.id
            attempt += 1
            if (attempt == 1) {
                Result.failure(IllegalStateException("resposta perdida"))
            } else {
                Result.success(event)
            }
        }

        val submit = suspend {
            repository.addGameEvent(
                gameId = "game-retry",
                eventType = GameEventType.GOAL,
                playerId = "player-1",
                playerName = "Jordi",
                teamId = "team-1",
                assistedById = null,
                assistedByName = null,
                minute = 18
            )
        }

        assertTrue(submit().isFailure)
        assertTrue(submit().isSuccess)
        assertEquals(2, requestIds.size)
        assertEquals(requestIds[0], requestIds[1])
    }
}
