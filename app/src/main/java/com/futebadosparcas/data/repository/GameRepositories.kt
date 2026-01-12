package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.GameEvent
import com.futebadosparcas.data.model.GameJoinRequest
import com.futebadosparcas.data.model.LiveGameScore
import com.futebadosparcas.data.model.MVPVote
import com.futebadosparcas.data.model.PlayerPosition
import com.futebadosparcas.data.model.Team
import com.futebadosparcas.data.model.UpcomingGame
import kotlinx.coroutines.flow.Flow

/**
 * Interface para gerenciamento de eventos de jogo.
 * Implementado por GameEventsRepositoryAdapter que delega para o repositorio KMP.
 */
interface GameEventsRepository {
    fun getGameEventsFlow(gameId: String): Flow<Result<List<GameEvent>>>
    fun getLiveScoreFlow(gameId: String): Flow<LiveGameScore?>
    suspend fun sendGameEvent(gameId: String, event: GameEvent): Result<Unit>
    suspend fun deleteGameEvent(gameId: String, eventId: String): Result<Unit>
}

/**
 * Interface para gerenciamento de times em jogo.
 * Implementado por GameTeamRepositoryAdapter que delega para o repositorio KMP.
 */
interface GameTeamRepository {
    suspend fun generateTeams(
        gameId: String,
        numberOfTeams: Int,
        balanceTeams: Boolean
    ): Result<List<Team>>
    suspend fun getGameTeams(gameId: String): Result<List<Team>>
    fun getGameTeamsFlow(gameId: String): Flow<Result<List<Team>>>
    suspend fun clearGameTeams(gameId: String): Result<Unit>
    suspend fun updateTeams(teams: List<Team>): Result<Unit>
}

/**
 * Interface para gerenciamento de experiencia de jogo (votacao MVP).
 * Implementado por GameExperienceRepositoryAdapter que delega para o repositorio KMP.
 */
interface GameExperienceRepository {
    suspend fun submitVote(vote: MVPVote): Result<Unit>
    suspend fun isVotingOpen(gameId: String): Result<Boolean>
    suspend fun hasUserVoted(gameId: String, userId: String): Result<Boolean>
    suspend fun getGameVotes(gameId: String): Result<List<MVPVote>>
    suspend fun concludeVoting(gameId: String): Result<Unit>
    suspend fun checkAllVoted(gameId: String): Result<Boolean>
}

/**
 * Interface para gerenciamento de solicitacoes de participacao em jogos.
 * Implementado por GameRequestRepositoryAdapter que delega para o repositorio KMP.
 */
interface GameRequestRepository {
    suspend fun requestJoinGame(
        gameId: String,
        message: String,
        position: String?
    ): Result<GameJoinRequest>
    suspend fun getPendingRequests(gameId: String): Result<List<GameJoinRequest>>
    fun getPendingRequestsFlow(gameId: String): Flow<List<GameJoinRequest>>
    suspend fun getAllRequests(gameId: String): Result<List<GameJoinRequest>>
    suspend fun approveRequest(requestId: String): Result<Unit>
    suspend fun rejectRequest(requestId: String, reason: String?): Result<Unit>
    suspend fun getUserRequests(): Result<List<GameJoinRequest>>
    fun getUserRequestsFlow(): Flow<List<GameJoinRequest>>
    suspend fun hasActiveCampaignRequest(gameId: String): Result<Boolean>
    suspend fun cancelRequest(requestId: String): Result<Unit>
}

/**
 * Interface para gerenciamento de convocatorias (summons) para jogos.
 * Implementado por GameSummonRepositoryAdapter que delega para o repositorio KMP.
 */
interface GameSummonRepository {
    suspend fun createSummonsForGame(
        gameId: String,
        groupId: String,
        gameDate: String,
        locationName: String
    ): Result<Int>
    suspend fun getMyPendingSummons(): Result<List<com.futebadosparcas.data.model.GameSummon>>
    fun getMyPendingSummonsFlow(): Flow<List<com.futebadosparcas.data.model.GameSummon>>
    suspend fun getGameSummons(gameId: String): Result<List<com.futebadosparcas.data.model.GameSummon>>
    fun getGameSummonsFlow(gameId: String): Flow<List<com.futebadosparcas.data.model.GameSummon>>
    suspend fun acceptSummon(gameId: String, position: PlayerPosition): Result<Unit>
    suspend fun declineSummon(gameId: String): Result<Unit>
    suspend fun getMyUpcomingGames(limit: Int): Result<List<UpcomingGame>>
    fun getMyUpcomingGamesFlow(limit: Int): Flow<List<UpcomingGame>>
    suspend fun cancelPresence(gameId: String): Result<Unit>
    suspend fun isSummonedForGame(gameId: String): Result<Boolean>
    suspend fun getMySummonForGame(gameId: String): Result<com.futebadosparcas.data.model.GameSummon?>
}
