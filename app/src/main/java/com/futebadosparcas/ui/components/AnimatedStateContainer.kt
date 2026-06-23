package com.futebadosparcas.ui.components

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.ContentTransform
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.IntOffset
import com.futebadosparcas.ui.theme.MotionDuration
import com.futebadosparcas.ui.theme.MotionEasing
import com.futebadosparcas.ui.theme.rememberReduceMotion

/**
 * Tipo de estado da UI para determinar a direção da animação.
 *
 * Utilizado pelo [AnimatedStateContainer] para aplicar transições
 * contextuais entre Loading, Success e Error.
 */
enum class StateType {
    /** Estado de carregamento (shimmer/skeleton) */
    LOADING,
    /** Estado de sucesso com dados carregados */
    SUCCESS,
    /** Estado de erro com mensagem/retry */
    ERROR,
    /** Estado vazio sem dados */
    EMPTY
}

/**
 * Container que aplica AnimatedContent com transições contextuais
 * baseadas no tipo de estado da UI.
 *
 * Transições:
 * - Loading -> Success: fade in + slide up (dados chegaram)
 * - Success -> Error: fade in + slide down (problema detectado)
 * - Loading -> Error: fade in + slide down
 * - Error -> Loading: fade in + slide up (retry iniciado)
 * - Qualquer -> Empty: fade in + slide up
 *
 * Uso:
 * ```kotlin
 * val stateType = when (uiState) {
 *     is UiState.Loading -> StateType.LOADING
 *     is UiState.Success -> StateType.SUCCESS
 *     is UiState.Error -> StateType.ERROR
 *     is UiState.Empty -> StateType.EMPTY
 * }
 *
 * AnimatedStateContainer(
 *     targetState = stateType,
 *     modifier = Modifier.fillMaxSize()
 * ) { currentState ->
 *     when (currentState) {
 *         StateType.LOADING -> LoadingState()
 *         StateType.SUCCESS -> SuccessContent(data)
 *         StateType.ERROR -> ErrorState(message)
 *         StateType.EMPTY -> EmptyState()
 *     }
 * }
 * ```
 *
 * @param targetState O tipo de estado atual da UI
 * @param modifier Modifier para o container
 * @param label Label para a animação (para debugging)
 * @param content Composable que recebe o estado atual para renderizar
 */
@Composable
fun AnimatedStateContainer(
    targetState: StateType,
    modifier: Modifier = Modifier,
    label: String = "stateTransition",
    content: @Composable (StateType) -> Unit
) {
    val reducedMotion = rememberReduceMotion()

    AnimatedContent(
        targetState = targetState,
        modifier = modifier,
        transitionSpec = { createStateTransition(initialState, targetState, reducedMotion) },
        label = label
    ) { currentState ->
        content(currentState)
    }
}

/**
 * Overload genérico que aceita qualquer estado tipado.
 *
 * Usa [stateMapper] para mapear o estado customizado para [StateType]
 * e determinar a transição de animação adequada.
 *
 * Uso:
 * ```kotlin
 * AnimatedStateContainer(
 *     targetState = uiState,
 *     stateMapper = { state ->
 *         when (state) {
 *             is HomeUiState.Loading -> StateType.LOADING
 *             is HomeUiState.Success -> StateType.SUCCESS
 *             is HomeUiState.Error -> StateType.ERROR
 *         }
 *     }
 * ) { currentState ->
 *     when (currentState) {
 *         is HomeUiState.Loading -> LoadingState()
 *         is HomeUiState.Success -> HomeContent(currentState.data)
 *         is HomeUiState.Error -> ErrorState(currentState.message)
 *     }
 * }
 * ```
 */
@Composable
fun <T> AnimatedStateContainer(
    targetState: T,
    stateMapper: (T) -> StateType,
    modifier: Modifier = Modifier,
    label: String = "stateTransition",
    content: @Composable (T) -> Unit
) {
    val reducedMotion = rememberReduceMotion()

    AnimatedContent(
        targetState = targetState,
        modifier = modifier,
        transitionSpec = {
            val fromType = stateMapper(initialState)
            val toType = stateMapper(targetState)
            createStateTransition(fromType, toType, reducedMotion)
        },
        label = label
    ) { currentState ->
        content(currentState)
    }
}

/**
 * Cria a transição de animação baseada nos estados de origem e destino.
 *
 * - Para estados "positivos" (Loading->Success, Error->Success): slide up + fade
 * - Para estados "negativos" (Success->Error, Loading->Error): slide down + fade
 * - Para estados neutros ou iguais: apenas fade
 */
private fun createStateTransition(
    fromState: StateType,
    toState: StateType,
    reducedMotion: Boolean
): ContentTransform {
    val enterDuration = MotionDuration.getMedium(reducedMotion)
    val exitDuration = MotionDuration.getShort(reducedMotion)
    val enterSpec = tween<IntOffset>(durationMillis = enterDuration, easing = MotionEasing.Decelerate)
    val exitSpec = tween<IntOffset>(durationMillis = exitDuration, easing = MotionEasing.Accelerate)
    val enterFadeSpec = tween<Float>(durationMillis = enterDuration, easing = MotionEasing.Standard)
    val exitFadeSpec = tween<Float>(durationMillis = exitDuration, easing = MotionEasing.Standard)

    val slideUp = slideInVertically(
        initialOffsetY = { fullHeight -> fullHeight / 4 },
        animationSpec = enterSpec
    ) + fadeIn(
        animationSpec = enterFadeSpec
    )

    val slideDown = slideInVertically(
        initialOffsetY = { fullHeight -> -fullHeight / 4 },
        animationSpec = enterSpec
    ) + fadeIn(
        animationSpec = enterFadeSpec
    )

    val exitFade = fadeOut(
        animationSpec = exitFadeSpec
    )

    val exitSlideUp = slideOutVertically(
        targetOffsetY = { fullHeight -> -fullHeight / 4 },
        animationSpec = exitSpec
    ) + exitFade

    val exitSlideDown = slideOutVertically(
        targetOffsetY = { fullHeight -> fullHeight / 4 },
        animationSpec = exitSpec
    ) + exitFade

    return when {
        // Transições "positivas": slide up (dados chegaram, retry resolveu)
        fromState == StateType.LOADING && toState == StateType.SUCCESS -> slideUp togetherWith exitFade
        fromState == StateType.ERROR && toState == StateType.SUCCESS -> slideUp togetherWith exitFade
        fromState == StateType.LOADING && toState == StateType.EMPTY -> slideUp togetherWith exitFade
        fromState == StateType.ERROR && toState == StateType.LOADING -> slideUp togetherWith exitFade

        // Transições "negativas": slide down (erro encontrado)
        fromState == StateType.SUCCESS && toState == StateType.ERROR -> slideDown togetherWith exitSlideUp
        fromState == StateType.LOADING && toState == StateType.ERROR -> slideDown togetherWith exitSlideUp

        // Transições neutras: apenas fade
        else -> fadeIn(
            animationSpec = enterFadeSpec
        ) togetherWith fadeOut(
            animationSpec = exitFadeSpec
        )
    }
}
