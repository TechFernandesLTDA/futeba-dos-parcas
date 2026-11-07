package com.futebadosparcas.domain.model

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class GameConfirmationTest {

    @Test
    fun getStatusEnumRetornaStatusCorreto() {
        val confirmed = GameConfirmation(status = "CONFIRMED")
        val cancelled = GameConfirmation(status = "CANCELLED")
        val pending = GameConfirmation(status = "PENDING")
        val waitlist = GameConfirmation(status = "WAITLIST")
        val unknown = GameConfirmation(status = "INVALID_STATUS")

        assertEquals(ConfirmationStatus.CONFIRMED, confirmed.getStatusEnum())
        assertEquals(ConfirmationStatus.CANCELLED, cancelled.getStatusEnum())
        assertEquals(ConfirmationStatus.PENDING, pending.getStatusEnum())
        assertEquals(ConfirmationStatus.WAITLIST, waitlist.getStatusEnum())
        assertEquals(ConfirmationStatus.CONFIRMED, unknown.getStatusEnum())
    }

    @Test
    fun getDisplayNamePriorizaNicknameQuandoPresente() {
        val withNickname = GameConfirmation(userName = "Renan Fernandes", nickname = "Loca")
        val withoutNickname = GameConfirmation(userName = "Renan Fernandes", nickname = "")
        val blankNickname = GameConfirmation(userName = "Renan Fernandes", nickname = "   ")

        assertEquals("Loca", withNickname.getDisplayName())
        assertEquals("Renan Fernandes", withoutNickname.getDisplayName())
        assertEquals("Renan Fernandes", blankNickname.getDisplayName())
    }

    @Test
    fun validaNaoNegativosEmEstatisticas() {
        assertFailsWith<IllegalArgumentException> {
            GameConfirmation(goals = -1)
        }
        assertFailsWith<IllegalArgumentException> {
            GameConfirmation(assists = -1)
        }
        assertFailsWith<IllegalArgumentException> {
            GameConfirmation(saves = -1)
        }
        assertFailsWith<IllegalArgumentException> {
            GameConfirmation(yellowCards = -1)
        }
        assertFailsWith<IllegalArgumentException> {
            GameConfirmation(redCards = -1)
        }
        assertFailsWith<IllegalArgumentException> {
            GameConfirmation(xpEarned = -1)
        }
    }
}
