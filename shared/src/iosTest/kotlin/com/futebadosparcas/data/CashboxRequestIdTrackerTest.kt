package com.futebadosparcas.data

import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals

class CashboxRequestIdTrackerTest {

    @Test
    fun `failed retry reuses request id and success releases it`() = runBlocking {
        var generated = 0
        val tracker = CashboxRequestIdTracker { "request-id-${++generated}-abcdef" }

        val first = tracker.requestId("same-operation", "")
        val retry = tracker.requestId("same-operation", "")
        assertEquals(first, retry)
        assertEquals(1, generated)

        tracker.complete("same-operation", first)
        val nextOperation = tracker.requestId("same-operation", "")
        assertEquals("request-id-2-abcdef", nextOperation)
    }

    @Test
    fun `valid caller request id is preserved`() = runBlocking {
        val tracker = CashboxRequestIdTracker { "generated-request-id" }
        val preferred = "client-request-id-123456"

        assertEquals(preferred, tracker.requestId("operation", preferred))
    }
}
