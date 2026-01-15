package com.futebadosparcas.domain.repository

import com.futebadosparcas.domain.model.GameEvent
import com.futebadosparcas.domain.model.LiveScore
import kotlinx.coroutines.flow.Flow

/**
 * Repository responsavel por eventos de partida (gols, assistencias, etc).
 * Interface KMP para ser usada em Android e iOS.
 */
interface GameEventsRepository {
    /**
     * Flow de eventos de jogo em tempo real.
     */
    fun getGameEventsFlow(gameId: String): Flow<Result<List<GameEvent>>>

    /**
     * Flow de placar ao vivo.
     */
    fun getLiveScoreFlow(gameId: String): Flow<LiveScore?>

    /**
     * Envia um evento de jogo.
     */
    suspend fun sendGameEvent(gameId: String, event: GameEvent): Result<Unit>

    /**
     * Deleta um evento de jogo.
     */
    suspend fun deleteGameEvent(gameId: String, eventId: String): Result<Unit>
}
