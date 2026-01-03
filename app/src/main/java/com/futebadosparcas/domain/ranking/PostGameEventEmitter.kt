package com.futebadosparcas.domain.ranking

import com.futebadosparcas.ui.statistics.PostGameSummary
import com.futebadosparcas.util.AppLogger
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import java.util.concurrent.ConcurrentLinkedQueue
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Emite eventos pos-jogo para que a UI possa mostrar o resumo de XP.
 * Singleton compartilhado entre o repositorio e a UI.
 *
 * Usa replay maior para garantir que eventos nao sejam perdidos
 * quando multiplos jogos terminam em sequencia.
 */
@Singleton
class PostGameEventEmitter @Inject constructor() {

    companion object {
        private const val TAG = "PostGameEventEmitter"
        private const val REPLAY_BUFFER_SIZE = 10
        private const val EXTRA_BUFFER_CAPACITY = 20
    }

    private val _postGameEvents = MutableSharedFlow<PostGameSummary>(
        replay = REPLAY_BUFFER_SIZE, // Aumentado para evitar perda de eventos
        extraBufferCapacity = EXTRA_BUFFER_CAPACITY
    )
    val postGameEvents: SharedFlow<PostGameSummary> = _postGameEvents.asSharedFlow()

    /**
     * Fila de eventos pendentes para processamento garantido.
     * Usada como backup caso o SharedFlow esteja cheio.
     */
    private val pendingEvents = ConcurrentLinkedQueue<PostGameSummary>()

    /**
     * Emite um evento pos-jogo para o usuario atual.
     * Garante que o evento nao sera perdido.
     */
    suspend fun emit(summary: PostGameSummary) {
        val success = _postGameEvents.tryEmit(summary)
        if (!success) {
            // Se o buffer estiver cheio, adiciona a fila pendente
            pendingEvents.offer(summary)
            AppLogger.w(TAG) { "Buffer cheio, evento adicionado a fila pendente: ${summary.gameId}" }

            // Tentar processar eventos pendentes
            processPendingEvents()
        } else {
            AppLogger.d(TAG) { "Evento emitido: ${summary.gameId}, XP: ${summary.xpEarned}" }
        }
    }

    /**
     * Tenta processar eventos pendentes da fila.
     */
    private suspend fun processPendingEvents() {
        while (true) {
            val event = pendingEvents.peek() ?: break
            if (_postGameEvents.tryEmit(event)) {
                pendingEvents.poll() // Remove apenas se emitido com sucesso
                AppLogger.d(TAG) { "Evento pendente processado: ${event.gameId}" }
            } else {
                break // Buffer ainda cheio, tentar depois
            }
        }
    }

    /**
     * Retorna o numero de eventos pendentes na fila.
     */
    fun getPendingCount(): Int = pendingEvents.size

    /**
     * Verifica se ha eventos pendentes.
     */
    fun hasPendingEvents(): Boolean = pendingEvents.isNotEmpty()

    /**
     * Limpa todos os eventos pendentes (usar com cuidado).
     */
    fun clearPending() {
        val count = pendingEvents.size
        pendingEvents.clear()
        if (count > 0) {
            AppLogger.w(TAG) { "Limpos $count eventos pendentes" }
        }
    }

    /**
     * Cria um PostGameSummary a partir do resultado de processamento.
     */
    fun createSummary(
        gameId: String,
        result: PlayerProcessingResult,
        previousXp: Long,
        previousLevel: Int
    ): PostGameSummary {
        return PostGameSummary(
            gameId = gameId,
            xpEarned = result.xpEarned,
            xpBreakdown = result.xpBreakdown,
            previousXp = previousXp,
            newXp = previousXp + result.xpEarned,
            previousLevel = previousLevel,
            newLevel = result.newLevel,
            leveledUp = result.leveledUp,
            newLevelName = com.futebadosparcas.data.model.LevelTable.getLevelName(result.newLevel),
            milestonesUnlocked = result.milestonesUnlocked,
            gameResult = result.gameResult.name
        )
    }

    /**
     * Emite multiplos eventos de uma vez (util para batch processing).
     */
    suspend fun emitAll(summaries: List<PostGameSummary>) {
        summaries.forEach { emit(it) }
    }
}
