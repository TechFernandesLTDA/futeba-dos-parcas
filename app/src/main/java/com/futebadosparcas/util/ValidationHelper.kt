package com.futebadosparcas.util

import android.content.Context
import android.util.Patterns
import com.futebadosparcas.R

/**
 * Validation Helper (auth).
 *
 * Retorna a mensagem já resolvida em `strings.xml` (`values`, `values-en`,
 * `values-es`) — antes era texto em PT fixo no código, que vazava em inglês
 * e espanhol (#4596 item 4). Funções de validação que não retornam texto de
 * usuário moram no [com.futebadosparcas.domain.validation.ValidationHelper].
 */
object ValidationHelper {

    fun validateEmail(email: String?, context: Context): String? {
        return when {
            email.isNullOrBlank() -> context.getString(R.string.validation_email_required)
            !Patterns.EMAIL_ADDRESS.matcher(email).matches() -> context.getString(R.string.validation_email_invalid)
            else -> null
        }
    }

    fun validatePassword(password: String?, context: Context): String? {
        return when {
            password.isNullOrBlank() -> context.getString(R.string.validation_password_required)
            password.length < 6 -> context.getString(R.string.validation_password_min)
            password.length > 128 -> context.getString(R.string.validation_password_max)
            else -> null
        }
    }

    fun validateName(name: String?, context: Context): String? {
        return when {
            name.isNullOrBlank() -> context.getString(R.string.validation_name_required)
            name.length < 2 -> context.getString(R.string.validation_name_short)
            name.length > 50 -> context.getString(R.string.validation_name_max_chars)
            !name.matches(Regex("^[a-zA-ZÀ-ÿ\\s'-]+$")) -> context.getString(R.string.validation_name_invalid)
            else -> null
        }
    }
}
