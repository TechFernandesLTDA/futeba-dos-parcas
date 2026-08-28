package com.futebadosparcas.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Brush
import androidx.compose.material3.MaterialTheme

/**
 * Gradientes sutis para a aplicação.
 * Adiciona profundidade visual sem distrair do conteúdo.
 */

/**
 * Gradiente derivado do colorScheme ativo (#2690).
 */
@Composable
fun surfaceGradient(): Brush = Brush.linearGradient(
    listOf(MaterialTheme.colorScheme.surface, MaterialTheme.colorScheme.surfaceContainer)
)
