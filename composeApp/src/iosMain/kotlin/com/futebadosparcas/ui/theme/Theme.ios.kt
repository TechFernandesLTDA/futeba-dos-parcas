package com.futebadosparcas.ui.theme

import androidx.compose.material3.ColorScheme
import androidx.compose.runtime.Composable

/**
 * #2673/#4086 — Setup de tema específico de iOS.
 *
 * Diferente do Android (onde `PlatformThemeSetup` ajusta diretamente
 * `window.statusBarColor` / `isAppearanceLightStatusBars`), no iOS o Compose
 * Multiplatform NÃO controla a status bar de dentro do Compose: a aparência
 * (clara/escura) da status bar é responsabilidade do `UIViewController` host e da
 * camada SwiftUI (`ContentView.swift` via `.preferredColorScheme(...)`).
 *
 * Status bar (#4086): o controller usa o estilo `UIStatusBarStyleDefault`, que resolve
 * pelo trait collection do sistema (com `UIUserInterfaceStyle = Automatic` no
 * `Info.plist`). Como o app segue o sistema (`ThemeMode.SYSTEM` em `App.kt`), a status
 * bar acompanha o mesmo modo do app e os glifos contrastam com o fundo edge-to-edge do
 * `Surface` raiz. Não há `delegate` em `MainViewController.kt` — o controle só será
 * necessário quando existir rota de tema explícita (LIGHT/DARK) no iOS.
 *
 * Safe-area (notch, status bar, home indicator, Dynamic Island):
 * - O `ComposeUIViewController` (ver `MainViewController.kt`) já mede as safe areas
 *   do sistema e as expõe ao Compose através de `WindowInsets.safeDrawing`.
 * - O tratamento dos insets acontece no scaffold raiz `App()`
 *   (`Modifier.windowInsetsPadding(WindowInsets.safeDrawing)`), garantindo que o
 *   conteúdo não fique sob o notch/cutout nem sob o home indicator (#2691).
 *
 * Por isso, este `actual` é intencionalmente um no-op: a status bar é resolvida pelo
 * trait collection do sistema (mesmo critério de `isDark` que o `FutebaTheme` usa com
 * `ThemeMode.SYSTEM`), e a safe-area é tratada no scaffold raiz. Os parâmetros são
 * mantidos por contrato do `expect` e para paridade com o Android.
 */
@Composable
internal actual fun PlatformThemeSetup(
    colorScheme: ColorScheme,
    isDark: Boolean
) {
    // No-op no iOS: status bar segue o sistema (UIUserInterfaceStyle = Automatic);
    // safe-area é tratada via WindowInsets.safeDrawing no scaffold raiz (App.kt).
}
