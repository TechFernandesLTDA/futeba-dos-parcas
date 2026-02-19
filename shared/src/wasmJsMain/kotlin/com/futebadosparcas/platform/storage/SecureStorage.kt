package com.futebadosparcas.platform.storage

// TODO: Fase 3 - implementar com sessionStorage/localStorage com criptografia
actual class SecureStorage actual constructor() {
    private val store = mutableMapOf<String, String>()

    actual fun save(key: String, value: String) { store[key] = value }
    actual fun get(key: String): String? = store[key]
    actual fun delete(key: String) { store.remove(key) }
    actual fun clear() { store.clear() }
    actual fun contains(key: String): Boolean = store.containsKey(key)
}
