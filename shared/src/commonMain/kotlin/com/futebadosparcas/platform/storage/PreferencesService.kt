package com.futebadosparcas.platform.storage

/**
 * Abstração multiplataforma para armazenamento de preferências simples (key-value).
 *
 * Implementações:
 * - Android: SharedPreferences
 * - iOS: NSUserDefaults
 *
 * NOTA: Para dados sensíveis (tokens, senhas), usar EncryptedPreferences específico
 * de cada plataforma (EncryptedSharedPreferences no Android, Keychain no iOS).
 */
expect class PreferencesService {
    fun getString(key: String, default: String?): String?
    fun putString(key: String, value: String)
    fun getInt(key: String, default: Int): Int
    fun putInt(key: String, value: Int)
    fun getLong(key: String, default: Long): Long
    fun putLong(key: String, value: Long)
    fun getFloat(key: String, default: Float): Float
    fun putFloat(key: String, value: Float)
    fun getBoolean(key: String, default: Boolean): Boolean
    fun putBoolean(key: String, value: Boolean)
    fun remove(key: String)
    fun clear()
    fun contains(key: String): Boolean
}
