package com.futebadosparcas.util

import android.util.Patterns
import java.util.regex.Pattern

/**
 * Validation Helper
 *
 * Provides common validation functions with consistent error messages.
 * Useful for form validation, data sanitization, and input checking.
 *
 * Usage:
 * ```kotlin
 * val emailError = ValidationHelper.validateEmail(email)
 * if (emailError != null) {
 *     // Show error message
 * }
 * ```
 */
object ValidationHelper {

    // ============================================
    // Email Validation
    // ============================================

    fun validateEmail(email: String?): String? {
        return when {
            email.isNullOrBlank() -> "Email é obrigatório"
            !Patterns.EMAIL_ADDRESS.matcher(email).matches() -> "Email inválido"
            else -> null
        }
    }

    fun isValidEmail(email: String?): Boolean {
        return !email.isNullOrBlank() && Patterns.EMAIL_ADDRESS.matcher(email).matches()
    }

    // ============================================
    // Password Validation
    // ============================================

    fun validatePassword(password: String?): String? {
        return when {
            password.isNullOrBlank() -> "Senha é obrigatória"
            password.length < 6 -> "Senha deve ter no mínimo 6 caracteres"
            password.length > 128 -> "Senha muito longa"
            else -> null
        }
    }

    fun validatePasswordMatch(password: String?, confirmPassword: String?): String? {
        return when {
            confirmPassword.isNullOrBlank() -> "Confirme sua senha"
            password != confirmPassword -> "Senhas não coincidem"
            else -> null
        }
    }

    // ============================================
    // Name Validation
    // ============================================

    fun validateName(name: String?): String? {
        return when {
            name.isNullOrBlank() -> "Nome é obrigatório"
            name.length < 2 -> "Nome muito curto"
            name.length > 50 -> "Nome muito longo"
            !name.matches(Regex("^[a-zA-ZÀ-ÿ\\s'-]+$")) -> "Nome contém caracteres inválidos"
            else -> null
        }
    }

    // ============================================
    // Phone Validation
    // ============================================

    private val PHONE_PATTERN = Pattern.compile("^\\+?[1-9]\\d{10,14}$")

    fun validatePhone(phone: String?): String? {
        if (phone.isNullOrBlank()) {
            return null // Phone is optional
        }

        val digitsOnly = phone.replace(Regex("[^\\d+]"), "")

        return when {
            digitsOnly.length < 10 -> "Telefone inválido"
            !PHONE_PATTERN.matcher(digitsOnly).matches() -> "Formato de telefone inválido"
            else -> null
        }
    }

    // ============================================
    // Number Validation
    // ============================================

    fun validatePositiveInt(value: Int?, fieldName: String = "Valor"): String? {
        return when {
            value == null -> "$fieldName é obrigatório"
            value <= 0 -> "$fieldName deve ser positivo"
            else -> null
        }
    }

    fun validateRange(value: Int?, min: Int, max: Int, fieldName: String = "Valor"): String? {
        return when {
            value == null -> "$fieldName é obrigatório"
            value < min -> "$fieldName deve ser no mínimo $min"
            value > max -> "$fieldName deve ser no máximo $max"
            else -> null
        }
    }

    // ============================================
    // Game-Specific Validation
    // ============================================

    fun validatePlayerCount(count: Int?): String? {
        return when {
            count == null -> "Número de jogadores é obrigatório"
            count < 2 -> "Mínimo de 2 jogadores"
            count > 100 -> "Máximo de 100 jogadores"
            else -> null
        }
    }

    fun validatePrice(price: Double?): String? {
        return when {
            price == null -> "Valor é obrigatório"
            price < 0 -> "Valor não pode ser negativo"
            price > 10000 -> "Valor muito alto"
            else -> null
        }
    }

    // ============================================
    // String Validation
    // ============================================

    fun validateNonEmpty(value: String?, fieldName: String = "Campo"): String? {
        return when {
            value.isNullOrBlank() -> "$fieldName é obrigatório"
            else -> null
        }
    }

    fun validateLength(value: String?, minLength: Int, maxLength: Int, fieldName: String = "Campo"): String? {
        return when {
            value.isNullOrBlank() -> "$fieldName é obrigatório"
            value.length < minLength -> "$fieldName deve ter no mínimo $minLength caracteres"
            value.length > maxLength -> "$fieldName deve ter no máximo $maxLength caracteres"
            else -> null
        }
    }

    // ============================================
    // Sanitization
    // ============================================

    fun sanitizeName(name: String?): String {
        return name?.trim()?.replace(Regex("\\s+"), " ") ?: ""
    }

    fun sanitizePhone(phone: String?): String {
        return phone?.replace(Regex("[^\\d+]"), "") ?: ""
    }

    fun sanitizeEmail(email: String?): String {
        return email?.trim()?.lowercase() ?: ""
    }
}
