package com.futebadosparcas.platform.storage

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Implementacao Android do SecureStorage usando EncryptedSharedPreferences.
 *
 * Usa AES256-SIV para chaves e AES256-GCM para valores,
 * com MasterKey armazenada no Android Keystore.
 *
 * NOTA: A inicializacao requer Context do Android, que sera
 * injetado via Hilt/DI no modulo :app. Esta classe fornece
 * um metodo companion para inicializacao com contexto.
 *
 * Uso via DI (Hilt):
 * ```kotlin
 * @Provides
 * fun provideSecureStorage(@ApplicationContext context: Context): SecureStorage {
 *     SecureStorage.init(context)
 *     return SecureStorage()
 * }
 * ```
 */
actual class SecureStorage actual constructor() {

    companion object {
        private var prefs: SharedPreferences? = null
        private const val PREFS_NAME = "futeba_secure_prefs"

        /**
         * Inicializa o SecureStorage com o Context do Android.
         * Deve ser chamado uma vez na inicializacao do app ou via DI.
         *
         * @param context Application context
         */
        fun init(context: Context) {
            if (prefs == null) {
                val masterKey = MasterKey.Builder(context)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build()

                prefs = EncryptedSharedPreferences.create(
                    context,
                    PREFS_NAME,
                    masterKey,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
                )
            }
        }

        private fun getPrefs(): SharedPreferences {
            return prefs ?: throw IllegalStateException(
                "SecureStorage nao inicializado. Chame SecureStorage.init(context) primeiro."
            )
        }
    }

    actual fun save(key: String, value: String) {
        getPrefs().edit().putString(key, value).apply()
    }

    actual fun get(key: String): String? {
        return getPrefs().getString(key, null)
    }

    actual fun delete(key: String) {
        getPrefs().edit().remove(key).apply()
    }

    actual fun clear() {
        getPrefs().edit().clear().apply()
    }

    actual fun contains(key: String): Boolean {
        return getPrefs().contains(key)
    }
}
