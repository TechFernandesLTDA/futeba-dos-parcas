package com.futebadosparcas.ui.theme

import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.displayCutout
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.union
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.foundation.layout.padding

/**
 * Modifier extensions para gerenciar WindowInsets de forma consistente em todo o app.
 *
 * Edge-to-Edge Design:
 * - Permite que o conteúdo se estenda até as bordas da tela
 * - Gerencia padding automaticamente para evitar sobreposição com barras do sistema
 * - Suporta teclado (IME), barras de navegação/status e display cutout
 */

@Composable
private fun safeSystemBarsInsets(): WindowInsets {
    return WindowInsets.systemBars.union(WindowInsets.displayCutout)
}

@Composable
private fun safeStatusBarsInsets(): WindowInsets {
    return WindowInsets.statusBars.union(
        WindowInsets.displayCutout.only(WindowInsetsSides.Top + WindowInsetsSides.Horizontal)
    )
}

@Composable
private fun safeNavigationBarsInsets(): WindowInsets {
    return WindowInsets.navigationBars.union(
        WindowInsets.displayCutout.only(WindowInsetsSides.Bottom + WindowInsetsSides.Horizontal)
    )
}

/**
 * Adiciona padding para todas as barras do sistema (status + navigation + cutout)
 */
@Composable
fun Modifier.systemBarsPadding(): Modifier {
    return this.padding(safeSystemBarsInsets().asPaddingValues())
}

/**
 * Adiciona padding para a barra de status e recortes no topo/laterais
 */
@Composable
fun Modifier.statusBarsPadding(): Modifier {
    return this.padding(safeStatusBarsInsets().asPaddingValues())
}

/**
 * Adiciona padding para a barra de navegação e recortes laterais/bottom
 */
@Composable
fun Modifier.navigationBarsPadding(): Modifier {
    return this.padding(safeNavigationBarsInsets().asPaddingValues())
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
        safeSystemBarsInsets()
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
        safeSystemBarsInsets()
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
        safeSystemBarsInsets()
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
        safeSystemBarsInsets()
            .only(WindowInsetsSides.Bottom)
            .asPaddingValues()
    )
}

/**
 * Adiciona padding para barras do sistema/cutout + teclado
 * Combina os insets por lado para evitar somar navegação e IME no bottom
 */
@Composable
fun Modifier.systemBarsAndImePadding(): Modifier {
    return this.padding(safeSystemBarsInsets().union(WindowInsets.ime).asPaddingValues())
}
