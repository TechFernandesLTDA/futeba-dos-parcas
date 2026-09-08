package com.futebadosparcas.ui.theme

import com.futebadosparcas.domain.model.AppThemeConfig
import com.futebadosparcas.domain.model.ContrastLevel
import com.futebadosparcas.domain.model.DefaultSeeds
import com.futebadosparcas.domain.model.SeedColors
import com.futebadosparcas.domain.model.ThemeMode
import com.futebadosparcas.domain.repository.ThemeRepository
import com.futebadosparcas.platform.storage.PreferencesService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

/** NSUserDefaults-backed iOS theme preference store. New iOS installs follow the OS. */
internal class IosThemeRepository(
    private val preferences: PreferencesService
) : ThemeRepository {
    private val state = MutableStateFlow(readConfig())

    override val themeConfig = state.asStateFlow()

    override suspend fun updateThemeConfig(config: AppThemeConfig) = update(config)

    override suspend fun setPrimaryColor(color: Int) = update(state.value.copy(
        seedColors = state.value.seedColors.copy(primary = color)
    ))

    override suspend fun setSecondaryColor(color: Int) = update(state.value.copy(
        seedColors = state.value.seedColors.copy(secondary = color)
    ))

    override suspend fun setThemeMode(mode: ThemeMode) = update(state.value.copy(mode = mode))

    override suspend fun setContrastLevel(level: ContrastLevel) = update(state.value.copy(contrastLevel = level))

    override suspend fun setUseDynamicColor(enabled: Boolean) = update(state.value.copy(useDynamicColor = enabled))

    override suspend fun resetThemeConfig() = update(DEFAULT_IOS_CONFIG)

    private fun update(config: AppThemeConfig) {
        state.value = config
        preferences.putString(KEY_MODE, config.mode.name)
        preferences.putInt(KEY_PRIMARY, config.seedColors.primary)
        preferences.putInt(KEY_SECONDARY, config.seedColors.secondary)
        preferences.putInt(KEY_TERTIARY, config.seedColors.tertiary ?: DefaultSeeds.TERTIARY_ARGB)
        preferences.putString(KEY_CONTRAST, config.contrastLevel.name)
        preferences.putBoolean(KEY_DYNAMIC, config.useDynamicColor)
    }

    private fun readConfig(): AppThemeConfig = AppThemeConfig(
        seedColors = SeedColors(
            primary = preferences.getInt(KEY_PRIMARY, DefaultSeeds.PRIMARY_ARGB),
            secondary = preferences.getInt(KEY_SECONDARY, DefaultSeeds.SECONDARY_ARGB),
            tertiary = preferences.getInt(KEY_TERTIARY, DefaultSeeds.TERTIARY_ARGB)
        ),
        mode = themeModeFromPreference(preferences.getString(KEY_MODE, null)),
        contrastLevel = contrastLevelFromPreference(preferences.getString(KEY_CONTRAST, null)),
        useDynamicColor = preferences.getBoolean(KEY_DYNAMIC, false)
    )

    private companion object {
        val DEFAULT_IOS_CONFIG = AppThemeConfig(mode = ThemeMode.SYSTEM)
        const val KEY_MODE = "ios_theme_mode"
        const val KEY_PRIMARY = "ios_theme_primary"
        const val KEY_SECONDARY = "ios_theme_secondary"
        const val KEY_TERTIARY = "ios_theme_tertiary"
        const val KEY_CONTRAST = "ios_theme_contrast"
        const val KEY_DYNAMIC = "ios_theme_dynamic_color"
    }
}
