package com.futebadosparcas.util

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.hapticfeedback.HapticFeedback
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback

/**
 * Tipos de feedback háptico para ações no app.
 *
 * Mapeia as interações do usuário para intensidades de vibração apropriadas
 * usando a API nativa do Compose (LocalHapticFeedback).
 */
enum class HapticType {
    /** Feedback leve para pull-to-refresh, scroll, seleção */
    LIGHT,
    /** Feedback médio para confirmação de presença, voto MVP */
    MEDIUM,
    /** Feedback intenso para gol marcado, nível alcançado */
    HEAVY
}

/**
 * Helper Compose para feedback háptico contextual.
 *
 * Encapsula o LocalHapticFeedback do Compose com métodos
 * semânticos para cada tipo de ação no app.
 *
 * Uso:
 * ```kotlin
 * val haptic = rememberHapticFeedback()
 *
 * Button(onClick = {
 *     haptic.performConfirm()  // Feedback médio
 *     confirmPresence()
 * }) { ... }
 * ```
 */
class HapticFeedbackHelper(
    private val hapticFeedback: HapticFeedback
) {
    /**
     * Executa feedback háptico genérico pelo tipo.
     */
    fun perform(type: HapticType) {
        when (type) {
            HapticType.LIGHT -> hapticFeedback.performHapticFeedback(HapticFeedbackType.TextHandleMove)
            HapticType.MEDIUM -> hapticFeedback.performHapticFeedback(HapticFeedbackType.LongPress)
            HapticType.HEAVY -> hapticFeedback.performHapticFeedback(HapticFeedbackType.LongPress)
        }
    }

    // ========== Métodos semânticos para ações específicas ==========

    /**
     * Confirmação de presença no jogo.
     * Feedback médio - satisfatório sem ser intrusivo.
     */
    fun performConfirm() {
        perform(HapticType.MEDIUM)
    }

    /**
     * Gol marcado durante jogo ao vivo.
     * Feedback intenso - celebração.
     */
    fun performGoalScored() {
        perform(HapticType.HEAVY)
    }

    /**
     * Voto MVP registrado.
     * Feedback leve - confirmação discreta.
     */
    fun performMvpVote() {
        perform(HapticType.LIGHT)
    }

    /**
     * Pull-to-refresh ativado.
     * Feedback leve - confirmação tátil de que o refresh foi acionado.
     */
    fun performPullToRefresh() {
        perform(HapticType.LIGHT)
    }

    /**
     * Erro ou ação inválida.
     * Feedback médio duplo para indicar problema.
     */
    fun performError() {
        perform(HapticType.MEDIUM)
    }

    /**
     * Sucesso genérico (salvar, criar, etc).
     * Feedback médio.
     */
    fun performSuccess() {
        perform(HapticType.MEDIUM)
    }

    /**
     * Seleção em lista/grid (selecionar jogador, cor do colete, etc).
     * Feedback leve.
     */
    fun performSelection() {
        perform(HapticType.LIGHT)
    }

    /**
     * Level up ou conquista desbloqueada.
     * Feedback intenso - celebração especial.
     */
    fun performLevelUp() {
        perform(HapticType.HEAVY)
    }
}

/**
 * Cria e memoriza um [HapticFeedbackHelper] que encapsula o [LocalHapticFeedback].
 *
 * Deve ser chamado dentro de um @Composable.
 *
 * Uso:
 * ```kotlin
 * @Composable
 * fun MyScreen() {
 *     val haptic = rememberHapticFeedback()
 *
 *     Button(onClick = {
 *         haptic.performConfirm()
 *         // ... ação
 *     }) { Text("Confirmar") }
 * }
 * ```
 */
@Composable
fun rememberHapticFeedback(): HapticFeedbackHelper {
    val hapticFeedback = LocalHapticFeedback.current
    return remember(hapticFeedback) {
        HapticFeedbackHelper(hapticFeedback)
    }
}
