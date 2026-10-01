package com.futebadosparcas.ui.settings

import com.futebadosparcas.domain.model.AppThemeConfig
import com.futebadosparcas.domain.model.ContrastLevel
import com.futebadosparcas.domain.model.ThemeMode
import com.futebadosparcas.domain.repository.ThemeRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

/**
 * [ThemeRepository] em memória para os targets não-shipping do composeApp
 * (harness Android e wasmJs) — #4097.
 *
 * O app Android real (`:app`) tem a implementação DataStore própria e não depende
 * do `:composeApp`; o iOS usa `ThemeRepositoryImpl` (NSUserDefaults, shared/iosMain).
 * Aqui só garantimos que `App.kt` e a tela de tema funcionem sem persistência.
 */
internal class InMemoryThemeRepository(
    private val initial: AppThemeConfig = SharedUiThemeDefaults.config
) : ThemeRepository {

    private val state = MutableStateFlow(initial)

    override val themeConfig: Flow<AppThemeConfig> = state.asStateFlow()

    override suspend fun updateThemeConfig(config: AppThemeConfig) {
        state.value = config
    }

    override suspend fun setPrimaryColor(color: Int) {
        state.update { it.copy(seedColors = it.seedColors.copy(primary = color)) }
    }

    override suspend fun setSecondaryColor(color: Int) {
        state.update { it.copy(seedColors = it.seedColors.copy(secondary = color)) }
    }

    override suspend fun setThemeMode(mode: ThemeMode) {
        state.update { it.copy(mode = mode) }
    }

    override suspend fun setContrastLevel(level: ContrastLevel) {
        state.update { it.copy(contrastLevel = level) }
    }

    override suspend fun setUseDynamicColor(enabled: Boolean) {
        state.update { it.copy(useDynamicColor = enabled) }
    }

    override suspend fun resetThemeConfig() {
        state.value = initial
    }
}
