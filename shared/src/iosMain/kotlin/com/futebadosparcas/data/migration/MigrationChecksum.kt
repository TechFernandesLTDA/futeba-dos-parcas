package com.futebadosparcas.data.migration

import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.addressOf
import kotlinx.cinterop.convert
import kotlinx.cinterop.usePinned
import platform.CoreCrypto.CC_MD5
import platform.CoreCrypto.CC_MD5_DIGEST_LENGTH

/**
 * Implementacao iOS do calculo de checksum usando CommonCrypto.
 */
actual object MigrationChecksum {

    /**
     * Calcula o checksum MD5 de uma string usando CommonCrypto.
     *
     * @param input String para calcular o hash
     * @return Hash MD5 em formato hexadecimal (32 caracteres)
     */
    @OptIn(ExperimentalForeignApi::class)
    actual fun md5(input: String): String {
        val data = input.encodeToByteArray()
        val digest = UByteArray(CC_MD5_DIGEST_LENGTH)

        data.usePinned { pinnedData ->
            digest.usePinned { pinnedDigest ->
                CC_MD5(
                    pinnedData.addressOf(0),
                    data.size.convert(),
                    pinnedDigest.addressOf(0)
                )
            }
        }

        return digest.joinToString("") { "%02x".format(it.toInt()) }
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
