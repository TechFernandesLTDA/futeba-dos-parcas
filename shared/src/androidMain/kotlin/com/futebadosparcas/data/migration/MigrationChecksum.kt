package com.futebadosparcas.data.migration

import java.security.MessageDigest

/**
 * Implementacao Android do calculo de checksum usando MessageDigest.
 */
actual object MigrationChecksum {

    /**
     * Calcula o checksum MD5 de uma string usando MessageDigest.
     *
     * @param input String para calcular o hash
     * @return Hash MD5 em formato hexadecimal (32 caracteres)
     */
    actual fun md5(input: String): String {
        val md = MessageDigest.getInstance("MD5")
        val digest = md.digest(input.toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }
    }

    /**
     * Verifica se dois checksums sao iguais (case-insensitive).
     *
     * @param expected Checksum esperado
     * @param actual Checksum atual
     * @return true se os checksums forem iguais
     */
    actual fun verify(expected: String, actual: String): Boolean {
        return expected.equals(actual, ignoreCase = true)
    }
}
