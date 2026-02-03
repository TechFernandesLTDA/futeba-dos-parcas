package com.futebadosparcas.platform.storage

import platform.Foundation.NSUserDefaults
import platform.Foundation.setValue

/**
 * Implementacao iOS do PreferencesService usando NSUserDefaults.
 *
 * NSUserDefaults eh o mecanismo padrao do iOS para armazenamento
 * de preferencias simples (key-value), analogo ao SharedPreferences do Android.
 *
 * NOTA: Para dados sensíveis (tokens, senhas), usar Keychain do iOS.
 */
actual class PreferencesService {

    private val userDefaults = NSUserDefaults.standardUserDefaults

    actual fun getString(key: String, default: String?): String? {
        return userDefaults.stringForKey(key) ?: default
    }

    actual fun putString(key: String, value: String) {
        userDefaults.setObject(value, forKey = key)
        userDefaults.synchronize()
    }

    actual fun getInt(key: String, default: Int): Int {
        return if (userDefaults.objectForKey(key) != null) {
            userDefaults.integerForKey(key).toInt()
        } else {
            default
        }
    }

    actual fun putInt(key: String, value: Int) {
        userDefaults.setInteger(value.toLong(), forKey = key)
        userDefaults.synchronize()
    }

    actual fun getLong(key: String, default: Long): Long {
        return if (userDefaults.objectForKey(key) != null) {
            userDefaults.integerForKey(key)
        } else {
            default
        }
    }

    actual fun putLong(key: String, value: Long) {
        userDefaults.setInteger(value, forKey = key)
        userDefaults.synchronize()
    }

    actual fun getFloat(key: String, default: Float): Float {
        return if (userDefaults.objectForKey(key) != null) {
            userDefaults.floatForKey(key)
        } else {
            default
        }
    }

    actual fun putFloat(key: String, value: Float) {
        userDefaults.setFloat(value, forKey = key)
        userDefaults.synchronize()
    }

    actual fun getBoolean(key: String, default: Boolean): Boolean {
        return if (userDefaults.objectForKey(key) != null) {
            userDefaults.boolForKey(key)
        } else {
            default
        }
    }

    actual fun putBoolean(key: String, value: Boolean) {
        userDefaults.setBool(value, forKey = key)
        userDefaults.synchronize()
    }

    actual fun remove(key: String) {
        userDefaults.removeObjectForKey(key)
        userDefaults.synchronize()
    }

    actual fun clear() {
        // Remove todas as chaves do dominio da app
        val appDomain = platform.Foundation.NSBundle.mainBundle.bundleIdentifier
        if (appDomain != null) {
            userDefaults.removePersistentDomainForName(appDomain)
            userDefaults.synchronize()
        }
    }

    actual fun contains(key: String): Boolean {
        return userDefaults.objectForKey(key) != null
    }
}
