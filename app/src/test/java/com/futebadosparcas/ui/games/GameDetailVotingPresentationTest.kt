package com.futebadosparcas.ui.games

import com.futebadosparcas.domain.model.GameStatus
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertNull
import org.junit.jupiter.api.Test

class GameDetailVotingPresentationTest {

    @Test
    fun `non-finished game does not show post-game voting`() {
        GameStatus.entries
            .filterNot { it == GameStatus.FINISHED }
            .forEach { status ->
                assertNull(resolveGameDetailVotingPresentation(status.name, hasVoted = false))
                assertNull(resolveGameDetailVotingPresentation(status.name, hasVoted = true))
            }
    }

    @Test
    fun `finished game with pending or unknown vote shows call to action`() {
        assertEquals(
            GameDetailVotingPresentation.PENDING,
            resolveGameDetailVotingPresentation(GameStatus.FINISHED.name, hasVoted = false)
        )
        assertEquals(
            GameDetailVotingPresentation.PENDING,
            resolveGameDetailVotingPresentation(GameStatus.FINISHED.name, hasVoted = null)
        )
    }

    @Test
    fun `finished game with recorded vote shows completion`() {
        assertEquals(
            GameDetailVotingPresentation.COMPLETED,
            resolveGameDetailVotingPresentation(GameStatus.FINISHED.name, hasVoted = true)
        )
    }
}
