package com.futebadosparcas.data.model

import com.google.firebase.Timestamp
import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.Date

class AndroidGameWaitlistTest {
    @Test
    fun `normaliza timestamp date e long na fronteira`() {
        val dto = AndroidGameWaitlist()
        assertEquals(1_700_000_000_000L, dto.timestampMillis(1_700_000_000_000L))
        assertEquals(1_700_000_000_000L, dto.timestampMillis(Date(1_700_000_000_000L)))
        assertEquals(1_700_000_000_000L, dto.timestampMillis(Timestamp(Date(1_700_000_000_000L))))
    }
}
