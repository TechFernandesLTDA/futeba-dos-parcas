package com.futebadosparcas.ui.settings

import com.futebadosparcas.domain.model.ThemeMode

/**
 * Propaga o [ThemeMode] escolhido pelo usuário para a camada nativa da plataforma (#4097).
 *
 * - **iOS**: ajusta `overrideUserInterfaceStyle` das janelas. Sem isso, ao forçar
 *   ESCURO com o iPhone em modo claro (ou vice-versa) a status bar — resolvida pelo
 *   trait collection do sistema com `UIStatusBarStyleDefault` — ficaria com glifos
 *   sem contraste sobre o fundo edge-to-edge do app (pendência declarada em
 *   `MainViewController.kt` / `Theme.ios.kt`, #4086). Em SYSTEM volta a `Unspecified`
 *   para seguir o sistema em tempo real.
 * - **Android (harness) / wasmJs**: no-op. O app Android real (`:app`) aplica o modo
 *   via `AppCompatDelegate` no seu próprio `ThemeViewModel`.
 *
 * Deve ser chamado na thread principal (ex.: de um `LaunchedEffect`).
 */
internal expect fun applyPlatformThemeMode(mode: ThemeMode)
