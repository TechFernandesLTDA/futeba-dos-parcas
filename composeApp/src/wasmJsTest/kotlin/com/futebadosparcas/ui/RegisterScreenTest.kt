package com.futebadosparcas.ui

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class RegisterScreenTest {

    @Test
    fun `name validation - empty name is invalid`() {
        assertFalse(isValidName(""))
    }

    @Test
    fun `name validation - name with 3 chars is valid`() {
        assertTrue(isValidName("Ana"))
    }

    @Test
    fun `name validation - name with 2 chars is invalid`() {
        assertFalse(isValidName("Jo"))
    }

    @Test
    fun `password match - same passwords match`() {
        assertTrue(passwordsMatch("123456", "123456"))
    }

    @Test
    fun `password match - different passwords do not match`() {
        assertFalse(passwordsMatch("123456", "654321"))
    }

    @Test
    fun `password strength - 6 chars is minimum`() {
        assertTrue(isValidPassword("123456"))
    }

    @Test
    fun `password strength - 5 chars is invalid`() {
        assertFalse(isValidPassword("12345"))
    }

    @Test
    fun `registration form - all valid passes`() {
        val name = "João Silva"
        val email = "joao@email.com"
        val password = "123456"
        val confirmPassword = "123456"
        
        assertTrue(
            isValidName(name) &&
            isValidEmail(email) &&
            isValidPassword(password) &&
            passwordsMatch(password, confirmPassword)
        )
    }

    @Test
    fun `registration form - mismatched passwords fails`() {
        val password = "123456"
        val confirmPassword = "654321"
        
        assertFalse(passwordsMatch(password, confirmPassword))
    }
}

private fun isValidName(name: String): Boolean = name.trim().length >= 3
private fun isValidEmail(email: String): Boolean = email.contains("@") && email.contains(".")
private fun isValidPassword(password: String): Boolean = password.length >= 6
private fun passwordsMatch(password: String, confirm: String): Boolean = password == confirm
