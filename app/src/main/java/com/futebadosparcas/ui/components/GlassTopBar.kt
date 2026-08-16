package com.futebadosparcas.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.displayCutout
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.futebadosparcas.R
import androidx.compose.ui.res.stringResource
/**
 * TopBar com efeito Glassmorphism (vidro fosco).
 * Cria um efeito visual moderno com transparência e blur.
 */

@Composable
private fun glassTopBarInsets(): WindowInsets {
    return WindowInsets.statusBars.union(WindowInsets.displayCutout)
}

// ==================== Configuration ====================

/**
 * Configuração do efeito glass.
 */
data class GlassConfig(
    val blurRadius: Dp = 20.dp,
    val backgroundColor: Color = Color.White,
    val contentColor: Color = Color.Black,
    val backgroundAlpha: Float = 0.7f,
    val borderAlpha: Float = 0.3f,
    val shadowElevation: Dp = 4.dp,
    val gradientOverlay: Boolean = true,
    val gradientColor: Color = Color.White
)

/**
 * Configuração para tema escuro.
 */
@Deprecated("Usar rememberGlassConfig() que respeita ThemeMode do usuário")
val DarkGlassConfig = GlassConfig(
    backgroundColor = Color.Black,
    contentColor = Color.White,
    backgroundAlpha = 0.6f,
    borderAlpha = 0.2f
)

/**
 * Configuração para tema claro.
 */
@Deprecated("Usar rememberGlassConfig() que respeita ThemeMode do usuário")
val LightGlassConfig = GlassConfig(
    backgroundColor = Color.White,
    contentColor = Color.Black,
    backgroundAlpha = 0.8f,
    borderAlpha = 0.3f
)

/**
 * Retorna a configuração glass adequada ao tema atual.
 * Usa MaterialTheme.colorScheme — respeita ThemeMode.LIGHT/DARK/SYSTEM configurado pelo usuário.
 */
@Composable
fun rememberGlassConfig(): GlassConfig {
    val colorScheme = MaterialTheme.colorScheme
    return remember(colorScheme) {
        val surface = colorScheme.surface
        val isDark = (0.299f * surface.red + 0.587f * surface.green + 0.114f * surface.blue) < 0.5f
        GlassConfig(
            backgroundColor = colorScheme.surface,
            contentColor = colorScheme.onSurface,
            backgroundAlpha = if (isDark) 0.6f else 0.8f,
            borderAlpha = if (isDark) 0.2f else 0.3f,
            gradientColor = colorScheme.primary.copy(alpha = 0.15f)
        )
    }
}

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
    glassConfig: GlassConfig = rememberGlassConfig(),
    scrollOffset: Float = 0f  // 0-1, para ajustar opacidade com scroll
) {
    val adjustedAlpha = (glassConfig.backgroundAlpha + (scrollOffset * 0.2f))
        .coerceIn(0f, 1f)

    Box(
        modifier = modifier
            .fillMaxWidth()
            .windowInsetsPadding(glassTopBarInsets())
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
                                glassConfig.gradientColor.copy(alpha = 0.1f),
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
                    color = glassConfig.contentColor
                        .copy(alpha = glassConfig.borderAlpha * 0.5f)
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
                color = glassConfig.contentColor.copy(alpha = 0.9f),
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
    glassConfig: GlassConfig = rememberGlassConfig(),
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
                    tint = glassConfig.contentColor.copy(alpha = 0.9f)
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
    glassConfig: GlassConfig = rememberGlassConfig(),
    expandedHeight: Dp = 200.dp,
    collapsedHeight: Dp = 64.dp
) {
    val currentHeight = expandedHeight - ((expandedHeight - collapsedHeight) * scrollProgress)

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(currentHeight)
            .windowInsetsPadding(glassTopBarInsets())
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
                color = glassConfig.contentColor
                    .copy(alpha = (1f - scrollProgress) * 0.9f),
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
                color = glassConfig.contentColor
                    .copy(alpha = scrollProgress * 0.9f),
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
    glassConfig: GlassConfig = rememberGlassConfig(),
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
                                glassConfig.gradientColor.copy(alpha = 0.15f),
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
