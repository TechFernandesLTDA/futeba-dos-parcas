package com.futebadosparcas.util

import android.content.Context
import android.content.SharedPreferences
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PreferencesManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    // Lazy initialization - SharedPreferences só é criado quando acessado pela primeira vez
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
     * Salva o timestamp do último login bem-sucedido
     */
    fun setLastLoginTime(timestamp: Long = System.currentTimeMillis()) {
        sharedPreferences.edit()
            .putLong(KEY_LAST_LOGIN_TIME, timestamp)
            .apply()
    }
    
    /**
     * Retorna o timestamp do último login
     * @return timestamp em milissegundos, ou 0 se nunca fez login
     */
    fun getLastLoginTime(): Long {
        return sharedPreferences.getLong(KEY_LAST_LOGIN_TIME, 0L)
    }

    fun clearAll() {
        cachedTheme = null
        sharedPreferences.edit().clear().apply()
    }

    companion object {
        private const val PREFS_NAME = "futeba_prefs"
        private const val DEFAULT_THEME = "system"

        private const val KEY_FIRST_LAUNCH = "first_launch"
        private const val KEY_NOTIFICATIONS_ENABLED = "notifications_enabled"
        private const val KEY_PREFERRED_FIELD_TYPE = "preferred_field_type"
        private const val KEY_THEME_PREFERENCE = "theme_preference"
        private const val KEY_MOCK_MODE_ENABLED = "mock_mode_enabled"
        private const val KEY_DEV_MODE_ENABLED = "dev_mode_enabled"
        private const val KEY_LAST_LOGIN_TIME = "last_login_time"
    }
}
