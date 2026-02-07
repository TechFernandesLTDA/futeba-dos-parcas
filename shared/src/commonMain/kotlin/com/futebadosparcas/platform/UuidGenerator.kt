package com.futebadosparcas.platform

/**
 * Gerador de UUID multiplataforma.
 *
 * Implementacoes:
 * - Android: java.util.UUID
 * - iOS: NSUUID (Foundation)
 *
 * Uso:
 * ```kotlin
 * val id = UuidGenerator.generate()          // "550e8400-e29b-41d4-a716-446655440000"
 * val shortId = UuidGenerator.generateShort() // "550e8400e29b" (12 chars)
 * ```
 */
expect object UuidGenerator {
    /**
     * Gera um UUID v4 completo (36 caracteres com hifens).
     *
     * @return UUID no formato "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
     */
    fun generate(): String

    /**
     * Gera um ID curto baseado em UUID (12 caracteres alfanumericos).
     * Util para tokens de convite, codigos de grupo, etc.
     *
     * @param length Tamanho desejado do ID (padrao: 12)
     * @return String alfanumerica de comprimento especificado
     */
    fun generateShort(length: Int = 12): String
}
