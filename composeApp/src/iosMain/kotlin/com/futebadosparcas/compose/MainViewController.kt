package com.futebadosparcas.compose

import androidx.compose.ui.window.ComposeUIViewController

/**
 * ViewController principal para iOS.
 *
 * Esta função cria o UIViewController que será usado no SwiftUI.
 *
 * #2673 — Safe-area: o `ComposeUIViewController` do Compose Multiplatform já mede as
 * safe areas do sistema (notch, status bar, home indicator, Dynamic Island) e as
 * expõe ao Compose via `WindowInsets.safeDrawing` / `WindowInsets.safeContent`.
 *
 * Mantemos o comportamento padrão (`opaque = true`, conteúdo desenhando edge-to-edge
 * sob as barras) e aplicamos o tratamento de insets no scaffold raiz `App()`
 * (`Modifier.windowInsetsPadding(WindowInsets.safeDrawing)`), seguindo a recomendação
 * oficial de não consumir insets fora do composable raiz. NÃO desabilitamos o
 * encaminhamento de insets, pois isso quebraria o respeito ao notch/cutout (#2691).
 */
fun MainViewController() = ComposeUIViewController { App() }
