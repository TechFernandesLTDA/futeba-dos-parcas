package com.futebadosparcas.platform.storage

/**
 * Implementação iOS do PreferencesService usando NSUserDefaults.
 *
 * TODO (QUANDO TIVER MAC DISPONÍVEL):
 * 1. Importar platform.Foundation.NSUserDefaults
 * 2. Implementar métodos usando NSUserDefaults.standardUserDefaults
 *
 * Exemplo:
 * ```
 * import platform.Foundation.NSUserDefaults
 *
 * actual class PreferencesService {
 *     private val userDefaults = NSUserDefaults.standardUserDefaults
 *
 *     actual fun getString(key: String, default: String?): String? {
 *         return userDefaults.stringForKey(key) ?: default
 *     }
 * }
 * ```
 */
actual class PreferencesService {
    actual fun getString(key: String, default: String?): String? {
        TODO("Implementar com NSUserDefaults.standardUserDefaults.stringForKey()")
    }

    actual fun putString(key: String, value: String) {
        TODO("Implementar com NSUserDefaults.standardUserDefaults.setObject()")
    }

    actual fun getInt(key: String, default: Int): Int {
        TODO("Implementar com NSUserDefaults.standardUserDefaults.integerForKey()")
    }

    actual fun putInt(key: String, value: Int) {
        TODO("Implementar com NSUserDefaults.standardUserDefaults.setInteger()")
    }

    actual fun getLong(key: String, default: Long): Long {
        TODO("Implementar com NSUserDefaults.standardUserDefaults.integerForKey() convertido para Long")
    }

    actual fun putLong(key: String, value: Long) {
        TODO("Implementar com NSUserDefaults.standardUserDefaults.setInteger()")
    }

    actual fun getFloat(key: String, default: Float): Float {
        TODO("Implementar com NSUserDefaults.standardUserDefaults.floatForKey()")
    }

    actual fun putFloat(key: String, value: Float) {
        TODO("Implementar com NSUserDefaults.standardUserDefaults.setFloat()")
    }

    actual fun getBoolean(key: String, default: Boolean): Boolean {
        TODO("Implementar com NSUserDefaults.standardUserDefaults.boolForKey()")
    }

    actual fun putBoolean(key: String, value: Boolean) {
        TODO("Implementar com NSUserDefaults.standardUserDefaults.setBool()")
    }

    actual fun remove(key: String) {
        TODO("Implementar com NSUserDefaults.standardUserDefaults.removeObjectForKey()")
    }

    actual fun clear() {
        TODO("Implementar removendo todas as chaves do domínio da app")
    }

    actual fun contains(key: String): Boolean {
        TODO("Implementar verificando se objectForKey() retorna null")
    }
}
