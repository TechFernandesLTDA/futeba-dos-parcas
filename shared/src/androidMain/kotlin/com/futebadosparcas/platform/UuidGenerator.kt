package com.futebadosparcas.platform

import java.util.UUID

/**
 * Implementacao Android do gerador de UUID usando java.util.UUID.
 */
actual object UuidGenerator {
    actual fun generate(): String = UUID.randomUUID().toString()

    actual fun generateShort(length: Int): String {
        return UUID.randomUUID()
            .toString()
            .replace("-", "")
            .take(length.coerceIn(1, 32))
    }
}
