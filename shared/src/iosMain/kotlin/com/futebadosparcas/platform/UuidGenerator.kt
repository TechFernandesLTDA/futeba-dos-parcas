package com.futebadosparcas.platform

import platform.Foundation.NSUUID

/**
 * Implementacao iOS do gerador de UUID usando NSUUID (Foundation).
 */
actual object UuidGenerator {
    actual fun generate(): String = NSUUID().UUIDString().lowercase()

    actual fun generateShort(length: Int): String {
        return NSUUID()
            .UUIDString()
            .replace("-", "")
            .lowercase()
            .take(length.coerceIn(1, 32))
    }
}
