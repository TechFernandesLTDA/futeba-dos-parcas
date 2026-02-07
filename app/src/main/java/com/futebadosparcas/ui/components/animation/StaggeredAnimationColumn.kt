package com.futebadosparcas.ui.components.animation

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.lazy.LazyItemScope
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay

/**
 * Duração padrão da animação de cada item (ms).
 */
private const val ITEM_ANIMATION_DURATION_MS = 300

/**
 * Atraso padrão entre a animação de cada item (ms).
 */
private const val DEFAULT_STAGGER_DELAY_MS = 50L

/**
 * Container que anima itens filhos com efeito staggered (escalonado).
 *
 * Cada item filho aparece com um atraso incremental, criando um efeito
 * de "cascata" visual que melhora a percepção de performance.
 *
 * Uso:
 * ```kotlin
 * StaggeredAnimationColumn(
 *     itemCount = items.size,
 *     modifier = Modifier.fillMaxWidth()
 * ) { index ->
 *     GameCard(game = items[index])
 * }
 * ```
 *
 * @param itemCount Número total de itens a animar
 * @param modifier Modificador para o Column container
 * @param staggerDelayMs Atraso entre cada item (padrão: 50ms)
 * @param animationDurationMs Duração da animação de cada item (padrão: 300ms)
 * @param verticalArrangement Arranjo vertical dos itens
 * @param horizontalAlignment Alinhamento horizontal dos itens
 * @param content Composable para cada item, recebe o índice
 */
@Composable
fun StaggeredAnimationColumn(
    itemCount: Int,
    modifier: Modifier = Modifier,
    staggerDelayMs: Long = DEFAULT_STAGGER_DELAY_MS,
    animationDurationMs: Int = ITEM_ANIMATION_DURATION_MS,
    verticalArrangement: Arrangement.Vertical = Arrangement.spacedBy(0.dp),
    horizontalAlignment: Alignment.Horizontal = Alignment.Start,
    content: @Composable (index: Int) -> Unit
) {
    Column(
        modifier = modifier,
        verticalArrangement = verticalArrangement,
        horizontalAlignment = horizontalAlignment
    ) {
        repeat(itemCount) { index ->
            StaggeredItem(
                index = index,
                staggerDelayMs = staggerDelayMs,
                animationDurationMs = animationDurationMs
            ) {
                content(index)
            }
        }
    }
}

/**
 * Item individual com animação staggered.
 *
 * Inicia invisível e aparece com fade + slide up após o atraso calculado.
 */
@Composable
private fun StaggeredItem(
    index: Int,
    staggerDelayMs: Long,
    animationDurationMs: Int,
    content: @Composable () -> Unit
) {
    var visible by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        delay(index * staggerDelayMs)
        visible = true
    }

    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(
            animationSpec = tween(
                durationMillis = animationDurationMs,
                easing = FastOutSlowInEasing
            )
        ) + slideInVertically(
            initialOffsetY = { fullHeight -> fullHeight / 3 },
            animationSpec = tween(
                durationMillis = animationDurationMs,
                easing = FastOutSlowInEasing
            )
        )
    ) {
        content()
    }
}

/**
 * Extensão para LazyListScope que adiciona animação staggered a itens de LazyColumn.
 *
 * Uso:
 * ```kotlin
 * LazyColumn {
 *     staggeredItems(
 *         items = gamesList,
 *         key = { it.id }
 *     ) { game ->
 *         GameCard(game = game)
 *     }
 * }
 * ```
 *
 * @param items Lista de itens a exibir
 * @param key Chave única para cada item (para performance de recomposição)
 * @param staggerDelayMs Atraso entre cada item
 * @param animationDurationMs Duração da animação de entrada
 * @param content Composable para cada item
 */
fun <T> LazyListScope.staggeredItems(
    items: List<T>,
    key: ((T) -> Any)? = null,
    staggerDelayMs: Long = DEFAULT_STAGGER_DELAY_MS,
    animationDurationMs: Int = ITEM_ANIMATION_DURATION_MS,
    content: @Composable LazyItemScope.(T) -> Unit
) {
    items(
        count = items.size,
        key = if (key != null) { index -> key(items[index]) } else null
    ) { index ->
        var visible by remember { mutableStateOf(false) }

        LaunchedEffect(Unit) {
            delay(index * staggerDelayMs)
            visible = true
        }

        AnimatedVisibility(
            visible = visible,
            enter = fadeIn(
                animationSpec = tween(
                    durationMillis = animationDurationMs,
                    easing = FastOutSlowInEasing
                )
            ) + slideInVertically(
                initialOffsetY = { fullHeight -> fullHeight / 3 },
                animationSpec = tween(
                    durationMillis = animationDurationMs,
                    easing = FastOutSlowInEasing
                )
            )
        ) {
            content(items[index])
        }
    }
}
