package com.futebadosparcas.compose

import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.window.ComposeViewport
import kotlinx.browser.document

/**
 * Entry point da aplicação web (wasmJs).
 *
 * Usa ComposeViewport (CMP 1.10.0+) ao invés do deprecado CanvasBasedWindow.
 * ComposeViewport suporta HTML interop e A11Y.
 *
 * Fase 0: entrada básica - navegação completa na Fase 6E.
 * TODO: Fase 7 - integrar PWA, Service Worker e feature flags de plataforma
 */
@OptIn(ExperimentalComposeUiApi::class)
fun main() {
    ComposeViewport(document.body!!) {
        App()
    }
}
