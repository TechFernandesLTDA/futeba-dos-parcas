package com.futebadosparcas.compose

import androidx.compose.ui.window.ComposeUIViewController

/**
 * ViewController principal para iOS.
 *
 * Esta função cria o UIViewController que será usado no SwiftUI.
 */
fun MainViewController() = ComposeUIViewController { App() }
