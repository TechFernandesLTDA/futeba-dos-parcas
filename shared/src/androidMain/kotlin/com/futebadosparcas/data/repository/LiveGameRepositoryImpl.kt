package com.futebadosparcas.data.repository

import com.futebadosparcas.domain.model.GameEvent
import com.futebadosparcas.domain.model.GameEventType
import com.futebadosparcas.domain.model.LivePlayerStats
import com.futebadosparcas.domain.model.LiveScore
import com.futebadosparcas.domain.repository.LiveGameRepository
import com.futebadosparcas.platform.firebase.FirebaseDataSource
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map

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
                result.getOrNull()
            }
            .catch { e ->
                emit(null)
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
        // Verificar permissão primeiro
        val canManage = dataSource.canManageGameEvents(gameId)
        if (!canManage) {
            return Result.failure(Exception("Você não tem permissão para adicionar eventos neste jogo"))
        }

        // Criar evento
        val event = GameEvent(
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

        // Salvar evento
        val savedEventResult = dataSource.addGameEvent(gameId, event)
        if (savedEventResult.isFailure) {
            return savedEventResult
        }

        // Se for gol, atualizar placar
        if (eventType == GameEventType.GOAL) {
            val updateResult = dataSource.updateScoreForGoal(gameId, teamId)
            if (updateResult.isFailure) {
                return Result.failure(updateResult.exceptionOrNull() ?: Exception("Erro ao atualizar placar"))
            }
        }

        // Atualizar estatísticas do jogador
        val statsResult = dataSource.updatePlayerStats(
            gameId = gameId,
            playerId = playerId,
            teamId = teamId,
            eventType = eventType,
            assistedById = assistedById
        )

        if (statsResult.isFailure) {
            return Result.failure(statsResult.exceptionOrNull() ?: Exception("Erro ao atualizar estatísticas"))
        }

        return savedEventResult
    }

    override suspend fun deleteGameEvent(gameId: String, eventId: String): Result<Unit> {
        return dataSource.deleteGameEvent(gameId, eventId)
    }

    override fun observeGameEvents(gameId: String): Flow<List<GameEvent>> {
        return dataSource.getGameEventsFlow(gameId)
            .map { result ->
                result.getOrNull() ?: emptyList()
            }
            .catch { e ->
                emit(emptyList())
            }
    }

    override fun observeLivePlayerStats(gameId: String): Flow<List<LivePlayerStats>> {
        return dataSource.getLivePlayerStatsFlow(gameId)
            .map { result ->
                result.getOrNull() ?: emptyList()
            }
            .catch { e ->
                emit(emptyList())
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
