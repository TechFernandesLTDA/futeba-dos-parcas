package com.futebadosparcas.platform.firebase

import com.futebadosparcas.domain.model.*
import com.futebadosparcas.platform.UuidGenerator
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.auth.auth
import dev.gitlive.firebase.firestore.Direction
import dev.gitlive.firebase.firestore.FieldPath
import dev.gitlive.firebase.firestore.FieldValue
import dev.gitlive.firebase.firestore.Query
import dev.gitlive.firebase.firestore.Timestamp
import dev.gitlive.firebase.firestore.firestore
import dev.gitlive.firebase.functions.FirebaseFunctionsException
import dev.gitlive.firebase.functions.code
import dev.gitlive.firebase.functions.functions
import dev.gitlive.firebase.storage.storage
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toInstant
import kotlinx.datetime.toLocalDateTime
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi
import kotlin.time.Duration.Companion.seconds

/**
 * Implementação multiplataforma do FirebaseDataSource usando GitLive Firebase SDK 2.4.0.
 *
 * Migrado de Firebase Android SDK para GitLive SDK para suporte KMP (Android + iOS).
 * Sem chamadas .await() — todas as operações são suspend nativas do GitLive SDK.
 */

actual class FirebaseDataSource actual constructor() {

    private val firestore = Firebase.firestore
    private val auth = Firebase.auth
    private val storage = Firebase.storage

    internal val games = FirebaseGamesDataSource(firestore, auth)
    internal val groups = FirebaseGroupsDataSource(firestore, auth, storage)
    internal val users = FirebaseUsersDataSource(firestore, auth, storage)
    internal val finance = FirebaseFinanceDataSource(firestore, auth)
    internal val gamification = FirebaseGamificationDataSource(firestore, auth)
    internal val locations = FirebaseLocationsDataSource(firestore, auth)

    companion object {
        internal fun exportPayloadFromCallableData(data: Any?): ExportMyDataPayload =
            FirebaseUsersDataSource.exportPayloadFromCallableData(data)
    }

    // ========== GAMES ==========
    actual suspend fun getUpcomingGames(limit: Int): Result<List<Game>> =
        games.getUpcomingGames(limit)

    actual fun getUpcomingGamesFlow(limit: Int): Flow<Result<List<Game>>> =
        games.getUpcomingGamesFlow(limit)

    actual suspend fun getGameById(gameId: String): Result<Game> =
        games.getGameById(gameId)

    actual fun getGameByIdFlow(gameId: String): Flow<Result<Game>> =
        games.getGameByIdFlow(gameId)

    actual suspend fun getConfirmedGamesForUser(userId: String): Result<List<Game>> =
        games.getConfirmedGamesForUser(userId)

    actual suspend fun getGamesByGroup(groupId: String, limit: Int): Result<List<Game>> =
        games.getGamesByGroup(groupId, limit)

    actual suspend fun getPublicGames(limit: Int): Result<List<Game>> =
        games.getPublicGames(limit)

    actual suspend fun createGame(game: Game): Result<Game> =
        games.createGame(game)

    actual suspend fun updateGame(gameId: String, updates: Map<String, Any>): Result<Unit> =
        games.updateGame(gameId, updates)

    actual suspend fun deleteGame(gameId: String): Result<Unit> =
        games.deleteGame(gameId)

    actual suspend fun getGameConfirmations(gameId: String): Result<List<GameConfirmation>> =
        games.getGameConfirmations(gameId)

    actual fun getGameConfirmationsFlow(gameId: String): Flow<Result<List<GameConfirmation>>> =
        games.getGameConfirmationsFlow(gameId)

    actual suspend fun confirmPresence(gameId: String, userId: String, userName: String, userPhoto: String?, position: String, isCasualPlayer: Boolean): Result<GameConfirmation> =
        games.confirmPresence(gameId, userId, userName, userPhoto, position, isCasualPlayer)

    actual suspend fun cancelConfirmation(gameId: String, userId: String): Result<Unit> =
        games.cancelConfirmation(gameId, userId)

    actual suspend fun updatePaymentStatus(gameId: String, userId: String, isPaid: Boolean): Result<Unit> =
        games.updatePaymentStatus(gameId, userId, isPaid)

    actual suspend fun removePlayerFromGame(gameId: String, userId: String): Result<Unit> =
        games.removePlayerFromGame(gameId, userId)

    actual suspend fun summonPlayers(gameId: String, confirmations: List<GameConfirmation>): Result<Unit> =
        games.summonPlayers(gameId, confirmations)

    actual suspend fun acceptInvitation(gameId: String, userId: String, position: String): Result<GameConfirmation> =
        games.acceptInvitation(gameId, userId, position)

    actual suspend fun updateConfirmationStatus(gameId: String, userId: String, status: String): Result<Unit> =
        games.updateConfirmationStatus(gameId, userId, status)

    actual fun getGameWaitlistFlow(gameId: String): Flow<Result<List<GameWaitlist>>> =
        games.getGameWaitlistFlow(gameId)

    actual suspend fun joinWaitlist(gameId: String, position: String): Result<GameWaitlist> =
        games.joinWaitlist(gameId, position)

    actual suspend fun leaveWaitlist(gameId: String, userId: String): Result<Unit> =
        games.leaveWaitlist(gameId, userId)

    actual suspend fun getGameTeams(gameId: String): Result<List<Team>> =
        games.getGameTeams(gameId)

    actual fun getGameTeamsFlow(gameId: String): Flow<Result<List<Team>>> =
        games.getGameTeamsFlow(gameId)

    actual suspend fun saveTeams(gameId: String, teams: List<Team>): Result<Unit> =
        games.saveTeams(gameId, teams)

    actual suspend fun clearGameTeams(gameId: String): Result<Unit> =
        games.clearGameTeams(gameId)

    actual suspend fun createLiveGame(gameId: String): Result<Unit> =
        games.createLiveGame(gameId)

    actual suspend fun updateLiveScore(gameId: String, team1Score: Int, team2Score: Int): Result<Unit> =
        games.updateLiveScore(gameId, team1Score, team2Score)

    actual suspend fun addGameEvent(gameId: String, event: GameEvent): Result<GameEvent> =
        games.addGameEvent(gameId, event)

    actual suspend fun getGameEvents(gameId: String): Result<List<GameEvent>> =
        games.getGameEvents(gameId)

    actual fun getGameEventsFlow(gameId: String): Flow<Result<List<GameEvent>>> =
        games.getGameEventsFlow(gameId)

    actual fun getLiveScoreFlow(gameId: String): Flow<Result<LiveScore?>> =
        games.getLiveScoreFlow(gameId)

    actual suspend fun startLiveGame(gameId: String, team1Id: String, team2Id: String): Result<LiveScore> =
        games.startLiveGame(gameId, team1Id, team2Id)

    actual suspend fun canManageGameEvents(gameId: String): Boolean =
        games.canManageGameEvents(gameId)

    actual suspend fun updateScoreForGoal(gameId: String, teamId: String): Result<Unit> =
        games.updateScoreForGoal(gameId, teamId)

    actual suspend fun updatePlayerStats(gameId: String, playerId: String, teamId: String, eventType: GameEventType, assistedById: String?): Result<Unit> =
        games.updatePlayerStats(gameId, playerId, teamId, eventType, assistedById)

    actual suspend fun deleteGameEvent(gameId: String, eventId: String): Result<Unit> =
        games.deleteGameEvent(gameId, eventId)

    // ========== GROUPS ==========
    actual suspend fun getUserGroups(userId: String): Result<List<UserGroup>> =
        groups.getUserGroups(userId)

    actual fun getUserGroupsFlow(userId: String): Flow<Result<List<UserGroup>>> =
        groups.getUserGroupsFlow(userId)

    actual suspend fun getGroupById(groupId: String): Result<UserGroup> =
        groups.getGroupById(groupId)

    actual suspend fun createGroup(group: Group): Result<Group> =
        groups.createGroup(group)

    actual suspend fun updateGroup(groupId: String, updates: Map<String, Any>): Result<Unit> =
        groups.updateGroup(groupId, updates)

    actual suspend fun getGroupMembers(groupId: String): Result<List<GroupMember>> =
        groups.getGroupMembers(groupId)

    actual suspend fun addGroupMember(groupId: String, userId: String, role: String): Result<Unit> =
        groups.addGroupMember(groupId, userId, role)

    actual suspend fun removeGroupMember(groupId: String, userId: String): Result<Unit> =
        groups.removeGroupMember(groupId, userId)

    actual suspend fun getGroupDetails(groupId: String): Result<Group> =
        groups.getGroupDetails(groupId)

    actual fun getGroupMembersFlow(groupId: String): Flow<Result<List<GroupMember>>> =
        groups.getGroupMembersFlow(groupId)

    actual fun getGroupDetailsFlow(groupId: String): Flow<Result<Group>> =
        groups.getGroupDetailsFlow(groupId)

    actual suspend fun promoteGroupMemberToAdmin(groupId: String, memberId: String): Result<Unit> =
        groups.promoteGroupMemberToAdmin(groupId, memberId)

    actual suspend fun demoteGroupAdminToMember(groupId: String, memberId: String): Result<Unit> =
        groups.demoteGroupAdminToMember(groupId, memberId)

    actual suspend fun updateGroupMemberRole(groupId: String, userId: String, role: String): Result<Unit> =
        groups.updateGroupMemberRole(groupId, userId, role)

    actual suspend fun leaveGroup(groupId: String, userId: String): Result<Unit> =
        groups.leaveGroup(groupId, userId)

    actual suspend fun archiveGroup(groupId: String): Result<Unit> =
        groups.archiveGroup(groupId)

    actual suspend fun restoreGroup(groupId: String): Result<Unit> =
        groups.restoreGroup(groupId)

    actual suspend fun deleteGroup(groupId: String): Result<Unit> =
        groups.deleteGroup(groupId)

    actual suspend fun transferGroupOwnership(groupId: String, newOwnerId: String, oldOwnerId: String, newOwnerName: String): Result<Unit> =
        groups.transferGroupOwnership(groupId, newOwnerId, oldOwnerId, newOwnerName)

    actual suspend fun syncGroupMemberCount(groupId: String, userIds: List<String>): Result<Unit> =
        groups.syncGroupMemberCount(groupId, userIds)

    actual suspend fun joinGroupByInviteCode(inviteCode: String, userId: String, userName: String, userPhoto: String?): Result<String> =
        groups.joinGroupByInviteCode(inviteCode, userId, userName, userPhoto)

    actual suspend fun generateGroupInviteCode(groupId: String): Result<String> =
        groups.generateGroupInviteCode(groupId)

    actual suspend fun searchPublicGroups(query: String, limit: Int): Result<List<Group>> =
        groups.searchPublicGroups(query, limit)

    actual suspend fun createGroupJoinRequest(groupId: String, userId: String, userName: String, userPhoto: String?,): Result<Unit> =
        groups.createGroupJoinRequest(groupId, userId, userName, userPhoto)

    actual suspend fun cancelGroupJoinRequest(groupId: String, userId: String): Result<Unit> =
        groups.cancelGroupJoinRequest(groupId, userId)

    actual suspend fun approveGroupJoinRequest(groupId: String, requesterId: String, approverId: String,): Result<Unit> =
        groups.approveGroupJoinRequest(groupId, requesterId, approverId)

    actual suspend fun rejectGroupJoinRequest(groupId: String, requesterId: String, approverId: String,): Result<Unit> =
        groups.rejectGroupJoinRequest(groupId, requesterId, approverId)

    actual fun observeMyGroupJoinRequest(groupId: String, userId: String,): Flow<GroupJoinRequest?> =
        groups.observeMyGroupJoinRequest(groupId, userId)

    actual fun observePendingGroupJoinRequests(groupId: String): Flow<List<GroupJoinRequest>> =
        groups.observePendingGroupJoinRequests(groupId)

    suspend fun getMyRoleInGroup(groupId: String, userId: String): Result<String?> =
        groups.getMyRoleInGroup(groupId, userId)

    suspend fun isMemberOfGroup(groupId: String, userId: String): Result<Boolean> =
        groups.isMemberOfGroup(groupId, userId)

    suspend fun getMyAdminGroups(userId: String): Result<List<String>> =
        groups.getMyAdminGroups(userId)

    suspend fun getValidGroupsForGame(userId: String): Result<List<String>> =
        groups.getValidGroupsForGame(userId)

    suspend fun canCreateGames(userId: String): Result<Boolean> =
        groups.canCreateGames(userId)

    suspend fun countMyAdminGroups(userId: String): Result<Int> =
        groups.countMyAdminGroups(userId)

    suspend fun syncAllMyGroupsMemberCount(userId: String): Result<Unit> =
        groups.syncAllMyGroupsMemberCount(userId)

    suspend fun getGroupActiveMemberIds(groupId: String): Result<List<String>> =
        groups.getGroupActiveMemberIds(groupId)

    suspend fun uploadGroupPhoto(groupId: String, photoPath: String): Result<String> =
        groups.uploadGroupPhoto(groupId, photoPath)

    // ========== USERS ==========
    actual suspend fun blockUserOnServer(userId: String, targetUserId: String, userName: String, reason: String): Result<Unit> =
        users.blockUserOnServer(userId, targetUserId, userName, reason)

    actual suspend fun unblockUserOnServer(userId: String, targetUserId: String): Result<Unit> =
        users.unblockUserOnServer(userId, targetUserId)

    actual suspend fun submitContentReport(targetType: String, targetId: String, targetName: String, reason: String, gameId: String?, groupId: String?): Result<Unit> =
        users.submitContentReport(targetType, targetId, targetName, reason, gameId, groupId)

    actual suspend fun submitPlayerReport(reporterId: String, targetUserId: String, targetUserName: String, reason: String, gameId: String?, groupId: String?): Result<Unit> =
        users.submitPlayerReport(reporterId, targetUserId, targetUserName, reason, gameId, groupId)

    suspend fun getRecentActivities(limit: Int): Result<List<Activity>> =
        users.getRecentActivities(limit)

    fun getRecentActivitiesFlow(limit: Int): Flow<Result<List<Activity>>> =
        users.getRecentActivitiesFlow(limit)

    suspend fun createActivity(activity: Activity): Result<Unit> =
        users.createActivity(activity)

    suspend fun getUserActivities(userId: String, limit: Int): Result<List<Activity>> =
        users.getUserActivities(userId, limit)

    actual suspend fun getUserStatistics(userId: String): Result<Statistics> =
        users.getUserStatistics(userId)

    actual fun getUserStatisticsFlow(userId: String): Flow<Result<Statistics>> =
        users.getUserStatisticsFlow(userId)

    actual suspend fun updateUserStatistics(userId: String, updates: Map<String, Any>): Result<Unit> =
        users.updateUserStatistics(userId, updates)

    actual suspend fun getUserById(userId: String): Result<User> =
        users.getUserById(userId)

    actual suspend fun getUsersByIds(userIds: List<String>): Result<List<User>> =
        users.getUsersByIds(userIds)

    actual suspend fun getCurrentUser(): Result<User> =
        users.getCurrentUser()

    actual fun getCurrentUserId(): String? =
        users.getCurrentUserId()

    actual suspend fun updateUser(userId: String, updates: Map<String, Any>): Result<Unit> =
        users.updateUser(userId, updates)

    actual suspend fun updateUserPiiViaCallable(updates: Map<String, Any>): Result<Unit> =
        users.updateUserPiiViaCallable(updates)

    actual suspend fun deleteAccount(): Result<Unit> =
        users.deleteAccount()

    actual suspend fun exportMyData(): Result<ExportMyDataPayload> =
        users.exportMyData()

    actual suspend fun registerPushToken(registration: PushTokenRegistration): Result<Unit> =
        users.registerPushToken(registration)

    actual suspend fun unregisterPushToken(deviceId: String, sequence: Long, token: String?): Result<Unit> =
        users.unregisterPushToken(deviceId, sequence, token)

    actual suspend fun submitMvpVoteViaCallable(vote: MVPVote): Result<Unit> =
        users.submitMvpVoteViaCallable(vote)

    actual suspend fun concludeMvpVotingViaCallable(gameId: String): Result<Unit> =
        users.concludeMvpVotingViaCallable(gameId)

    actual suspend fun startGameLifecycleViaCallable(gameId: String): Result<Unit> =
        users.startGameLifecycleViaCallable(gameId)

    actual suspend fun finishGameLifecycleViaCallable(gameId: String): Result<Unit> =
        users.finishGameLifecycleViaCallable(gameId)

    actual suspend fun searchUsers(query: String, limit: Int): Result<List<User>> =
        users.searchUsers(query, limit)

    actual suspend fun getAllUsers(): Result<List<User>> =
        users.getAllUsers()

    actual suspend fun updateUserRole(userId: String, newRole: String): Result<Unit> =
        users.updateUserRole(userId, newRole)

    actual suspend fun updateAutoRatings(userId: String, autoStrikerRating: Double, autoMidRating: Double, autoDefenderRating: Double, autoGkRating: Double, autoRatingSamples: Int): Result<Unit> =
        users.updateAutoRatings(userId, autoStrikerRating, autoMidRating, autoDefenderRating, autoGkRating, autoRatingSamples)

    actual suspend fun updateProfileVisibility(userId: String, isSearchable: Boolean): Result<Unit> =
        users.updateProfileVisibility(userId, isSearchable)

    actual suspend fun getFieldOwners(): Result<List<User>> =
        users.getFieldOwners()

    actual suspend fun updateFcmToken(token: String): Result<Unit> =
        users.updateFcmToken(token)

    actual suspend fun getAllFavoriteTeams(): Result<List<FavoriteTeam>> =
        users.getAllFavoriteTeams()

    actual suspend fun getFavoriteTeamById(teamId: String): Result<FavoriteTeam> =
        users.getFavoriteTeamById(teamId)

    actual fun getAuthStateFlow(): Flow<String?> =
        users.getAuthStateFlow()

    actual fun isLoggedIn(): Boolean =
        users.isLoggedIn()

    actual fun getCurrentAuthUserId(): String? =
        users.getCurrentAuthUserId()

    actual suspend fun getCurrentAuthUser(): Result<User> =
        users.getCurrentAuthUser()

    actual suspend fun signInWithEmailPassword(email: String, password: String): Result<String> =
        users.signInWithEmailPassword(email, password)

    actual suspend fun signUpWithEmailPassword(email: String, password: String): Result<String> =
        users.signUpWithEmailPassword(email, password)

    actual suspend fun sendPasswordResetEmail(email: String): Result<Unit> =
        users.sendPasswordResetEmail(email)

    actual suspend fun logout(): Unit =
        users.logout()

    actual suspend fun getMyNotifications(limit: Int): Result<List<AppNotification>> =
        users.getMyNotifications(limit)

    actual fun getMyNotificationsFlow(limit: Int): Flow<List<AppNotification>> =
        users.getMyNotificationsFlow(limit)

    actual suspend fun getUnreadNotifications(): Result<List<AppNotification>> =
        users.getUnreadNotifications()

    actual fun getUnreadCountFlow(): Flow<Int> =
        users.getUnreadCountFlow()

    actual suspend fun getUnreadCount(): Result<Int> =
        users.getUnreadCount()

    actual suspend fun markNotificationAsRead(notificationId: String): Result<Unit> =
        users.markNotificationAsRead(notificationId)

    actual suspend fun markNotificationAsUnread(notificationId: String): Result<Unit> =
        users.markNotificationAsUnread(notificationId)

    actual suspend fun markAllNotificationsAsRead(): Result<Unit> =
        users.markAllNotificationsAsRead()

    actual suspend fun getNotificationById(notificationId: String): Result<AppNotification> =
        users.getNotificationById(notificationId)

    actual suspend fun createNotification(notification: AppNotification): Result<String> =
        users.createNotification(notification)

    actual suspend fun batchCreateNotifications(notifications: List<AppNotification>): Result<Unit> =
        users.batchCreateNotifications(notifications)

    actual suspend fun deleteNotification(notificationId: String): Result<Unit> =
        users.deleteNotification(notificationId)

    actual suspend fun deleteOldNotifications(): Result<Int> =
        users.deleteOldNotifications()

    actual suspend fun getNotificationsByType(type: NotificationType, limit: Int): Result<List<AppNotification>> =
        users.getNotificationsByType(type, limit)

    actual suspend fun getPendingActionNotifications(): Result<List<AppNotification>> =
        users.getPendingActionNotifications()

    // ========== FINANCE ==========
    actual suspend fun executeBatch(operations: List<BatchOperation>): Result<Unit> =
        finance.executeBatch(operations)

    actual suspend fun getLivePlayerStats(gameId: String): Result<List<LivePlayerStats>> =
        finance.getLivePlayerStats(gameId)

    actual fun getLivePlayerStatsFlow(gameId: String): Flow<Result<List<LivePlayerStats>>> =
        finance.getLivePlayerStatsFlow(gameId)

    actual suspend fun finishGame(gameId: String): Result<Unit> =
        finance.finishGame(gameId)

    actual suspend fun clearAllLiveGameData(): Result<Unit> =
        finance.clearAllLiveGameData()

    actual suspend fun createPayment(payment: Payment): Result<Payment> =
        finance.createPayment(payment)

    actual suspend fun confirmPayment(paymentId: String): Result<Unit> =
        finance.confirmPayment(paymentId)

    actual suspend fun getPaymentsByUser(userId: String): Result<List<Payment>> =
        finance.getPaymentsByUser(userId)

    actual suspend fun uploadCashboxReceipt(groupId: String, filePath: String): Result<String> =
        finance.uploadCashboxReceipt(groupId, filePath)

    actual suspend fun addCashboxEntry(groupId: String, entry: CashboxEntry, receiptFilePath: String?): Result<String> =
        finance.addCashboxEntry(groupId, entry, receiptFilePath)

    actual suspend fun getCashboxSummary(groupId: String): Result<CashboxSummary> =
        finance.getCashboxSummary(groupId)

    actual fun getCashboxSummaryFlow(groupId: String): Flow<Result<CashboxSummary>> =
        finance.getCashboxSummaryFlow(groupId)

    actual suspend fun getCashboxHistory(groupId: String, limit: Int): Result<List<CashboxEntry>> =
        finance.getCashboxHistory(groupId, limit)

    actual fun getCashboxHistoryFlow(groupId: String, limit: Int): Flow<Result<List<CashboxEntry>>> =
        finance.getCashboxHistoryFlow(groupId, limit)

    actual suspend fun getCashboxHistoryFiltered(groupId: String, filter: CashboxFilter, limit: Int): Result<List<CashboxEntry>> =
        finance.getCashboxHistoryFiltered(groupId, filter, limit)

    actual suspend fun getCashboxEntriesByMonth(groupId: String, year: Int, month: Int): Result<List<CashboxEntry>> =
        finance.getCashboxEntriesByMonth(groupId, year, month)

    actual suspend fun getCashboxEntryById(groupId: String, entryId: String): Result<CashboxEntry> =
        finance.getCashboxEntryById(groupId, entryId)

    actual suspend fun deleteCashboxEntry(groupId: String, entryId: String): Result<Unit> =
        finance.deleteCashboxEntry(groupId, entryId)

    actual suspend fun recalculateCashboxBalance(groupId: String): Result<CashboxSummary> =
        finance.recalculateCashboxBalance(groupId)

    // ========== GAMIFICATION ==========
    actual suspend fun getUserXpLogs(userId: String, limit: Int): Result<List<XpLog>> =
        gamification.getUserXpLogs(userId, limit)

    actual suspend fun createXpLog(xpLog: XpLog): Result<XpLog> =
        gamification.createXpLog(xpLog)

    actual suspend fun updateUserLevel(userId: String, level: Int, xp: Long): Result<Unit> =
        gamification.updateUserLevel(userId, level, xp)

    actual suspend fun awardBadge(userId: String, badgeId: String): Result<Unit> =
        gamification.awardBadge(userId, badgeId)

    actual suspend fun unlockMilestone(userId: String, milestoneId: String): Result<Unit> =
        gamification.unlockMilestone(userId, milestoneId)

    actual suspend fun getRankingByCategory(category: String, field: String, limit: Int): Result<List<Triple<String, Long, Int>>> =
        gamification.getRankingByCategory(category, field, limit)

    actual suspend fun getRankingDeltas(periodName: String, periodKey: String, deltaField: String, minGames: Int, limit: Int): Result<List<Triple<String, Long, Int>>> =
        gamification.getRankingDeltas(periodName, periodKey, deltaField, minGames, limit)

    actual suspend fun getUsersStatistics(userIds: List<String>): Result<Map<String, Statistics>> =
        gamification.getUsersStatistics(userIds)

    actual suspend fun getStatisticsRanking(orderByField: String, limit: Int): Result<List<Statistics>> =
        gamification.getStatisticsRanking(orderByField, limit)

    actual suspend fun getUserStreak(userId: String): Result<UserStreak?> =
        gamification.getUserStreak(userId)

    actual suspend fun saveUserStreak(streak: UserStreak): Result<Unit> =
        gamification.saveUserStreak(streak)

    actual suspend fun getAvailableBadges(): Result<List<BadgeDefinition>> =
        gamification.getAvailableBadges()

    actual suspend fun getUserBadges(userId: String): Result<List<UserBadge>> =
        gamification.getUserBadges(userId)

    actual suspend fun getRecentBadges(userId: String, limit: Int): Result<List<UserBadge>> =
        gamification.getRecentBadges(userId, limit)

    actual suspend fun createUserBadge(userBadge: UserBadge): Result<UserBadge> =
        gamification.createUserBadge(userBadge)

    actual suspend fun updateUserBadge(userBadge: UserBadge): Result<Unit> =
        gamification.updateUserBadge(userBadge)

    actual suspend fun getActiveSeason(): Result<Season?> =
        gamification.getActiveSeason()

    actual suspend fun getAllSeasons(): Result<List<Season>> =
        gamification.getAllSeasons()

    actual suspend fun getSeasonRanking(seasonId: String, limit: Int): Result<List<SeasonParticipation>> =
        gamification.getSeasonRanking(seasonId, limit)

    actual fun observeSeasonRanking(seasonId: String, limit: Int, gender: String?): Flow<List<SeasonParticipation>> =
        gamification.observeSeasonRanking(seasonId, limit, gender)

    actual suspend fun getSeasonParticipation(seasonId: String, userId: String): Result<SeasonParticipation?> =
        gamification.getSeasonParticipation(seasonId, userId)

    actual suspend fun saveSeasonParticipation(participation: SeasonParticipation): Result<Unit> =
        gamification.saveSeasonParticipation(participation)

    actual suspend fun getActiveChallenges(): Result<List<WeeklyChallenge>> =
        gamification.getActiveChallenges()

    actual suspend fun getChallengesProgress(userId: String, challengeIds: List<String>): Result<List<UserChallengeProgress>> =
        gamification.getChallengesProgress(userId, challengeIds)

    // ========== LOCATIONS ==========
    actual suspend fun getAllLocations(): Result<List<Location>> =
        locations.getAllLocations()

    actual suspend fun getLocationsByCity(city: String, state: String?): Result<List<Location>> =
        locations.getLocationsByCity(city, state)

    actual suspend fun getLocationsByStates(states: List<String>): Result<List<Location>> =
        locations.getLocationsByStates(states)

    actual suspend fun getLocationsInLatitudeBand(minLatitude: Double, maxLatitude: Double): Result<List<Location>> =
        locations.getLocationsInLatitudeBand(minLatitude, maxLatitude)

    actual suspend fun getLocationsWithPagination(limit: Int, lastLocationName: String?): Result<List<Location>> =
        locations.getLocationsWithPagination(limit, lastLocationName)

    actual suspend fun getLocationsPaginated(pageSize: Int, cursor: String?, sortBy: LocationSortField): Result<PaginatedResult<Location>> =
        locations.getLocationsPaginated(pageSize, cursor, sortBy)

    actual suspend fun deleteLocation(locationId: String): Result<Unit> =
        locations.deleteLocation(locationId)

    actual suspend fun deleteLocationWithFields(locationId: String): Result<Int> =
        locations.deleteLocationWithFields(locationId)

    actual suspend fun getLocationsByOwner(ownerId: String): Result<List<Location>> =
        locations.getLocationsByOwner(ownerId)

    actual suspend fun getLocationById(locationId: String): Result<Location> =
        locations.getLocationById(locationId)

    actual suspend fun getLocationWithFields(locationId: String): Result<LocationWithFields> =
        locations.getLocationWithFields(locationId)

    actual suspend fun createLocation(location: Location): Result<Location> =
        locations.createLocation(location)

    actual suspend fun updateLocation(location: Location): Result<Unit> =
        locations.updateLocation(location)

    actual suspend fun searchLocations(query: String): Result<List<Location>> =
        locations.searchLocations(query)

    actual suspend fun getOrCreateLocationFromPlace(placeId: String, name: String, address: String, city: String, state: String, latitude: Double?, longitude: Double?): Result<Location> =
        locations.getOrCreateLocationFromPlace(placeId, name, address, city, state, latitude, longitude)

    actual suspend fun addLocationReview(review: LocationReview): Result<Unit> =
        locations.addLocationReview(review)

    actual suspend fun getLocationReviews(locationId: String): Result<List<LocationReview>> =
        locations.getLocationReviews(locationId)

    actual suspend fun seedGinasioApollo(): Result<Location> =
        locations.seedGinasioApollo()

    actual suspend fun migrateLocations(migrationData: List<LocationMigrationData>): Result<Int> =
        locations.migrateLocations(migrationData)

    actual suspend fun deduplicateLocations(): Result<Int> =
        locations.deduplicateLocations()

    actual suspend fun getFieldsByLocation(locationId: String): Result<List<Field>> =
        locations.getFieldsByLocation(locationId)

    actual suspend fun getFieldById(fieldId: String): Result<Field> =
        locations.getFieldById(fieldId)

    actual suspend fun createField(field: Field): Result<Field> =
        locations.createField(field)

    actual suspend fun updateField(field: Field): Result<Unit> =
        locations.updateField(field)

    actual suspend fun deleteField(fieldId: String): Result<Unit> =
        locations.deleteField(fieldId)

    actual suspend fun uploadFieldPhoto(filePath: String): Result<String> =
        locations.uploadFieldPhoto(filePath)

    actual suspend fun logLocationAudit(log: LocationAuditLog): Result<Unit> =
        locations.logLocationAudit(log)

    actual suspend fun getLocationAuditLogs(locationId: String, limit: Int): Result<List<LocationAuditLog>> =
        locations.getLocationAuditLogs(locationId, limit)

}
