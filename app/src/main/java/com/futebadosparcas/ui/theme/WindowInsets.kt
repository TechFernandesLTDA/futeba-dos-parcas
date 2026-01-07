package com.futebadosparcas.ui.theme

import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.statusBars
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.foundation.layout.padding

/**
 * Modifier extensions para gerenciar WindowInsets de forma consistente em todo o app.
 *
 * Edge-to-Edge Design:
 * - Permite que o conteúdo se estenda até as bordas da tela
 * - Gerencia padding automaticamente para evitar sobreposição com barras do sistema
 * - Suporta teclado (IME) e barras de navegação/status
 */

/**
 * Adiciona padding para todas as barras do sistema (status + navigation)
 */
@Composable
fun Modifier.systemBarsPadding(): Modifier {
    return this.padding(WindowInsets.systemBars.asPaddingValues())
}

/**
 * Adiciona padding apenas para a barra de status (topo)
 */
@Composable
fun Modifier.statusBarsPadding(): Modifier {
    return this.padding(WindowInsets.statusBars.asPaddingValues())
}

/**
 * Adiciona padding apenas para a barra de navegação (bottom)
 */
@Composable
fun Modifier.navigationBarsPadding(): Modifier {
    return this.padding(WindowInsets.navigationBars.asPaddingValues())
}

/**
 * Adiciona padding para o teclado (IME - Input Method Editor)
 * Útil para formulários e campos de texto
 */
@Composable
fun Modifier.imePadding(): Modifier {
    return this.padding(WindowInsets.ime.asPaddingValues())
}

/**
 * Adiciona padding horizontal para barras do sistema
 * Útil para NavigationRail em tablets
 */
@Composable
fun Modifier.systemBarsHorizontalPadding(): Modifier {
    return this.padding(
        WindowInsets.systemBars
            .only(WindowInsetsSides.Horizontal)
            .asPaddingValues()
    )
}

/**
 * Adiciona padding vertical para barras do sistema
 * Útil para listas que precisam de padding top/bottom
 */
@Composable
fun Modifier.systemBarsVerticalPadding(): Modifier {
    return this.padding(
        WindowInsets.systemBars
            .only(WindowInsetsSides.Vertical)
            .asPaddingValues()
    )
}

/**
 * Adiciona padding apenas no topo (status bar)
 * Mantém compatibilidade com design existente
 */
@Composable
fun Modifier.topBarPadding(): Modifier {
    return this.padding(
        WindowInsets.systemBars
            .only(WindowInsetsSides.Top)
            .asPaddingValues()
    )
}

/**
 * Adiciona padding apenas no bottom (navigation bar)
 * Útil para FABs e bottom sheets
 */
@Composable
fun Modifier.bottomBarPadding(): Modifier {
    return this.padding(
        WindowInsets.systemBars
            .only(WindowInsetsSides.Bottom)
            .asPaddingValues()
    )
}

/**
 * Adiciona padding para barras do sistema + teclado
 * Combina systemBars e ime para telas com inputs
 */
@Composable
fun Modifier.systemBarsAndImePadding(): Modifier {
    val systemBarsPadding = WindowInsets.systemBars.asPaddingValues()
    val imePadding = WindowInsets.ime.asPaddingValues()

    return this
        .padding(systemBarsPadding)
        .padding(imePadding)
}
