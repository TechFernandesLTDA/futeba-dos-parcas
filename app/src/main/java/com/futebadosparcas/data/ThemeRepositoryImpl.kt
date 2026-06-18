package com.futebadosparcas.data

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import com.futebadosparcas.domain.model.AppThemeConfig
import com.futebadosparcas.domain.model.ContrastLevel
import com.futebadosparcas.domain.model.SeedColors
import com.futebadosparcas.domain.model.ThemeMode
import com.futebadosparcas.domain.repository.ThemeRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * Implementacao Android do ThemeRepository.
 * Usa DataStore para persistencia local de preferencias de tema.
 */
class ThemeRepositoryImpl constructor(
    private val dataStore: DataStore<Preferences>
) : ThemeRepository {

    private object Keys {
        val THEME_MODE = stringPreferencesKey("theme_mode")
        val PRIMARY_COLOR = intPreferencesKey("primary_color")
        val SECONDARY_COLOR = intPreferencesKey("secondary_color")
        val CONTRAST_LEVEL = stringPreferencesKey("contrast_level")
        val USE_DYNAMIC_COLOR = booleanPreferencesKey("use_dynamic_color")
    }

    // Default real do app, vindo do modelo (SYSTEM). Usado quando nada foi persistido
    // pelo usuario — corrige #2688 (default era LIGHT efetivo no leitor).
    private val defaultConfig = AppThemeConfig()

    override val themeConfig: Flow<AppThemeConfig> = dataStore.data
        .map { preferences ->
            // #2688: quando nada foi persistido, segue o sistema (default do modelo),
            // respeitando qualquer preferencia que o usuario ja tenha escolhido.
            val mode = try {
                ThemeMode.valueOf(preferences[Keys.THEME_MODE] ?: defaultConfig.mode.name)
            } catch (e: IllegalArgumentException) {
                defaultConfig.mode
            }

            val contrast = try {
                ContrastLevel.valueOf(preferences[Keys.CONTRAST_LEVEL] ?: defaultConfig.contrastLevel.name)
            } catch (e: IllegalArgumentException) {
                defaultConfig.contrastLevel
            }

            // Usa Compose Color (não android.graphics.Color) para cores semente padrão.
            val primary = preferences[Keys.PRIMARY_COLOR] ?: Color(0xFF00852A).toArgb()
            val secondary = preferences[Keys.SECONDARY_COLOR] ?: Color(0xFFFF9600).toArgb()

            // #2684: Material You (opt-in). Sem nada persistido usa o default da marca.
            val useDynamicColor = preferences[Keys.USE_DYNAMIC_COLOR] ?: defaultConfig.useDynamicColor

            AppThemeConfig(
                seedColors = SeedColors(primary, secondary),
                mode = mode,
                contrastLevel = contrast,
                useDynamicColor = useDynamicColor
            )
        }

    override suspend fun updateThemeConfig(config: AppThemeConfig) {
        dataStore.edit { preferences ->
            preferences[Keys.THEME_MODE] = config.mode.name
            preferences[Keys.PRIMARY_COLOR] = config.seedColors.primary
            preferences[Keys.SECONDARY_COLOR] = config.seedColors.secondary
            preferences[Keys.CONTRAST_LEVEL] = config.contrastLevel.name
            preferences[Keys.USE_DYNAMIC_COLOR] = config.useDynamicColor
        }
    }

    override suspend fun setPrimaryColor(color: Int) {
        dataStore.edit { it[Keys.PRIMARY_COLOR] = color }
    }

    override suspend fun setSecondaryColor(color: Int) {
        dataStore.edit { it[Keys.SECONDARY_COLOR] = color }
    }

    override suspend fun setThemeMode(mode: ThemeMode) {
        dataStore.edit { it[Keys.THEME_MODE] = mode.name }
    }

    override suspend fun setContrastLevel(level: ContrastLevel) {
        dataStore.edit { it[Keys.CONTRAST_LEVEL] = level.name }
    }

    override suspend fun setUseDynamicColor(enabled: Boolean) {
        dataStore.edit { it[Keys.USE_DYNAMIC_COLOR] = enabled }
    }

    override suspend fun resetThemeConfig() {
        val defaults = AppThemeConfig()
        dataStore.edit { preferences ->
            preferences[Keys.THEME_MODE] = defaults.mode.name
            preferences[Keys.PRIMARY_COLOR] = defaults.seedColors.primary
            preferences[Keys.SECONDARY_COLOR] = defaults.seedColors.secondary
            preferences[Keys.CONTRAST_LEVEL] = defaults.contrastLevel.name
            preferences[Keys.USE_DYNAMIC_COLOR] = defaults.useDynamicColor
        }
    }
}
