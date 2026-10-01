package com.futebadosparcas.ui.settings

import com.futebadosparcas.domain.model.ThemeMode

/**
 * Harness Android do composeApp: no-op (#4097).
 *
 * O app Android real é o `:app`, que aplica o modo via `AppCompatDelegate`
 * (`ThemeHelper.applyTheme`) no seu próprio `ThemeViewModel`.
 */
internal actual fun applyPlatformThemeMode(mode: ThemeMode) {
    // No-op: o target Android deste módulo é apenas harness de build.
}
