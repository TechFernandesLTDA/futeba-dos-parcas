package com.futebadosparcas.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.futebadosparcas.ui.theme.rememberReduceMotion

/**
 * Componente genérico de shimmer para listas
 * Permite criar efeitos de loading personalizados
 */
@Composable
fun ShimmerListContent(
    modifier: Modifier = Modifier,
    count: Int = 5,
    contentPadding: PaddingValues = PaddingValues(16.dp),
    verticalArrangement: Arrangement.Vertical = Arrangement.spacedBy(12.dp),
    shimmerContent: @Composable (Brush) -> Unit
) {
    val shimmerColors = listOf(
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f)
    )

    // Reduced-motion: usa placeholder estático em vez do gradiente animado (#2735).
    // rememberInfiniteTransition é sempre chamado (regra dos composables); quando
    // reduced=true, initialValue==targetValue => valor fixo, sem animação visível.
    val reducedMotion = rememberReduceMotion()
    val staticColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.7f)

    val transition = rememberInfiniteTransition(label = "shimmer")
    val translateAnim by transition.animateFloat(
        initialValue = if (reducedMotion) 500f else 0f,
        targetValue = if (reducedMotion) 500f else 1000f,
        animationSpec = infiniteRepeatable(
            animation = tween(
                durationMillis = if (reducedMotion) 1 else 1200,
                easing = LinearEasing
            ),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmer_translate"
    )

    val brush = if (reducedMotion) {
        Brush.linearGradient(colors = listOf(staticColor, staticColor))
    } else {
        Brush.linearGradient(
            colors = shimmerColors,
            start = Offset(translateAnim - 1000f, translateAnim - 1000f),
            end = Offset(translateAnim, translateAnim)
        )
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = contentPadding,
        verticalArrangement = verticalArrangement
    ) {
        items(count, key = { "shimmer_$it" }) {
            shimmerContent(brush)
        }
    }
}

/**
 * Extension function para adicionar shimmer items a uma LazyListScope existente
 */
fun LazyListScope.shimmerItems(
    count: Int,
    shimmerContent: @Composable (Brush) -> Unit
) {
    items(count, key = { "shimmer_ext_$it" }) {
        // Nota: Brush deve ser criado dentro do composable com animação
        ShimmerBox {
            shimmerContent(it)
        }
    }
}

/**
 * Componente auxiliar que fornece o brush animado.
 * Quando reduced-motion está ativo, fornece brush estático (#2735).
 */
@Composable
private fun ShimmerBox(
    content: @Composable (Brush) -> Unit
) {
    val shimmerColors = listOf(
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f)
    )

    // Reduced-motion: usa placeholder estático em vez do gradiente animado (#2735).
    // rememberInfiniteTransition sempre chamado; initialValue==targetValue trava animação.
    val reducedMotion = rememberReduceMotion()
    val staticColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.7f)

    val transition = rememberInfiniteTransition(label = "shimmer")
    val translateAnim by transition.animateFloat(
        initialValue = if (reducedMotion) 500f else 0f,
        targetValue = if (reducedMotion) 500f else 1000f,
        animationSpec = infiniteRepeatable(
            animation = tween(
                durationMillis = if (reducedMotion) 1 else 1200,
                easing = LinearEasing
            ),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmer_translate"
    )

    val brush = if (reducedMotion) {
        Brush.linearGradient(colors = listOf(staticColor, staticColor))
    } else {
        Brush.linearGradient(
            colors = shimmerColors,
            start = Offset(translateAnim - 1000f, translateAnim - 1000f),
            end = Offset(translateAnim, translateAnim)
        )
    }

    content(brush)
}

/**
 * Componente básico de shimmer box para uso genérico.
 * Quando reduced-motion está ativo, renderiza placeholder sólido sem animação (#2735).
 */
@Composable
fun ShimmerBox(
    modifier: Modifier = Modifier,
    cornerRadius: Dp = 4.dp
) {
    val shimmerColors = listOf(
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f)
    )

    // Reduced-motion: usa placeholder estático em vez do gradiente animado (#2735).
    // rememberInfiniteTransition sempre chamado; initialValue==targetValue trava animação.
    val reducedMotion = rememberReduceMotion()
    val staticColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.7f)

    val transition = rememberInfiniteTransition(label = "shimmer")
    val translateAnim by transition.animateFloat(
        initialValue = if (reducedMotion) 500f else 0f,
        targetValue = if (reducedMotion) 500f else 1000f,
        animationSpec = infiniteRepeatable(
            animation = tween(
                durationMillis = if (reducedMotion) 1 else 1200,
                easing = LinearEasing
            ),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmer_translate"
    )

    val brush = if (reducedMotion) {
        Brush.linearGradient(colors = listOf(staticColor, staticColor))
    } else {
        Brush.linearGradient(
            colors = shimmerColors,
            start = Offset(translateAnim - 1000f, translateAnim - 1000f),
            end = Offset(translateAnim, translateAnim)
        )
    }

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(cornerRadius))
            .background(brush)
    )
}

/**
 * Variante de shimmer para itens de lista simples (texto)
 */
@Composable
fun ShimmerTextItem(
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        ShimmerBox(
            modifier = Modifier
                .fillMaxWidth(0.7f)
                .height(20.dp)
        )
        ShimmerBox(
            modifier = Modifier
                .fillMaxWidth(0.5f)
                .height(16.dp)
        )
    }
}
