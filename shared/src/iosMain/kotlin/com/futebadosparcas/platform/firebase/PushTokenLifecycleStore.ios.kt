package com.futebadosparcas.platform.firebase

import platform.Foundation.NSUserDefaults

private const val DEVICE_ID_KEY = "push.installation.device-id"
private const val TOKEN_KEY = "push.installation.fcm-token"
private const val SEQUENCE_KEY = "push.installation.sequence"

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
        // O token FCM identifica a instalação, não a conta. O unregister
        // transacional acima já impede entrega após logout; manter o token no
        // Keychain permite reassociá-lo com segurança no próximo login. A
        // camada Swift continua sendo a única dona das operações de Keychain,
        // evitando casts Kotlin Map -> CFDictionaryRef inválidos em runtime.
        // Remova somente a chave anterior à migração para Keychain.
        NSUserDefaults.standardUserDefaults.removeObjectForKey(TOKEN_KEY)
    }
}
