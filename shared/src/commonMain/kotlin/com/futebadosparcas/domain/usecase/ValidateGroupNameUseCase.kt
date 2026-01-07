package com.futebadosparcas.domain.usecase

/**
 * Use Case para validar nome de grupo.
 * Logica pura, compartilhavel entre plataformas.
 */
object ValidateGroupNameUseCase {

    /**
     * Valida o nome de um grupo.
     *
     * Regras:
     * - Nao pode estar vazio
     * - Minimo 3 caracteres
     * - Maximo 50 caracteres
     * - Apenas letras, numeros, espacos e caracteres especiais permitidos (-, _, ')
     */
    operator fun invoke(name: String): ValidationResult {
        val trimmed = name.trim()

        if (trimmed.isEmpty()) {
            return ValidationResult.Error("Nome do grupo e obrigatorio")
        }

        if (trimmed.length < 3) {
            return ValidationResult.Error("Nome deve ter pelo menos 3 caracteres")
        }

        if (trimmed.length > 50) {
            return ValidationResult.Error("Nome deve ter no maximo 50 caracteres")
        }

        // Validar caracteres especiais
        // Permite: letras (Unicode), numeros, espacos, hifen, underscore, apostrofo
        val regex = Regex("^[\\p{L}\\p{N}\\s\\-_']+$")
        if (!trimmed.matches(regex)) {
            return ValidationResult.Error("Nome contem caracteres invalidos")
        }

        return ValidationResult.Success(trimmed)
    }
}

/**
 * Use Case para validar descricao de grupo.
 */
object ValidateGroupDescriptionUseCase {

    /**
     * Valida a descricao de um grupo.
     *
     * Regras:
     * - Opcional (pode estar vazia)
     * - Maximo 200 caracteres
     */
    operator fun invoke(description: String): ValidationResult {
        val trimmed = description.trim()

        if (trimmed.length > 200) {
            return ValidationResult.Error("Descricao deve ter no maximo 200 caracteres")
        }

        return ValidationResult.Success(trimmed)
    }
}

/**
 * Resultado de validacao.
 */
sealed class ValidationResult {
    data class Success(val value: String) : ValidationResult()
    data class Error(val message: String) : ValidationResult()

    fun isSuccess(): Boolean = this is Success
    fun isError(): Boolean = this is Error
    fun getOrNull(): String? = (this as? Success)?.value
    fun getErrorOrNull(): String? = (this as? Error)?.message
}
