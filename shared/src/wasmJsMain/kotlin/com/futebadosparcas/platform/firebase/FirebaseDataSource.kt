package com.futebadosparcas.platform.firebase

import com.futebadosparcas.domain.model.*
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

private fun notSupported(method: String): Nothing =
    throw UnsupportedOperationException("Firebase.$method nao disponivel na plataforma Web (Phase 0 stub)")

private fun <T> stubResult(): Result<T> =
    Result.failure(UnsupportedOperationException("Firebase nao disponivel na plataforma Web (Phase 0 stub)"))

private fun <T> stubFlow(): Flow<Result<T>> = flow {
    emit(Result.failure(UnsupportedOperationException("Firebase nao disponivel na plataforma Web (Phase 0 stub)")))
}

private fun <T> stubFlowList(): Flow<List<T>> = flow { emit(emptyList()) }

// TODO: Fase 2 - implementar com GitLive Firebase SDK para wasmJs
actual class FirebaseDataSource {

    // ========== GAMES ==========

    actual suspend fun getUpcomingGames(limit: Int): Result<List<Game>> = stubResult()
    actual fun getUpcomingGamesFlow(limit: Int): Flow<Result<List<Game>>> = stubFlow()
    actual suspend fun getGameById(gameId: String): Result<Game> = stubResult()
    actual fun getGameByIdFlow(gameId: String): Flow<Result<Game>> = stubFlow()
    actual suspend fun getConfirmedGamesForUser(userId: String): Result<List<Game>> = stubResult()
    actual suspend fun getGamesByGroup(groupId: String, limit: Int): Result<List<Game>> = stubResult()
    actual suspend fun getPublicGames(limit: Int): Result<List<Game>> = stubResult()
    actual suspend fun createGame(game: Game): Result<Game> = stubResult()
    actual suspend fun updateGame(gameId: String, updates: Map<String, Any>): Result<Unit> = stubResult()
    actual suspend fun deleteGame(gameId: String): Result<Unit> = stubResult()

    // ========== GAME CONFIRMATIONS ==========

    actual suspend fun getGameConfirmations(gameId: String): Result<List<GameConfirmation>> = stubResult()
    actual fun getGameConfirmationsFlow(gameId: String): Flow<Result<List<GameConfirmation>>> = stubFlow()
    actual suspend fun confirmPresence(
        gameId: String,
        userId: String,
        userName: String,
        userPhoto: String?,
        position: String,
        isCasualPlayer: Boolean
    ): Result<GameConfirmation> = stubResult()
    actual suspend fun cancelConfirmation(gameId: String, userId: String): Result<Unit> = stubResult()
    actual suspend fun removePlayerFromGame(gameId: String, userId: String): Result<Unit> = stubResult()
    actual suspend fun updatePaymentStatus(
        gameId: String,
        userId: String,
        isPaid: Boolean
    ): Result<Unit> = stubResult()
    actual suspend fun summonPlayers(gameId: String, confirmations: List<GameConfirmation>): Result<Unit> = stubResult()
    actual suspend fun acceptInvitation(
        gameId: String,
        userId: String,
        position: String
    ): Result<GameConfirmation> = stubResult()
    actual suspend fun updateConfirmationStatus(
        gameId: String,
        userId: String,
        status: String
    ): Result<Unit> = stubResult()

    // ========== TEAMS ==========

    actual suspend fun getGameTeams(gameId: String): Result<List<Team>> = stubResult()
    actual fun getGameTeamsFlow(gameId: String): Flow<Result<List<Team>>> = stubFlow()
    actual suspend fun saveTeams(gameId: String, teams: List<Team>): Result<Unit> = stubResult()
    actual suspend fun clearGameTeams(gameId: String): Result<Unit> = stubResult()

    // ========== STATISTICS ==========

    actual suspend fun getUserStatistics(userId: String): Result<Statistics> = stubResult()
    actual fun getUserStatisticsFlow(userId: String): Flow<Result<Statistics>> = stubFlow()
    actual suspend fun updateUserStatistics(userId: String, updates: Map<String, Any>): Result<Unit> = stubResult()

    // ========== USERS ==========

    actual suspend fun getUserById(userId: String): Result<User> = stubResult()
    actual suspend fun getUsersByIds(userIds: List<String>): Result<List<User>> = stubResult()
    actual suspend fun getCurrentUser(): Result<User> = stubResult()
    actual fun getCurrentUserId(): String? = null
    actual suspend fun updateUser(userId: String, updates: Map<String, Any>): Result<Unit> = stubResult()
    actual suspend fun searchUsers(query: String, limit: Int): Result<List<User>> = stubResult()
    actual suspend fun getAllUsers(): Result<List<User>> = stubResult()
    actual suspend fun updateUserRole(userId: String, newRole: String): Result<Unit> = stubResult()
    actual suspend fun updateAutoRatings(
        userId: String,
        autoStrikerRating: Double,
        autoMidRating: Double,
        autoDefenderRating: Double,
        autoGkRating: Double,
        autoRatingSamples: Int
    ): Result<Unit> = stubResult()

    // ========== GROUPS ==========

    actual suspend fun getUserGroups(userId: String): Result<List<UserGroup>> = stubResult()
    actual fun getUserGroupsFlow(userId: String): Flow<Result<List<UserGroup>>> = stubFlow()
    actual suspend fun getGroupById(groupId: String): Result<UserGroup> = stubResult()

    // ========== XP LOGS ==========

    actual suspend fun getUserXpLogs(userId: String, limit: Int): Result<List<XpLog>> = stubResult()

    // ========== XP/GAMIFICATION ==========

    actual suspend fun createXpLog(xpLog: XpLog): Result<XpLog> = stubResult()
    actual suspend fun updateUserLevel(userId: String, level: Int, xp: Long): Result<Unit> = stubResult()
    actual suspend fun awardBadge(userId: String, badgeId: String): Result<Unit> = stubResult()
    actual suspend fun updateStreak(userId: String, streak: Int, lastGameDate: Long): Result<Unit> = stubResult()
    actual suspend fun unlockMilestone(userId: String, milestoneId: String): Result<Unit> = stubResult()

    // ========== LIVE GAME ==========

    actual suspend fun startLiveGame(gameId: String, team1Id: String, team2Id: String): Result<LiveScore> = stubResult()
    actual suspend fun canManageGameEvents(gameId: String): Boolean = false
    actual suspend fun updateScoreForGoal(gameId: String, teamId: String): Result<Unit> = stubResult()
    actual suspend fun updatePlayerStats(
        gameId: String,
        playerId: String,
        teamId: String,
        eventType: GameEventType,
        assistedById: String?
    ): Result<Unit> = stubResult()
    actual suspend fun deleteGameEvent(gameId: String, eventId: String): Result<Unit> = stubResult()
    actual suspend fun getLivePlayerStats(gameId: String): Result<List<LivePlayerStats>> = stubResult()
    actual fun getLivePlayerStatsFlow(gameId: String): Flow<Result<List<LivePlayerStats>>> = stubFlow()
    actual suspend fun finishGame(gameId: String): Result<Unit> = stubResult()
    actual suspend fun clearAllLiveGameData(): Result<Unit> = stubResult()
    actual suspend fun createLiveGame(gameId: String): Result<Unit> = stubResult()
    actual suspend fun updateLiveScore(gameId: String, team1Score: Int, team2Score: Int): Result<Unit> = stubResult()
    actual suspend fun addGameEvent(gameId: String, event: GameEvent): Result<GameEvent> = stubResult()
    actual suspend fun getGameEvents(gameId: String): Result<List<GameEvent>> = stubResult()
    actual fun getGameEventsFlow(gameId: String): Flow<Result<List<GameEvent>>> = stubFlow()
    actual fun getLiveScoreFlow(gameId: String): Flow<Result<LiveScore>> = stubFlow()

    // ========== GROUPS MANAGEMENT ==========

    actual suspend fun createGroup(group: Group): Result<Group> = stubResult()
    actual suspend fun updateGroup(groupId: String, updates: Map<String, Any>): Result<Unit> = stubResult()
    actual suspend fun getGroupMembers(groupId: String): Result<List<GroupMember>> = stubResult()
    actual fun getGroupMembersFlow(groupId: String): Flow<Result<List<GroupMember>>> = stubFlow()
    actual suspend fun addGroupMember(groupId: String, userId: String, role: String): Result<Unit> = stubResult()
    actual suspend fun removeGroupMember(groupId: String, userId: String): Result<Unit> = stubResult()
    actual suspend fun getGroupDetails(groupId: String): Result<Group> = stubResult()
    actual fun getGroupDetailsFlow(groupId: String): Flow<Result<Group>> = stubFlow()

    // ========== GROUPS ADVANCED ==========

    actual suspend fun promoteGroupMemberToAdmin(groupId: String, memberId: String): Result<Unit> = stubResult()
    actual suspend fun demoteGroupAdminToMember(groupId: String, memberId: String): Result<Unit> = stubResult()
    actual suspend fun updateGroupMemberRole(groupId: String, userId: String, role: String): Result<Unit> = stubResult()
    actual suspend fun leaveGroup(groupId: String, userId: String): Result<Unit> = stubResult()
    actual suspend fun archiveGroup(groupId: String): Result<Unit> = stubResult()
    actual suspend fun restoreGroup(groupId: String): Result<Unit> = stubResult()
    actual suspend fun deleteGroup(groupId: String): Result<Unit> = stubResult()
    actual suspend fun transferGroupOwnership(
        groupId: String,
        newOwnerId: String,
        oldOwnerId: String,
        newOwnerName: String
    ): Result<Unit> = stubResult()
    actual suspend fun syncGroupMemberCount(groupId: String, userIds: List<String>): Result<Unit> = stubResult()
    actual suspend fun joinGroupByInviteCode(
        inviteCode: String,
        userId: String,
        userName: String,
        userPhoto: String?
    ): Result<String> = stubResult()
    actual suspend fun generateGroupInviteCode(groupId: String): Result<String> = stubResult()

    // ========== BATCH OPERATIONS ==========

    actual suspend fun executeBatch(operations: List<BatchOperation>): Result<Unit> = stubResult()

    // ========== PROFILE VISIBILITY ==========

    actual suspend fun updateProfileVisibility(userId: String, isSearchable: Boolean): Result<Unit> = stubResult()

    // ========== FIELD OWNERS ==========

    actual suspend fun getFieldOwners(): Result<List<User>> = stubResult()

    // ========== FCM TOKEN ==========

    actual suspend fun updateFcmToken(token: String): Result<Unit> = stubResult()

    // ========== AUTH ==========

    actual fun getAuthStateFlow(): Flow<String?> = flow { emit(null) }
    actual fun isLoggedIn(): Boolean = false
    actual fun getCurrentAuthUserId(): String? = null
    actual suspend fun getCurrentAuthUser(): Result<User> = stubResult()
    actual fun logout() { /* no-op no web stub */ }

    // ========== LOCATIONS ==========

    actual suspend fun getAllLocations(): Result<List<Location>> = stubResult()
    actual suspend fun getLocationsWithPagination(limit: Int, lastLocationName: String?): Result<List<Location>> = stubResult()
    actual suspend fun getLocationsPaginated(
        pageSize: Int,
        cursor: String?,
        sortBy: LocationSortField
    ): Result<PaginatedResult<Location>> = stubResult()
    actual suspend fun deleteLocation(locationId: String): Result<Unit> = stubResult()
    actual suspend fun getLocationsByOwner(ownerId: String): Result<List<Location>> = stubResult()
    actual suspend fun getLocationById(locationId: String): Result<Location> = stubResult()
    actual suspend fun getLocationWithFields(locationId: String): Result<LocationWithFields> = stubResult()
    actual suspend fun createLocation(location: Location): Result<Location> = stubResult()
    actual suspend fun updateLocation(location: Location): Result<Unit> = stubResult()
    actual suspend fun searchLocations(query: String): Result<List<Location>> = stubResult()
    actual suspend fun getOrCreateLocationFromPlace(
        placeId: String,
        name: String,
        address: String,
        city: String,
        state: String,
        latitude: Double?,
        longitude: Double?
    ): Result<Location> = stubResult()
    actual suspend fun addLocationReview(review: LocationReview): Result<Unit> = stubResult()
    actual suspend fun getLocationReviews(locationId: String): Result<List<LocationReview>> = stubResult()
    actual suspend fun seedGinasioApollo(): Result<Location> = stubResult()
    actual suspend fun migrateLocations(migrationData: List<LocationMigrationData>): Result<Int> = stubResult()
    actual suspend fun deduplicateLocations(): Result<Int> = stubResult()
    actual suspend fun deleteLocationWithFields(locationId: String): Result<Int> = stubResult()

    // ========== FIELDS ==========

    actual suspend fun getFieldsByLocation(locationId: String): Result<List<Field>> = stubResult()
    actual suspend fun getFieldById(fieldId: String): Result<Field> = stubResult()
    actual suspend fun createField(field: Field): Result<Field> = stubResult()
    actual suspend fun updateField(field: Field): Result<Unit> = stubResult()
    actual suspend fun deleteField(fieldId: String): Result<Unit> = stubResult()
    actual suspend fun uploadFieldPhoto(filePath: String): Result<String> = stubResult()

    // ========== PAYMENTS ==========

    actual suspend fun createPayment(payment: Payment): Result<Payment> = stubResult()
    actual suspend fun confirmPayment(paymentId: String): Result<Unit> = stubResult()
    actual suspend fun getPaymentsByUser(userId: String): Result<List<Payment>> = stubResult()

    // ========== CASHBOX ==========

    actual suspend fun uploadCashboxReceipt(groupId: String, filePath: String): Result<String> = stubResult()
    actual suspend fun addCashboxEntry(
        groupId: String,
        entry: CashboxEntry,
        receiptFilePath: String?
    ): Result<String> = stubResult()
    actual suspend fun getCashboxSummary(groupId: String): Result<CashboxSummary> = stubResult()
    actual fun getCashboxSummaryFlow(groupId: String): Flow<Result<CashboxSummary>> = stubFlow()
    actual suspend fun getCashboxHistory(groupId: String, limit: Int): Result<List<CashboxEntry>> = stubResult()
    actual fun getCashboxHistoryFlow(groupId: String, limit: Int): Flow<Result<List<CashboxEntry>>> = stubFlow()
    actual suspend fun getCashboxHistoryFiltered(
        groupId: String,
        filter: CashboxFilter,
        limit: Int
    ): Result<List<CashboxEntry>> = stubResult()
    actual suspend fun getCashboxEntriesByMonth(
        groupId: String,
        year: Int,
        month: Int
    ): Result<List<CashboxEntry>> = stubResult()
    actual suspend fun getCashboxEntryById(groupId: String, entryId: String): Result<CashboxEntry> = stubResult()
    actual suspend fun deleteCashboxEntry(groupId: String, entryId: String): Result<Unit> = stubResult()
    actual suspend fun recalculateCashboxBalance(groupId: String): Result<CashboxSummary> = stubResult()

    // ========== GAMIFICATION - STREAKS ==========

    actual suspend fun getUserStreak(userId: String): Result<UserStreak?> = stubResult()
    actual suspend fun saveUserStreak(streak: UserStreak): Result<Unit> = stubResult()

    // ========== GAMIFICATION - BADGES ==========

    actual suspend fun getAvailableBadges(): Result<List<BadgeDefinition>> = stubResult()
    actual suspend fun getUserBadges(userId: String): Result<List<UserBadge>> = stubResult()
    actual suspend fun getRecentBadges(userId: String, limit: Int): Result<List<UserBadge>> = stubResult()
    actual suspend fun createUserBadge(userBadge: UserBadge): Result<UserBadge> = stubResult()
    actual suspend fun updateUserBadge(userBadge: UserBadge): Result<Unit> = stubResult()

    // ========== GAMIFICATION - SEASONS ==========

    actual suspend fun getActiveSeason(): Result<Season?> = stubResult()
    actual suspend fun getAllSeasons(): Result<List<Season>> = stubResult()
    actual suspend fun getSeasonRanking(seasonId: String, limit: Int): Result<List<SeasonParticipation>> = stubResult()
    actual fun observeSeasonRanking(seasonId: String, limit: Int): Flow<List<SeasonParticipation>> = stubFlowList()
    actual suspend fun getSeasonParticipation(seasonId: String, userId: String): Result<SeasonParticipation?> = stubResult()
    actual suspend fun saveSeasonParticipation(participation: SeasonParticipation): Result<Unit> = stubResult()

    // ========== GAMIFICATION - CHALLENGES ==========

    actual suspend fun getActiveChallenges(): Result<List<WeeklyChallenge>> = stubResult()
    actual suspend fun getChallengesProgress(
        userId: String,
        challengeIds: List<String>
    ): Result<List<UserChallengeProgress>> = stubResult()

    // ========== RANKINGS ==========

    actual suspend fun getRankingByCategory(
        category: String,
        field: String,
        limit: Int
    ): Result<List<Triple<String, Long, Int>>> = stubResult()

    actual suspend fun getRankingDeltas(
        periodName: String,
        periodKey: String,
        deltaField: String,
        minGames: Int,
        limit: Int
    ): Result<List<Triple<String, Long, Int>>> = stubResult()

    actual suspend fun getUsersStatistics(userIds: List<String>): Result<Map<String, Statistics>> = stubResult()
    actual suspend fun getStatisticsRanking(orderByField: String, limit: Int): Result<List<Statistics>> = stubResult()

    // ========== NOTIFICATIONS ==========

    actual suspend fun getMyNotifications(limit: Int): Result<List<AppNotification>> = stubResult()
    actual fun getMyNotificationsFlow(limit: Int): Flow<List<AppNotification>> = stubFlowList()
    actual suspend fun getUnreadNotifications(): Result<List<AppNotification>> = stubResult()
    actual fun getUnreadCountFlow(): Flow<Int> = flow { emit(0) }
    actual suspend fun getUnreadCount(): Result<Int> = stubResult()
    actual suspend fun markNotificationAsRead(notificationId: String): Result<Unit> = stubResult()
    actual suspend fun markNotificationAsUnread(notificationId: String): Result<Unit> = stubResult()
    actual suspend fun markAllNotificationsAsRead(): Result<Unit> = stubResult()
    actual suspend fun getNotificationById(notificationId: String): Result<AppNotification> = stubResult()
    actual suspend fun createNotification(notification: AppNotification): Result<String> = stubResult()
    actual suspend fun batchCreateNotifications(notifications: List<AppNotification>): Result<Unit> = stubResult()
    actual suspend fun deleteNotification(notificationId: String): Result<Unit> = stubResult()
    actual suspend fun deleteOldNotifications(): Result<Int> = stubResult()
    actual suspend fun getNotificationsByType(type: NotificationType, limit: Int): Result<List<AppNotification>> = stubResult()
    actual suspend fun getPendingActionNotifications(): Result<List<AppNotification>> = stubResult()

    // ========== LOCATION AUDIT LOGS ==========

    actual suspend fun logLocationAudit(log: LocationAuditLog): Result<Unit> = stubResult()
    actual suspend fun getLocationAuditLogs(locationId: String, limit: Int): Result<List<LocationAuditLog>> = stubResult()
}
