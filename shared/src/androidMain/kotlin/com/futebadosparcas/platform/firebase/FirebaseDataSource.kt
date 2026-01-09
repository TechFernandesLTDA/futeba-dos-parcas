package com.futebadosparcas.platform.firebase

import com.futebadosparcas.domain.model.*
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.*
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import java.util.Date

/**
 * Implementação Android do FirebaseDataSource usando Firebase Android SDK.
 *
 * NOTA: Esta é uma implementação inicial. A versão completa com retry policy,
 * logging avançado e otimizações será migrada na Fase 3 quando os repositórios
 * forem movidos para o shared module.
 *
 * @param firestore FirebaseFirestore instance
 * @param auth FirebaseAuth instance
 */
actual class FirebaseDataSource(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth
) {

    companion object {
        private const val COLLECTION_GAMES = "games"
        private const val COLLECTION_CONFIRMATIONS = "confirmations"
        private const val COLLECTION_TEAMS = "teams"
        private const val COLLECTION_STATISTICS = "statistics"
        private const val COLLECTION_USERS = "users"
        private const val COLLECTION_GROUPS = "groups"
        private const val COLLECTION_USER_GROUPS = "user_groups"
        private const val COLLECTION_XP_LOGS = "xp_logs"
    }

    // ========== GAMES ==========

    actual suspend fun getUpcomingGames(limit: Int): Result<List<Game>> {
        return try {
            val now = Date()
            val snapshot = firestore.collection(COLLECTION_GAMES)
                .whereGreaterThanOrEqualTo("dateTime", now)
                .orderBy("dateTime", Query.Direction.ASCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            Result.success(snapshot.documents.mapNotNull { it.toGameOrNull() })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual fun getUpcomingGamesFlow(limit: Int): Flow<Result<List<Game>>> = callbackFlow {
        val now = Date()
        val listener = firestore.collection(COLLECTION_GAMES)
            .whereGreaterThanOrEqualTo("dateTime", now)
            .orderBy("dateTime", Query.Direction.ASCENDING)
            .limit(limit.toLong())
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }
                if (snapshot != null) {
                    trySend(Result.success(snapshot.documents.mapNotNull { it.toGameOrNull() }))
                }
            }

        awaitClose { listener.remove() }
    }

    actual suspend fun getGameById(gameId: String): Result<Game> {
        return try {
            val doc = firestore.collection(COLLECTION_GAMES)
                .document(gameId)
                .get()
                .await()

            val game = doc.toGameOrNull()
                ?: return Result.failure(Exception("Jogo não encontrado"))
            Result.success(game)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual fun getGameByIdFlow(gameId: String): Flow<Result<Game>> = callbackFlow {
        val listener = firestore.collection(COLLECTION_GAMES)
            .document(gameId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }
                if (snapshot != null && snapshot.exists()) {
                    val game = snapshot.toGameOrNull()
                    if (game != null) {
                        trySend(Result.success(game))
                    }
                }
            }

        awaitClose { listener.remove() }
    }

    actual suspend fun getConfirmedGamesForUser(userId: String): Result<List<Game>> {
        return try {
            // 1. Buscar confirmações do usuário
            val confirmations = firestore.collection(COLLECTION_CONFIRMATIONS)
                .whereEqualTo("user_id", userId)
                .whereEqualTo("status", "CONFIRMED")
                .get()
                .await()
                .documents.mapNotNull { it.toGameConfirmationOrNull() }

            // 2. Extrair IDs únicos de jogos
            val gameIds = confirmations.map { it.gameId }.distinct()
            if (gameIds.isEmpty()) {
                return Result.success(emptyList())
            }

            // 3. Buscar jogos em chunks (whereIn limit = 10)
            val games = mutableListOf<Game>()
            gameIds.chunked(10).forEach { chunk ->
                val snapshot = firestore.collection(COLLECTION_GAMES)
                    .whereIn(FieldPath.documentId(), chunk)
                    .get()
                    .await()
                games.addAll(snapshot.documents.mapNotNull { it.toGameOrNull() })
            }

            // 4. Ordenar por data
            Result.success(games.sortedBy { it.createdAt })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun getGamesByGroup(groupId: String, limit: Int): Result<List<Game>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_GAMES)
                .whereEqualTo("groupId", groupId)
                .orderBy("dateTime", Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            Result.success(snapshot.documents.mapNotNull { it.toGameOrNull() })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun getPublicGames(limit: Int): Result<List<Game>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_GAMES)
                .whereEqualTo("visibility", "PUBLIC")
                .limit(limit.toLong())
                .get()
                .await()

            Result.success(snapshot.documents.mapNotNull { it.toGameOrNull() })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun createGame(game: Game): Result<Game> {
        return try {
            val docRef = firestore.collection(COLLECTION_GAMES).document()
            val gameWithId = game.copy(id = docRef.id)
            docRef.set(gameWithId).await()
            Result.success(gameWithId)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun updateGame(gameId: String, updates: Map<String, Any>): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_GAMES)
                .document(gameId)
                .update(updates)
                .await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun deleteGame(gameId: String): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_GAMES)
                .document(gameId)
                .delete()
                .await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ========== CONFIRMATIONS ==========

    actual suspend fun getGameConfirmations(gameId: String): Result<List<GameConfirmation>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_CONFIRMATIONS)
                .whereEqualTo("gameId", gameId)
                .get()
                .await()

            Result.success(snapshot.documents.mapNotNull { it.toGameConfirmationOrNull() })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual fun getGameConfirmationsFlow(gameId: String): Flow<Result<List<GameConfirmation>>> = callbackFlow {
        val listener = firestore.collection(COLLECTION_CONFIRMATIONS)
            .whereEqualTo("gameId", gameId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }
                if (snapshot != null) {
                    trySend(Result.success(snapshot.documents.mapNotNull { it.toGameConfirmationOrNull() }))
                }
            }

        awaitClose { listener.remove() }
    }

    actual suspend fun confirmPresence(
        gameId: String,
        userId: String,
        userName: String,
        userPhoto: String?,
        position: String,
        isCasualPlayer: Boolean
    ): Result<GameConfirmation> {
        return try {
            val confirmation = GameConfirmation(
                id = "",
                gameId = gameId,
                userId = userId,
                userName = userName,
                userPhoto = userPhoto,
                position = position,
                isCasualPlayer = isCasualPlayer
            )

            val docRef = firestore.collection(COLLECTION_CONFIRMATIONS).document()
            val confirmationWithId = confirmation.copy(id = docRef.id)
            docRef.set(confirmationWithId).await()
            Result.success(confirmationWithId)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun cancelConfirmation(gameId: String, userId: String): Result<Unit> {
        return try {
            val query = firestore.collection(COLLECTION_CONFIRMATIONS)
                .whereEqualTo("gameId", gameId)
                .whereEqualTo("userId", userId)
                .get()
                .await()

            query.documents.forEach { it.reference.delete().await() }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun updatePaymentStatus(gameId: String, userId: String, isPaid: Boolean): Result<Unit> {
        return try {
            val snapshot = firestore.collection(COLLECTION_CONFIRMATIONS)
                .whereEqualTo("game_id", gameId)
                .whereEqualTo("user_id", userId)
                .get()
                .await()

            if (snapshot.isEmpty) {
                return Result.failure(NoSuchElementException("Confirmação não encontrada"))
            }

            val status = if (isPaid) "PAID" else "PENDING"
            val batch = firestore.batch()
            snapshot.documents.forEach { doc ->
                batch.update(doc.reference, "payment_status", status)
            }
            batch.commit().await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ========== TEAMS ==========

    actual suspend fun getGameTeams(gameId: String): Result<List<Team>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_TEAMS)
                .whereEqualTo("game_id", gameId)
                .get()
                .await()

            Result.success(snapshot.documents.mapNotNull { it.toTeamOrNull() })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual fun getGameTeamsFlow(gameId: String): Flow<Result<List<Team>>> = callbackFlow {
        val listener = firestore.collection(COLLECTION_TEAMS)
            .whereEqualTo("game_id", gameId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }
                if (snapshot != null) {
                    val teams = snapshot.documents.mapNotNull { it.toTeamOrNull() }
                    trySend(Result.success(teams))
                }
            }

        awaitClose { listener.remove() }
    }

    actual suspend fun saveTeams(gameId: String, teams: List<Team>): Result<Unit> {
        return try {
            val batch = firestore.batch()

            teams.forEach { team ->
                val docRef = firestore.collection(COLLECTION_TEAMS).document()
                val teamData = mapOf(
                    "id" to docRef.id,
                    "game_id" to gameId,
                    "name" to team.name,
                    "color" to team.color,
                    "player_ids" to team.playerIds,
                    "score" to team.score
                )
                batch.set(docRef, teamData)
            }

            batch.commit().await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun clearGameTeams(gameId: String): Result<Unit> {
        return try {
            val snapshot = firestore.collection(COLLECTION_TEAMS)
                .whereEqualTo("game_id", gameId)
                .get()
                .await()

            val batch = firestore.batch()
            snapshot.documents.forEach { doc ->
                batch.delete(doc.reference)
            }
            batch.commit().await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ========== STATISTICS ==========

    actual suspend fun getUserStatistics(userId: String): Result<Statistics> {
        return try {
            val doc = firestore.collection(COLLECTION_STATISTICS)
                .document(userId)
                .get()
                .await()

            val stats = doc.toStatisticsOrNull()
                ?: Statistics(userId = userId) // Retorna stats zerada se não existir
            Result.success(stats)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual fun getUserStatisticsFlow(userId: String): Flow<Result<Statistics>> = callbackFlow {
        val listener = firestore.collection(COLLECTION_STATISTICS)
            .document(userId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }
                val stats = snapshot?.toStatisticsOrNull() ?: Statistics(userId = userId)
                trySend(Result.success(stats))
            }

        awaitClose { listener.remove() }
    }

    actual suspend fun updateUserStatistics(userId: String, updates: Map<String, Any>): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_STATISTICS)
                .document(userId)
                .update(updates)
                .await()
            Result.success(Unit)
        } catch (e: Exception) {
            // Se o documento não existir, criar com as atualizações
            try {
                firestore.collection(COLLECTION_STATISTICS)
                    .document(userId)
                    .set(updates, SetOptions.merge())
                    .await()
                Result.success(Unit)
            } catch (innerE: Exception) {
                Result.failure(innerE)
            }
        }
    }

    // ========== USERS ==========

    actual suspend fun getUserById(userId: String): Result<User> {
        return try {
            val doc = firestore.collection(COLLECTION_USERS)
                .document(userId)
                .get()
                .await()

            val user = doc.toUserOrNull()
                ?: return Result.failure(Exception("Usuário não encontrado"))

            Result.success(user)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun getUsersByIds(userIds: List<String>): Result<List<User>> {
        return try {
            if (userIds.isEmpty()) return Result.success(emptyList())

            val chunks = userIds.chunked(10)
            val allUsers = mutableListOf<User>()

            for (chunk in chunks) {
                val snapshot = firestore.collection(COLLECTION_USERS)
                    .whereIn(FieldPath.documentId(), chunk)
                    .get()
                    .await()
                allUsers.addAll(snapshot.documents.mapNotNull { doc -> 
                    doc.toUserOrNull() 
                })
            }

            Result.success(allUsers)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun getCurrentUser(): Result<User> {
        val uid = auth.currentUser?.uid
            ?: return Result.failure(Exception("Usuário não autenticado"))
            
        android.util.Log.d("FirebaseDataSource", "getCurrentUser: fetching from Firebase for uid=$uid")
        
        return getUserById(uid).onSuccess { user ->
             android.util.Log.d("FirebaseDataSource", "getCurrentUser: retrieved ${user.name}, Level=${user.level}")
        }
    }

    actual fun getCurrentUserId(): String? {
        return auth.currentUser?.uid
    }

    actual suspend fun updateUser(userId: String, updates: Map<String, Any>): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_USERS)
                .document(userId)
                .update(updates)
                .await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun searchUsers(query: String, limit: Int): Result<List<User>> {
        android.util.Log.d("FirebaseDataSource", "searchUsers called with query='$query', limit=$limit")
        return try {
            val collection = firestore.collection(COLLECTION_USERS)
            
            val snapshot = if (query.isBlank()) {
                collection
                    .limit(limit.toLong())
                    .get()
                    .await()
            } else {
                collection
                    .orderBy("name")
                    .startAt(query)
                    .endAt(query + "\uf8ff")
                    .limit(limit.toLong())
                    .get()
                    .await()
            }
            
            android.util.Log.d("FirebaseDataSource", "searchUsers query success. Documents found: ${snapshot.documents.size}")
            
            val users = snapshot.documents.mapNotNull { 
                val user = it.toUserOrNull()
                if (user == null) {
                   android.util.Log.w("FirebaseDataSource", "Failed to map document ${it.id} to User")
                }
                user
            }
            
            android.util.Log.d("FirebaseDataSource", "searchUsers mapped ${users.size} users successfully")
            if (users.isNotEmpty()) {
                android.util.Log.d("FirebaseDataSource", "Sample user: ${users.first().name}")
            }
            
            Result.success(users)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "searchUsers failed", e)
            Result.failure(e)
        }
    }

    // ========== GROUPS ==========

    actual suspend fun getUserGroups(userId: String): Result<List<UserGroup>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_USER_GROUPS)
                .whereEqualTo("userId", userId)
                .get()
                .await()

            val userGroups = snapshot.documents.mapNotNull { it.toUserGroupOrNull() }
            Result.success<List<UserGroup>>(userGroups)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual fun getUserGroupsFlow(userId: String): Flow<Result<List<UserGroup>>> = callbackFlow {
        val listener = firestore.collection(COLLECTION_USER_GROUPS)
            .whereEqualTo("userId", userId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }
                if (snapshot != null) {
                    val groups = snapshot.documents.mapNotNull { it.toUserGroupOrNull() }
                    trySend(Result.success(groups))
                }
            }

        awaitClose { listener.remove() }
    }

    actual suspend fun getGroupById(groupId: String): Result<UserGroup> {
        return try {
            val doc = firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .get()
                .await()

            if (!doc.exists()) {
                return Result.failure(NoSuchElementException("Grupo não encontrado: $groupId"))
            }

            val group = doc.toUserGroupOrNull()
                ?: return Result.failure(IllegalStateException("Erro ao converter grupo"))

            Result.success(group)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ========== XP LOGS ==========

    actual suspend fun getUserXpLogs(userId: String, limit: Int): Result<List<XpLog>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_XP_LOGS)
                .whereEqualTo("userId", userId)
                .orderBy("timestamp", Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val logs = snapshot.documents.mapNotNull { it.toXpLogOrNull() }
            Result.success<List<XpLog>>(logs)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ========== XP/GAMIFICATION ==========

    actual suspend fun createXpLog(xpLog: XpLog): Result<XpLog> {
        return try {
            val docRef = firestore.collection(COLLECTION_XP_LOGS).document()
            val xpLogData = mapOf(
                "id" to docRef.id,
                "user_id" to xpLog.userId,
                "game_id" to xpLog.gameId,
                "xp_earned" to xpLog.xpEarned,
                "xp_before" to xpLog.xpBefore,
                "xp_after" to xpLog.xpAfter,
                "level_before" to xpLog.levelBefore,
                "level_after" to xpLog.levelAfter,
                "xp_participation" to xpLog.xpParticipation,
                "xp_goals" to xpLog.xpGoals,
                "xp_assists" to xpLog.xpAssists,
                "xp_saves" to xpLog.xpSaves,
                "xp_result" to xpLog.xpResult,
                "xp_mvp" to xpLog.xpMvp,
                "xp_milestones" to xpLog.xpMilestones,
                "xp_streak" to xpLog.xpStreak,
                "goals" to xpLog.goals,
                "assists" to xpLog.assists,
                "saves" to xpLog.saves,
                "was_mvp" to xpLog.wasMvp,
                "game_result" to xpLog.gameResult,
                "milestones_unlocked" to xpLog.milestonesUnlocked,
                "created_at" to com.google.firebase.firestore.FieldValue.serverTimestamp()
            )
            docRef.set(xpLogData).await()
            Result.success(xpLog.copy(id = docRef.id))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun updateUserLevel(userId: String, level: Int, xp: Long): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_USERS)
                .document(userId)
                .update(
                    mapOf(
                        "level" to level,
                        "experience_points" to xp
                    )
                )
                .await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun awardBadge(userId: String, badgeId: String): Result<Unit> {
        return try {
            val docRef = firestore.collection("user_badges").document()
            val badgeData = mapOf(
                "id" to docRef.id,
                "user_id" to userId,
                "badge_id" to badgeId,
                "unlocked_at" to com.google.firebase.firestore.FieldValue.serverTimestamp()
            )
            docRef.set(badgeData).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun updateStreak(userId: String, streak: Int, lastGameDate: Long): Result<Unit> {
        return try {
            firestore.collection("user_streaks")
                .document(userId)
                .set(
                    mapOf(
                        "user_id" to userId,
                        "current_streak" to streak,
                        "last_game_date" to lastGameDate,
                        "updated_at" to com.google.firebase.firestore.FieldValue.serverTimestamp()
                    ),
                    SetOptions.merge()
                )
                .await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun unlockMilestone(userId: String, milestoneId: String): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_USERS)
                .document(userId)
                .update(
                    "milestones_achieved",
                    com.google.firebase.firestore.FieldValue.arrayUnion(milestoneId)
                )
                .await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ========== LIVE GAME ==========

    actual suspend fun createLiveGame(gameId: String): Result<Unit> {
        return try {
            val liveScoreData = mapOf(
                "game_id" to gameId,
                "team1_score" to 0,
                "team2_score" to 0,
                "started_at" to com.google.firebase.firestore.FieldValue.serverTimestamp()
            )
            firestore.collection("live_scores")
                .document(gameId)
                .set(liveScoreData)
                .await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun updateLiveScore(gameId: String, team1Score: Int, team2Score: Int): Result<Unit> {
        return try {
            firestore.collection("live_scores")
                .document(gameId)
                .update(
                    mapOf(
                        "team1_score" to team1Score,
                        "team2_score" to team2Score
                    )
                )
                .await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun addGameEvent(gameId: String, event: GameEvent): Result<GameEvent> {
        return try {
            val docRef = firestore.collection("game_events").document()
            val eventData = mapOf(
                "id" to docRef.id,
                "game_id" to gameId,
                "event_type" to event.eventType,
                "player_id" to event.playerId,
                "player_name" to event.playerName,
                "team_id" to event.teamId,
                "assisted_by_id" to event.assistedById,
                "assisted_by_name" to event.assistedByName,
                "minute" to event.minute,
                "created_by" to event.createdBy,
                "created_at" to com.google.firebase.firestore.FieldValue.serverTimestamp()
            )
            docRef.set(eventData).await()
            Result.success(event.copy(id = docRef.id))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun getGameEvents(gameId: String): Result<List<GameEvent>> {
        return try {
            val snapshot = firestore.collection("game_events")
                .whereEqualTo("game_id", gameId)
                .orderBy("minute", Query.Direction.ASCENDING)
                .get()
                .await()
            Result.success(snapshot.documents.mapNotNull { it.toGameEventOrNull() })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual fun getGameEventsFlow(gameId: String): Flow<Result<List<GameEvent>>> = callbackFlow {
        val listener = firestore.collection("game_events")
            .whereEqualTo("game_id", gameId)
            .orderBy("minute", Query.Direction.ASCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }
                if (snapshot != null) {
                    val events = snapshot.documents.mapNotNull { it.toGameEventOrNull() }
                    trySend(Result.success(events))
                }
            }
        awaitClose { listener.remove() }
    }

    actual fun getLiveScoreFlow(gameId: String): Flow<Result<LiveScore>> = callbackFlow {
        val listener = firestore.collection("live_scores")
            .document(gameId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }
                if (snapshot != null && snapshot.exists()) {
                    val score = snapshot.toLiveScoreOrNull()
                    if (score != null) {
                        trySend(Result.success(score))
                    }
                }
            }
        awaitClose { listener.remove() }
    }

    // ========== GROUPS MANAGEMENT ==========

    actual suspend fun createGroup(group: Group): Result<Group> {
        return try {
            val docRef = firestore.collection(COLLECTION_GROUPS).document()
            val groupData = mapOf(
                "id" to docRef.id,
                "name" to group.name,
                "description" to group.description,
                "photo_url" to group.photoUrl,
                "owner_id" to group.ownerId,
                "is_active" to true,
                "created_at" to com.google.firebase.firestore.FieldValue.serverTimestamp()
            )
            docRef.set(groupData).await()
            Result.success(group.copy(id = docRef.id))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun updateGroup(groupId: String, updates: Map<String, Any>): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .update(updates)
                .await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun getGroupMembers(groupId: String): Result<List<GroupMember>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection("members")
                .get()
                .await()
            Result.success(snapshot.documents.mapNotNull { it.toGroupMemberOrNull() })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun addGroupMember(groupId: String, userId: String, role: String): Result<Unit> {
        return try {
            val memberData = mapOf(
                "user_id" to userId,
                "role" to role,
                "joined_at" to com.google.firebase.firestore.FieldValue.serverTimestamp()
            )
            firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection("members")
                .document(userId)
                .set(memberData)
                .await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun removeGroupMember(groupId: String, userId: String): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection("members")
                .document(userId)
                .delete()
                .await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun getGroupDetails(groupId: String): Result<Group> {
        return try {
            val doc = firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .get()
                .await()

            if (!doc.exists()) {
                return Result.failure(NoSuchElementException("Grupo não encontrado: $groupId"))
            }

            val group = doc.toGroupOrNull()
                ?: return Result.failure(IllegalStateException("Erro ao converter grupo"))

            Result.success(group)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ========== BATCH OPERATIONS ==========

    actual suspend fun executeBatch(operations: List<BatchOperation>): Result<Unit> {
        return try {
            val batch = firestore.batch()

            operations.forEach { operation ->
                when (operation) {
                    is BatchOperation.Set -> {
                        val ref = firestore.collection(operation.collection).document(operation.documentId)
                        batch.set(ref, operation.data)
                    }
                    is BatchOperation.Update -> {
                        val ref = firestore.collection(operation.collection).document(operation.documentId)
                        batch.update(ref, operation.updates)
                    }
                    is BatchOperation.Delete -> {
                        val ref = firestore.collection(operation.collection).document(operation.documentId)
                        batch.delete(ref)
                    }
                }
            }

            batch.commit().await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

/**
 * Helper para pegar Long de forma segura, tratando Number, Timestamp ou String.
 */
private fun DocumentSnapshot.safeLong(field: String): Long? {
    val value = get(field)
    return when (value) {
        is Number -> value.toLong()
        is com.google.firebase.Timestamp -> value.toDate().time
        is String -> value.toLongOrNull()
        else -> null
    }
}

/**
 * Helper para pegar Int de forma segura.
 */
private fun DocumentSnapshot.safeInt(field: String): Int? {
    return safeLong(field)?.toInt()
}

/**
 * Extensão para converter DocumentSnapshot para User com mapeamento manual.
 * 
 * Esta abordagem é necessária porque o domain.model.User usa @SerialName 
 * (kotlinx.serialization) enquanto o Firebase SDK espera @PropertyName.
 * 
 * @return User ou null se o documento não existir
 */
private fun DocumentSnapshot.toUserOrNull(): User? {
    if (!exists()) return null
    
    return User(
        id = id,
        email = getString("email") ?: "",
        name = getString("name") ?: "",
        phone = getString("phone"),
        nickname = getString("nickname"),
        photoUrl = getString("photo_url") ?: getString("photoUrl"),
        fcmToken = getString("fcm_token") ?: getString("fcmToken"),
        isSearchable = getBoolean("is_searchable") ?: getBoolean("isSearchable") ?: true,
        isProfilePublic = getBoolean("is_profile_public") ?: getBoolean("isProfilePublic") ?: true,
        role = getString("role") ?: UserRole.PLAYER.name,
        createdAt = safeLong("created_at") ?: safeLong("createdAt"),
        updatedAt = safeLong("updated_at") ?: safeLong("updatedAt"),

        // Ratings manuais
        strikerRating = getDouble("striker_rating") ?: getDouble("strikerRating") ?: 0.0,
        midRating = getDouble("mid_rating") ?: getDouble("midRating") ?: 0.0,
        defenderRating = getDouble("defender_rating") ?: getDouble("defenderRating") ?: 0.0,
        gkRating = getDouble("gk_rating") ?: getDouble("gkRating") ?: 0.0,

        // Preferências
        preferredPosition = getString("preferred_position") ?: getString("preferredPosition"),
        preferredFieldTypes = ((get("preferred_field_types") ?: get("preferredFieldTypes")) as? List<*>)?.mapNotNull { item ->
            (item as? String)?.let { name ->
                try { FieldType.valueOf(name) } catch (e: Exception) { null }
            }
        } ?: emptyList(),

        // Informações Pessoais
        birthDate = safeLong("birth_date") ?: safeLong("birthDate"),
        gender = getString("gender"),
        heightCm = safeInt("height_cm") ?: safeInt("heightCm"),
        weightKg = safeInt("weight_kg") ?: safeInt("weightKg"),
        dominantFoot = getString("dominant_foot") ?: getString("dominantFoot"),
        primaryPosition = getString("primary_position") ?: getString("primaryPosition"),
        secondaryPosition = getString("secondary_position") ?: getString("secondaryPosition"),
        playStyle = getString("play_style") ?: getString("playStyle"),
        experienceYears = safeInt("experience_years") ?: safeInt("experienceYears"),

        // Gamificação
        level = safeInt("level") ?: 1,
        experiencePoints = safeLong("experience_points") ?: safeLong("experiencePoints") ?: 0L,
        milestonesAchieved = ((get("milestones_achieved") ?: get("milestonesAchieved")) as? List<*>)?.mapNotNull { it as? String } ?: emptyList(),

        // Ratings Automáticos
        autoStrikerRating = getDouble("auto_striker_rating") ?: 0.0,
        autoMidRating = getDouble("auto_mid_rating") ?: 0.0,
        autoDefenderRating = getDouble("auto_defender_rating") ?: 0.0,
        autoGkRating = getDouble("auto_gk_rating") ?: 0.0,
        autoRatingSamples = safeInt("auto_rating_samples") ?: 0
    )
}

/**
 * Extensão para converter DocumentSnapshot para Game com mapeamento manual.
 */
private fun DocumentSnapshot.toGameOrNull(): Game? {
    if (!exists()) return null
    return Game(
        id = id,
        scheduleId = getString("schedule_id") ?: getString("scheduleId") ?: "",
        date = getString("date") ?: "",
        time = getString("time") ?: "",
        endTime = getString("end_time") ?: getString("endTime") ?: "",
        status = getString("status") ?: GameStatus.SCHEDULED.name,
        maxPlayers = safeInt("max_players") ?: safeInt("maxPlayers") ?: 14,
        maxGoalkeepers = safeInt("max_goalkeepers") ?: safeInt("maxGoalkeepers") ?: 3,
        playersCount = safeInt("players_count") ?: safeInt("playersCount") ?: 0,
        goalkeepersCount = safeInt("goalkeepers_count") ?: safeInt("goalkeepersCount") ?: 0,
        dailyPrice = getDouble("daily_price") ?: getDouble("dailyPrice") ?: 0.0,
        totalCost = getDouble("total_cost") ?: getDouble("totalCost") ?: 0.0,
        pixKey = getString("pix_key") ?: getString("pixKey") ?: "",
        numberOfTeams = safeInt("number_of_teams") ?: safeInt("numberOfTeams") ?: 2,
        ownerId = getString("owner_id") ?: getString("ownerId") ?: "",
        ownerName = getString("owner_name") ?: getString("ownerName") ?: "",
        
        // Local
        locationId = getString("location_id") ?: getString("locationId") ?: "",
        fieldId = getString("field_id") ?: getString("fieldId") ?: "",
        locationName = getString("location_name") ?: getString("locationName") ?: "",
        locationAddress = getString("location_address") ?: getString("locationAddress") ?: "",
        locationLat = getDouble("location_lat") ?: getDouble("locationLat"),
        locationLng = getDouble("location_lng") ?: getDouble("locationLng"),
        fieldName = getString("field_name") ?: getString("fieldName") ?: "",

        // Configuracoes
        gameType = getString("game_type") ?: getString("gameType") ?: "Society",
        recurrence = getString("recurrence") ?: "none",
        visibility = getString("visibility") ?: GameVisibility.GROUP_ONLY.name,
        createdAt = safeLong("created_at") ?: safeLong("createdAt"),

        // Processamento
        xpProcessed = getBoolean("xp_processed") ?: getBoolean("xpProcessed") ?: false,
        mvpId = getString("mvp_id") ?: getString("mvpId"),

        // Placar
        team1Score = safeInt("team1_score") ?: safeInt("team1Score") ?: 0,
        team2Score = safeInt("team2_score") ?: safeInt("team2Score") ?: 0,
        team1Name = getString("team1_name") ?: getString("team1Name") ?: "Time 1",
        team2Name = getString("team2_name") ?: getString("team2Name") ?: "Time 2",

        // Grupo
        groupId = getString("group_id") ?: getString("groupId"),
        groupName = getString("group_name") ?: getString("groupName")
    )
}

/**
 * Extensão para converter DocumentSnapshot para GameConfirmation com mapeamento manual.
 */
private fun DocumentSnapshot.toGameConfirmationOrNull(): GameConfirmation? {
    if (!exists()) return null
    return GameConfirmation(
        id = id,
        gameId = getString("game_id") ?: getString("gameId") ?: "",
        userId = getString("user_id") ?: getString("userId") ?: "",
        userName = getString("user_name") ?: getString("userName") ?: "",
        userPhoto = getString("user_photo") ?: getString("userPhoto"),
        position = getString("position") ?: "FIELD",
        teamId = getString("team_id") ?: getString("teamId"),
        status = getString("status") ?: ConfirmationStatus.CONFIRMED.name,
        paymentStatus = getString("payment_status") ?: getString("paymentStatus") ?: PaymentStatus.PENDING.name,
        isCasualPlayer = getBoolean("is_casual_player") ?: getBoolean("isCasualPlayer") ?: false,

        // Estatisticas do jogo
        goals = safeInt("goals") ?: 0,
        assists = safeInt("assists") ?: 0,
        saves = safeInt("saves") ?: 0,
        yellowCards = safeInt("yellow_cards") ?: safeInt("yellowCards") ?: 0,
        redCards = safeInt("red_cards") ?: safeInt("redCards") ?: 0,

        nickname = getString("nickname"),
        xpEarned = safeInt("xp_earned") ?: safeInt("xpEarned") ?: 0,
        isMvp = getBoolean("is_mvp") ?: getBoolean("isMvp") ?: false,
        isBestGk = getBoolean("is_best_gk") ?: getBoolean("isBestGk") ?: false,
        isWorstPlayer = getBoolean("is_worst_player") ?: getBoolean("isWorstPlayer") ?: false,
        confirmedAt = safeLong("confirmed_at") ?: safeLong("confirmedAt")
    )
}

/**
 * Extensão para converter DocumentSnapshot para Statistics com mapeamento manual.
 */
private fun DocumentSnapshot.toStatisticsOrNull(): Statistics? {
    if (!exists()) return null
    return Statistics(
        id = id,
        userId = getString("user_id") ?: getString("userId") ?: "",
        totalGames = safeInt("total_games") ?: safeInt("totalGames") ?: 0,
        totalGoals = safeInt("total_goals") ?: safeInt("totalGoals") ?: 0,
        totalAssists = safeInt("total_assists") ?: safeInt("totalAssists") ?: 0,
        totalSaves = safeInt("total_saves") ?: safeInt("totalSaves") ?: 0,
        totalWins = safeInt("total_wins") ?: safeInt("totalWins") ?: 0,
        totalDraws = safeInt("total_draws") ?: safeInt("totalDraws") ?: 0,
        totalLosses = safeInt("total_losses") ?: safeInt("totalLosses") ?: 0,
        mvpCount = safeInt("mvp_count") ?: safeInt("mvpCount") ?: 0,
        bestGkCount = safeInt("best_gk_count") ?: safeInt("bestGkCount") ?: 0,
        worstPlayerCount = safeInt("worst_player_count") ?: safeInt("worstPlayerCount") ?: 0,
        currentStreak = safeInt("current_streak") ?: safeInt("currentStreak") ?: 0,
        bestStreak = safeInt("best_streak") ?: safeInt("bestStreak") ?: 0,
        yellowCards = safeInt("yellow_cards") ?: safeInt("yellowCards") ?: 0,
        redCards = safeInt("red_cards") ?: safeInt("redCards") ?: 0,
        lastGameDate = safeLong("last_game_date") ?: safeLong("lastGameDate"),
        updatedAt = safeLong("updated_at") ?: safeLong("updatedAt")
    )
}

/**
 * Extensão para converter DocumentSnapshot para UserGroup com mapeamento manual.
 */
private fun DocumentSnapshot.toUserGroupOrNull(): UserGroup? {
    if (!exists()) return null
    return UserGroup(
        id = id,
        userId = getString("user_id") ?: getString("userId") ?: "",
        groupId = getString("group_id") ?: getString("groupId") ?: "",
        groupName = getString("group_name") ?: getString("groupName") ?: "",
        groupPhoto = getString("group_photo") ?: getString("groupPhoto"),
        role = getString("role") ?: GroupMemberRole.MEMBER.name,
        joinedAt = safeLong("joined_at") ?: safeLong("joinedAt")
    )
}

/**
 * Extensão para converter DocumentSnapshot para Team com mapeamento manual.
 */
private fun DocumentSnapshot.toTeamOrNull(): Team? {
    if (!exists()) return null
    return Team(
        id = id,
        gameId = getString("game_id") ?: getString("gameId") ?: "",
        name = getString("name") ?: "",
        color = getString("color") ?: "",
        playerIds = ((get("player_ids") ?: get("playerIds")) as? List<*>)?.filterIsInstance<String>() ?: emptyList(),
        score = safeInt("score") ?: 0
    )
}

/**
 * Extensão para converter DocumentSnapshot para XpLog com mapeamento manual.
 */
private fun DocumentSnapshot.toXpLogOrNull(): XpLog? {
    if (!exists()) return null
    return XpLog(
        id = id,
        userId = getString("user_id") ?: getString("userId") ?: "",
        gameId = getString("game_id") ?: getString("gameId") ?: "",
        xpEarned = safeLong("xp_earned") ?: safeLong("xpEarned") ?: 0L,
        xpBefore = safeLong("xp_before") ?: safeLong("xpBefore") ?: 0L,
        xpAfter = safeLong("xp_after") ?: safeLong("xpAfter") ?: 0L,
        levelBefore = safeInt("level_before") ?: safeInt("levelBefore") ?: 1,
        levelAfter = safeInt("level_after") ?: safeInt("levelAfter") ?: 1,
        xpParticipation = safeInt("xp_participation") ?: 0,
        xpGoals = safeInt("xp_goals") ?: 0,
        xpAssists = safeInt("xp_assists") ?: 0,
        xpSaves = safeInt("xp_saves") ?: 0,
        xpResult = safeInt("xp_result") ?: 0,
        xpMvp = safeInt("xp_mvp") ?: 0,
        xpMilestones = safeInt("xp_milestones") ?: 0,
        xpStreak = safeInt("xp_streak") ?: 0,
        goals = safeInt("goals") ?: 0,
        assists = safeInt("assists") ?: 0,
        saves = safeInt("saves") ?: 0,
        wasMvp = getBoolean("was_mvp") ?: getBoolean("wasMvp") ?: false,
        gameResult = getString("game_result") ?: getString("gameResult") ?: "",
        milestonesUnlocked = ((get("milestones_unlocked") ?: get("milestonesUnlocked")) as? List<*>)?.filterIsInstance<String>() ?: emptyList(),
        createdAt = safeLong("created_at") ?: safeLong("createdAt")
    )
}

/**
 * Extensão para converter DocumentSnapshot para GameEvent com mapeamento manual.
 */
private fun DocumentSnapshot.toGameEventOrNull(): GameEvent? {
    if (!exists()) return null
    return GameEvent(
        id = id,
        gameId = getString("game_id") ?: getString("gameId") ?: "",
        eventType = getString("event_type") ?: getString("eventType") ?: GameEventType.GOAL.name,
        playerId = getString("player_id") ?: getString("playerId") ?: "",
        playerName = getString("player_name") ?: getString("playerName") ?: "",
        teamId = getString("team_id") ?: getString("teamId") ?: "",
        assistedById = getString("assisted_by_id") ?: getString("assistedById"),
        assistedByName = getString("assisted_by_name") ?: getString("assistedByName"),
        minute = safeInt("minute") ?: 0,
        createdBy = getString("created_by") ?: getString("createdBy") ?: "",
        createdAt = safeLong("created_at") ?: safeLong("createdAt")
    )
}

/**
 * Extensão para converter DocumentSnapshot para LiveScore com mapeamento manual.
 */
private fun DocumentSnapshot.toLiveScoreOrNull(): LiveScore? {
    if (!exists()) return null
    return LiveScore(
        id = id,
        gameId = getString("game_id") ?: getString("gameId") ?: "",
        team1Id = getString("team1_id") ?: getString("team1Id") ?: "",
        team1Score = safeInt("team1_score") ?: safeInt("team1Score") ?: 0,
        team2Id = getString("team2_id") ?: getString("team2Id") ?: "",
        team2Score = safeInt("team2_score") ?: safeInt("team2Score") ?: 0,
        startedAt = safeLong("started_at") ?: safeLong("startedAt"),
        finishedAt = safeLong("finished_at") ?: safeLong("finishedAt")
    )
}

/**
 * Extensão para converter DocumentSnapshot para Group com mapeamento manual.
 */
private fun DocumentSnapshot.toGroupOrNull(): Group? {
    if (!exists()) return null
    return Group(
        id = id,
        name = getString("name") ?: "",
        description = getString("description") ?: "",
        photoUrl = getString("photo_url") ?: getString("photoUrl"),
        ownerId = getString("owner_id") ?: getString("ownerId") ?: "",
        ownerName = getString("owner_name") ?: getString("ownerName") ?: "",
        membersCount = safeInt("members_count") ?: safeInt("membersCount") ?: 0,
        gamesCount = safeInt("games_count") ?: safeInt("gamesCount") ?: 0,
        isPublic = getBoolean("is_public") ?: getBoolean("isPublic") ?: false,
        inviteCode = getString("invite_code") ?: getString("inviteCode"),
        pixKey = getString("pix_key") ?: getString("pixKey"),
        defaultLocationId = getString("default_location_id") ?: getString("defaultLocationId"),
        defaultLocationName = getString("default_location_name") ?: getString("defaultLocationName"),
        defaultDayOfWeek = safeInt("default_day_of_week") ?: safeInt("defaultDayOfWeek"),
        defaultTime = getString("default_time") ?: getString("defaultTime"),
        defaultMaxPlayers = safeInt("default_max_players") ?: safeInt("defaultMaxPlayers") ?: 14,
        defaultPrice = getDouble("default_price") ?: getDouble("defaultPrice") ?: 0.0,
        createdAt = safeLong("created_at") ?: safeLong("createdAt"),
        updatedAt = safeLong("updated_at") ?: safeLong("updatedAt")
    )
}

/**
 * Extensão para converter DocumentSnapshot para GroupMember com mapeamento manual.
 */
private fun DocumentSnapshot.toGroupMemberOrNull(): GroupMember? {
    if (!exists()) return null
    return GroupMember(
        id = id,
        groupId = getString("group_id") ?: getString("groupId") ?: "",
        userId = getString("user_id") ?: getString("userId") ?: "",
        userName = getString("user_name") ?: getString("userName") ?: "",
        userPhoto = getString("user_photo") ?: getString("userPhoto"),
        role = getString("role") ?: GroupMemberRole.MEMBER.name,
        nickname = getString("nickname"),
        joinedAt = safeLong("joined_at") ?: safeLong("joinedAt"),
        gamesPlayed = safeInt("games_played") ?: safeInt("gamesPlayed") ?: 0,
        goals = safeInt("goals") ?: 0,
        assists = safeInt("assists") ?: 0
    )
}
