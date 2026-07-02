package com.futebadosparcas.domain.util

/**
 * Valida CNPJ brasileiro pelo algoritmo de digito verificador (mod 11).
 *
 * Aceita CNPJ com ou sem mascara (99.999.999/9999-99 ou 99999999999999).
 * Rejeita sequencias de digitos iguais (00.000.000/0000-00, etc).
 *
 * Implementacao KMP shared — mesma logica que web e Cloud Functions.
 * Spec: SPEC_FEATURE_AUTH_OVERHAUL_CNPJ_GOOGLE_LINK.md (#3188)
 */
object CnpjValidator {

    // Pesos do 1o digito verificador (mod 11)
    private val WEIGHTS_FIRST = intArrayOf(5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2)

    // Pesos do 2o digito verificador (mod 11)
    private val WEIGHTS_SECOND = intArrayOf(6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2)

    /**
     * Calcula digito verificador esperado (mod 11 com pesos).
     */
    private fun checkDigit(digits: String, weights: IntArray): Int {
        var sum = 0
        for (i in weights.indices) {
            sum += digits[i].digitToInt() * weights[i]
        }
        val remainder = sum % 11
        return if (remainder < 2) 0 else 11 - remainder
    }

    /**
     * Valida CNPJ.
     *
     * @return true se valido, false caso contrario.
     */
    fun isValid(cnpj: String?): Boolean {
        if (cnpj.isNullOrBlank()) return false

        // Apenas digitos ASCII 0-9: isDigit() aceitaria digitos Unicode (#1310 L2)
        val digits = cnpj.filter { it in '0'..'9' }
        if (digits.length != 14) return false

        // Sequencias todas iguais sao invalidas
        if (digits.all { it == digits[0] }) return false

        // 1o digito verificador
        if (checkDigit(digits, WEIGHTS_FIRST) != digits[12].digitToInt()) return false

        // 2o digito verificador
        return checkDigit(digits, WEIGHTS_SECOND) == digits[13].digitToInt()
    }

    /**
     * Mascara CNPJ para exibicao (LGPD): **.***.***\/0001-**.
     * Mostra apenas os 4 digitos da filial.
     */
    fun mask(cnpj: String): String {
        val digits = strip(cnpj)
        if (digits.length != 14) return "***"
        return "**.***.***/${digits.substring(8, 12)}-**"
    }

    /**
     * Formata CNPJ com mascara completa: 99.999.999/9999-99.
     * Use APENAS no proprio perfil/cadastro do usuario.
     */
    fun format(cnpj: String): String {
        val digits = strip(cnpj)
        if (digits.length != 14) return cnpj
        return "${digits.substring(0, 2)}.${digits.substring(2, 5)}." +
            "${digits.substring(5, 8)}/${digits.substring(8, 12)}-" +
            digits.substring(12, 14)
    }

    /**
     * Remove caracteres nao-digito.
     */
    fun strip(cnpj: String): String = cnpj.filter { it in '0'..'9' }
}
