package com.futebadosparcas.domain.util

/**
 * Valida CPF brasileiro pelo algoritmo de digito verificador (mod 11).
 *
 * Aceita CPF com ou sem mascara (999.999.999-99 ou 99999999999).
 * Rejeita sequencias de digitos iguais (000.000.000-00, etc).
 *
 * Implementacao KMP shared — mesma logica que web e Cloud Functions.
 * Spec: SPEC_FEATURE_PHONE_CPF_VERIFICATION.md
 */
object CpfValidator {

    /**
     * Valida CPF.
     *
     * @return true se valido, false caso contrario.
     */
    fun isValid(cpf: String?): Boolean {
        if (cpf.isNullOrBlank()) return false

        // Apenas digitos ASCII 0-9: isDigit() aceitaria digitos Unicode (#1310 L2)
        val digits = cpf.filter { it in '0'..'9' }
        if (digits.length != 11) return false

        // Sequencias todas iguais sao invalidas
        if (digits.all { it == digits[0] }) return false

        // 1o digito verificador
        var sum = 0
        for (i in 0 until 9) {
            sum += digits[i].digitToInt() * (10 - i)
        }
        var remainder = (sum * 10) % 11
        if (remainder == 10) remainder = 0
        if (remainder != digits[9].digitToInt()) return false

        // 2o digito verificador
        sum = 0
        for (i in 0 until 10) {
            sum += digits[i].digitToInt() * (11 - i)
        }
        remainder = (sum * 10) % 11
        if (remainder == 10) remainder = 0
        return remainder == digits[10].digitToInt()
    }

    /**
     * Mascara CPF para exibicao (LGPD): ***.456.789-**.
     * Use em listas, perfis publicos.
     */
    fun mask(cpf: String): String {
        val digits = strip(cpf)
        if (digits.length != 11) return cpf
        return "***.${digits.substring(3, 6)}.${digits.substring(6, 9)}-**"
    }

    /**
     * Formata CPF com mascara completa: 999.999.999-99.
     * Use APENAS no proprio perfil do usuario.
     */
    fun format(cpf: String): String {
        val digits = strip(cpf)
        if (digits.length != 11) return cpf
        return "${digits.substring(0, 3)}.${digits.substring(3, 6)}." +
            "${digits.substring(6, 9)}-${digits.substring(9, 11)}"
    }

    /**
     * Remove caracteres nao-digito.
     */
    fun strip(cpf: String): String = cpf.filter { it in '0'..'9' }
}
