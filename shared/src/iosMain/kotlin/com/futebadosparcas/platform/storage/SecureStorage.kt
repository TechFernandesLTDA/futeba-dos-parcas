package com.futebadosparcas.platform.storage

import kotlinx.cinterop.ExperimentalForeignApi
import kotlinx.cinterop.alloc
import kotlinx.cinterop.memScoped
import kotlinx.cinterop.ptr
import kotlinx.cinterop.value
import platform.CoreFoundation.CFDictionaryRef
import platform.Foundation.NSData
import platform.Foundation.NSString
import platform.Foundation.NSUTF8StringEncoding
import platform.Foundation.create
import platform.Foundation.dataUsingEncoding
import platform.Security.*

/**
 * Implementacao iOS do SecureStorage usando Keychain Services.
 *
 * Keychain eh o mecanismo padrao do iOS para armazenar dados sensiveis,
 * como tokens de autenticacao, senhas e chaves criptograficas.
 *
 * Os dados sao criptografados pelo hardware do dispositivo (Secure Enclave)
 * e ficam protegidos mesmo se o dispositivo for comprometido.
 *
 * NOTA: No iOS, o Keychain persiste mesmo apos desinstalar o app
 * (diferente do NSUserDefaults). Para limpar, usar clear() explicitamente.
 */
actual class SecureStorage actual constructor() {

    companion object {
        // Identificador do servico para agrupar itens no Keychain
        private const val SERVICE_NAME = "com.futebadosparcas.secure"
    }

    actual fun save(key: String, value: String) {
        // Deletar item existente antes de salvar (Keychain nao faz update, precisa delete+add)
        delete(key)

        val valueData = (value as NSString).dataUsingEncoding(NSUTF8StringEncoding) ?: return

        val query = mapOf<Any?, Any?>(
            kSecClass to kSecClassGenericPassword,
            kSecAttrService to SERVICE_NAME,
            kSecAttrAccount to key,
            kSecValueData to valueData
        )

        @Suppress("UNCHECKED_CAST")
        SecItemAdd(query as CFDictionaryRef, null)
    }

    @OptIn(ExperimentalForeignApi::class)
    actual fun get(key: String): String? {
        val query = mapOf<Any?, Any?>(
            kSecClass to kSecClassGenericPassword,
            kSecAttrService to SERVICE_NAME,
            kSecAttrAccount to key,
            kSecReturnData to true,
            kSecMatchLimit to kSecMatchLimitOne
        )

        return memScoped {
            val result = alloc<CFDictionaryRef>()

            @Suppress("UNCHECKED_CAST")
            val status = SecItemCopyMatching(query as CFDictionaryRef, result.ptr)

            if (status == errSecSuccess) {
                val data = result.value as? NSData ?: return null
                NSString.create(data = data, encoding = NSUTF8StringEncoding) as? String
            } else {
                null
            }
        }
    }

    actual fun delete(key: String) {
        val query = mapOf<Any?, Any?>(
            kSecClass to kSecClassGenericPassword,
            kSecAttrService to SERVICE_NAME,
            kSecAttrAccount to key
        )

        @Suppress("UNCHECKED_CAST")
        SecItemDelete(query as CFDictionaryRef)
    }

    actual fun clear() {
        val query = mapOf<Any?, Any?>(
            kSecClass to kSecClassGenericPassword,
            kSecAttrService to SERVICE_NAME
        )

        @Suppress("UNCHECKED_CAST")
        SecItemDelete(query as CFDictionaryRef)
    }

    @OptIn(ExperimentalForeignApi::class)
    actual fun contains(key: String): Boolean {
        val query = mapOf<Any?, Any?>(
            kSecClass to kSecClassGenericPassword,
            kSecAttrService to SERVICE_NAME,
            kSecAttrAccount to key,
            kSecReturnData to false
        )

        @Suppress("UNCHECKED_CAST")
        val status = SecItemCopyMatching(query as CFDictionaryRef, null)
        return status == errSecSuccess
    }
}
