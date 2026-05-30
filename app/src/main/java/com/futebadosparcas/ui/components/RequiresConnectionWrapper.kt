package com.futebadosparcas.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.semantics
import com.futebadosparcas.R

/**
 * RequiresConnectionWrapper — wrapper para ações que requerem conexão.
 *
 * Quando [isConnected] = false:
 * - Desabilita visualmente o conteúdo (opacidade reduzida).
 * - Bloqueia toques (consume todos os eventos de ponteiro).
 * - Anuncia "Requer conexão com internet" via semantics para leitores de tela.
 *
 * Quando [isConnected] = true, renderiza o [content] sem alteração.
 *
 * Uso:
 * ```kotlin
 * val isConnected by connectivityMonitor.isConnected.collectAsStateWithLifecycle(true)
 *
 * RequiresConnectionWrapper(isConnected = isConnected) {
 *     Button(onClick = { criarJogo() }) { Text("Criar Jogo") }
 * }
 * ```
 *
 * TODO (follow-up #2222): adotar em botões de criação de jogo, confirmação de
 * presença, votação MVP e cashbox — qualquer ação que dispara write no Firestore.
 *
 * @param isConnected Status atual de conectividade. Obtenha via
 *   [com.futebadosparcas.util.ConnectivityMonitor.isConnected] coletado com
 *   `collectAsStateWithLifecycle(initialValue = true)`.
 * @param modifier Modifier aplicado ao container externo.
 * @param disabledDescription Texto de acessibilidade anunciado quando offline.
 *   Por padrão usa [R.string.ui_requires_connection].
 * @param content Conteúdo que requer conexão (botão, ação, etc.).
 */
@Composable
fun RequiresConnectionWrapper(
    isConnected: Boolean,
    modifier: Modifier = Modifier,
    disabledDescription: String? = null,
    content: @Composable () -> Unit
) {
    // Quando online, renderiza diretamente sem overhead extra.
    if (isConnected) {
        Box(modifier = modifier) { content() }
        return
    }

    val description = disabledDescription ?: stringResource(R.string.ui_requires_connection)

    Box(
        modifier = modifier
            // Desabilita visualmente: opacidade 40% igual ao padrão MUI do web.
            .alpha(0.4f)
            // Bloqueia todos os eventos de toque para o content filho.
            .pointerInput(Unit) {
                awaitPointerEventScope {
                    while (true) {
                        // Consome o evento sem propagar — impede cliques enquanto offline.
                        val event = awaitPointerEvent()
                        event.changes.forEach { it.consume() }
                    }
                }
            }
            // Acessibilidade: anuncia estado desabilitado + motivo.
            .semantics {
                disabled()
                contentDescription = description
            }
    ) {
        content()
    }
}
