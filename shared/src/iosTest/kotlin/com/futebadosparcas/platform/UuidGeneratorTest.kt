package com.futebadosparcas.platform

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class UuidGeneratorTest {

    @Test
    fun `generate returns non-empty string`() {
        val uuid = UuidGenerator.generate()
        assertTrue(uuid.isNotEmpty())
    }

    @Test
    fun `generate returns unique values across calls`() {
        val uuid1 = UuidGenerator.generate()
        val uuid2 = UuidGenerator.generate()
        assertNotEquals(uuid1, uuid2)
    }

    @Test
    fun `generate returns UUID with correct format`() {
        val uuid = UuidGenerator.generate()
        val parts = uuid.split("-")
        assertEquals(5, parts.size)
        assertEquals(8, parts[0].length)
        assertEquals(4, parts[1].length)
        assertEquals(4, parts[2].length)
        assertEquals(4, parts[3].length)
        assertEquals(12, parts[4].length)
    }

    @Test
    fun `generate returns lowercase UUID`() {
        val uuid = UuidGenerator.generate()
        assertEquals(uuid, uuid.lowercase())
    }

    @Test
    fun `generateShort returns correct length`() {
        val result = UuidGenerator.generateShort(length = 8)
        assertEquals(8, result.length)
    }

    @Test
    fun `generateShort returns lowercase`() {
        val result = UuidGenerator.generateShort(length = 16)
        assertEquals(result, result.lowercase())
    }
}
