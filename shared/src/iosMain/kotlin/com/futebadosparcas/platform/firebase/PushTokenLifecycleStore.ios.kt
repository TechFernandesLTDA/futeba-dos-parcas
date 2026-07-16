package com.futebadosparcas.platform.firebase

import platform.CoreFoundation.CFDictionaryRef
import platform.Foundation.NSUserDefaults
import platform.Security.SecItemDelete
import platform.Security.kSecAttrAccount
import platform.Security.kSecAttrService
import platform.Security.kSecClass
import platform.Security.kSecClassGenericPassword

private const val DEVICE_ID_KEY = "push.installation.device-id"
private const val TOKEN_KEY = "push.installation.fcm-token"
private const val SEQUENCE_KEY = "push.installation.sequence"
private const val KEYCHAIN_SERVICE = "com.futebadosparcas.push"
private const val KEYCHAIN_ACCOUNT = "fcm-token"

internal actual object PushTokenLifecycleStore {
    actual fun nextForUnregister(): StoredPushToken? {
        val defaults = NSUserDefaults.standardUserDefaults
        val deviceId = defaults.stringForKey(DEVICE_ID_KEY)?.takeIf { it.isNotBlank() }
            ?: return null
        val current = defaults.integerForKey(SEQUENCE_KEY).toLong().coerceAtLeast(0)
        val next = if (current == Long.MAX_VALUE) 1 else current + 1
        defaults.setInteger(next, forKey = SEQUENCE_KEY)
        return StoredPushToken(
            deviceId = deviceId,
            sequence = next
        )
    }

    actual fun clearToken() {
        val query = mapOf<Any?, Any?>(
            kSecClass to kSecClassGenericPassword,
            kSecAttrService to KEYCHAIN_SERVICE,
            kSecAttrAccount to KEYCHAIN_ACCOUNT
        )
        @Suppress("UNCHECKED_CAST")
        SecItemDelete(query as CFDictionaryRef)
        // Remove também a chave anterior à migração para Keychain.
        NSUserDefaults.standardUserDefaults.removeObjectForKey(TOKEN_KEY)
    }
}
