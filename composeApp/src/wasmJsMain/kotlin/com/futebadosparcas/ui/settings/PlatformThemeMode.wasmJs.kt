package com.futebadosparcas.ui.settings

import com.futebadosparcas.domain.model.ThemeMode

/**
 * wasmJs (infraestrutura CMP, não-shipping): no-op (#4097).
 * A Web real é o app React em `web/` (`ThemeContext.tsx`).
 */
internal actual fun applyPlatformThemeMode(mode: ThemeMode) {
    // No-op: sem chrome nativo a sincronizar no target wasmJs.
}
