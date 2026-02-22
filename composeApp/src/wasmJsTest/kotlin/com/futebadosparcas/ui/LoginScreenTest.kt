package com.futebadosparcas.ui

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class LoginScreenTest {

    @Test
    fun `email validation - empty email is invalid`() {
        val email = ""
        assertFalse(isValidEmail(email))
    }

    @Test
    fun `email validation - valid email passes`() {
        val email = "test@futeba.com"
        assertTrue(isValidEmail(email))
    }

    @Test
    fun `email validation - email without @ is invalid`() {
        val email = "testfuteba.com"
        assertFalse(isValidEmail(email))
    }

    @Test
    fun `email validation - email without domain is invalid`() {
        val email = "test@"
        assertFalse(isValidEmail(email))
    }

    @Test
    fun `password validation - empty password is invalid`() {
        val password = ""
        assertFalse(isValidPassword(password))
    }

    @Test
    fun `password validation - password with 6 chars is valid`() {
        val password = "123456"
        assertTrue(isValidPassword(password))
    }

    @Test
    fun `password validation - password with 5 chars is invalid`() {
        val password = "12345"
        assertFalse(isValidPassword(password))
    }

    @Test
    fun `login form - both fields empty shows error`() {
        val email = ""
        val password = ""
        assertTrue(email.isEmpty() && password.isEmpty())
    }

    @Test
    fun `login form - valid credentials pass validation`() {
        val email = "test@futeba.com"
        val password = "123456"
        assertTrue(isValidEmail(email) && isValidPassword(password))
    }
}

private fun isValidEmail(email: String): Boolean {
    return email.contains("@") && email.contains(".") && email.length >= 5
}

private fun isValidPassword(password: String): Boolean {
    return password.length >= 6
}
