package com.futebadosparcas.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R

/**
 * TopBar com efeito Glassmorphism (vidro fosco).
 * Cria um efeito visual moderno com transparência e blur.
 */

// ==================== Configuration ====================

/**
 * Configuração do efeito glass.
 */
data class GlassConfig(
    val blurRadius: Dp = 20.dp,
    val backgroundColor: Color = Color.White,
    val backgroundAlpha: Float = 0.7f,
    val borderAlpha: Float = 0.3f,
    val shadowElevation: Dp = 4.dp,
    val gradientOverlay: Boolean = true
)

/**
 * Configuração para tema escuro.
 */
val DarkGlassConfig = GlassConfig(
    backgroundColor = Color.Black,
    backgroundAlpha = 0.6f,
    borderAlpha = 0.2f
)

/**
 * Configuração para tema claro.
 */
val LightGlassConfig = GlassConfig(
    backgroundColor = Color.White,
    backgroundAlpha = 0.8f,
    borderAlpha = 0.3f
)

// ==================== Main Composable ====================

/**
 * TopBar com efeito glassmorphism.
 */
@Composable
fun GlassTopBar(
    title: String,
    modifier: Modifier = Modifier,
    navigationIcon: @Composable (() -> Unit)? = null,
    actions: @Composable RowScope.() -> Unit = {},
    glassConfig: GlassConfig = LightGlassConfig,
    scrollOffset: Float = 0f  // 0-1, para ajustar opacidade com scroll
) {
    val adjustedAlpha = (glassConfig.backgroundAlpha + (scrollOffset * 0.2f))
        .coerceIn(0f, 1f)

    Box(
        modifier = modifier
            .fillMaxWidth()
            .windowInsetsPadding(WindowInsets.statusBars)
    ) {
        // Camada de background com blur (simulado)
        Box(
            modifier = Modifier
                .matchParentSize()
                .graphicsLayer {
                    alpha = adjustedAlpha
                }
                .background(
                    color = glassConfig.backgroundColor.copy(alpha = adjustedAlpha)
                )
        )

        // Gradiente overlay para efeito de brilho
        if (glassConfig.gradientOverlay) {
            Box(
                modifier = Modifier
                    .matchParentSize()
                    .background(
                        brush = Brush.verticalGradient(
                            colors = listOf(
                                Color.White.copy(alpha = 0.1f),
                                Color.Transparent
                            )
                        )
                    )
            )
        }

        // Borda inferior sutil
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .height(1.dp)
                .background(
                    color = if (glassConfig.backgroundColor == Color.White) {
                        Color.Black.copy(alpha = glassConfig.borderAlpha * 0.5f)
                    } else {
                        Color.White.copy(alpha = glassConfig.borderAlpha * 0.5f)
                    }
                )
        )

        // Conteúdo da TopBar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(64.dp)
                .padding(horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Navigation icon
            if (navigationIcon != null) {
                navigationIcon()
            }

            // Título
            Text(
                text = title,
                style = MaterialTheme.typography.titleLarge,
                color = if (glassConfig.backgroundColor == Color.White) {
                    Color.Black.copy(alpha = 0.9f)
                } else {
                    Color.White.copy(alpha = 0.9f)
                },
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 16.dp)
            )

            // Actions
            Row(
                horizontalArrangement = Arrangement.End,
                content = actions
            )
        }
    }
}

/**
 * GlassTopBar com botão de voltar padrão.
 */
@Composable
fun GlassTopBarWithBack(
    title: String,
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier,
    actions: @Composable RowScope.() -> Unit = {},
    glassConfig: GlassConfig = LightGlassConfig,
    scrollOffset: Float = 0f
) {
    GlassTopBar(
        title = title,
        modifier = modifier,
        navigationIcon = {
            IconButton(onClick = onNavigateBack) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(R.string.back),
                    tint = if (glassConfig.backgroundColor == Color.White) {
                        Color.Black.copy(alpha = 0.9f)
                    } else {
                        Color.White.copy(alpha = 0.9f)
                    }
                )
            }
        },
        actions = actions,
        glassConfig = glassConfig,
        scrollOffset = scrollOffset
    )
}

// ==================== Collapsing Glass TopBar ====================

/**
 * GlassTopBar que colapsa com scroll.
 */
@Composable
fun CollapsingGlassTopBar(
    title: String,
    scrollProgress: Float,  // 0 = expandido, 1 = colapsado
    modifier: Modifier = Modifier,
    expandedTitle: String = title,
    navigationIcon: @Composable (() -> Unit)? = null,
    actions: @Composable RowScope.() -> Unit = {},
    glassConfig: GlassConfig = LightGlassConfig,
    expandedHeight: Dp = 200.dp,
    collapsedHeight: Dp = 64.dp
) {
    val currentHeight = expandedHeight - ((expandedHeight - collapsedHeight) * scrollProgress)

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(currentHeight)
            .windowInsetsPadding(WindowInsets.statusBars)
    ) {
        // Background glass
        Box(
            modifier = Modifier
                .matchParentSize()
                .graphicsLayer {
                    alpha = glassConfig.backgroundAlpha + (scrollProgress * 0.2f)
                }
                .background(glassConfig.backgroundColor)
        )

        // Título expandido (fade out com scroll)
        if (scrollProgress < 0.8f) {
            Text(
                text = expandedTitle,
                style = MaterialTheme.typography.headlineLarge,
                color = if (glassConfig.backgroundColor == Color.White) {
                    Color.Black.copy(alpha = (1f - scrollProgress) * 0.9f)
                } else {
                    Color.White.copy(alpha = (1f - scrollProgress) * 0.9f)
                },
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(16.dp)
                    .padding(bottom = 8.dp)
            )
        }

        // TopBar colapsada
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(collapsedHeight)
                .align(Alignment.TopCenter)
                .padding(horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            navigationIcon?.invoke()

            // Título colapsado (fade in com scroll)
            Text(
                text = title,
                style = MaterialTheme.typography.titleLarge,
                color = if (glassConfig.backgroundColor == Color.White) {
                    Color.Black.copy(alpha = scrollProgress * 0.9f)
                } else {
                    Color.White.copy(alpha = scrollProgress * 0.9f)
                },
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 16.dp)
            )

            Row(
                horizontalArrangement = Arrangement.End,
                content = actions
            )
        }
    }
}

// ==================== Glass Card ====================

/**
 * Card com efeito glass.
 */
@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    glassConfig: GlassConfig = LightGlassConfig,
    content: @Composable () -> Unit
) {
    Box(
        modifier = modifier
            .graphicsLayer {
                alpha = glassConfig.backgroundAlpha
                shadowElevation = glassConfig.shadowElevation.toPx()
            }
            .background(
                color = glassConfig.backgroundColor.copy(alpha = glassConfig.backgroundAlpha),
                shape = MaterialTheme.shapes.medium
            )
    ) {
        // Gradiente de brilho
        if (glassConfig.gradientOverlay) {
            Box(
                modifier = Modifier
                    .matchParentSize()
                    .background(
                        brush = Brush.verticalGradient(
                            colors = listOf(
                                Color.White.copy(alpha = 0.15f),
                                Color.Transparent
                            )
                        ),
                        shape = MaterialTheme.shapes.medium
                    )
            )
        }

        content()
    }
}
