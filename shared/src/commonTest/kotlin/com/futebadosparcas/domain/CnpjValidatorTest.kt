package com.futebadosparcas.domain

import com.futebadosparcas.domain.util.CnpjValidator
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class CnpjValidatorTest {

    @Test
    fun `valid CNPJ with mask returns true`() {
        assertTrue(CnpjValidator.isValid("11.222.333/0001-81"))
        assertTrue(CnpjValidator.isValid("12.345.678/0001-95"))
    }

    @Test
    fun `valid CNPJ without mask returns true`() {
        assertTrue(CnpjValidator.isValid("11222333000181"))
        assertTrue(CnpjValidator.isValid("12345678000195"))
    }

    @Test
    fun `valid CNPJ with leading zeros returns true`() {
        assertTrue(CnpjValidator.isValid("00.000.000/0001-91"))
        assertTrue(CnpjValidator.isValid("00000000000191"))
    }

    @Test
    fun `wrong check digit returns false`() {
        assertFalse(CnpjValidator.isValid("11.222.333/0001-82"))
        assertFalse(CnpjValidator.isValid("12.345.678/0001-00"))
    }

    @Test
    fun `all-equal sequences return false`() {
        assertFalse(CnpjValidator.isValid("00.000.000/0000-00"))
        assertFalse(CnpjValidator.isValid("11.111.111/1111-11"))
        assertFalse(CnpjValidator.isValid("99999999999999"))
    }

    @Test
    fun `null blank and whitespace return false`() {
        assertFalse(CnpjValidator.isValid(null))
        assertFalse(CnpjValidator.isValid(""))
        assertFalse(CnpjValidator.isValid("   "))
    }

    @Test
    fun `wrong length returns false`() {
        assertFalse(CnpjValidator.isValid("123"))
        assertFalse(CnpjValidator.isValid("112223330001811"))
        // CPF valido nao e CNPJ
        assertFalse(CnpjValidator.isValid("11144477735"))
    }

    @Test
    fun `non-digit characters are ignored during validation`() {
        assertTrue(CnpjValidator.isValid("11-222-333.0001/81"))
        assertTrue(CnpjValidator.isValid("11 222 333 0001 81"))
    }

    @Test
    fun `unicode digits are rejected`() {
        // Digitos arabes (U+0660..) nao devem ser aceitos como ASCII
        assertFalse(CnpjValidator.isValid("١١222333000181"))
    }

    @Test
    fun `mask shows only branch digits`() {
        assertEquals("**.***.***/0001-**", CnpjValidator.mask("11222333000181"))
        assertEquals("**.***.***/0001-**", CnpjValidator.mask("11.222.333/0001-81"))
    }

    @Test
    fun `mask returns stars for invalid length`() {
        assertEquals("***", CnpjValidator.mask("123"))
    }

    @Test
    fun `format applies full mask`() {
        assertEquals("11.222.333/0001-81", CnpjValidator.format("11222333000181"))
        assertEquals("11.222.333/0001-81", CnpjValidator.format("11.222.333/0001-81"))
    }

    @Test
    fun `format returns input for invalid length`() {
        assertEquals("123", CnpjValidator.format("123"))
    }

    @Test
    fun `strip removes mask`() {
        assertEquals("11222333000181", CnpjValidator.strip("11.222.333/0001-81"))
        assertEquals("11222333000181", CnpjValidator.strip("11-222-333.0001/81"))
    }
}
