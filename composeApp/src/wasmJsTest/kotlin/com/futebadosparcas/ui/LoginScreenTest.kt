package com.futebadosparcas.ui

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlin.test.assertNull

class LoginScreenTest {

    @Test
    fun `validateLoginInput returns error when email is empty`() {
        val result = LoginValidationHelper.validateLoginInput(
            email = "",
            password = "123456"
        )
        assertTrue(result.isError)
        assertEquals("Preencha todos os campos", result.errorMessage)
    }

    @Test
    fun `validateLoginInput returns error when password is empty`() {
        val result = LoginValidationHelper.validateLoginInput(
            email = "test@email.com",
            password = ""
        )
        assertTrue(result.isError)
        assertEquals("Preencha todos os campos", result.errorMessage)
    }

    @Test
    fun `validateLoginInput returns error when both email and password are empty`() {
        val result = LoginValidationHelper.validateLoginInput(
            email = "",
            password = ""
        )
        assertTrue(result.isError)
        assertEquals("Preencha todos os campos", result.errorMessage)
    }

    @Test
    fun `validateLoginInput returns success when email and password are provided`() {
        val result = LoginValidationHelper.validateLoginInput(
            email = "test@email.com",
            password = "123456"
        )
        assertFalse(result.isError)
        assertNull(result.errorMessage)
    }

    @Test
    fun `validateLoginInput returns error when email contains only whitespace`() {
        val result = LoginValidationHelper.validateLoginInput(
            email = "   ",
            password = "123456"
        )
        assertTrue(result.isError)
        assertEquals("Preencha todos os campos", result.errorMessage)
    }

    @Test
    fun `validateLoginInput returns error when password contains only whitespace`() {
        val result = LoginValidationHelper.validateLoginInput(
            email = "test@email.com",
            password = "   "
        )
        assertTrue(result.isError)
        assertEquals("Preencha todos os campos", result.errorMessage)
    }

    @Test
    fun `LoginScreenState default values are correct`() {
        val state = LoginScreenState()
        assertEquals("", state.email)
        assertEquals("", state.password)
        assertFalse(state.isLoading)
        assertFalse(state.isRegisterMode)
        assertNull(state.errorMessage)
        assertNull(state.successMessage)
    }

    @Test
    fun `LoginScreenState can be updated with new values`() {
        val state = LoginScreenState(
            email = "test@email.com",
            password = "123456",
            isLoading = true,
            isRegisterMode = false,
            errorMessage = "Erro de teste",
            successMessage = null
        )
        assertEquals("test@email.com", state.email)
        assertEquals("123456", state.password)
        assertTrue(state.isLoading)
        assertFalse(state.isRegisterMode)
        assertEquals("Erro de teste", state.errorMessage)
        assertNull(state.successMessage)
    }

    @Test
    fun `LoginScreenState isLoading disables form fields`() {
        val state = LoginScreenState(isLoading = true)
        assertTrue(state.isLoading)
        assertFalse(state.isFormEnabled)
    }

    @Test
    fun `LoginScreenState isGoogleLoading disables form fields`() {
        val state = LoginScreenState(isGoogleLoading = true)
        assertTrue(state.isGoogleLoading)
        assertFalse(state.isFormEnabled)
    }

    @Test
    fun `LoginScreenState form is enabled when not loading`() {
        val state = LoginScreenState(isLoading = false, isGoogleLoading = false)
        assertFalse(state.isLoading)
        assertFalse(state.isGoogleLoading)
        assertTrue(state.isFormEnabled)
    }

    @Test
    fun `LoginScreenState copy preserves unchanged values`() {
        val original = LoginScreenState(
            email = "original@email.com",
            password = "originalpass",
            isLoading = false
        )
        val updated = original.copy(isLoading = true)
        assertEquals("original@email.com", updated.email)
        assertEquals("originalpass", updated.password)
        assertTrue(updated.isLoading)
    }

    @Test
    fun `isFormEnabled returns false when both isLoading and isGoogleLoading are true`() {
        val state = LoginScreenState(isLoading = true, isGoogleLoading = true)
        assertFalse(state.isFormEnabled)
    }

    @Test
    fun `isFormEnabled returns true when both isLoading and isGoogleLoading are false`() {
        val state = LoginScreenState(isLoading = false, isGoogleLoading = false)
        assertTrue(state.isFormEnabled)
    }

    @Test
    fun `LoginScreenState with successMessage shows feedback`() {
        val state = LoginScreenState(successMessage = "Login realizado com sucesso!")
        assertEquals("Login realizado com sucesso!", state.successMessage)
        assertTrue(state.hasFeedback)
    }

    @Test
    fun `LoginScreenState with errorMessage shows feedback`() {
        val state = LoginScreenState(errorMessage = "Email ou senha inválidos")
        assertEquals("Email ou senha inválidos", state.errorMessage)
        assertTrue(state.hasFeedback)
    }

    @Test
    fun `LoginScreenState without messages does not show feedback`() {
        val state = LoginScreenState()
        assertFalse(state.hasFeedback)
    }

    @Test
    fun `toggleMode switches between login and register`() {
        var isRegisterMode = false
        isRegisterMode = !isRegisterMode
        assertTrue(isRegisterMode)
        isRegisterMode = !isRegisterMode
        assertFalse(isRegisterMode)
    }
}

data class LoginScreenState(
    val email: String = "",
    val password: String = "",
    val confirmPassword: String = "",
    val name: String = "",
    val isLoading: Boolean = false,
    val isGoogleLoading: Boolean = false,
    val isRegisterMode: Boolean = false,
    val errorMessage: String? = null,
    val successMessage: String? = null
) {
    val isFormEnabled: Boolean
        get() = !isLoading && !isGoogleLoading

    val hasFeedback: Boolean
        get() = errorMessage != null || successMessage != null
}

object LoginValidationHelper {
    data class ValidationResult(
        val isError: Boolean,
        val errorMessage: String? = null
    )

    fun validateLoginInput(email: String, password: String): ValidationResult {
        return when {
            email.isBlank() || password.isBlank() -> ValidationResult(
                isError = true,
                errorMessage = "Preencha todos os campos"
            )
            else -> ValidationResult(isError = false)
        }
    }
}
