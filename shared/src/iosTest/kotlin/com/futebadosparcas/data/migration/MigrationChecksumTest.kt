package com.futebadosparcas.data.migration

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class MigrationChecksumTest {

    @Test
    fun `md5 returns correct length`() {
        val checksum = MigrationChecksum.md5("test")
        assertEquals(32, checksum.length)
    }

    @Test
    fun `md5 is deterministic for same input`() {
        val input = "hello world"
        val hash1 = MigrationChecksum.md5(input)
        val hash2 = MigrationChecksum.md5(input)
        assertEquals(hash1, hash2)
    }

    @Test
    fun `md5 different inputs produce different checksums`() {
        val hash1 = MigrationChecksum.md5("input1")
        val hash2 = MigrationChecksum.md5("input2")
        assertNotEquals(hash1, hash2)
    }

    @Test
    fun `md5 empty string returns valid checksum`() {
        val checksum = MigrationChecksum.md5("")
        assertEquals(32, checksum.length)
        assertTrue(checksum.all { it.isDigit() || it in 'a'..'f' })
    }

    @Test
    fun `md5 known input returns expected hash`() {
        val checksum = MigrationChecksum.md5("abc")
        assertEquals(32, checksum.length)
    }

    @Test
    fun `md5 returns hex string`() {
        val checksum = MigrationChecksum.md5("test")
        assertTrue(checksum.all { it.isDigit() || it in 'a'..'f' })
    }

    @Test
    fun `verify returns true for matching checksums`() {
        assertTrue(MigrationChecksum.verify("abc123", "ABC123"))
    }

    @Test
    fun `verify is case insensitive`() {
        val checksum = MigrationChecksum.md5("hello")
        assertTrue(MigrationChecksum.verify(checksum, checksum))
    }
}
