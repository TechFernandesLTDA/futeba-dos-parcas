package com.futebadosparcas.platform.storage

/**
 * Abstracoes multiplataforma para armazenamento seguro de dados sensiveis.
 *
 * Implementacoes:
 * - Android: EncryptedSharedPreferences (AndroidX Security)
 * - iOS: Keychain Services (Security framework)
 *
 * Uso para tokens, credenciais e outros dados sensiveis que NAO devem
 * ser armazenados em PreferencesService (SharedPreferences/NSUserDefaults).
 *
 * Exemplo:
 * ```kotlin
 * val storage = SecureStorage()
 * storage.save("auth_token", "eyJhbGciOiJIUzI1NiIs...")
 * val token = storage.get("auth_token")
 * storage.delete("auth_token")
 * ```
 */
expect class SecureStorage() {
    /**
     * Salva um valor de forma segura e criptografada.
     *
     * @param key Chave para identificar o dado
     * @param value Valor a ser armazenado
     */
    fun save(key: String, value: String)

    /**
     * Busca um valor armazenado de forma segura.
     *
     * @param key Chave do dado
     * @return Valor armazenado ou null se nao encontrado
     */
    fun get(key: String): String?

    /**
     * Remove um valor armazenado de forma segura.
     *
     * @param key Chave do dado a ser removido
     */
    fun delete(key: String)

    /**
     * Remove todos os dados armazenados de forma segura.
     * Util para logout ou reset da aplicacao.
     */
    fun clear()

    /**
     * Verifica se existe um valor para a chave especificada.
     *
     * @param key Chave a verificar
     * @return true se o dado existe
     */
    fun contains(key: String): Boolean
}
