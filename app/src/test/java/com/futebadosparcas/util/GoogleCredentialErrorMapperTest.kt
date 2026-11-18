package com.futebadosparcas.util

import androidx.credentials.exceptions.GetCredentialInterruptedException
import androidx.credentials.exceptions.GetCredentialProviderConfigurationException
import androidx.credentials.exceptions.GetCredentialUnknownException
import androidx.credentials.exceptions.GetCredentialUnsupportedException
import androidx.credentials.exceptions.NoCredentialException
import com.futebadosparcas.R
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

/**
 * Testes do mapeamento de falhas do Credential Manager (login com Google).
 *
 * Convenção: methodName_condition_expectedResult
 */
@DisplayName("GoogleCredentialErrorMapper Tests")
class GoogleCredentialErrorMapperTest {

    @Test
    fun map_noCredential_returnsNoGoogleAccount() {
        assertEquals(
            R.string.login_error_no_google_account,
            GoogleCredentialErrorMapper.map(NoCredentialException("sem conta"))
        )
    }

    @Test
    fun map_providerConfiguration_returnsGoogleUnavailable() {
        assertEquals(
            R.string.login_error_google_unavailable,
            GoogleCredentialErrorMapper.map(GetCredentialProviderConfigurationException("sem provedor"))
        )
    }

    @Test
    fun map_unsupported_returnsGoogleUnavailable() {
        assertEquals(
            R.string.login_error_google_unavailable,
            GoogleCredentialErrorMapper.map(GetCredentialUnsupportedException("não suportado"))
        )
    }

    @Test
    fun map_interrupted_returnsGeneric() {
        assertEquals(
            R.string.auth_error_generic,
            GoogleCredentialErrorMapper.map(GetCredentialInterruptedException("interrompido"))
        )
    }

    @Test
    fun map_unknown_returnsGeneric() {
        assertEquals(
            R.string.auth_error_generic,
            GoogleCredentialErrorMapper.map(GetCredentialUnknownException("desconhecido"))
        )
    }
}
