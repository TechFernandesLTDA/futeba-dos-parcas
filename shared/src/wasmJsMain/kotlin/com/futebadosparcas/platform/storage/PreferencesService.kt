package com.futebadosparcas.platform.storage

// TODO: Fase 3 - implementar com localStorage do browser
actual class PreferencesService {
    private val store = mutableMapOf<String, String>()

    actual fun getString(key: String, default: String?): String? = store[key] ?: default
    actual fun putString(key: String, value: String) { store[key] = value }
    actual fun getInt(key: String, default: Int): Int = store[key]?.toIntOrNull() ?: default
    actual fun putInt(key: String, value: Int) { store[key] = value.toString() }
    actual fun getLong(key: String, default: Long): Long = store[key]?.toLongOrNull() ?: default
    actual fun putLong(key: String, value: Long) { store[key] = value.toString() }
    actual fun getFloat(key: String, default: Float): Float = store[key]?.toFloatOrNull() ?: default
    actual fun putFloat(key: String, value: Float) { store[key] = value.toString() }
    actual fun getBoolean(key: String, default: Boolean): Boolean =
        store[key]?.toBooleanStrictOrNull() ?: default
    actual fun putBoolean(key: String, value: Boolean) { store[key] = value.toString() }
    actual fun remove(key: String) { store.remove(key) }
    actual fun clear() { store.clear() }
    actual fun contains(key: String): Boolean = store.containsKey(key)
}
