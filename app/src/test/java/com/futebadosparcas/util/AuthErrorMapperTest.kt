package com.futebadosparcas.util

import com.futebadosparcas.R
import com.google.firebase.FirebaseNetworkException
import com.google.firebase.auth.FirebaseAuthException
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

/**
 * Testes do mapeamento de erros do Firebase Auth para mensagens PT-BR (#3184).
 *
 * Convenção: methodName_condition_expectedResult
 */
@DisplayName("AuthErrorMapper Tests")
class AuthErrorMapperTest {

    // ============================================
    // Anti-enumeração: credenciais inválidas → mesma mensagem genérica
    // ============================================

    @Test
    fun mapAuthError_wrongPassword_returnsInvalidCredentials() {
        val result = AuthErrorMapper.mapAuthError(
            FirebaseAuthException("ERROR_WRONG_PASSWORD", "wrong password")
        )
        assertEquals(R.string.auth_error_invalid_credentials, result)
    }

    @Test
    fun mapAuthError_userNotFound_returnsInvalidCredentials() {
        val result = AuthErrorMapper.mapAuthError(
            FirebaseAuthException("ERROR_USER_NOT_FOUND", "user not found")
        )
        assertEquals(R.string.auth_error_invalid_credentials, result)
    }

    @Test
    fun mapAuthError_invalidCredential_returnsInvalidCredentials() {
        val result = AuthErrorMapper.mapAuthError(
            FirebaseAuthException("ERROR_INVALID_CREDENTIAL", "invalid credential")
        )
        assertEquals(R.string.auth_error_invalid_credentials, result)
    }

    @Test
    fun mapAuthError_invalidLoginCredentials_returnsInvalidCredentials() {
        val result = AuthErrorMapper.mapAuthError(
            FirebaseAuthException("ERROR_INVALID_LOGIN_CREDENTIALS", "invalid login credentials")
        )
        assertEquals(R.string.auth_error_invalid_credentials, result)
    }

    @Test
    fun mapAuthError_credentialErrors_allReturnSameMessage() {
        // Garante a propriedade anti-enumeração: nenhum código de credencial
        // pode vazar se o email existe ou não na base
        val codes = listOf(
            "ERROR_WRONG_PASSWORD",
            "ERROR_USER_NOT_FOUND",
            "ERROR_INVALID_CREDENTIAL",
            "ERROR_INVALID_LOGIN_CREDENTIALS"
        )
        val results = codes.map { code ->
            AuthErrorMapper.mapAuthError(FirebaseAuthException(code, "msg"))
        }.toSet()
        assertEquals(setOf(R.string.auth_error_invalid_credentials), results)
    }

    // ============================================
    // Demais códigos conhecidos
    // ============================================

    @Test
    fun mapAuthError_emailAlreadyInUse_returnsEmailInUse() {
        val result = AuthErrorMapper.mapAuthError(
            FirebaseAuthException("ERROR_EMAIL_ALREADY_IN_USE", "email in use")
        )
        assertEquals(R.string.auth_error_email_in_use, result)
    }

    @Test
    fun mapAuthError_tooManyRequests_returnsTooManyRequests() {
        val result = AuthErrorMapper.mapAuthError(
            FirebaseAuthException("ERROR_TOO_MANY_REQUESTS", "too many requests")
        )
        assertEquals(R.string.auth_error_too_many_requests, result)
    }

    @Test
    fun mapAuthError_userDisabled_returnsUserDisabled() {
        val result = AuthErrorMapper.mapAuthError(
            FirebaseAuthException("ERROR_USER_DISABLED", "user disabled")
        )
        assertEquals(R.string.auth_error_user_disabled, result)
    }

    @Test
    fun mapAuthError_weakPassword_returnsWeakPassword() {
        val result = AuthErrorMapper.mapAuthError(
            FirebaseAuthException("ERROR_WEAK_PASSWORD", "weak password")
        )
        assertEquals(R.string.auth_error_weak_password, result)
    }

    @Test
    fun mapAuthError_invalidEmail_returnsInvalidEmail() {
        val result = AuthErrorMapper.mapAuthError(
            FirebaseAuthException("ERROR_INVALID_EMAIL", "invalid email")
        )
        assertEquals(R.string.auth_error_invalid_email, result)
    }

    // ============================================
    // Rede
    // ============================================

    @Test
    fun mapAuthError_networkRequestFailed_returnsNetworkError() {
        val result = AuthErrorMapper.mapAuthError(
            FirebaseAuthException("ERROR_NETWORK_REQUEST_FAILED", "network request failed")
        )
        assertEquals(R.string.auth_error_network, result)
    }

    @Test
    fun mapAuthError_firebaseNetworkException_returnsNetworkError() {
        val result = AuthErrorMapper.mapAuthError(
            FirebaseNetworkException("no connection")
        )
        assertEquals(R.string.auth_error_network, result)
    }

    // ============================================
    // Fallback
    // ============================================

    @Test
    fun mapAuthError_unknownAuthErrorCode_returnsGenericError() {
        val result = AuthErrorMapper.mapAuthError(
            FirebaseAuthException("ERROR_SOMETHING_UNKNOWN", "unknown")
        )
        assertEquals(R.string.auth_error_generic, result)
    }

    @Test
    fun mapAuthError_genericThrowable_returnsGenericError() {
        val result = AuthErrorMapper.mapAuthError(RuntimeException("boom"))
        assertEquals(R.string.auth_error_generic, result)
    }
}
