package com.futebadosparcas.platform

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class PlatformTest {

    private val platform = Platform()

    @Test
    fun `platform name is not empty`() {
        assertTrue(platform.name.isNotEmpty())
    }

    @Test
    fun `platform name contains iOS`() {
        assertTrue(platform.name.contains("iOS") || platform.name.contains("iPhone"))
    }

    @Test
    fun `platform isAndroid returns false`() {
        assertFalse(platform.isAndroid)
    }

    @Test
    fun `platform isIOS returns true`() {
        assertTrue(platform.isIOS)
    }

    @Test
    fun `platform name contains version`() {
        assertTrue(platform.name.isNotBlank())
    }
}
