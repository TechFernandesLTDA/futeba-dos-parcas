package com.futebadosparcas.platform.storage

import android.content.Context
import android.content.SharedPreferences

/**
 * Implementação Android do PreferencesService usando SharedPreferences.
 */
actual class PreferencesService(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("futeba_prefs", Context.MODE_PRIVATE)

    actual fun getString(key: String, default: String?): String? {
        return prefs.getString(key, default)
    }

    actual fun putString(key: String, value: String) {
        prefs.edit().putString(key, value).apply()
    }

    actual fun getInt(key: String, default: Int): Int {
        return prefs.getInt(key, default)
    }

    actual fun putInt(key: String, value: Int) {
        prefs.edit().putInt(key, value).apply()
    }

    actual fun getLong(key: String, default: Long): Long {
        return prefs.getLong(key, default)
    }

    actual fun putLong(key: String, value: Long) {
        prefs.edit().putLong(key, value).apply()
    }

    actual fun getFloat(key: String, default: Float): Float {
        return prefs.getFloat(key, default)
    }

    actual fun putFloat(key: String, value: Float) {
        prefs.edit().putFloat(key, value).apply()
    }

    actual fun getBoolean(key: String, default: Boolean): Boolean {
        return prefs.getBoolean(key, default)
    }

    actual fun putBoolean(key: String, value: Boolean) {
        prefs.edit().putBoolean(key, value).apply()
    }

    actual fun remove(key: String) {
        prefs.edit().remove(key).apply()
    }

    actual fun clear() {
        prefs.edit().clear().apply()
    }

    actual fun contains(key: String): Boolean {
        return prefs.contains(key)
    }
}
