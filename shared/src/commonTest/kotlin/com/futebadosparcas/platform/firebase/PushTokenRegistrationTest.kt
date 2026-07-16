package com.futebadosparcas.platform.firebase

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class PushTokenRegistrationTest {
    @Test
    fun payloadUsesBackendWireContractAndTrimsValues() {
        val payload = PushTokenRegistration(
            token = " token-123 ",
            deviceId = " installation-1 ",
            platform = PushPlatform.IOS,
            sequence = 7
        ).toPayload()

        assertEquals("token-123", payload["token"])
        assertEquals("installation-1", payload["deviceId"])
        assertEquals("ios", payload["platform"])
        assertEquals(7L, payload["sequence"])
    }

    @Test
    fun blankTokenIsRejectedBeforeNetworkCall() {
        assertFailsWith<IllegalArgumentException> {
            PushTokenRegistration("  ", "installation-1", PushPlatform.IOS, 1)
        }
    }

    @Test
    fun blankDeviceIdIsRejectedBeforeNetworkCall() {
        assertFailsWith<IllegalArgumentException> {
            PushTokenRegistration("token-123", " ", PushPlatform.IOS, 1)
        }
    }

    @Test
    fun nonPositiveSequenceIsRejectedBeforeNetworkCall() {
        assertFailsWith<IllegalArgumentException> {
            PushTokenRegistration("token-123", "installation-1", PushPlatform.IOS, 0)
        }
    }
}
