package com.futebadosparcas.platform

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class DateTimeHelperTest {

    @Test
    fun `now returns positive timestamp`() {
        val now = DateTimeHelper.now()
        assertTrue(now > 0)
    }

    @Test
    fun `formatDate formats timestamp correctly`() {
        val timestamp = 1700000000000L
        val formatted = DateTimeHelper.formatDate(timestamp, "dd/MM/yyyy")
        assertTrue(formatted.isNotEmpty())
    }

    @Test
    fun `formatDate formats time component`() {
        val timestamp = 1700000000000L
        val formatted = DateTimeHelper.formatDate(timestamp, "HH:mm")
        assertTrue(formatted.isNotEmpty())
    }

    @Test
    fun `formatDate handles epoch zero`() {
        val formatted = DateTimeHelper.formatDate(0L, "yyyy-MM-dd")
        assertTrue(formatted.isNotEmpty())
    }

    @Test
    fun `formatDate handles current time`() {
        val now = DateTimeHelper.now()
        val formatted = DateTimeHelper.formatDate(now, "yyyy-MM-dd HH:mm:ss")
        assertTrue(formatted.isNotEmpty())
    }
}
