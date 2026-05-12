package com.futebadosparcas.domain.model

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Testes compartilhados para o modelo Game, GameStatus e funcoes computadas.
 * Executam em Android (JVM) e iOS (Native).
 */
class GameTest {

    private fun makeGame(status: String = GameStatus.SCHEDULED.name) =
        Game(id = "g1", status = status)

    // ---- GameStatus ----

    @Test
    fun gameStatus_getStatusEnum_scheduled_retornaScheduled() {
        val game = makeGame(GameStatus.SCHEDULED.name)
        assertEquals(GameStatus.SCHEDULED, game.getStatusEnum())
    }

    @Test
    fun gameStatus_getStatusEnum_live_retornaLive() {
        val game = makeGame(GameStatus.LIVE.name)
        assertEquals(GameStatus.LIVE, game.getStatusEnum())
    }

    @Test
    fun gameStatus_getStatusEnum_finished_retornaFinished() {
        val game = makeGame(GameStatus.FINISHED.name)
        assertEquals(GameStatus.FINISHED, game.getStatusEnum())
    }

    @Test
    fun gameStatus_getStatusEnum_cancelled_retornaCancelled() {
        val game = makeGame(GameStatus.CANCELLED.name)
        assertEquals(GameStatus.CANCELLED, game.getStatusEnum())
    }

    @Test
    fun gameStatus_getStatusEnum_confirmed_retornaConfirmed() {
        val game = makeGame(GameStatus.CONFIRMED.name)
        assertEquals(GameStatus.CONFIRMED, game.getStatusEnum())
    }

    @Test
    fun gameStatus_getStatusEnum_invalido_fallbackParaScheduled() {
        // Status corrompido no Firestore -> fallback seguro
        val game = makeGame("STATUS_INVALIDO")
        assertEquals(GameStatus.SCHEDULED, game.getStatusEnum())
    }

    // ---- Helpers de status ----

    @Test
    fun game_isLive_statusLive_retornaTrue() {
        assertTrue(makeGame(GameStatus.LIVE.name).isLive())
    }

    @Test
    fun game_isLive_statusScheduled_retornaFalse() {
        assertFalse(makeGame(GameStatus.SCHEDULED.name).isLive())
    }

    @Test
    fun game_isFinished_statusFinished_retornaTrue() {
        assertTrue(makeGame(GameStatus.FINISHED.name).isFinished())
    }

    @Test
    fun game_isFinished_statusLive_retornaFalse() {
        assertFalse(makeGame(GameStatus.LIVE.name).isFinished())
    }

    @Test
    fun game_isScheduled_statusScheduled_retornaTrue() {
        assertTrue(makeGame(GameStatus.SCHEDULED.name).isScheduled())
    }

    @Test
    fun game_isCancelled_statusCancelled_retornaTrue() {
        assertTrue(makeGame(GameStatus.CANCELLED.name).isCancelled())
    }

    @Test
    fun game_isConfirmed_statusConfirmed_retornaTrue() {
        assertTrue(makeGame(GameStatus.CONFIRMED.name).isConfirmed())
    }

    // ---- Placar ----

    @Test
    fun game_totalGoals_somaPlacarCorretamente() {
        val game = Game(id = "g1", team1Score = 3, team2Score = 2)
        assertEquals(5, game.totalGoals())
    }

    @Test
    fun game_totalGoals_zerado_retornaZero() {
        val game = Game(id = "g1")
        assertEquals(0, game.totalGoals())
    }

    @Test
    fun game_formattedScore_retornaFormatoCorreto() {
        val game = Game(id = "g1", team1Score = 2, team2Score = 1)
        assertEquals("2 x 1", game.formattedScore())
    }

    // ---- Visibilidade ----

    @Test
    fun game_isPubliclyVisible_publicOpen_retornaTrue() {
        val game = Game(id = "g1", visibility = GameVisibility.PUBLIC_OPEN.name)
        assertTrue(game.isPubliclyVisible())
    }

    @Test
    fun game_isPubliclyVisible_publicClosed_retornaTrue() {
        val game = Game(id = "g1", visibility = GameVisibility.PUBLIC_CLOSED.name)
        assertTrue(game.isPubliclyVisible())
    }

    @Test
    fun game_isPubliclyVisible_groupOnly_retornaFalse() {
        val game = Game(id = "g1", visibility = GameVisibility.GROUP_ONLY.name)
        assertFalse(game.isPubliclyVisible())
    }

    // ---- Defaults ----

    @Test
    fun game_statusDefault_eScheduled() {
        val game = Game(id = "g1")
        assertEquals(GameStatus.SCHEDULED.name, game.status)
    }

    @Test
    fun game_maxPlayersDefault_e14() {
        val game = Game(id = "g1")
        assertEquals(14, game.maxPlayers)
    }
}
