package com.futebadosparcas.data.repository

import com.futebadosparcas.domain.model.GameEvent
import com.futebadosparcas.domain.model.GameEventType
import com.futebadosparcas.domain.model.LivePlayerStats
import com.futebadosparcas.domain.model.LiveScore
import com.futebadosparcas.domain.repository.LiveGameRepository
import com.futebadosparcas.platform.UuidGenerator
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Implementação Android do LiveGameRepository.
 *
 * Gerencia jogos ao vivo incluindo:
 * - Placar em tempo real
 * - Eventos (gols, assistências, cartões, defesas)
 * - Estatísticas dos jogadores
 * - Controle de permissões (apenas owner ou confirmados)
 */
class LiveGameRepositoryImpl(
    private val dataSource: FirebaseDataSource
) : LiveGameRepository {

    private val requestIdMutex = Mutex()
    private val pendingRequestIds = mutableMapOf<String, String>()

    override suspend fun startLiveGame(
        gameId: String,
        team1Id: String,
        team2Id: String
    ): Result<LiveScore> {
        return dataSource.startLiveGame(gameId, team1Id, team2Id)
    }

    override fun observeLiveScore(gameId: String): Flow<LiveScore?> {
        return dataSource.getLiveScoreFlow(gameId)
            .map { result ->
                result.getOrThrow()
            }
    }

    override suspend fun addGameEvent(
        gameId: String,
        eventType: GameEventType,
        playerId: String,
        playerName: String,
        teamId: String,
        assistedById: String?,
        assistedByName: String?,
        minute: Int
    ): Result<GameEvent> {
        val eventKey = listOf(
            gameId,
            eventType.name,
            playerId,
            teamId,
            assistedById.orEmpty(),
            minute.toString()
        ).joinToString("|")
        val requestId = requestIdMutex.withLock {
            pendingRequestIds.getOrPut(eventKey) { UuidGenerator.generate() }
        }
        val event = GameEvent(
            id = requestId,
            gameId = gameId,
            eventType = eventType.name,
            playerId = playerId,
            playerName = playerName,
            teamId = teamId,
            assistedById = assistedById,
            assistedByName = assistedByName,
            minute = minute,
            createdBy = dataSource.getCurrentAuthUserId() ?: ""
        )
        val result = dataSource.addGameEvent(gameId, event)
        if (result.isSuccess) {
            requestIdMutex.withLock {
                if (pendingRequestIds[eventKey] == requestId) {
                    pendingRequestIds.remove(eventKey)
                }
            }
        }
        return result
    }

    override suspend fun deleteGameEvent(gameId: String, eventId: String): Result<Unit> {
        return dataSource.deleteGameEvent(gameId, eventId)
    }

    override fun observeGameEvents(gameId: String): Flow<List<GameEvent>> {
        return dataSource.getGameEventsFlow(gameId)
            .map { result ->
                result.getOrThrow()
            }
    }

    override fun observeLivePlayerStats(gameId: String): Flow<List<LivePlayerStats>> {
        return dataSource.getLivePlayerStatsFlow(gameId)
            .map { result ->
                result.getOrThrow()
            }
    }

    override suspend fun finishGame(gameId: String): Result<Unit> {
        return dataSource.finishGame(gameId)
    }

    override suspend fun getFinalStats(gameId: String): Result<List<LivePlayerStats>> {
        return dataSource.getLivePlayerStats(gameId)
    }

    override suspend fun clearAll(): Result<Unit> {
        return dataSource.clearAllLiveGameData()
    }
}
