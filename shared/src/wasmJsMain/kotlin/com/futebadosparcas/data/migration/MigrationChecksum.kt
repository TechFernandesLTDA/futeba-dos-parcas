package com.futebadosparcas.data.migration

// TODO: Fase 3 - implementar MD5 real via crypto API do browser
actual object MigrationChecksum {
    actual fun md5(input: String): String {
        // Hash simples para web - nao e MD5 real
        var hash = 0
        for (char in input) {
            hash = (hash shl 5) - hash + char.code
        }
        return hash.toString(16).padStart(32, '0').take(32)
    }

    actual fun verify(expected: String, actual: String): Boolean =
        expected.equals(actual, ignoreCase = true)
}
