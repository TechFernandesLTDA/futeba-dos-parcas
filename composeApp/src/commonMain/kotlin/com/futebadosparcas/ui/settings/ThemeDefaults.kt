package com.futebadosparcas.ui.settings

import com.futebadosparcas.domain.model.AppThemeConfig
import com.futebadosparcas.domain.model.ThemeMode

/**
 * Defaults de tema da UI compartilhada (composeApp — iOS é o alvo de produção).
 *
 * #4086/#4095/#4097: enquanto nenhuma preferência foi persistida, o app segue o
 * sistema ([ThemeMode.SYSTEM]). É também o valor inicial usado por `App.kt` antes da
 * primeira emissão de `ThemeRepository.themeConfig` e pelo fallback em memória dos
 * targets não-shipping (harness Android e wasmJs).
 *
 * Mantido em sincronia com `ThemeRepositoryImpl.DEFAULT_CONFIG` (shared/iosMain).
 */
internal object SharedUiThemeDefaults {
    val config: AppThemeConfig = AppThemeConfig.DEFAULT.copy(mode = ThemeMode.SYSTEM)
}
