package com.futebadosparcas.util

import androidx.annotation.StringRes
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.GetCredentialProviderConfigurationException
import androidx.credentials.exceptions.GetCredentialUnsupportedException
import androidx.credentials.exceptions.NoCredentialException
import com.futebadosparcas.R

/**
 * Converte falhas do Credential Manager no login com Google em mensagens PT-BR.
 * O cancelamento pelo usuário é tratado antes, na tela, e não vira mensagem.
 */
object GoogleCredentialErrorMapper {

    @StringRes
    fun map(e: GetCredentialException): Int = when (e) {
        is NoCredentialException -> R.string.login_error_no_google_account
        // Sem Google Play Services compatível ou provedor de credenciais ausente
        is GetCredentialProviderConfigurationException,
        is GetCredentialUnsupportedException -> R.string.login_error_google_unavailable
        else -> R.string.auth_error_generic
    }
}
