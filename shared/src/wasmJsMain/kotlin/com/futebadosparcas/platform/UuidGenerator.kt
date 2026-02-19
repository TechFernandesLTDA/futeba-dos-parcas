package com.futebadosparcas.platform

import kotlin.random.Random

actual object UuidGenerator {
    actual fun generate(): String {
        // TODO: Fase 3 - usar crypto.randomUUID() via interop
        val bytes = (1..16).map { Random.nextInt(256) }
        return buildString {
            bytes.forEachIndexed { index, byte ->
                when (index) {
                    4, 6, 8, 10 -> append('-')
                    else -> Unit
                }
                append(byte.toString(16).padStart(2, '0'))
            }
        }
    }

    actual fun generateShort(length: Int): String {
        return generate().replace("-", "").take(length)
    }
}
