package com.futebadosparcas.platform.storage

import kotlinx.cinterop.alloc
import kotlinx.cinterop.memScoped
import kotlinx.cinterop.ptr
import kotlinx.cinterop.value
import platform.CoreFoundation.CFDictionaryRef
import platform.CoreFoundation.CFTypeRefVar
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
        val valueData = (value as NSString).dataUsingEncoding(NSUTF8StringEncoding)
            ?: throw SecureStorageException(operation = "encode")

        val identityQuery = mapOf<Any?, Any?>(
            kSecClass to kSecClassGenericPassword,
            kSecAttrService to SERVICE_NAME,
            kSecAttrAccount to key
        )
        val addQuery = identityQuery + mapOf<Any?, Any?>(
            kSecAttrAccessible to kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
            kSecValueData to valueData
        )

        @Suppress("UNCHECKED_CAST")
        val addStatus = SecItemAdd(addQuery as CFDictionaryRef, null)
        when (addStatus) {
            errSecSuccess -> return
            errSecDuplicateItem -> {
                val updateAttributes = mapOf<Any?, Any?>(
                    kSecAttrAccessible to kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
                    kSecValueData to valueData
                )

                @Suppress("UNCHECKED_CAST")
                val updateStatus = SecItemUpdate(
                    identityQuery as CFDictionaryRef,
                    updateAttributes as CFDictionaryRef
                )
                requireKeychainSuccess(operation = "update", status = updateStatus)
            }
            else -> failKeychainOperation(operation = "add", status = addStatus)
        }
    }

    actual fun get(key: String): String? {
        val query = mapOf<Any?, Any?>(
            kSecClass to kSecClassGenericPassword,
            kSecAttrService to SERVICE_NAME,
            kSecAttrAccount to key,
            kSecReturnData to true,
            kSecMatchLimit to kSecMatchLimitOne
        )

        return memScoped {
            // CFTypeRefVar eh o equivalente a CFTypeRef* em Objective-C/Swift
            // Necessario porque CFDictionaryRef eh um typealias para CPointer<__CFDictionary>?, nao um CVariable
            val result = alloc<CFTypeRefVar>()

            @Suppress("UNCHECKED_CAST")
            val status = SecItemCopyMatching(query as CFDictionaryRef, result.ptr)

            when (status) {
                errSecSuccess -> {
                    val data = result.value as? NSData
                        ?: throw SecureStorageException(operation = "read-result")
                    NSString.create(data = data, encoding = NSUTF8StringEncoding) as? String
                        ?: throw SecureStorageException(operation = "decode")
                }
                errSecItemNotFound -> null
                else -> failKeychainOperation(operation = "read", status = status)
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
        val status = SecItemDelete(query as CFDictionaryRef)
        requireKeychainSuccess(
            operation = "delete",
            status = status,
            itemNotFoundIsSuccess = true
        )
    }

    actual fun clear() {
        val query = mapOf<Any?, Any?>(
            kSecClass to kSecClassGenericPassword,
            kSecAttrService to SERVICE_NAME
        )

        @Suppress("UNCHECKED_CAST")
        val status = SecItemDelete(query as CFDictionaryRef)
        requireKeychainSuccess(
            operation = "clear",
            status = status,
            itemNotFoundIsSuccess = true
        )
    }

    actual fun contains(key: String): Boolean {
        val query = mapOf<Any?, Any?>(
            kSecClass to kSecClassGenericPassword,
            kSecAttrService to SERVICE_NAME,
            kSecAttrAccount to key,
            kSecReturnData to false
        )

        @Suppress("UNCHECKED_CAST")
        val status = SecItemCopyMatching(query as CFDictionaryRef, null)
        return when (status) {
            errSecSuccess -> true
            errSecItemNotFound -> false
            else -> failKeychainOperation(operation = "contains", status = status)
        }
    }
}

internal fun requireKeychainSuccess(
    operation: String,
    status: Int,
    itemNotFoundIsSuccess: Boolean = false,
) {
    if (status == errSecSuccess || (itemNotFoundIsSuccess && status == errSecItemNotFound)) {
        return
    }
    failKeychainOperation(operation = operation, status = status)
}

internal fun failKeychainOperation(operation: String, status: Int): Nothing {
    // Deliberadamente nao inclui key/value. O codigo e suficiente para diagnostico.
    println("SecureStorage Keychain failure: operation=$operation status=$status")
    throw SecureStorageException(operation = operation, errorCode = status.toLong())
}
