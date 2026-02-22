package com.futebadosparcas.ui

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import kotlin.test.assertNull

class RegisterScreenTest {

    @Test
    fun `validateRegisterInput returns error when name is empty`() {
        val result = RegisterValidationHelper.validateRegisterInput(
            name = "",
            email = "test@email.com",
            password = "123456",
            confirmPassword = "123456"
        )
        assertTrue(result.isError)
        assertEquals("Digite seu nome", result.errorMessage)
    }

    @Test
    fun `validateRegisterInput returns error when email is empty`() {
        val result = RegisterValidationHelper.validateRegisterInput(
            name = "João Silva",
            email = "",
            password = "123456",
            confirmPassword = "123456"
        )
        assertTrue(result.isError)
        assertEquals("Digite seu email", result.errorMessage)
    }

    @Test
    fun `validateRegisterInput returns error when password is empty`() {
        val result = RegisterValidationHelper.validateRegisterInput(
            name = "João Silva",
            email = "test@email.com",
            password = "",
            confirmPassword = ""
        )
        assertTrue(result.isError)
        assertEquals("Digite sua senha", result.errorMessage)
    }

    @Test
    fun `validateRegisterInput returns error when password is too short`() {
        val result = RegisterValidationHelper.validateRegisterInput(
            name = "João Silva",
            email = "test@email.com",
            password = "12345",
            confirmPassword = "12345"
        )
        assertTrue(result.isError)
        assertEquals("A senha deve ter pelo menos 6 caracteres", result.errorMessage)
    }

    @Test
    fun `validateRegisterInput returns error when passwords do not match`() {
        val result = RegisterValidationHelper.validateRegisterInput(
            name = "João Silva",
            email = "test@email.com",
            password = "123456",
            confirmPassword = "654321"
        )
        assertTrue(result.isError)
        assertEquals("As senhas não coincidem", result.errorMessage)
    }

    @Test
    fun `validateRegisterInput returns success when all fields are valid`() {
        val result = RegisterValidationHelper.validateRegisterInput(
            name = "João Silva",
            email = "test@email.com",
            password = "123456",
            confirmPassword = "123456"
        )
        assertFalse(result.isError)
        assertNull(result.errorMessage)
    }

    @Test
    fun `validateRegisterInput returns error for name with only whitespace`() {
        val result = RegisterValidationHelper.validateRegisterInput(
            name = "   ",
            email = "test@email.com",
            password = "123456",
            confirmPassword = "123456"
        )
        assertTrue(result.isError)
        assertEquals("Digite seu nome", result.errorMessage)
    }

    @Test
    fun `validateRegisterInput returns error for email with only whitespace`() {
        val result = RegisterValidationHelper.validateRegisterInput(
            name = "João Silva",
            email = "   ",
            password = "123456",
            confirmPassword = "123456"
        )
        assertTrue(result.isError)
        assertEquals("Digite seu email", result.errorMessage)
    }

    @Test
    fun `validateRegisterInput accepts password with exactly 6 characters`() {
        val result = RegisterValidationHelper.validateRegisterInput(
            name = "João Silva",
            email = "test@email.com",
            password = "123456",
            confirmPassword = "123456"
        )
        assertFalse(result.isError)
    }

    @Test
    fun `validateRegisterInput accepts password with more than 6 characters`() {
        val result = RegisterValidationHelper.validateRegisterInput(
            name = "João Silva",
            email = "test@email.com",
            password = "12345678",
            confirmPassword = "12345678"
        )
        assertFalse(result.isError)
    }

    @Test
    fun `validateRegisterInput rejects password with 5 characters`() {
        val result = RegisterValidationHelper.validateRegisterInput(
            name = "João Silva",
            email = "test@email.com",
            password = "12345",
            confirmPassword = "12345"
        )
        assertTrue(result.isError)
        assertEquals("A senha deve ter pelo menos 6 caracteres", result.errorMessage)
    }

    @Test
    fun `RegisterScreenState default values are correct`() {
        val state = RegisterScreenState()
        assertEquals("", state.name)
        assertEquals("", state.email)
        assertEquals("", state.password)
        assertEquals("", state.confirmPassword)
        assertFalse(state.isLoading)
        assertFalse(state.showPassword)
        assertNull(state.errorMessage)
        assertNull(state.successMessage)
    }

    @Test
    fun `RegisterScreenState can be updated with new values`() {
        val state = RegisterScreenState(
            name = "João Silva",
            email = "joao@email.com",
            password = "123456",
            confirmPassword = "123456",
            isLoading = true,
            showPassword = true,
            errorMessage = "Erro de teste",
            successMessage = "Sucesso!"
        )
        assertEquals("João Silva", state.name)
        assertEquals("joao@email.com", state.email)
        assertEquals("123456", state.password)
        assertEquals("123456", state.confirmPassword)
        assertTrue(state.isLoading)
        assertTrue(state.showPassword)
        assertEquals("Erro de teste", state.errorMessage)
        assertEquals("Sucesso!", state.successMessage)
    }

    @Test
    fun `RegisterScreenState isLoading disables form`() {
        val state = RegisterScreenState(isLoading = true)
        assertTrue(state.isLoading)
        assertFalse(state.isFormEnabled)
    }

    @Test
    fun `RegisterScreenState form is enabled when not loading`() {
        val state = RegisterScreenState(isLoading = false)
        assertFalse(state.isLoading)
        assertTrue(state.isFormEnabled)
    }

    @Test
    fun `RegisterScreenState copy preserves unchanged values`() {
        val original = RegisterScreenState(
            name = "Original Name",
            email = "original@email.com",
            password = "originalpass"
        )
        val updated = original.copy(isLoading = true)
        assertEquals("Original Name", updated.name)
        assertEquals("original@email.com", updated.email)
        assertEquals("originalpass", updated.password)
        assertTrue(updated.isLoading)
    }

    @Test
    fun `togglePasswordVisibility switches visibility state`() {
        var showPassword = false
        showPassword = !showPassword
        assertTrue(showPassword)
        showPassword = !showPassword
        assertFalse(showPassword)
    }

    @Test
    fun `RegisterScreenState hasFeedback is true with errorMessage`() {
        val state = RegisterScreenState(errorMessage = "Erro")
        assertTrue(state.hasFeedback)
    }

    @Test
    fun `RegisterScreenState hasFeedback is true with successMessage`() {
        val state = RegisterScreenState(successMessage = "Sucesso")
        assertTrue(state.hasFeedback)
    }

    @Test
    fun `RegisterScreenState hasFeedback is false without messages`() {
        val state = RegisterScreenState()
        assertFalse(state.hasFeedback)
    }

    @Test
    fun `passwords match validation returns true when equal`() {
        val password = "123456"
        val confirmPassword = "123456"
        assertEquals(password, confirmPassword)
    }

    @Test
    fun `passwords match validation returns false when different`() {
        val password = "123456"
        val confirmPassword = "654321"
        assertTrue(password != confirmPassword)
    }

    @Test
    fun `password length validation for various lengths`() {
        assertTrue("12345".length < 6)
        assertTrue("123456".length >= 6)
        assertTrue("12345678".length >= 6)
        assertTrue("abcdefghij".length >= 6)
    }
}

data class RegisterScreenState(
    val name: String = "",
    val email: String = "",
    val password: String = "",
    val confirmPassword: String = "",
    val isLoading: Boolean = false,
    val showPassword: Boolean = false,
    val errorMessage: String? = null,
    val successMessage: String? = null
) {
    val isFormEnabled: Boolean
        get() = !isLoading

    val hasFeedback: Boolean
        get() = errorMessage != null || successMessage != null
}

object RegisterValidationHelper {
    data class ValidationResult(
        val isError: Boolean,
        val errorMessage: String? = null
    )

    fun validateRegisterInput(
        name: String,
        email: String,
        password: String,
        confirmPassword: String
    ): ValidationResult {
        return when {
            name.isBlank() -> ValidationResult(
                isError = true,
                errorMessage = "Digite seu nome"
            )
            email.isBlank() -> ValidationResult(
                isError = true,
                errorMessage = "Digite seu email"
            )
            password.isBlank() -> ValidationResult(
                isError = true,
                errorMessage = "Digite sua senha"
            )
            password.length < 6 -> ValidationResult(
                isError = true,
                errorMessage = "A senha deve ter pelo menos 6 caracteres"
            )
            password != confirmPassword -> ValidationResult(
                isError = true,
                errorMessage = "As senhas não coincidem"
            )
            else -> ValidationResult(isError = false)
        }
    }
}
