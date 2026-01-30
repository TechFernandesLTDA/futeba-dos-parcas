package com.futebadosparcas.data.migration

/**
 * Interface expect/actual para calcular checksums de migracoes.
 *
 * O checksum garante idempotencia das migracoes, evitando que uma
 * migracao seja executada novamente caso seu codigo tenha sido alterado.
 */
expect object MigrationChecksum {
    /**
     * Calcula o checksum MD5 de uma string.
     *
     * @param input String para calcular o hash
     * @return Hash MD5 em formato hexadecimal (32 caracteres)
     */
    fun md5(input: String): String

    /**
     * Verifica se dois checksums sao iguais.
     *
     * @param expected Checksum esperado
     * @param actual Checksum atual
     * @return true se os checksums forem iguais
     */
    fun verify(expected: String, actual: String): Boolean
}

/**
 * Extensao para gerar checksum de uma migracao baseado no nome e versao.
 *
 * O checksum inclui:
 * - Versao da migracao
 * - Nome da migracao
 * - Salt fixo para garantir unicidade
 */
fun Migration.generateChecksum(): String {
    val content = "migration:v${version}:${name}:futebadosparcas"
    return MigrationChecksum.md5(content)
}

/**
 * Verifica se o checksum de uma migracao corresponde ao registro.
 *
 * @param record Registro da migracao aplicada
 * @return true se os checksums correspondem
 */
fun Migration.verifyChecksum(record: MigrationRecord): Boolean {
    val expectedChecksum = this.generateChecksum()
    return MigrationChecksum.verify(expectedChecksum, record.checksum)
}
