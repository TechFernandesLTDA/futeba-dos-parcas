package com.futebadosparcas.domain

import com.futebadosparcas.domain.util.CpfValidator
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class CpfValidatorTest {

    @Test
    fun `valid CPF with mask returns true`() {
        assertTrue(CpfValidator.isValid("111.444.777-35"))
        assertTrue(CpfValidator.isValid("123.456.789-09"))
    }

    @Test
    fun `valid CPF without mask returns true`() {
        assertTrue(CpfValidator.isValid("11144477735"))
        assertTrue(CpfValidator.isValid("12345678909"))
    }

    @Test
    fun `wrong check digit returns false`() {
        assertFalse(CpfValidator.isValid("111.444.777-36"))
        assertFalse(CpfValidator.isValid("123.456.789-00"))
    }

    @Test
    fun `all-equal sequences return false`() {
        assertFalse(CpfValidator.isValid("000.000.000-00"))
        assertFalse(CpfValidator.isValid("111.111.111-11"))
        assertFalse(CpfValidator.isValid("999.999.999-99"))
    }

    @Test
    fun `null and empty return false`() {
        assertFalse(CpfValidator.isValid(null))
        assertFalse(CpfValidator.isValid(""))
        assertFalse(CpfValidator.isValid("   "))
    }

    @Test
    fun `wrong length returns false`() {
        assertFalse(CpfValidator.isValid("123"))
        assertFalse(CpfValidator.isValid("123456789012"))
    }

    @Test
    fun `mask hides first and last digits`() {
        assertEquals("***.444.777-**", CpfValidator.mask("11144477735"))
    }

    @Test
    fun `mask returns *** for invalid CPF`() {
        assertEquals("***", CpfValidator.mask("123"))
    }

    @Test
    fun `format adds full mask`() {
        assertEquals("111.444.777-35", CpfValidator.format("11144477735"))
    }

    @Test
    fun `strip removes non-digits`() {
        assertEquals("11144477735", CpfValidator.strip("111.444.777-35"))
        assertEquals("11144477735", CpfValidator.strip("111-444-777 35"))
    }
}
