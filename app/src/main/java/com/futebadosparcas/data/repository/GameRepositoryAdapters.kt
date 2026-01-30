package com.futebadosparcas.data.repository

import com.futebadosparcas.data.model.GameEvent
import com.futebadosparcas.data.model.GameJoinRequest
import com.futebadosparcas.data.model.LiveGameScore
import com.futebadosparcas.data.model.MVPVote
import com.futebadosparcas.data.model.PlayerPosition
import com.futebadosparcas.data.model.Team
import com.futebadosparcas.data.model.UpcomingGame
import com.futebadosparcas.domain.model.GameConfirmation
import com.futebadosparcas.domain.model.GameEvent as KmpGameEvent
import com.futebadosparcas.domain.model.GameJoinRequest as KmpGameJoinRequest
import com.futebadosparcas.domain.model.GameSummon as KmpGameSummon
import com.futebadosparcas.domain.model.LiveScore as KmpLiveScore
import com.futebadosparcas.domain.model.MVPVote as KmpMVPVote
import com.futebadosparcas.domain.model.PlayerPosition as KmpPlayerPosition
import com.futebadosparcas.domain.model.Team as KmpTeam
import com.futebadosparcas.domain.model.UpcomingGame as KmpUpcomingGame
import com.futebadosparcas.domain.model.VoteCategory as KmpVoteCategory
import com.futebadosparcas.domain.repository.GameEventsRepository as KmpGameEventsRepository
import com.futebadosparcas.domain.repository.GameExperienceRepository as KmpGameExperienceRepository
import com.futebadosparcas.domain.repository.GameRequestRepository as KmpGameRequestRepository
import com.futebadosparcas.domain.repository.GameSummonRepository as KmpGameSummonRepository
import com.futebadosparcas.domain.repository.GameTeamRepository as KmpGameTeamRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * Adapter que converte entre modelos Android e modelos KMP para GameRequestRepository.
 */
class GameRequestRepositoryAdapter(
    private val kmpRepository: KmpGameRequestRepository
) : GameRequestRepository {

    override suspend fun requestJoinGame(
        gameId: String,
        message: String,
        position: String?
    ): Result<GameJoinRequest> {
        return kmpRepository.requestJoinGame(gameId, message, position)
            .map { it.toAndroidModel() }
    }

    override suspend fun getPendingRequests(gameId: String): Result<List<GameJoinRequest>> {
        return kmpRepository.getPendingRequests(gameId)
            .map { list -> list.map { it.toAndroidModel() } }
    }

    override fun getPendingRequestsFlow(gameId: String): Flow<List<GameJoinRequest>> {
        return kmpRepository.getPendingRequestsFlow(gameId)
            .map { list -> list.map { it.toAndroidModel() } }
    }

    override suspend fun getAllRequests(gameId: String): Result<List<GameJoinRequest>> {
        return kmpRepository.getAllRequests(gameId)
            .map { list -> list.map { it.toAndroidModel() } }
    }

    override suspend fun approveRequest(requestId: String): Result<Unit> {
        return kmpRepository.approveRequest(requestId)
    }

    override suspend fun rejectRequest(requestId: String, reason: String?): Result<Unit> {
        return kmpRepository.rejectRequest(requestId, reason)
    }

    override suspend fun getUserRequests(): Result<List<GameJoinRequest>> {
        return kmpRepository.getUserRequests()
            .map { list -> list.map { it.toAndroidModel() } }
    }

    override fun getUserRequestsFlow(): Flow<List<GameJoinRequest>> {
        return kmpRepository.getUserRequestsFlow()
            .map { list -> list.map { it.toAndroidModel() } }
    }

    override suspend fun hasActiveCampaignRequest(gameId: String): Result<Boolean> {
        return kmpRepository.hasActiveRequest(gameId)
    }

    override suspend fun cancelRequest(requestId: String): Result<Unit> {
        return kmpRepository.cancelRequest(requestId)
    }
}

/**
 * Adapter que converte entre modelos Android e modelos KMP para GameSummonRepository.
 */
class GameSummonRepositoryAdapter(
    private val kmpRepository: KmpGameSummonRepository
) : GameSummonRepository {

    override suspend fun createSummonsForGame(
        gameId: String,
        groupId: String,
        gameDate: String,
        locationName: String
    ): Result<Int> {
        return kmpRepository.createSummonsForGame(gameId, groupId, gameDate, locationName)
    }

    override suspend fun getMyPendingSummons(): Result<List<com.futebadosparcas.data.model.GameSummon>> {
        return kmpRepository.getMyPendingSummons()
            .map { list -> list.map { it.toAndroidModel() } }
    }

    override fun getMyPendingSummonsFlow(): kotlinx.coroutines.flow.Flow<List<com.futebadosparcas.data.model.GameSummon>> {
        return kmpRepository.getMyPendingSummonsFlow()
            .map { list -> list.map { it.toAndroidModel() } }
    }

    override suspend fun getGameSummons(gameId: String): Result<List<com.futebadosparcas.data.model.GameSummon>> {
        return kmpRepository.getGameSummons(gameId)
            .map { list -> list.map { it.toAndroidModel() } }
    }

    override fun getGameSummonsFlow(gameId: String): kotlinx.coroutines.flow.Flow<List<com.futebadosparcas.data.model.GameSummon>> {
        return kmpRepository.getGameSummonsFlow(gameId)
            .map { list -> list.map { it.toAndroidModel() } }
    }

    override suspend fun acceptSummon(gameId: String, position: PlayerPosition): Result<kotlin.Unit> {
        return kmpRepository.acceptSummon(gameId, position.toKmpModel())
    }

    override suspend fun declineSummon(gameId: String): Result<kotlin.Unit> {
        return kmpRepository.declineSummon(gameId)
    }

    override suspend fun getMyUpcomingGames(limit: Int): Result<List<UpcomingGame>> {
        return kmpRepository.getMyUpcomingGames(limit)
            .map { list -> list.map { it.toAndroidModel() } }
    }

    override fun getMyUpcomingGamesFlow(limit: Int): kotlinx.coroutines.flow.Flow<List<UpcomingGame>> {
        return kmpRepository.getMyUpcomingGamesFlow(limit)
            .map { list -> list.map { it.toAndroidModel() } }
    }

    override suspend fun cancelPresence(gameId: String): Result<kotlin.Unit> {
        return kmpRepository.cancelPresence(gameId)
    }

    override suspend fun isSummonedForGame(gameId: String): Result<Boolean> {
        return kmpRepository.isSummonedForGame(gameId)
    }

    override suspend fun getMySummonForGame(gameId: String): Result<com.futebadosparcas.data.model.GameSummon?> {
        return kmpRepository.getMySummonForGame(gameId)
            .map { it?.toAndroidModel() }
    }
}

/**
 * Adapter que converte entre modelos Android e modelos KMP para GameExperienceRepository.
 */
class GameExperienceRepositoryAdapter(
    private val kmpRepository: KmpGameExperienceRepository
) : GameExperienceRepository {

    override suspend fun submitVote(vote: MVPVote): Result<kotlin.Unit> {
        return kmpRepository.submitVote(vote.toKmpModel())
    }

    override suspend fun isVotingOpen(gameId: String): Result<Boolean> {
        return kmpRepository.isVotingOpen(gameId)
    }

    override suspend fun hasUserVoted(gameId: String, userId: String): Result<Boolean> {
        return kmpRepository.hasUserVoted(gameId, userId)
    }

    override suspend fun getGameVotes(gameId: String): Result<List<MVPVote>> {
        return kmpRepository.getGameVotes(gameId)
            .map { list -> list.map { it.toAndroidModel() } }
    }

    override suspend fun concludeVoting(gameId: String): Result<kotlin.Unit> {
        return kmpRepository.concludeVoting(gameId)
    }

    override suspend fun checkAllVoted(gameId: String): Result<Boolean> {
        return kmpRepository.checkAllVoted(gameId)
    }
}

/**
 * Adapter que converte entre modelos Android e modelos KMP para GameEventsRepository.
 */
class GameEventsRepositoryAdapter(
    private val kmpRepository: KmpGameEventsRepository
) : GameEventsRepository {

    override fun getGameEventsFlow(gameId: String): Flow<Result<List<GameEvent>>> {
        return kmpRepository.getGameEventsFlow(gameId)
            .map { result -> result.map { list -> list.map { it.toAndroidModel() } } }
    }

    override fun getLiveScoreFlow(gameId: String): Flow<LiveGameScore?> {
        return kmpRepository.getLiveScoreFlow(gameId)
            .map { it?.toAndroidModel() }
    }

    override suspend fun sendGameEvent(gameId: String, event: GameEvent): Result<kotlin.Unit> {
        return kmpRepository.sendGameEvent(gameId, event.toKmpModel())
    }

    override suspend fun deleteGameEvent(gameId: String, eventId: String): Result<kotlin.Unit> {
        return kmpRepository.deleteGameEvent(gameId, eventId)
    }
}

/**
 * Adapter que converte entre modelos Android e modelos KMP para GameTeamRepository.
 */
class GameTeamRepositoryAdapter(
    private val kmpRepository: KmpGameTeamRepository
) : GameTeamRepository {

    override suspend fun generateTeams(
        gameId: String,
        numberOfTeams: Int,
        balanceTeams: Boolean
    ): Result<List<Team>> {
        return kmpRepository.generateTeams(gameId, numberOfTeams, balanceTeams)
            .map { list -> list.map { it.toAndroidModel() } }
    }

    override suspend fun getGameTeams(gameId: String): Result<List<Team>> {
        return kmpRepository.getGameTeams(gameId)
            .map { list -> list.map { it.toAndroidModel() } }
    }

    override fun getGameTeamsFlow(gameId: String): Flow<Result<List<Team>>> {
        return kmpRepository.getGameTeamsFlow(gameId)
            .map { result -> result.map { list -> list.map { it.toAndroidModel() } } }
    }

    override suspend fun clearGameTeams(gameId: String): Result<kotlin.Unit> {
        return kmpRepository.clearGameTeams(gameId)
    }

    override suspend fun updateTeams(teams: List<Team>): Result<kotlin.Unit> {
        return kmpRepository.updateTeams(teams.map { it.toKmpModel() })
    }
}

// ========== Funcoes de conversao entre modelos Android e KMP ==========

// GameJoinRequest
private fun KmpGameJoinRequest.toAndroidModel(): GameJoinRequest {
    return GameJoinRequest(
        id = id,
        gameId = gameId,
        userId = userId,
        userName = userName,
        userPhoto = userPhoto,
        userLevel = userLevel,
        userPosition = userPosition,
        message = message,
        status = status,
        requestedAt = requestedAt?.let { java.util.Date(it) },
        reviewedAt = reviewedAt?.let { java.util.Date(it) },
        reviewedBy = reviewedBy,
        rejectionReason = rejectionReason
    )
}

// GameSummon
private fun KmpGameSummon.toAndroidModel(): com.futebadosparcas.data.model.GameSummon {
    return com.futebadosparcas.data.model.GameSummon(
        id = id,
        gameId = gameId,
        groupId = groupId,
        userId = userId,
        userName = userName,
        userPhoto = userPhoto,
        status = status,
        position = position,
        summonedBy = summonedBy,
        summonedByName = summonedByName,
        summonedAt = summonedAt?.let { java.util.Date(it) },
        respondedAt = respondedAt?.let { java.util.Date(it) }
    )
}

// UpcomingGame
private fun KmpUpcomingGame.toAndroidModel(): UpcomingGame {
    return UpcomingGame(
        id = id,
        gameId = gameId,
        groupId = groupId,
        groupName = groupName,
        dateTime = java.util.Date(dateTime),
        locationName = locationName,
        locationAddress = locationAddress,
        fieldName = fieldName,
        status = status,
        myPosition = myPosition,
        confirmedCount = confirmedCount,
        maxPlayers = maxPlayers
    )
}

// MVPVote
private fun MVPVote.toKmpModel(): KmpMVPVote {
    return KmpMVPVote(
        id = id,
        gameId = gameId,
        voterId = voterId,
        votedPlayerId = votedPlayerId,
        category = when (category) {
            com.futebadosparcas.data.model.VoteCategory.MVP -> KmpVoteCategory.MVP
            com.futebadosparcas.data.model.VoteCategory.WORST -> KmpVoteCategory.WORST
            com.futebadosparcas.data.model.VoteCategory.BEST_GOALKEEPER -> KmpVoteCategory.BEST_GOALKEEPER
            com.futebadosparcas.data.model.VoteCategory.CUSTOM -> KmpVoteCategory.CUSTOM
        },
        votedAt = votedAt?.time
    )
}

private fun KmpMVPVote.toAndroidModel(): MVPVote {
    return MVPVote(
        id = id,
        gameId = gameId,
        voterId = voterId,
        votedPlayerId = votedPlayerId,
        category = when (category) {
            KmpVoteCategory.MVP -> com.futebadosparcas.data.model.VoteCategory.MVP
            KmpVoteCategory.WORST -> com.futebadosparcas.data.model.VoteCategory.WORST
            KmpVoteCategory.BEST_GOALKEEPER -> com.futebadosparcas.data.model.VoteCategory.BEST_GOALKEEPER
            KmpVoteCategory.CUSTOM -> com.futebadosparcas.data.model.VoteCategory.CUSTOM
        },
        votedAt = votedAt?.let { java.util.Date(it) }
    )
}

// GameEvent
private fun GameEvent.toKmpModel(): KmpGameEvent {
    return KmpGameEvent(
        id = id,
        gameId = gameId,
        eventType = eventType,
        playerId = playerId,
        playerName = playerName,
        teamId = teamId,
        assistedById = assistedById,
        assistedByName = assistedByName,
        minute = minute,
        createdBy = "",
        createdAt = null
    )
}

private fun KmpGameEvent.toAndroidModel(): GameEvent {
    return GameEvent(
        id = id,
        gameId = gameId,
        eventType = eventType,
        playerId = playerId,
        playerName = playerName,
        teamId = teamId,
        assistedById = assistedById,
        assistedByName = assistedByName,
        minute = minute,
        createdAt = createdAt?.let { java.util.Date(it) }
    )
}

// LiveScore
private fun KmpLiveScore.toAndroidModel(): LiveGameScore {
    return LiveGameScore(
        id = id,
        gameId = gameId,
        team1Id = team1Id,
        team1Score = team1Score,
        team2Id = team2Id,
        team2Score = team2Score,
        startedAt = startedAt?.let { java.util.Date(it) },
        finishedAt = finishedAt?.let { java.util.Date(it) }
    )
}

// Team
private fun KmpTeam.toAndroidModel(): Team {
    return Team(
        id = id,
        gameId = gameId,
        name = name,
        color = color,
        playerIds = playerIds,
        score = score
    )
}

private fun Team.toKmpModel(): KmpTeam {
    return KmpTeam(
        id = id,
        gameId = gameId,
        name = name,
        color = color,
        playerIds = playerIds,
        score = score
    )
}

// PlayerPosition
private fun PlayerPosition.toKmpModel(): KmpPlayerPosition {
    return when (this) {
        PlayerPosition.GOALKEEPER -> KmpPlayerPosition.GOALKEEPER
        PlayerPosition.FIELD -> KmpPlayerPosition.LINE
    }
}
