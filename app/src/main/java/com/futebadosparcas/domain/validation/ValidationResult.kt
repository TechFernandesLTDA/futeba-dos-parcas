package com.futebadosparcas.domain.validation

/**
 * Resultado de uma validação.
 *
 * Sealed class para representar se uma validação passou ou falhou,
 * com informações detalhadas sobre o erro quando aplicável.
 */
sealed class ValidationResult {
    /**
     * Validação passou com sucesso.
     */
    object Valid : ValidationResult()

    /**
     * Validação falhou.
     *
     * @param field Nome do campo que falhou na validação
     * @param message Mensagem descritiva do erro (em PT-BR)
     * @param code Código do erro para tratamento programático
     */
    data class Invalid(
        val field: String,
        val message: String,
        val code: ValidationErrorCode = ValidationErrorCode.GENERIC
    ) : ValidationResult()

    /**
     * Verifica se a validação passou.
     */
    fun isValid(): Boolean = this is Valid

    /**
     * Verifica se a validação falhou.
     */
    fun isInvalid(): Boolean = this is Invalid

    /**
     * Retorna a mensagem de erro ou null se válido.
     */
    fun errorMessageOrNull(): String? = (this as? Invalid)?.message

    companion object {
        /**
         * Cria um resultado válido.
         */
        fun valid(): ValidationResult = Valid

        /**
         * Cria um resultado inválido.
         */
        fun invalid(
            field: String,
            message: String,
            code: ValidationErrorCode = ValidationErrorCode.GENERIC
        ): ValidationResult = Invalid(field, message, code)

        /**
         * Combina múltiplos resultados de validação.
         * Retorna o primeiro erro encontrado ou Valid se todos passarem.
         */
        fun combine(vararg results: ValidationResult): ValidationResult {
            return results.firstOrNull { it is Invalid } ?: Valid
        }

        /**
         * Combina múltiplos resultados e retorna todos os erros.
         */
        fun combineAll(vararg results: ValidationResult): List<Invalid> {
            return results.filterIsInstance<Invalid>()
        }
    }
}

/**
 * Códigos de erro de validação para tratamento programático.
 */
enum class ValidationErrorCode {
    GENERIC,
    REQUIRED_FIELD,
    INVALID_FORMAT,
    INVALID_LENGTH,
    OUT_OF_RANGE,
    INVALID_EMAIL,
    INVALID_CEP,
    NEGATIVE_VALUE,
    INVALID_TIMESTAMP,
    FOREIGN_KEY_NOT_FOUND,
    DUPLICATE_ENTRY,
    INVALID_URL,
    INVALID_PHONE,
    INVALID_STATUS,
    LOGICAL_INCONSISTENCY
}
