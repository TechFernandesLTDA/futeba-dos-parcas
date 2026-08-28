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
 *
 * #4086 — Status bar: o controller do CMP usa o estilo `UIStatusBarStyleDefault`, que
 * resolve pelo trait collection do sistema (com `UIUserInterfaceStyle = Automatic` no
 * Info.plist). Como o app agora segue o sistema (`ThemeMode.SYSTEM` em `App.kt`), a
 * aparência da status bar (clara/escura) acompanha o mesmo modo do app e os glifos
 * contrastam com o fundo edge-to-edge desenhado pelo `Surface` raiz. Não é necessário
 * um `ComposeUIViewControllerDelegate` enquanto não houver rota de tema explícita
 * (LIGHT/DARK) no iOS; quando houver, controlar `preferredStatusBarStyle` aqui.
 */
fun MainViewController() = ComposeUIViewController { App() }
