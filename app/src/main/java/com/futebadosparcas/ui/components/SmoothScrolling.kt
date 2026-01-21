package com.futebadosparcas.ui.components

import androidx.compose.animation.core.AnimationSpec
import androidx.compose.animation.core.spring
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.gestures.FlingBehavior
import androidx.compose.foundation.gestures.ScrollableDefaults
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density

/**
 * Configuração de scroll suave para LazyColumn/LazyRow.
 *
 * Ajustes para scroll "manteiga" (butter-smooth):
 * 1. FlingBehavior com deceleração mais suave
 * 2. Velocidade inicial reduzida para sensação mais controlada
 * 3. Fricção ajustada para scroll mais natural
 *
 * Uso:
 * ```kotlin
 * LazyColumn(
 *     flingBehavior = rememberSmoothFlingBehavior()
 * ) { ... }
 * ```
 */

/**
 * Retorna um FlingBehavior otimizado para scroll suave.
 * Usa o comportamento padrão do Compose que já é otimizado,
 * mas pode ser customizado se necessário.
 */
@Composable
fun rememberSmoothFlingBehavior(): FlingBehavior {
    // O comportamento padrão do Compose já é bastante suave.
    // Se quiser customizar, pode usar um spring animation spec
    return ScrollableDefaults.flingBehavior()
}

/**
 * Constantes para configuração de scroll suave.
 */
object SmoothScrollConfig {
    /**
     * Velocidade de scroll padrão em dp/segundo.
     * Valores menores = scroll mais controlado.
     */
    const val DEFAULT_SCROLL_VELOCITY = 8000f

    /**
     * Fricção para decelerar o scroll.
     * Valores maiores = para mais rápido.
     */
    const val DEFAULT_FRICTION = 0.015f

    /**
     * Multiplicador de velocidade inicial do fling.
     * Valores menores = fling mais suave.
     */
    const val INITIAL_VELOCITY_MULTIPLIER = 0.8f
}

/**
 * Extensão para criar um AnimationSpec spring suave.
 * Útil para animações de scroll customizadas.
 */
fun <T> smoothSpring(
    dampingRatio: Float = 0.85f,
    stiffness: Float = 300f
): AnimationSpec<T> = spring(
    dampingRatio = dampingRatio,
    stiffness = stiffness
)

/**
 * Tips para scroll suave no Compose:
 *
 * 1. SEMPRE use keys estáveis em items:
 *    items(list, key = { it.id }) { ... }
 *
 * 2. Evite recomposições desnecessárias:
 *    - Use remember { } para valores calculados
 *    - Use derivedStateOf { } para estados derivados
 *
 * 3. Evite animações durante scroll:
 *    - Não use animateFloatAsState durante scroll
 *    - Calcule valores estaticamente com remember
 *
 * 4. Imagens:
 *    - Use placeholder enquanto carrega
 *    - Defina tamanho fixo para evitar reflow
 *    - Use Coil com cache configurado
 *
 * 5. Layouts complexos:
 *    - Extraia composables pesados
 *    - Use Modifier.drawWithCache para desenhos complexos
 */
