package com.futebadosparcas.data

import android.graphics.Color
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
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
    }

    override val themeConfig: Flow<AppThemeConfig> = dataStore.data
        .map { preferences ->
            val mode = try {
                ThemeMode.valueOf(preferences[Keys.THEME_MODE] ?: ThemeMode.LIGHT.name)
            } catch (e: IllegalArgumentException) {
                ThemeMode.LIGHT
            }

            val contrast = try {
                ContrastLevel.valueOf(preferences[Keys.CONTRAST_LEVEL] ?: ContrastLevel.NORMAL.name)
            } catch (e: IllegalArgumentException) {
                ContrastLevel.NORMAL
            }

            val primary = preferences[Keys.PRIMARY_COLOR] ?: Color.parseColor("#58CC02")
            val secondary = preferences[Keys.SECONDARY_COLOR] ?: Color.parseColor("#FF9600")

            AppThemeConfig(
                seedColors = SeedColors(primary, secondary),
                mode = mode,
                contrastLevel = contrast
            )
        }

    override suspend fun updateThemeConfig(config: AppThemeConfig) {
        dataStore.edit { preferences ->
            preferences[Keys.THEME_MODE] = config.mode.name
            preferences[Keys.PRIMARY_COLOR] = config.seedColors.primary
            preferences[Keys.SECONDARY_COLOR] = config.seedColors.secondary
            preferences[Keys.CONTRAST_LEVEL] = config.contrastLevel.name
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

    override suspend fun resetThemeConfig() {
        val defaults = AppThemeConfig()
        dataStore.edit { preferences ->
            preferences[Keys.THEME_MODE] = defaults.mode.name
            preferences[Keys.PRIMARY_COLOR] = defaults.seedColors.primary
            preferences[Keys.SECONDARY_COLOR] = defaults.seedColors.secondary
            preferences[Keys.CONTRAST_LEVEL] = defaults.contrastLevel.name
        }
    }
}
