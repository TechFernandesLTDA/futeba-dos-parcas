package com.futebadosparcas.platform.firebase

import com.futebadosparcas.domain.model.*
import kotlinx.coroutines.flow.Flow

/**
 * Abstração multiplataforma para acesso ao Firebase.
 *
 * Usa expect/actual para permitir implementações específicas de plataforma:
 * - Android: Firebase Android SDK
 * - iOS: Firebase iOS SDK (CocoaPods)
 *
 * IMPORTANTE: Esta interface centraliza TODAS as operações Firebase,
 * permitindo:
 * - Mock em testes unitários
 * - Trocar backend (ex: Firebase → Supabase)
 * - Retry logic e tratamento de erros
 * - Migração incremental para KMP
 */
expect class FirebaseDataSource {

    // ========== GAMES ==========

    suspend fun getUpcomingGames(limit: Int = 50): Result<List<Game>>
    fun getUpcomingGamesFlow(limit: Int = 50): Flow<Result<List<Game>>>
    suspend fun getGameById(gameId: String): Result<Game>
    fun getGameByIdFlow(gameId: String): Flow<Result<Game>>
    suspend fun getConfirmedGamesForUser(userId: String): Result<List<Game>>
    suspend fun getGamesByGroup(groupId: String, limit: Int = 50): Result<List<Game>>
    suspend fun getPublicGames(limit: Int = 20): Result<List<Game>>
    suspend fun createGame(game: Game): Result<Game>
    suspend fun updateGame(gameId: String, updates: Map<String, Any>): Result<Unit>
    suspend fun deleteGame(gameId: String): Result<Unit>

    // ========== GAME CONFIRMATIONS ==========

    suspend fun getGameConfirmations(gameId: String): Result<List<GameConfirmation>>
    fun getGameConfirmationsFlow(gameId: String): Flow<Result<List<GameConfirmation>>>
    suspend fun confirmPresence(
        gameId: String,
        userId: String,
        userName: String,
        userPhoto: String?,
        position: String,
        isCasualPlayer: Boolean
    ): Result<GameConfirmation>
    suspend fun cancelConfirmation(gameId: String, userId: String): Result<Unit>
    suspend fun updatePaymentStatus(
        gameId: String,
        userId: String,
        isPaid: Boolean
    ): Result<Unit>

    // ========== TEAMS ==========

    suspend fun getGameTeams(gameId: String): Result<List<Team>>
    fun getGameTeamsFlow(gameId: String): Flow<Result<List<Team>>>
    suspend fun saveTeams(gameId: String, teams: List<Team>): Result<Unit>
    suspend fun clearGameTeams(gameId: String): Result<Unit>

    // ========== STATISTICS ==========

    suspend fun getUserStatistics(userId: String): Result<Statistics>
    fun getUserStatisticsFlow(userId: String): Flow<Result<Statistics>>
    suspend fun updateUserStatistics(userId: String, updates: Map<String, Any>): Result<Unit>

    // ========== USERS ==========

    suspend fun getUserById(userId: String): Result<User>
    suspend fun getUsersByIds(userIds: List<String>): Result<List<User>>
    suspend fun getCurrentUser(): Result<User>
    fun getCurrentUserId(): String?
    suspend fun updateUser(userId: String, updates: Map<String, Any>): Result<Unit>
    suspend fun searchUsers(query: String, limit: Int): Result<List<User>>

    // ========== GROUPS ==========

    suspend fun getUserGroups(userId: String): Result<List<UserGroup>>
    fun getUserGroupsFlow(userId: String): Flow<Result<List<UserGroup>>>
    suspend fun getGroupById(groupId: String): Result<UserGroup>

    // ========== XP LOGS ==========

    suspend fun getUserXpLogs(userId: String, limit: Int): Result<List<XpLog>>

    // ========== XP/GAMIFICATION ==========

    suspend fun createXpLog(xpLog: XpLog): Result<XpLog>
    suspend fun updateUserLevel(userId: String, level: Int, xp: Long): Result<Unit>
    suspend fun awardBadge(userId: String, badgeId: String): Result<Unit>
    suspend fun updateStreak(userId: String, streak: Int, lastGameDate: Long): Result<Unit>
    suspend fun unlockMilestone(userId: String, milestoneId: String): Result<Unit>

    // ========== LIVE GAME ==========

    suspend fun createLiveGame(gameId: String): Result<Unit>
    suspend fun updateLiveScore(gameId: String, team1Score: Int, team2Score: Int): Result<Unit>
    suspend fun addGameEvent(gameId: String, event: GameEvent): Result<GameEvent>
    suspend fun getGameEvents(gameId: String): Result<List<GameEvent>>
    fun getGameEventsFlow(gameId: String): Flow<Result<List<GameEvent>>>
    fun getLiveScoreFlow(gameId: String): Flow<Result<LiveScore>>

    // ========== GROUPS MANAGEMENT ==========

    suspend fun createGroup(group: Group): Result<Group>
    suspend fun updateGroup(groupId: String, updates: Map<String, Any>): Result<Unit>
    suspend fun getGroupMembers(groupId: String): Result<List<GroupMember>>
    suspend fun addGroupMember(groupId: String, userId: String, role: String): Result<Unit>
    suspend fun removeGroupMember(groupId: String, userId: String): Result<Unit>
    suspend fun getGroupDetails(groupId: String): Result<Group>

    // ========== BATCH OPERATIONS ==========

    suspend fun executeBatch(operations: List<BatchOperation>): Result<Unit>
}

/**
 * Operação de batch write para Firebase.
 *
 * Permite agrupar múltiplas operações em uma única transação atômica.
 */
sealed class BatchOperation {
    data class Set(
        val collection: String,
        val documentId: String,
        val data: Map<String, Any>
    ) : BatchOperation()

    data class Update(
        val collection: String,
        val documentId: String,
        val updates: Map<String, Any>
    ) : BatchOperation()

    data class Delete(
        val collection: String,
        val documentId: String
    ) : BatchOperation()
}
