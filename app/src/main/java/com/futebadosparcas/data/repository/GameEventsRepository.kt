package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.GameEvent
import com.futebadosparcas.data.model.LiveGameScore
import kotlinx.coroutines.flow.Flow

/**
 * Repositório responsável por eventos de partida (gols, assistências, etc)
 */
interface GameEventsRepository {
    fun getGameEventsFlow(gameId: String): Flow<Result<List<GameEvent>>>
    fun getLiveScoreFlow(gameId: String): Flow<LiveGameScore?>
    suspend fun sendGameEvent(gameId: String, event: GameEvent): Result<Unit>
    suspend fun deleteGameEvent(gameId: String, eventId: String): Result<Unit>
}
