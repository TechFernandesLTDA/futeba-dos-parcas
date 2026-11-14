package com.futebadosparcas.ui.games

import com.futebadosparcas.data.model.GameEvent
import com.futebadosparcas.data.model.LiveGameScore
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test
import java.util.Date

class GameDetailMappersTest {

    @Test
    fun `evento do Firestore vira evento do dominio sem perder campos`() {
        val evento = GameEvent(
            id = "e1", gameId = "g1", eventType = "GOAL", playerId = "p1", playerName = "Ana",
            teamId = "t1", assistedById = "p2", assistedByName = "Bia", minute = 12,
            createdBy = "u1", createdAt = Date(1_000L),
        ).toDomainEvent()

        assertEquals("e1", evento.id)
        assertEquals("GOAL", evento.eventType)
        assertEquals("Ana", evento.playerName)
        assertEquals("Bia", evento.assistedByName)
        assertEquals(12, evento.minute)
        assertEquals(1_000L, evento.createdAt)
    }

    @Test
    fun `placar ao vivo do Firestore vira placar do dominio`() {
        val placar = LiveGameScore(
            id = "g1", gameId = "g1", team1Id = "a", team1Score = 2, team2Id = "b", team2Score = 1,
            startedAt = Date(5L),
        ).toDomainLiveScore()

        assertEquals(2, placar.team1Score)
        assertEquals(1, placar.team2Score)
        assertEquals(5L, placar.startedAt)
        assertNull(placar.finishedAt)
    }
}
