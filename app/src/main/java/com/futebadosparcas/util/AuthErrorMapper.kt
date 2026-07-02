package com.futebadosparcas.util

import androidx.annotation.StringRes
import com.futebadosparcas.R
import com.google.firebase.FirebaseNetworkException
import com.google.firebase.auth.FirebaseAuthException

/**
 * Mapeia exceções do Firebase Auth para mensagens de erro amigáveis em PT-BR (#3184).
 *
 * Regras:
 * - Anti-enumeração: erros de credencial (senha errada, usuário não encontrado,
 *   credencial inválida) retornam a MESMA mensagem genérica, para não revelar
 *   se um email está ou não cadastrado.
 * - Erros de rede têm mensagem própria para orientar o usuário a checar a conexão.
 * - Qualquer erro desconhecido cai na mensagem genérica de autenticação.
 */
object AuthErrorMapper {

    /**
     * Converte uma exceção de autenticação em um resource de string PT-BR.
     *
     * @param e exceção lançada pelo Firebase Auth (ou rede)
     * @return resource id da mensagem amigável correspondente
     */
    @StringRes
    fun mapAuthError(e: Throwable): Int {
        // Falha de rede pode vir como FirebaseNetworkException (fora do FirebaseAuthException)
        if (e is FirebaseNetworkException) {
            return R.string.auth_error_network
        }

        return when ((e as? FirebaseAuthException)?.errorCode) {
            // Anti-enumeração: mesma mensagem para credenciais inválidas
            "ERROR_WRONG_PASSWORD",
            "ERROR_USER_NOT_FOUND",
            "ERROR_INVALID_CREDENTIAL",
            "ERROR_INVALID_LOGIN_CREDENTIALS" -> R.string.auth_error_invalid_credentials

            "ERROR_EMAIL_ALREADY_IN_USE" -> R.string.auth_error_email_in_use
            "ERROR_TOO_MANY_REQUESTS" -> R.string.auth_error_too_many_requests
            "ERROR_USER_DISABLED" -> R.string.auth_error_user_disabled
            "ERROR_WEAK_PASSWORD" -> R.string.auth_error_weak_password
            "ERROR_INVALID_EMAIL" -> R.string.auth_error_invalid_email
            "ERROR_NETWORK_REQUEST_FAILED" -> R.string.auth_error_network

            else -> R.string.auth_error_generic
        }
    }
}
