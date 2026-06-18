package com.futebadosparcas.ui.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.runtime.Composable

/**
 * #2673 — Setup de tema específico de iOS.
 *
 * Diferente do Android (onde `PlatformThemeSetup` ajusta diretamente
 * `window.statusBarColor` / `isAppearanceLightStatusBars`), no iOS o Compose
 * Multiplatform NÃO controla a status bar de dentro do Compose: a aparência
 * (clara/escura) da status bar é responsabilidade do `UIViewController` host e da
 * camada SwiftUI (`ContentView.swift` via `.preferredColorScheme(...)`).
 *
 * Safe-area (notch, status bar, home indicator, Dynamic Island):
 * - O `ComposeUIViewController` (ver `MainViewController.kt`) já mede as safe areas
 *   do sistema e as expõe ao Compose através de `WindowInsets.safeDrawing`.
 * - O tratamento dos insets acontece no scaffold raiz `App()`
 *   (`Modifier.windowInsetsPadding(WindowInsets.safeDrawing)`), garantindo que o
 *   conteúdo não fique sob o notch/cutout nem sob o home indicator (#2691).
 *
 * Por isso, este `actual` é intencionalmente um no-op: não há API pública e estável
 * (até CMP 1.10) para alterar o estilo da status bar do iOS a partir do Compose, e
 * forçar algo aqui seria inventar comportamento inexistente. Os parâmetros são
 * mantidos por contrato do `expect` e para paridade com o Android.
 */
@Composable
internal actual fun PlatformThemeSetup(
    colorScheme: ColorScheme,
    isDark: Boolean
) {
    // No-op no iOS: status bar é gerenciada pelo host SwiftUI/UIViewController;
    // safe-area é tratada via WindowInsets.safeDrawing no scaffold raiz (App.kt).
}
