package com.futebadosparcas.util

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Gerenciador de preferências do app com suporte a encriptação.
 * Dados sensíveis são armazenados em EncryptedSharedPreferences.
 * Dados não-sensíveis usam SharedPreferences padrão para performance.
 */
@Singleton
class PreferencesManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    // Master key para encriptação AES256
    private val masterKey: MasterKey by lazy {
        MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
    }

    // SharedPreferences encriptado para dados sensíveis
    private val encryptedPreferences: SharedPreferences by lazy {
        createEncryptedPreferences()
    }

    /**
     * Cria EncryptedSharedPreferences com recuperação automática de erros.
     * Se a chave estiver corrompida, tenta limpar e recriar.
     */
    private fun createEncryptedPreferences(): SharedPreferences {
        return try {
            EncryptedSharedPreferences.create(
                context,
                ENCRYPTED_PREFS_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            AppLogger.e("PreferencesManager", "Erro ao criar EncryptedSharedPreferences", e)
            
            // Tenta recuperar limpando as preferências corrompidas
            when {
                e is javax.crypto.AEADBadTagException || 
                e.cause is javax.crypto.AEADBadTagException -> {
                    AppLogger.w("PreferencesManager") { "Chave de criptografia corrompida, tentando recuperar..." }
                    recoverFromCorruptedEncryption()
                }
                else -> {
                    AppLogger.w("PreferencesManager") { "Fallback para SharedPreferences não-encriptado" }
                    context.getSharedPreferences(ENCRYPTED_PREFS_NAME, Context.MODE_PRIVATE)
                }
            }
        }
    }

    /**
     * Recupera de erro de criptografia limpando dados corrompidos e recriando.
     */
    private fun recoverFromCorruptedEncryption(): SharedPreferences {
        try {
            // 1. Limpa o arquivo de preferências corrompido
            val prefsFile = context.getSharedPreferences(ENCRYPTED_PREFS_NAME, Context.MODE_PRIVATE)
            prefsFile.edit().clear().commit()
            
            // 2. Tenta recriar com nova chave
            return EncryptedSharedPreferences.create(
                context,
                ENCRYPTED_PREFS_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            ).also {
                AppLogger.i("PreferencesManager") { "EncryptedSharedPreferences recuperado com sucesso" }
            }
        } catch (e: Exception) {
            AppLogger.e("PreferencesManager", "Falha na recuperação, usando SharedPreferences padrão", e)
            return context.getSharedPreferences(ENCRYPTED_PREFS_NAME, Context.MODE_PRIVATE)
        }
    }

    // SharedPreferences padrão para dados não-sensíveis (performance)
    private val sharedPreferences: SharedPreferences by lazy {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    // Cache do tema para evitar leituras repetidas de disco
    @Volatile
    private var cachedTheme: String? = null

    fun setFirstLaunch(isFirst: Boolean) {
        sharedPreferences.edit()
            .putBoolean(KEY_FIRST_LAUNCH, isFirst)
            .apply()
    }

    fun isFirstLaunch(): Boolean {
        return sharedPreferences.getBoolean(KEY_FIRST_LAUNCH, true)
    }

    fun setNotificationsEnabled(enabled: Boolean) {
        sharedPreferences.edit()
            .putBoolean(KEY_NOTIFICATIONS_ENABLED, enabled)
            .apply()
    }

    fun areNotificationsEnabled(): Boolean {
        return sharedPreferences.getBoolean(KEY_NOTIFICATIONS_ENABLED, true)
    }

    fun setPreferredFieldType(fieldType: String) {
        sharedPreferences.edit()
            .putString(KEY_PREFERRED_FIELD_TYPE, fieldType)
            .apply()
    }

    fun getPreferredFieldType(): String? {
        return sharedPreferences.getString(KEY_PREFERRED_FIELD_TYPE, null)
    }

    fun setThemePreference(theme: String) {
        cachedTheme = theme
        sharedPreferences.edit()
            .putString(KEY_THEME_PREFERENCE, theme)
            .apply()
    }

    /**
     * Retorna a preferência de tema com cache para evitar leituras de disco repetidas.
     * A primeira chamada lê do disco, as subsequentes usam cache.
     */
    fun getThemePreference(): String {
        return cachedTheme ?: run {
            val theme = sharedPreferences.getString(KEY_THEME_PREFERENCE, DEFAULT_THEME) ?: DEFAULT_THEME
            cachedTheme = theme
            theme
        }
    }

    // Memory-only flags (reset on app restart) to ensure production data by default
    private var _isDevModeEnabled: Boolean = false
    private var _isMockModeEnabled: Boolean = false

    fun setMockModeEnabled(enabled: Boolean) {
        _isMockModeEnabled = enabled
    }

    /**
     * Verifica se o Modo Mock está ativado.
     * Resetado para false a cada reinicialização do app.
     */
    fun isMockModeEnabled(): Boolean {
        return _isMockModeEnabled
    }

    fun setDevModeEnabled(enabled: Boolean) {
        _isDevModeEnabled = enabled
    }

    fun isDevModeEnabled(): Boolean {
        return _isDevModeEnabled
    }
    
    /**
     * Salva o timestamp do último login bem-sucedido (encriptado)
     */
    fun setLastLoginTime(timestamp: Long = System.currentTimeMillis()) {
        encryptedPreferences.edit()
            .putLong(KEY_LAST_LOGIN_TIME, timestamp)
            .apply()
    }

    /**
     * Retorna o timestamp do último login
     * @return timestamp em milissegundos, ou 0 se nunca fez login
     */
    fun getLastLoginTime(): Long {
        return encryptedPreferences.getLong(KEY_LAST_LOGIN_TIME, 0L)
    }

    /**
     * Salva token FCM de forma segura (encriptado)
     */
    fun setFcmToken(token: String?) {
        if (token != null) {
            encryptedPreferences.edit()
                .putString(KEY_FCM_TOKEN, token)
                .apply()
        } else {
            encryptedPreferences.edit()
                .remove(KEY_FCM_TOKEN)
                .apply()
        }
    }

    /**
     * Retorna o token FCM salvo
     */
    fun getFcmToken(): String? {
        return encryptedPreferences.getString(KEY_FCM_TOKEN, null)
    }

    fun clearAll() {
        cachedTheme = null
        sharedPreferences.edit().clear().apply()
        encryptedPreferences.edit().clear().apply()
    }

    companion object {
        private const val PREFS_NAME = "futeba_prefs"
        private const val ENCRYPTED_PREFS_NAME = "futeba_secure_prefs"
        private const val DEFAULT_THEME = "light"

        // Chaves para SharedPreferences padrão (dados não-sensíveis)
        private const val KEY_FIRST_LAUNCH = "first_launch"
        private const val KEY_NOTIFICATIONS_ENABLED = "notifications_enabled"
        private const val KEY_PREFERRED_FIELD_TYPE = "preferred_field_type"
        private const val KEY_THEME_PREFERENCE = "theme_preference"
        private const val KEY_MOCK_MODE_ENABLED = "mock_mode_enabled"
        private const val KEY_DEV_MODE_ENABLED = "dev_mode_enabled"

        // Chaves para EncryptedSharedPreferences (dados sensíveis)
        private const val KEY_LAST_LOGIN_TIME = "last_login_time"
        private const val KEY_FCM_TOKEN = "fcm_token"
    }
}
