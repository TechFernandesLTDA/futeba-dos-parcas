package com.futebadosparcas.platform.firebase

import android.net.Uri
import com.futebadosparcas.domain.model.*
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.*
import com.google.firebase.storage.FirebaseStorage
import kotlinx.coroutines.async
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import java.io.File
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

/**
 * Implementação Android do FirebaseDataSource usando Firebase Android SDK.
 *
 * NOTA: Esta é uma implementação inicial. A versão completa com retry policy,
 * logging avançado e otimizações será migrada na Fase 3 quando os repositórios
 * forem movidos para o shared module.
 *
 * @param firestore FirebaseFirestore instance
 * @param auth FirebaseAuth instance
 * @param storage FirebaseStorage instance (opcional, injetado via Hilt)
 */
actual class FirebaseDataSource(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth,
    private val storage: FirebaseStorage = FirebaseStorage.getInstance()
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
        private const val COLLECTION_PAYMENTS = "payments"
        private const val SUBCOLLECTION_CASHBOX = "cashbox"
        private const val SUBCOLLECTION_CASHBOX_SUMMARY = "cashbox_summary"
    }

    /**
     * Retorna a instancia do FirebaseFirestore.
     * Usado por repositorios que precisam de acesso direto ao Firestore.
     */
    fun getFirestoreInstance(): FirebaseFirestore = firestore

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
                .whereEqualTo("group_id", groupId)
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
            val now = com.google.firebase.Timestamp.now()
            val snapshot = firestore.collection(COLLECTION_GAMES)
                .whereIn("visibility", listOf("PUBLIC_OPEN", "PUBLIC_CLOSED"))
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

    actual suspend fun removePlayerFromGame(gameId: String, userId: String): Result<Unit> {
        return try {
            val snapshot = firestore.collection(COLLECTION_CONFIRMATIONS)
                .whereEqualTo("gameId", gameId)
                .whereEqualTo("userId", userId)
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

    actual suspend fun summonPlayers(
        gameId: String,
        confirmations: List<GameConfirmation>
    ): Result<Unit> {
        return try {
            val batch = firestore.batch()
            confirmations.forEach { confirmation ->
                val docRef = firestore.collection(COLLECTION_CONFIRMATIONS)
                    .document("${gameId}_${confirmation.userId}")
                val confirmationData = mapOf(
                    "id" to docRef.id,
                    "game_id" to gameId,
                    "gameId" to gameId,
                    "user_id" to confirmation.userId,
                    "userId" to confirmation.userId,
                    "user_name" to confirmation.userName,
                    "userName" to confirmation.userName,
                    "user_photo" to confirmation.userPhoto,
                    "userPhoto" to confirmation.userPhoto,
                    "position" to confirmation.position,
                    "status" to "PENDING",
                    "is_casual_player" to confirmation.isCasualPlayer,
                    "isCasualPlayer" to confirmation.isCasualPlayer
                )
                batch.set(docRef, confirmationData)
            }
            batch.commit().await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun acceptInvitation(
        gameId: String,
        userId: String,
        position: String
    ): Result<GameConfirmation> {
        return try {
            // Buscar confirmacao existente com status PENDING
            val snapshot = firestore.collection(COLLECTION_CONFIRMATIONS)
                .whereEqualTo("gameId", gameId)
                .whereEqualTo("userId", userId)
                .get()
                .await()

            if (snapshot.isEmpty) {
                return Result.failure(Exception("Convite não encontrado"))
            }

            val doc = snapshot.documents[0]
            val updates = mapOf(
                "status" to "CONFIRMED",
                "position" to position
            )
            doc.reference.update(updates).await()

            // Construir confirmacao atualizada manualmente
            val confirmation = GameConfirmation(
                id = doc.id,
                gameId = gameId,
                userId = userId,
                userName = doc.getString("userName") ?: "",
                userPhoto = doc.getString("userPhoto"),
                position = position,
                status = "CONFIRMED",
                isCasualPlayer = doc.getBoolean("isCasualPlayer") ?: false
            )

            Result.success(confirmation)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun updateConfirmationStatus(
        gameId: String,
        userId: String,
        status: String
    ): Result<Unit> {
        return try {
            val snapshot = firestore.collection(COLLECTION_CONFIRMATIONS)
                .whereEqualTo("gameId", gameId)
                .whereEqualTo("userId", userId)
                .get()
                .await()

            if (snapshot.isEmpty) {
                return Result.failure(Exception("Confirmação não encontrada"))
            }

            val batch = firestore.batch()
            snapshot.documents.forEach { doc ->
                batch.update(doc.reference, "status", status)
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

    // ========== ACTIVITIES ==========

    /**
     * Busca atividades recentes do feed público.
     */
    suspend fun getRecentActivities(limit: Int): Result<List<Activity>> {
        return try {
            val snapshot = firestore.collection("activities")
                .whereEqualTo("visibility", "PUBLIC")
                .orderBy("created_at", Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val activities = snapshot.documents.mapNotNull { doc ->
                doc.toActivityOrNull()
            }
            Result.success(activities)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Flow de atividades recentes em tempo real.
     */
    fun getRecentActivitiesFlow(limit: Int): Flow<Result<List<Activity>>> = callbackFlow {
        val listener = firestore.collection("activities")
            .whereEqualTo("visibility", "PUBLIC")
            .orderBy("created_at", Query.Direction.DESCENDING)
            .limit(limit.toLong())
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }
                if (snapshot != null) {
                    val activities = snapshot.documents.mapNotNull { doc -> doc.toActivityOrNull() }
                    trySend(Result.success(activities))
                }
            }
        awaitClose { listener.remove() }
    }

    /**
     * Cria uma nova atividade.
     */
    suspend fun createActivity(activity: Activity): Result<Unit> {
        return try {
            firestore.collection("activities").add(activityToMap(activity)).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Busca atividades de um usuário específico.
     */
    suspend fun getUserActivities(userId: String, limit: Int): Result<List<Activity>> {
        return try {
            val snapshot = firestore.collection("activities")
                .whereEqualTo("user_id", userId)
                .orderBy("created_at", Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val activities = snapshot.documents.mapNotNull { doc ->
                doc.toActivityOrNull()
            }
            Result.success(activities)
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

    actual suspend fun getAllUsers(): Result<List<User>> {
        return try {
            // OTIMIZAÇÃO: Limitado a 100 usuários para evitar carregar toda a coleção
            // Para listas maiores, use searchUsers() com paginação ou implemente cursor-based pagination
            val snapshot = firestore.collection(COLLECTION_USERS)
                .orderBy("name")
                .limit(100)
                .get()
                .await()

            val users = snapshot.documents.mapNotNull { it.toUserOrNull() }
            Result.success(users)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "getAllUsers failed", e)
            Result.failure(e)
        }
    }

    actual suspend fun updateUserRole(userId: String, newRole: String): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_USERS)
                .document(userId)
                .update("role", newRole)
                .await()
            Result.success(Unit)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "updateUserRole failed", e)
            Result.failure(e)
        }
    }

    actual suspend fun updateAutoRatings(
        userId: String,
        autoStrikerRating: Double,
        autoMidRating: Double,
        autoDefenderRating: Double,
        autoGkRating: Double,
        autoRatingSamples: Int
    ): Result<Unit> {
        return try {
            val updates = mapOf(
                "auto_striker_rating" to autoStrikerRating,
                "auto_mid_rating" to autoMidRating,
                "auto_defender_rating" to autoDefenderRating,
                "auto_gk_rating" to autoGkRating,
                "auto_rating_samples" to autoRatingSamples,
                "auto_rating_updated_at" to com.google.firebase.firestore.FieldValue.serverTimestamp()
            )
            firestore.collection(COLLECTION_USERS)
                .document(userId)
                .update(updates)
                .await()
            Result.success(Unit)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "updateAutoRatings failed", e)
            Result.failure(e)
        }
    }

    // ========== PROFILE VISIBILITY ==========

    actual suspend fun updateProfileVisibility(userId: String, isSearchable: Boolean): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_USERS)
                .document(userId)
                .update("is_searchable", isSearchable)
                .await()
            Result.success(Unit)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "updateProfileVisibility failed", e)
            Result.failure(e)
        }
    }

    // ========== FIELD OWNERS ==========

    actual suspend fun getFieldOwners(): Result<List<User>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_USERS)
                .whereEqualTo("role", "FIELD_OWNER")
                .orderBy("name")
                .get()
                .await()
            val fieldOwners = snapshot.documents.mapNotNull { it.toUserOrNull() }
            Result.success(fieldOwners)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "getFieldOwners failed", e)
            Result.failure(e)
        }
    }

    // ========== FCM TOKEN ==========

    actual suspend fun updateFcmToken(token: String): Result<Unit> {
        return try {
            val uid = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuario nao autenticado"))

            firestore.collection(COLLECTION_USERS)
                .document(uid)
                .update("fcm_token", token)
                .await()
            Result.success(Unit)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "updateFcmToken failed", e)
            Result.failure(e)
        }
    }

    // ========== AUTH ==========

    actual fun getAuthStateFlow(): Flow<String?> = callbackFlow {
        val listener = FirebaseAuth.AuthStateListener { auth ->
            val userId = auth.currentUser?.uid
            trySend(userId)
        }
        auth.addAuthStateListener(listener)
        awaitClose { auth.removeAuthStateListener(listener) }
    }

    actual fun isLoggedIn(): Boolean {
        return auth.currentUser != null
    }

    actual fun getCurrentAuthUserId(): String? {
        return auth.currentUser?.uid
    }

    actual suspend fun getCurrentAuthUser(): Result<User> {
        android.util.Log.d("FirebaseDataSource", "=== getCurrentAuthUser() START ===")
        return try {
            // Enhanced retry logic for Google Sign-In reliability
            // Firebase Auth may take time to sync after credential validation
            var uid: String? = null
            var retries = 0
            val maxRetries = 10 // Increased from 5
            val baseDelay = 300L // Increased from 200ms

            android.util.Log.d("FirebaseDataSource", "Starting retry loop (max $maxRetries attempts)")
            while (uid == null && retries < maxRetries) {
                uid = auth.currentUser?.uid
                android.util.Log.d("FirebaseDataSource", "Retry $retries: uid = $uid")
                if (uid == null) {
                    // Exponential backoff: 300ms, 600ms, 900ms, 1200ms, etc.
                    val delay = baseDelay * (retries + 1)
                    android.util.Log.d("FirebaseDataSource", "Waiting ${delay}ms before next retry")
                    kotlinx.coroutines.delay(delay)
                    retries++
                }
            }

            if (uid == null) {
                android.util.Log.e("FirebaseDataSource", "FAILED: No UID after $retries retries")
                return Result.failure(Exception("Usuario nao autenticado"))
            }

            android.util.Log.d("FirebaseDataSource", "SUCCESS: Got UID = $uid")
            android.util.Log.d("FirebaseDataSource", "Waiting 100ms for Firestore sync")
            kotlinx.coroutines.delay(100)

            android.util.Log.d("FirebaseDataSource", "Querying Firestore for user doc: $uid")
            val doc = firestore.collection(COLLECTION_USERS).document(uid).get().await()

            if (doc.exists()) {
                android.util.Log.d("FirebaseDataSource", "User document EXISTS in Firestore")
                var user = doc.toUserOrNull()
                    ?: return Result.failure(Exception("Erro ao converter usuario"))

                android.util.Log.d("FirebaseDataSource", "User loaded: ${user.name} (${user.email})")

                // Verifica se a foto do Google mudou e atualiza
                val firebaseUser = auth.currentUser
                val googlePhotoUrl = firebaseUser?.photoUrl?.toString()

                if (googlePhotoUrl != null && googlePhotoUrl != user.photoUrl) {
                    android.util.Log.d("FirebaseDataSource", "Updating photo URL")
                    firestore.collection(COLLECTION_USERS)
                        .document(uid)
                        .update("photo_url", googlePhotoUrl)
                        .await()
                    user = user.copy(photoUrl = googlePhotoUrl)
                }

                android.util.Log.d("FirebaseDataSource", "=== getCurrentAuthUser() SUCCESS ===")
                Result.success(user)
            } else {
                android.util.Log.d("FirebaseDataSource", "User document DOES NOT EXIST - creating new user")
                // Criar usuario automaticamente se nao existir
                val firebaseUser = auth.currentUser
                    ?: return Result.failure(Exception("Usuário não autenticado"))
                val newUser = User(
                    id = uid,
                    email = firebaseUser.email ?: "",
                    name = firebaseUser.displayName ?: "",
                    photoUrl = firebaseUser.photoUrl?.toString()
                )
                android.util.Log.d("FirebaseDataSource", "Creating user: ${newUser.name} (${newUser.email})")

                // Converter User para Map (serialização manual para compatibilidade)
                val userData = mapOf(
                    "id" to newUser.id,
                    "email" to newUser.email,
                    "name" to newUser.name,
                    "photo_url" to newUser.photoUrl,
                    "fcm_token" to newUser.fcmToken,
                    "is_searchable" to newUser.isSearchable,
                    "is_profile_public" to newUser.isProfilePublic,
                    "role" to newUser.role,
                    "created_at" to com.google.firebase.firestore.FieldValue.serverTimestamp(),
                    "updated_at" to com.google.firebase.firestore.FieldValue.serverTimestamp(),
                    "level" to newUser.level,
                    "experience_points" to newUser.experiencePoints,
                    "milestones_achieved" to newUser.milestonesAchieved,
                    "striker_rating" to newUser.strikerRating,
                    "mid_rating" to newUser.midRating,
                    "defender_rating" to newUser.defenderRating,
                    "gk_rating" to newUser.gkRating,
                    "auto_striker_rating" to newUser.autoStrikerRating,
                    "auto_mid_rating" to newUser.autoMidRating,
                    "auto_defender_rating" to newUser.autoDefenderRating,
                    "auto_gk_rating" to newUser.autoGkRating,
                    "auto_rating_samples" to newUser.autoRatingSamples
                )

                firestore.collection(COLLECTION_USERS)
                    .document(uid)
                    .set(userData)
                    .await()
                android.util.Log.d("FirebaseDataSource", "=== getCurrentAuthUser() SUCCESS (new user created) ===")
                Result.success(newUser)
            }
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "=== getCurrentAuthUser() EXCEPTION: ${e.message} ===", e)
            Result.failure(e)
        }
    }

    actual fun logout() {
        auth.signOut()
    }

    /**
     * Retorna a instancia do FirebaseFirestore para uso em implementacoes de repository.
     * Este metodo expoe o Firestore diretamente para repositories que precisam
     * de operacoes especificas do Firestore (como collections customizadas).
     */
    fun getFirestore(): FirebaseFirestore = firestore

    // ========== GROUPS ==========

    actual suspend fun getUserGroups(userId: String): Result<List<UserGroup>> {
        return try {
            val snapshot = firestore.collection("users")
                .document(userId)
                .collection("groups")
                .orderBy("joined_at", com.google.firebase.firestore.Query.Direction.DESCENDING)
                .get()
                .await()

            val userGroups = snapshot.documents.mapNotNull { it.toUserGroupOrNull() }
            Result.success<List<UserGroup>>(userGroups)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual fun getUserGroupsFlow(userId: String): Flow<Result<List<UserGroup>>> = callbackFlow {
        val listener = firestore.collection("users")
            .document(userId)
            .collection("groups")
            .orderBy("joined_at", com.google.firebase.firestore.Query.Direction.DESCENDING)
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
                .whereEqualTo("user_id", userId)
                .orderBy("created_at", Query.Direction.DESCENDING)
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
        // Emitir null inicialmente para jogos que não estão live
        trySend(Result.success(LiveScore()))

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

    // ========== LIVE GAME (NEW METHODS) ==========

    actual suspend fun startLiveGame(gameId: String, team1Id: String, team2Id: String): Result<LiveScore> {
        return try {
            val docRef = firestore.collection("live_scores").document(gameId)

            val scoreData = mapOf(
                "game_id" to gameId,
                "team1_id" to team1Id,
                "team1_score" to 0,
                "team2_id" to team2Id,
                "team2_score" to 0,
                "started_at" to com.google.firebase.firestore.FieldValue.serverTimestamp()
            )

            docRef.set(scoreData).await()

            val score = LiveScore(
                id = gameId,
                gameId = gameId,
                team1Id = team1Id,
                team1Score = 0,
                team2Id = team2Id,
                team2Score = 0
            )

            Result.success(score)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun canManageGameEvents(gameId: String): Boolean {
        val currentUserId = auth.currentUser?.uid
        if (currentUserId == null) {
            android.util.Log.e("FirebaseDataSource", "canManageGameEvents: Usuário não autenticado")
            return false
        }

        return try {
            // Verificar se é owner do jogo
            val gameDoc = firestore.collection("games").document(gameId).get().await()
            val ownerId = gameDoc.getString("owner_id")
            if (ownerId == currentUserId) {
                android.util.Log.d("FirebaseDataSource", "canManageGameEvents: Usuário é owner")
                return true
            }

            // Verificar se está confirmado no jogo
            val confirmationId = "${gameId}_$currentUserId"
            val confDoc = firestore.collection("confirmations").document(confirmationId).get().await()
            if (confDoc.exists()) {
                val status = confDoc.getString("status")
                if (status == "CONFIRMED") {
                    android.util.Log.d("FirebaseDataSource", "canManageGameEvents: Usuário confirmado")
                    return true
                }
            }

            android.util.Log.w("FirebaseDataSource", "canManageGameEvents: Permissão negada")
            false
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "canManageGameEvents: Erro", e)
            false
        }
    }

    actual suspend fun updateScoreForGoal(gameId: String, teamId: String): Result<Unit> {
        return try {
            val scoreDoc = firestore.collection("live_scores").document(gameId)
            val gameDoc = firestore.collection("games").document(gameId)

            // Tentar garantir que o documento de placar existe
            try {
                val snapshot = scoreDoc.get().await()
                if (!snapshot.exists()) {
                    val teamsSnapshot = firestore.collection("teams")
                        .whereEqualTo("game_id", gameId)
                        .get()
                        .await()

                    val teams = teamsSnapshot.documents.mapNotNull { it.toTeamOrNull() }
                    if (teams.size >= 2) {
                        startLiveGame(gameId, teams[0].id, teams[1].id)
                        android.util.Log.d("FirebaseDataSource", "Placar inicializado sob demanda")
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("FirebaseDataSource", "Erro ao inicializar placar", e)
            }

            firestore.runTransaction { transaction ->
                val snapshot = transaction.get(scoreDoc)
                val score = snapshot.toLiveScoreOrNull() ?: return@runTransaction

                var newTeam1Score = score.team1Score
                var newTeam2Score = score.team2Score

                when {
                    score.team1Id == teamId -> {
                        newTeam1Score += 1
                        transaction.update(scoreDoc, "team1_score", newTeam1Score)
                    }
                    score.team2Id == teamId -> {
                        newTeam2Score += 1
                        transaction.update(scoreDoc, "team2_score", newTeam2Score)
                    }
                    else -> {
                        android.util.Log.w("FirebaseDataSource", "GOL para time desconhecido: $teamId")
                    }
                }

                // Sincronizar com documento principal do jogo
                transaction.update(gameDoc, mapOf(
                    "team1_score" to newTeam1Score,
                    "team2_score" to newTeam2Score
                ))
            }.await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun updatePlayerStats(
        gameId: String,
        playerId: String,
        teamId: String,
        eventType: GameEventType,
        assistedById: String?
    ): Result<Unit> {
        return try {
            val statsId = "${gameId}_$playerId"
            val statsDoc = firestore.collection("live_player_stats").document(statsId)
            val confirmationId = "${gameId}_$playerId"
            val confDoc = firestore.collection("confirmations").document(confirmationId)

            firestore.runTransaction { transaction ->
                // 1. Update Live Player Stats
                val snapshot = transaction.get(statsDoc)

                if (!snapshot.exists()) {
                    // Criar nova estatística
                    val newStats = mapOf(
                        "id" to statsId,
                        "game_id" to gameId,
                        "player_id" to playerId,
                        "team_id" to teamId,
                        "goals" to if (eventType == GameEventType.GOAL) 1 else 0,
                        "assists" to 0,
                        "saves" to if (eventType == GameEventType.SAVE) 1 else 0,
                        "yellow_cards" to if (eventType == GameEventType.YELLOW_CARD) 1 else 0,
                        "red_cards" to if (eventType == GameEventType.RED_CARD) 1 else 0
                    )
                    transaction.set(statsDoc, newStats)
                } else {
                    // Atualizar estatística existente
                    when (eventType) {
                        GameEventType.GOAL -> transaction.update(statsDoc, "goals", snapshot.getGoals() + 1)
                        GameEventType.SAVE -> transaction.update(statsDoc, "saves", snapshot.getSaves() + 1)
                        GameEventType.YELLOW_CARD -> transaction.update(statsDoc, "yellow_cards", snapshot.getYellowCards() + 1)
                        GameEventType.RED_CARD -> transaction.update(statsDoc, "red_cards", snapshot.getRedCards() + 1)
                        else -> {}
                    }
                }

                // 2. Sync with GameConfirmation
                val confSnapshot = transaction.get(confDoc)
                if (confSnapshot.exists()) {
                    val currentGoals = confSnapshot.getLong("goals") ?: 0
                    val currentYellow = confSnapshot.getLong("yellow_cards") ?: 0
                    val currentRed = confSnapshot.getLong("red_cards") ?: 0
                    val currentAssists = confSnapshot.getLong("assists") ?: 0
                    val currentSaves = confSnapshot.getLong("saves") ?: 0

                    when (eventType) {
                        GameEventType.GOAL -> transaction.update(confDoc, "goals", currentGoals + 1)
                        GameEventType.YELLOW_CARD -> transaction.update(confDoc, "yellow_cards", currentYellow + 1)
                        GameEventType.RED_CARD -> transaction.update(confDoc, "red_cards", currentRed + 1)
                        GameEventType.SAVE -> transaction.update(confDoc, "saves", currentSaves + 1)
                        else -> {}
                    }
                }

                // 3. Atualizar assistência se houver
                if (eventType == GameEventType.GOAL && assistedById != null) {
                    val assistStatsId = "${gameId}_$assistedById"
                    val assistStatsDoc = firestore.collection("live_player_stats").document(assistStatsId)
                    val assistConfDoc = firestore.collection("confirmations").document(assistStatsId)

                    // Update Live Stats
                    val assistSnapshot = transaction.get(assistStatsDoc)
                    if (assistSnapshot.exists()) {
                        transaction.update(assistStatsDoc, "assists", assistSnapshot.getAssists() + 1)
                    } else {
                        val newAssistStats = mapOf(
                            "id" to assistStatsId,
                            "game_id" to gameId,
                            "player_id" to assistedById,
                            "team_id" to teamId,
                            "assists" to 1
                        )
                        transaction.set(assistStatsDoc, newAssistStats)
                    }

                    // Update Confirmation
                    val assistConfSnapshot = transaction.get(assistConfDoc)
                    if (assistConfSnapshot.exists()) {
                        val currentAssistCount = assistConfSnapshot.getLong("assists") ?: 0
                        transaction.update(assistConfDoc, "assists", currentAssistCount + 1)
                    }
                }
            }.await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun deleteGameEvent(gameId: String, eventId: String): Result<Unit> {
        return try {
            // Validar permissão
            if (!canManageGameEvents(gameId)) {
                return Result.failure(Exception("Você não tem permissão para deletar eventos"))
            }

            // Buscar o evento antes de deletar
            val eventDoc = firestore.collection("game_events").document(eventId).get().await()
            val event = eventDoc.toGameEventOrNull()
                ?: return Result.failure(Exception("Evento não encontrado"))

            val eventType = event.getEventTypeEnum()

            // Reverter estatísticas em transação
            firestore.runTransaction { transaction ->
                val scoreDoc = firestore.collection("live_scores").document(gameId)
                val gameDoc = firestore.collection("games").document(gameId)

                // Reverter placar se for gol
                if (eventType == GameEventType.GOAL) {
                    val scoreSnapshot = transaction.get(scoreDoc)
                    val score = scoreSnapshot.toLiveScoreOrNull()

                    if (score != null) {
                        val newScore = when {
                            score.team1Id == event.teamId -> maxOf(0, score.team1Score - 1)
                            score.team2Id == event.teamId -> maxOf(0, score.team2Score - 1)
                            else -> return@runTransaction
                        }

                        when {
                            score.team1Id == event.teamId -> {
                                transaction.update(scoreDoc, "team1_score", newScore)
                                transaction.update(gameDoc, "team1_score", newScore)
                            }
                            score.team2Id == event.teamId -> {
                                transaction.update(scoreDoc, "team2_score", newScore)
                                transaction.update(gameDoc, "team2_score", newScore)
                            }
                        }
                    }
                }

                // Reverter estatísticas do jogador
                if (event.playerId.isNotEmpty()) {
                    val statsId = "${gameId}_${event.playerId}"
                    val statsDoc = firestore.collection("live_player_stats").document(statsId)
                    val confirmationId = "${gameId}_${event.playerId}"
                    val confDoc = firestore.collection("confirmations").document(confirmationId)

                    val statsSnapshot = transaction.get(statsDoc)

                    if (statsSnapshot.exists()) {
                        when (eventType) {
                            GameEventType.GOAL -> transaction.update(statsDoc, "goals", maxOf(0, statsSnapshot.getGoals() - 1))
                            GameEventType.SAVE -> transaction.update(statsDoc, "saves", maxOf(0, statsSnapshot.getSaves() - 1))
                            GameEventType.YELLOW_CARD -> transaction.update(statsDoc, "yellow_cards", maxOf(0, statsSnapshot.getYellowCards() - 1))
                            GameEventType.RED_CARD -> transaction.update(statsDoc, "red_cards", maxOf(0, statsSnapshot.getRedCards() - 1))
                            else -> {}
                        }
                    }

                    // Reverter em confirmations
                    val confSnapshot = transaction.get(confDoc)
                    if (confSnapshot.exists()) {
                        when (eventType) {
                            GameEventType.GOAL -> {
                                val currentGoals = confSnapshot.getLong("goals") ?: 0
                                transaction.update(confDoc, "goals", maxOf(0, currentGoals - 1))
                            }
                            GameEventType.YELLOW_CARD -> {
                                val currentYellow = confSnapshot.getLong("yellow_cards") ?: 0
                                transaction.update(confDoc, "yellow_cards", maxOf(0, currentYellow - 1))
                            }
                            GameEventType.RED_CARD -> {
                                val currentRed = confSnapshot.getLong("red_cards") ?: 0
                                transaction.update(confDoc, "red_cards", maxOf(0, currentRed - 1))
                            }
                            GameEventType.SAVE -> {
                                val currentSaves = confSnapshot.getLong("saves") ?: 0
                                transaction.update(confDoc, "saves", maxOf(0, currentSaves - 1))
                            }
                            else -> {}
                        }
                    }
                }

                // Reverter assistência se for gol com assistência
                if (eventType == GameEventType.GOAL && !event.assistedById.isNullOrEmpty()) {
                    val assistStatsId = "${gameId}_${event.assistedById}"
                    val assistStatsDoc = firestore.collection("live_player_stats").document(assistStatsId)
                    val assistConfDoc = firestore.collection("confirmations").document(assistStatsId)

                    val assistSnapshot = transaction.get(assistStatsDoc)
                    if (assistSnapshot.exists()) {
                        transaction.update(assistStatsDoc, "assists", maxOf(0, assistSnapshot.getAssists() - 1))
                    }

                    val assistConfSnapshot = transaction.get(assistConfDoc)
                    if (assistConfSnapshot.exists()) {
                        val currentAssists = assistConfSnapshot.getLong("assists") ?: 0
                        transaction.update(assistConfDoc, "assists", maxOf(0, currentAssists - 1))
                    }
                }

                // Deletar o evento
                transaction.delete(firestore.collection("game_events").document(eventId))
            }.await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun getLivePlayerStats(gameId: String): Result<List<LivePlayerStats>> {
        return try {
            val snapshot = firestore.collection("live_player_stats")
                .whereEqualTo("game_id", gameId)
                .get()
                .await()

            val stats = snapshot.documents.mapNotNull { doc ->
                LivePlayerStats(
                    id = doc.id,
                    gameId = doc.getString("game_id") ?: "",
                    playerId = doc.getString("player_id") ?: "",
                    playerName = doc.getString("player_name") ?: "",
                    teamId = doc.getString("team_id") ?: "",
                    position = doc.getString("position") ?: "LINE",
                    goals = doc.getLong("goals")?.toInt() ?: 0,
                    assists = doc.getLong("assists")?.toInt() ?: 0,
                    saves = doc.getLong("saves")?.toInt() ?: 0,
                    yellowCards = doc.getLong("yellow_cards")?.toInt() ?: 0,
                    redCards = doc.getLong("red_cards")?.toInt() ?: 0,
                    isPlaying = doc.getBoolean("is_playing") ?: true
                )
            }

            Result.success(stats)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual fun getLivePlayerStatsFlow(gameId: String): Flow<Result<List<LivePlayerStats>>> = callbackFlow {
        val listener = firestore.collection("live_player_stats")
            .whereEqualTo("game_id", gameId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }

                val stats = snapshot?.documents?.mapNotNull { doc ->
                    LivePlayerStats(
                        id = doc.id,
                        gameId = doc.getString("game_id") ?: "",
                        playerId = doc.getString("player_id") ?: "",
                        playerName = doc.getString("player_name") ?: "",
                        teamId = doc.getString("team_id") ?: "",
                        position = doc.getString("position") ?: "LINE",
                        goals = doc.getLong("goals")?.toInt() ?: 0,
                        assists = doc.getLong("assists")?.toInt() ?: 0,
                        saves = doc.getLong("saves")?.toInt() ?: 0,
                        yellowCards = doc.getLong("yellow_cards")?.toInt() ?: 0,
                        redCards = doc.getLong("red_cards")?.toInt() ?: 0,
                        isPlaying = doc.getBoolean("is_playing") ?: true
                    )
                } ?: emptyList()

                trySend(Result.success(stats))
            }

        awaitClose { listener.remove() }
    }

    actual suspend fun finishGame(gameId: String): Result<Unit> {
        return try {
            firestore.collection("live_scores")
                .document(gameId)
                .update("finished_at", com.google.firebase.firestore.FieldValue.serverTimestamp())
                .await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun clearAllLiveGameData(): Result<Unit> {
        return try {
            val scoresSnapshot = firestore.collection("live_scores").limit(500).get().await()
            val eventsSnapshot = firestore.collection("game_events").limit(500).get().await()
            val liveStatsSnapshot = firestore.collection("live_player_stats").limit(500).get().await()

            firestore.runBatch {
                scoresSnapshot.documents.forEach { doc -> it.delete(doc.reference) }
                eventsSnapshot.documents.forEach { doc -> it.delete(doc.reference) }
                liveStatsSnapshot.documents.forEach { doc -> it.delete(doc.reference) }
            }.await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
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

    actual fun getGroupMembersFlow(groupId: String): Flow<Result<List<GroupMember>>> = callbackFlow {
        val listener = firestore.collection(COLLECTION_GROUPS)
            .document(groupId)
            .collection("members")
            .whereEqualTo("status", "ACTIVE")
            .orderBy("joined_at", com.google.firebase.firestore.Query.Direction.ASCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }
                if (snapshot != null) {
                    val members = snapshot.documents.mapNotNull { it.toGroupMemberOrNull() }
                    trySend(Result.success(members))
                }
            }

        awaitClose { listener.remove() }
    }

    actual fun getGroupDetailsFlow(groupId: String): Flow<Result<Group>> = callbackFlow {
        val listener = firestore.collection(COLLECTION_GROUPS)
            .document(groupId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }

                if (snapshot != null && snapshot.exists()) {
                    val group = snapshot.toGroupOrNull()
                    if (group != null) {
                        trySend(Result.success(group))
                    } else {
                        trySend(Result.failure(Exception("Erro ao converter grupo")))
                    }
                } else {
                    trySend(Result.failure(Exception("Grupo não encontrado")))
                }
            }

        awaitClose { listener.remove() }
    }

    // ========== GROUPS AVANCED ==========

    actual suspend fun promoteGroupMemberToAdmin(groupId: String, memberId: String): Result<Unit> {
        return try {
            firestore.runTransaction { transaction ->
                val memberRef = firestore.collection(COLLECTION_GROUPS)
                    .document(groupId)
                    .collection("members").document(memberId)
                transaction.update(memberRef, "role", "ADMIN")

                val userGroupRef = firestore.collection("users")
                    .document(memberId)
                    .collection("groups").document(groupId)
                transaction.update(userGroupRef, "role", "ADMIN")
            }.await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun demoteGroupAdminToMember(groupId: String, memberId: String): Result<Unit> {
        return try {
            firestore.runTransaction { transaction ->
                val memberRef = firestore.collection(COLLECTION_GROUPS)
                    .document(groupId)
                    .collection("members").document(memberId)
                transaction.update(memberRef, "role", "MEMBER")

                val userGroupRef = firestore.collection("users")
                    .document(memberId)
                    .collection("groups").document(groupId)
                transaction.update(userGroupRef, "role", "MEMBER")
            }.await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun updateGroupMemberRole(groupId: String, userId: String, role: String): Result<Unit> {
        return try {
            firestore.runTransaction { transaction ->
                val memberRef = firestore.collection(COLLECTION_GROUPS)
                    .document(groupId)
                    .collection("members").document(userId)
                transaction.update(memberRef, "role", role)

                val userGroupRef = firestore.collection("users")
                    .document(userId)
                    .collection("groups").document(groupId)
                transaction.update(userGroupRef, "role", role)
            }.await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun leaveGroup(groupId: String, userId: String): Result<Unit> {
        return try {
            firestore.runTransaction { transaction ->
                val memberRef = firestore.collection(COLLECTION_GROUPS)
                    .document(groupId)
                    .collection("members").document(userId)
                transaction.update(memberRef, "status", "INACTIVE")

                val groupRef = firestore.collection(COLLECTION_GROUPS).document(groupId)
                transaction.update(groupRef, "member_count", com.google.firebase.firestore.FieldValue.increment(-1))

                val userGroupRef = firestore.collection("users")
                    .document(userId)
                    .collection("groups").document(groupId)
                transaction.delete(userGroupRef)
            }.await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun archiveGroup(groupId: String): Result<Unit> {
        return try {
            val updates = mapOf(
                "status" to "ARCHIVED",
                "updated_at" to com.google.firebase.firestore.FieldValue.serverTimestamp()
            )
            firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .update(updates)
                .await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun restoreGroup(groupId: String): Result<Unit> {
        return try {
            val updates = mapOf(
                "status" to "ACTIVE",
                "updated_at" to com.google.firebase.firestore.FieldValue.serverTimestamp()
            )
            firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .update(updates)
                .await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun deleteGroup(groupId: String): Result<Unit> {
        return try {
            val updates = mapOf(
                "status" to "DELETED",
                "updated_at" to com.google.firebase.firestore.FieldValue.serverTimestamp()
            )
            firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .update(updates)
                .await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun transferGroupOwnership(
        groupId: String,
        newOwnerId: String,
        oldOwnerId: String,
        newOwnerName: String
    ): Result<Unit> {
        return try {
            firestore.runTransaction { transaction ->
                val groupRef = firestore.collection(COLLECTION_GROUPS).document(groupId)
                transaction.update(groupRef, mapOf(
                    "owner_id" to newOwnerId,
                    "owner_name" to newOwnerName,
                    "updated_at" to com.google.firebase.firestore.FieldValue.serverTimestamp()
                ))

                val oldOwnerMemberRef = firestore.collection(COLLECTION_GROUPS)
                    .document(groupId)
                    .collection("members").document(oldOwnerId)
                transaction.update(oldOwnerMemberRef, "role", "ADMIN")

                val newOwnerMemberRef = firestore.collection(COLLECTION_GROUPS)
                    .document(groupId)
                    .collection("members").document(newOwnerId)
                transaction.update(newOwnerMemberRef, "role", "OWNER")

                val oldOwnerGroupRef = firestore.collection("users")
                    .document(oldOwnerId)
                    .collection("groups").document(groupId)
                transaction.update(oldOwnerGroupRef, "role", "ADMIN")

                val newOwnerGroupRef = firestore.collection("users")
                    .document(newOwnerId)
                    .collection("groups").document(groupId)
                transaction.update(newOwnerGroupRef, "role", "OWNER")
            }.await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun syncGroupMemberCount(groupId: String, userIds: List<String>): Result<Unit> {
        return try {
            val correctMemberCount = userIds.size

            // Atualizar grupo principal e todos os UserGroups
            val batch = firestore.batch()

            val groupRef = firestore.collection(COLLECTION_GROUPS).document(groupId)
            batch.update(groupRef, "member_count", correctMemberCount)

            userIds.forEach { memberId ->
                val userGroupRef = firestore.collection("users")
                    .document(memberId)
                    .collection("groups").document(groupId)
                batch.update(userGroupRef, "member_count", correctMemberCount)
            }

            batch.commit().await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun joinGroupByInviteCode(
        inviteCode: String,
        userId: String,
        userName: String,
        userPhoto: String?
    ): Result<String> {
        return try {
            // Buscar grupo com este invite code
            val snapshot = firestore.collection(COLLECTION_GROUPS)
                .whereEqualTo("invite_code", inviteCode)
                .whereEqualTo("status", "ACTIVE")
                .get()
                .await()

            if (snapshot.isEmpty) {
                return Result.failure(Exception("Código de convite inválido"))
            }

            val groupDoc = snapshot.documents[0]
            val groupId = groupDoc.id
            val groupName = groupDoc.getString("name") ?: ""
            val groupPhoto = groupDoc.getString("photo_url")

            // Adicionar membro em transação
            firestore.runTransaction { transaction ->
                val memberRef = firestore.collection(COLLECTION_GROUPS)
                    .document(groupId)
                    .collection("members").document(userId)

                val memberData = mapOf(
                    "user_id" to userId,
                    "user_name" to userName,
                    "user_photo" to userPhoto,
                    "role" to "MEMBER",
                    "status" to "ACTIVE",
                    "joined_at" to com.google.firebase.firestore.FieldValue.serverTimestamp()
                )
                transaction.set(memberRef, memberData)

                // Atualizar member_count
                val groupRef = firestore.collection(COLLECTION_GROUPS).document(groupId)
                transaction.update(groupRef, "member_count", com.google.firebase.firestore.FieldValue.increment(1))

                // Adicionar referência no usuário
                val userGroupRef = firestore.collection("users")
                    .document(userId)
                    .collection("groups").document(groupId)

                val userGroupData = mapOf(
                    "group_id" to groupId,
                    "group_name" to groupName,
                    "group_photo" to groupPhoto,
                    "role" to "MEMBER",
                    "joined_at" to com.google.firebase.firestore.FieldValue.serverTimestamp()
                )
                transaction.set(userGroupRef, userGroupData)
            }.await()

            Result.success(groupId)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun generateGroupInviteCode(groupId: String): Result<String> {
        return try {
            // Gerar código aleatório de 6 caracteres
            val code = (1..6)
                .map { ('A'..'Z').random() }
                .joinToString("")

            val updates = mapOf(
                "invite_code" to code,
                "updated_at" to com.google.firebase.firestore.FieldValue.serverTimestamp()
            )

            firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .update(updates)
                .await()

            Result.success(code)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ========== MÉTODOS AUXILIARES DE GRUPO ==========

    /**
     * Obtém o role do usuário atual em um grupo.
     */
    suspend fun getMyRoleInGroup(groupId: String, userId: String): Result<String?> {
        return try {
            val snapshot = firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection("members")
                .document(userId)
                .get()
                .await()

            val role = snapshot.getString("role")
            Result.success(role)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Verifica se o usuário é membro de um grupo.
     */
    suspend fun isMemberOfGroup(groupId: String, userId: String): Result<Boolean> {
        return try {
            val snapshot = firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection("members")
                .document(userId)
                .get()
                .await()

            val isMember = snapshot.exists() && snapshot.getString("status") == "ACTIVE"
            Result.success(isMember)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Obtém grupos onde o usuário é admin ou owner.
     */
    suspend fun getMyAdminGroups(userId: String): Result<List<String>> {
        return try {
            val snapshot = firestore.collection("users")
                .document(userId)
                .collection("groups")
                .whereIn("role", listOf("OWNER", "ADMIN"))
                .get()
                .await()

            val groupIds = snapshot.documents.map { it.id }
            Result.success(groupIds)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Obtém grupos ativos do usuário onde pode criar jogos (admin/owner).
     */
    suspend fun getValidGroupsForGame(userId: String): Result<List<String>> {
        return try {
            val snapshot = firestore.collection("users")
                .document(userId)
                .collection("groups")
                .whereEqualTo("status", "ACTIVE")
                .whereIn("role", listOf("OWNER", "ADMIN"))
                .get()
                .await()

            val groupIds = snapshot.documents.map { it.id }
            Result.success(groupIds)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Verifica se o usuário pode criar jogos (tem pelo menos um grupo como admin/owner).
     */
    suspend fun canCreateGames(userId: String): Result<Boolean> {
        return try {
            val snapshot = firestore.collection("users")
                .document(userId)
                .collection("groups")
                .whereEqualTo("status", "ACTIVE")
                .whereIn("role", listOf("OWNER", "ADMIN"))
                .limit(1)
                .get()
                .await()

            Result.success(!snapshot.isEmpty)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Conta grupos onde o usuário é admin ou owner.
     */
    suspend fun countMyAdminGroups(userId: String): Result<Int> {
        return try {
            val snapshot = firestore.collection("users")
                .document(userId)
                .collection("groups")
                .whereIn("role", listOf("OWNER", "ADMIN"))
                .get()
                .await()

            Result.success(snapshot.size())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Sincroniza member_count de todos os grupos do usuário.
     */
    suspend fun syncAllMyGroupsMemberCount(userId: String): Result<Unit> {
        return try {
            // Buscar grupos do usuário
            val groupsSnapshot = firestore.collection("users")
                .document(userId)
                .collection("groups")
                .get()
                .await()

            // Para cada grupo, buscar membros e atualizar contagem
            groupsSnapshot.documents.forEach { userGroupDoc ->
                val groupId = userGroupDoc.id

                // Buscar membros do grupo
                val membersSnapshot = firestore.collection(COLLECTION_GROUPS)
                    .document(groupId)
                    .collection("members")
                    .whereEqualTo("status", "ACTIVE")
                    .get()
                    .await()

                val memberCount = membersSnapshot.size()

                // Atualizar contagem
                firestore.runTransaction { transaction ->
                    val groupRef = firestore.collection(COLLECTION_GROUPS).document(groupId)
                    transaction.update(groupRef, "member_count", memberCount)

                    // Atualizar também na coleção do usuário
                    val userGroupRef = firestore.collection("users")
                        .document(userId)
                        .collection("groups").document(groupId)
                    transaction.update(userGroupRef, "member_count", memberCount)
                }.await()
            }

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Obtém a lista de IDs de membros ativos de um grupo.
     */
    suspend fun getGroupActiveMemberIds(groupId: String): Result<List<String>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection("members")
                .whereEqualTo("status", "ACTIVE")
                .get()
                .await()

            val userIds = snapshot.documents.map { it.id }
            Result.success(userIds)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Faz upload da foto/logo do grupo para o Firebase Storage.
     * Path padronizado: groups/{groupId}/logo.jpg
     */
    suspend fun uploadGroupPhoto(groupId: String, photoPath: String): Result<String> {
        return try {
            val storage = FirebaseStorage.getInstance()
            // Path padronizado: groups/{groupId}/logo.jpg (sobrescreve a logo anterior)
            val photoRef = storage.reference.child("groups/$groupId/logo.jpg")

            val file = java.io.File(photoPath)
            val uploadTask = photoRef.putFile(Uri.fromFile(file))

            // Aguardar upload completar
            uploadTask.await()

            // Obter URL de download
            val downloadUrl = photoRef.downloadUrl.await()
            Result.success(downloadUrl.toString())
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

    // ========== PAYMENTS ==========

    actual suspend fun createPayment(payment: Payment): Result<Payment> {
        return try {
            val paymentRef = if (payment.id.isEmpty()) {
                firestore.collection(COLLECTION_PAYMENTS).document()
            } else {
                firestore.collection(COLLECTION_PAYMENTS).document(payment.id)
            }

            val paymentData = hashMapOf(
                "id" to paymentRef.id,
                "user_id" to payment.userId,
                "game_id" to (payment.gameId ?: ""),
                "schedule_id" to (payment.scheduleId ?: ""),
                "type" to payment.type.name,
                "amount" to payment.amount,
                "status" to payment.status.name,
                "payment_method" to (payment.paymentMethod?.name ?: ""),
                "due_date" to payment.dueDate,
                "paid_at" to (payment.paidAt ?: 0L),
                "pix_key" to (payment.pixKey ?: ""),
                "pix_qrcode" to (payment.pixQrcode ?: ""),
                "pix_txid" to (payment.pixTxid ?: ""),
                "receipt_url" to (payment.receiptUrl ?: ""),
                "notes" to (payment.notes ?: ""),
                "created_at" to (payment.createdAt ?: System.currentTimeMillis())
            )

            paymentRef.set(paymentData).await()
            Result.success(payment.copy(id = paymentRef.id))
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao criar pagamento", e)
            Result.failure(e)
        }
    }

    actual suspend fun confirmPayment(paymentId: String): Result<Unit> {
        return try {
            val paymentRef = firestore.collection(COLLECTION_PAYMENTS).document(paymentId)
            paymentRef.update("status", PaymentStatus.PAID.name, "paid_at", System.currentTimeMillis()).await()
            Result.success(Unit)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao confirmar pagamento", e)
            Result.failure(e)
        }
    }

    actual suspend fun getPaymentsByUser(userId: String): Result<List<Payment>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_PAYMENTS)
                .whereEqualTo("user_id", userId)
                .orderBy("created_at", Query.Direction.DESCENDING)
                .get()
                .await()

            val payments = snapshot.documents.mapNotNull { it.toPaymentOrNull() }
            Result.success(payments)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao buscar pagamentos do usuário", e)
            Result.failure(e)
        }
    }

    // ========== CASHBOX ==========

    actual suspend fun uploadCashboxReceipt(groupId: String, filePath: String): Result<String> {
        return try {
            val filename = "receipt_${System.currentTimeMillis()}.jpg"
            // Path padronizado: groups/{groupId}/receipts/{timestamp}.jpg
            val ref = storage.reference.child("groups/$groupId/receipts/$filename")

            val file = File(filePath)
            val uri = android.net.Uri.fromFile(file)

            ref.putFile(uri).await()
            val downloadUrl = ref.downloadUrl.await()

            Result.success(downloadUrl.toString())
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao fazer upload de recibo", e)
            Result.failure(e)
        }
    }

    actual suspend fun addCashboxEntry(
        groupId: String,
        entry: CashboxEntry,
        receiptFilePath: String?
    ): Result<String> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            // Verificar permissão
            val memberDoc = firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection("members")
                .document(userId)
                .get()
                .await()

            if (!memberDoc.exists()) {
                return Result.failure(Exception("Usuário não é membro do grupo"))
            }

            val role = memberDoc.getString("role")
            if (role != "ADMIN" && role != "OWNER") {
                return Result.failure(Exception("Apenas administradores podem lançar no caixa"))
            }

            // Upload da foto se houver
            val finalEntry = if (receiptFilePath != null) {
                val uploadResult = uploadCashboxReceipt(groupId, receiptFilePath)
                if (uploadResult.isSuccess) {
                    entry.copy(receiptUrl = uploadResult.getOrNull())
                } else {
                    return Result.failure(uploadResult.exceptionOrNull() ?: Exception("Erro ao fazer upload do comprovante"))
                }
            } else {
                entry
            }

            val userName = memberDoc.getString("user_name") ?: ""
            val entryRef = firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection(SUBCOLLECTION_CASHBOX)
                .document()

            val summaryRef = firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection(SUBCOLLECTION_CASHBOX_SUMMARY)
                .document("current")

            if (finalEntry.amount <= 0) {
                return Result.failure(Exception("O valor deve ser maior que zero"))
            }

            val entryData = hashMapOf(
                "id" to entryRef.id,
                "type" to finalEntry.type,
                "category" to finalEntry.category,
                "custom_category" to (finalEntry.customCategory ?: ""),
                "amount" to finalEntry.amount,
                "description" to finalEntry.description,
                "created_by_id" to userId,
                "created_by_name" to userName,
                "reference_date" to finalEntry.referenceDate.toString(),
                "created_at" to (finalEntry.createdAt?.toString() ?: com.google.firebase.firestore.FieldValue.serverTimestamp()),
                "player_id" to (finalEntry.playerId ?: ""),
                "player_name" to (finalEntry.playerName ?: ""),
                "game_id" to (finalEntry.gameId ?: ""),
                "receipt_url" to (finalEntry.receiptUrl ?: ""),
                "status" to finalEntry.status
            )

            firestore.runTransaction { transaction ->
                // 1. Buscar sumário atual
                val summaryDoc = transaction.get(summaryRef)
                val balance = summaryDoc.getDouble("balance") ?: 0.0
                val totalIncome = summaryDoc.getDouble("total_income") ?: 0.0
                val totalExpense = summaryDoc.getDouble("total_expense") ?: 0.0
                val entryCount = summaryDoc.getLong("entry_count")?.toInt() ?: 0

                // 2. Calcular novos valores
                val amount = finalEntry.amount
                val newSummary = if (finalEntry.isIncome()) {
                    hashMapOf(
                        "balance" to (balance + amount),
                        "total_income" to (totalIncome + amount),
                        "total_expense" to totalExpense,
                        "last_entry_at" to com.google.firebase.firestore.FieldValue.serverTimestamp(),
                        "entry_count" to (entryCount + 1)
                    )
                } else {
                    hashMapOf(
                        "balance" to (balance - amount),
                        "total_income" to totalIncome,
                        "total_expense" to (totalExpense + amount),
                        "last_entry_at" to com.google.firebase.firestore.FieldValue.serverTimestamp(),
                        "entry_count" to (entryCount + 1)
                    )
                }

                // 3. Atualizar resumo
                transaction.set(summaryRef, newSummary)

                // 4. Adicionar entrada
                transaction.set(entryRef, entryData)

                entryRef.id
            }.await()

            Result.success(entryRef.id)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao adicionar entrada no caixa", e)
            Result.failure(e)
        }
    }

    actual suspend fun getCashboxSummary(groupId: String): Result<CashboxSummary> {
        return try {
            val doc = firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection(SUBCOLLECTION_CASHBOX_SUMMARY)
                .document("current")
                .get()
                .await()

            if (doc.exists()) {
                val summary = CashboxSummary(
                    balance = doc.getDouble("balance") ?: 0.0,
                    totalIncome = doc.getDouble("total_income") ?: 0.0,
                    totalExpense = doc.getDouble("total_expense") ?: 0.0,
                    lastEntryAt = doc.getTimestamp("last_entry_at")?.let { instantFromTimestamp(it) },
                    entryCount = doc.getLong("entry_count")?.toInt() ?: 0
                )
                Result.success(summary)
            } else {
                Result.success(CashboxSummary())
            }
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao buscar resumo do caixa", e)
            Result.failure(e)
        }
    }

    actual fun getCashboxSummaryFlow(groupId: String): Flow<Result<CashboxSummary>> = callbackFlow {
        val listener = firestore.collection(COLLECTION_GROUPS)
            .document(groupId)
            .collection(SUBCOLLECTION_CASHBOX_SUMMARY)
            .document("current")
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }

                val summary = if (snapshot != null && snapshot.exists()) {
                    CashboxSummary(
                        balance = snapshot.getDouble("balance") ?: 0.0,
                        totalIncome = snapshot.getDouble("total_income") ?: 0.0,
                        totalExpense = snapshot.getDouble("total_expense") ?: 0.0,
                        lastEntryAt = snapshot.getTimestamp("last_entry_at")?.let { instantFromTimestamp(it) },
                        entryCount = snapshot.getLong("entry_count")?.toInt() ?: 0
                    )
                } else {
                    CashboxSummary()
                }
                trySend(Result.success(summary))
            }

        awaitClose { listener.remove() }
    }

    actual suspend fun getCashboxHistory(groupId: String, limit: Int): Result<List<CashboxEntry>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection(SUBCOLLECTION_CASHBOX)
                .whereEqualTo("status", CashboxAppStatus.ACTIVE.name)
                .orderBy("created_at", Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val entries = snapshot.documents.mapNotNull { it.toCashboxEntryOrNull() }
            Result.success(entries)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao buscar histórico do caixa", e)
            Result.failure(e)
        }
    }

    actual fun getCashboxHistoryFlow(groupId: String, limit: Int): Flow<Result<List<CashboxEntry>>> = callbackFlow {
        val listener = firestore.collection(COLLECTION_GROUPS)
            .document(groupId)
            .collection(SUBCOLLECTION_CASHBOX)
            .whereEqualTo("status", CashboxAppStatus.ACTIVE.name)
            .orderBy("created_at", Query.Direction.DESCENDING)
            .limit(limit.toLong())
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }
                val entries = snapshot?.documents?.mapNotNull { it.toCashboxEntryOrNull() } ?: emptyList()
                trySend(Result.success(entries))
            }

        awaitClose { listener.remove() }
    }

    actual suspend fun getCashboxHistoryFiltered(
        groupId: String,
        filter: CashboxFilter,
        limit: Int
    ): Result<List<CashboxEntry>> {
        return try {
            var query: Query = firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection(SUBCOLLECTION_CASHBOX)
                .whereEqualTo("status", CashboxAppStatus.ACTIVE.name)

            // Aplicar filtro de tipo
            filter.type?.let {
                query = query.whereEqualTo("type", it.name)
            }

            // Aplicar filtro de categoria
            filter.category?.let {
                query = query.whereEqualTo("category", it.name)
            }

            // Aplicar filtro de jogador
            filter.playerId?.let {
                query = query.whereEqualTo("player_id", it)
            }

            // Aplicar filtro de data inicial
            filter.startDate?.let {
                query = query.whereGreaterThanOrEqualTo("reference_date", it.toString())
            }

            // Aplicar filtro de data final
            filter.endDate?.let {
                query = query.whereLessThanOrEqualTo("reference_date", it.toString())
            }

            // Determinar campo de ordenação
            val orderByField = if (filter.startDate != null || filter.endDate != null) {
                "reference_date"
            } else {
                "created_at"
            }

            val snapshot = query
                .orderBy(orderByField, Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val entries = snapshot.documents.mapNotNull { it.toCashboxEntryOrNull() }
            Result.success(entries)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao buscar histórico filtrado do caixa", e)
            Result.failure(e)
        }
    }

    actual suspend fun getCashboxEntriesByMonth(
        groupId: String,
        year: Int,
        month: Int
    ): Result<List<CashboxEntry>> {
        return try {
            val calendar = java.util.Calendar.getInstance()
            calendar.set(year, month - 1, 1, 0, 0, 0)
            calendar.set(java.util.Calendar.MILLISECOND, 0)
            val startDate = calendar.time

            calendar.set(year, month, 1, 0, 0, 0)
            calendar.set(java.util.Calendar.MILLISECOND, 0)
            val endDate = calendar.time

            val snapshot = firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection(SUBCOLLECTION_CASHBOX)
                .whereEqualTo("status", CashboxAppStatus.ACTIVE.name)
                .whereGreaterThanOrEqualTo("reference_date", startDate.toString())
                .whereLessThan("reference_date", endDate.toString())
                .orderBy("reference_date", Query.Direction.DESCENDING)
                .get()
                .await()

            val entries = snapshot.documents.mapNotNull { it.toCashboxEntryOrNull() }
            Result.success(entries)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao buscar entradas por mês", e)
            Result.failure(e)
        }
    }

    actual suspend fun getCashboxEntryById(groupId: String, entryId: String): Result<CashboxEntry> {
        return try {
            val doc = firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection(SUBCOLLECTION_CASHBOX)
                .document(entryId)
                .get()
                .await()

            if (doc.exists()) {
                val entry = doc.toCashboxEntryOrNull()
                    ?: return Result.failure(Exception("Erro ao converter entrada"))
                Result.success(entry)
            } else {
                Result.failure(Exception("Entrada não encontrada"))
            }
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao buscar entrada por ID", e)
            Result.failure(e)
        }
    }

    actual suspend fun deleteCashboxEntry(groupId: String, entryId: String): Result<Unit> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            // Verificar se é admin do grupo
            val memberDoc = firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection("members")
                .document(userId)
                .get()
                .await()

            if (!memberDoc.exists()) {
                return Result.failure(Exception("Você não é membro deste grupo"))
            }

            val role = memberDoc.getString("role")
            if (role != "OWNER") {
                return Result.failure(Exception("Apenas o dono do grupo pode estornar entradas"))
            }

            // Buscar entrada para saber o valor
            val entryDoc = firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection(SUBCOLLECTION_CASHBOX)
                .document(entryId)
                .get()
                .await()

            if (!entryDoc.exists()) {
                return Result.failure(Exception("Entrada não encontrada"))
            }

            val entry = entryDoc.toCashboxEntryOrNull()
                ?: return Result.failure(Exception("Erro ao converter entrada"))

            if (entry.status == CashboxAppStatus.VOIDED.name) {
                return Result.failure(Exception("Esta entrada já foi estornada"))
            }

            // Executar transação
            firestore.runTransaction { transaction ->
                // 1. Atualizar resumo
                val summaryRef = firestore.collection(COLLECTION_GROUPS)
                    .document(groupId)
                    .collection(SUBCOLLECTION_CASHBOX_SUMMARY)
                    .document("current")

                val summaryDoc = transaction.get(summaryRef)
                val balance = summaryDoc.getDouble("balance") ?: 0.0
                val totalIncome = summaryDoc.getDouble("total_income") ?: 0.0
                val totalExpense = summaryDoc.getDouble("total_expense") ?: 0.0
                val entryCount = summaryDoc.getLong("entry_count")?.toInt() ?: 0

                val amountDelta = if (entry.isIncome()) -entry.amount else entry.amount
                val newBalance = balance + amountDelta
                val newTotalIncome = if (entry.isIncome()) {
                    totalIncome - entry.amount
                } else {
                    totalIncome
                }
                val newTotalExpense = if (entry.isExpense()) {
                    totalExpense - entry.amount
                } else {
                    totalExpense
                }

                transaction.update(summaryRef, mapOf(
                    "balance" to newBalance,
                    "total_income" to newTotalIncome,
                    "total_expense" to newTotalExpense,
                    "last_entry_at" to com.google.firebase.firestore.FieldValue.serverTimestamp(),
                    "entry_count" to (entryCount - 1).coerceAtLeast(0)
                ))

                // 2. Marcar como cancelada (Soft Delete)
                val entryRef = firestore.collection(COLLECTION_GROUPS)
                    .document(groupId)
                    .collection(SUBCOLLECTION_CASHBOX)
                    .document(entryId)
                transaction.update(entryRef, mapOf(
                    "status" to CashboxAppStatus.VOIDED.name,
                    "voided_at" to com.google.firebase.firestore.FieldValue.serverTimestamp(),
                    "voided_by" to userId
                ))
            }.await()

            Result.success(Unit)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao deletar entrada do caixa", e)
            Result.failure(e)
        }
    }

    actual suspend fun recalculateCashboxBalance(groupId: String): Result<CashboxSummary> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            // Verificar se é admin do grupo
            val memberDoc = firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection("members")
                .document(userId)
                .get()
                .await()

            val role = memberDoc.getString("role")
            if (role != "ADMIN" && role != "OWNER") {
                return Result.failure(Exception("Apenas administradores podem recalcular o saldo"))
            }

            // Buscar todas as entradas
            val entriesSnapshot = firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection(SUBCOLLECTION_CASHBOX)
                .whereEqualTo("status", CashboxAppStatus.ACTIVE.name)
                .get()
                .await()

            var totalIncome = 0.0
            var totalExpense = 0.0
            var lastEntryDate: com.google.firebase.Timestamp? = null

            val entries = entriesSnapshot.documents.mapNotNull { it.toCashboxEntryOrNull() }

            // Ordenar para pegar a data mais recente corretamente (colocar nulls no final)
            val sortedEntries = entries.sortedByDescending { it.createdAt ?: kotlinx.datetime.Clock.System.now() }

            sortedEntries.forEach { entry ->
                if (entry.isIncome()) {
                    totalIncome += entry.amount
                } else {
                    totalExpense += entry.amount
                }
            }

            lastEntryDate = sortedEntries.firstOrNull()?.createdAt?.let { instant ->
                com.google.firebase.Timestamp(instant.toEpochMilliseconds() / 1000, ((instant.toEpochMilliseconds() % 1000) * 1_000_000).toInt())
            }

            val balance = totalIncome - totalExpense

            // Atualizar resumo
            val summary = CashboxSummary(
                balance = balance,
                totalIncome = totalIncome,
                totalExpense = totalExpense,
                lastEntryAt = lastEntryDate?.let { instantFromTimestamp(it) },
                entryCount = entries.size
            )

            firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection(SUBCOLLECTION_CASHBOX_SUMMARY)
                .document("current")
                .set(mapOf(
                    "balance" to balance,
                    "total_income" to totalIncome,
                    "total_expense" to totalExpense,
                    "last_entry_at" to (lastEntryDate ?: com.google.firebase.firestore.FieldValue.serverTimestamp()),
                    "entry_count" to entries.size
                ))
                .await()

            Result.success(summary)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao recalcular saldo do caixa", e)
            Result.failure(e)
        }
    }

    // ========== RANKINGS ==========

    actual suspend fun getRankingByCategory(
        category: String,
        field: String,
        limit: Int
    ): Result<List<Triple<String, Long, Int>>> {
        return try {
            // Se for XP, buscar da coleção users, senão da statistics
            val collection = if (category == "XP") COLLECTION_USERS else COLLECTION_STATISTICS

            val snapshot = firestore.collection(collection)
                .orderBy(field, Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val results = snapshot.documents.mapNotNull { doc ->
                val userId = doc.id
                val value = when (category) {
                    "XP" -> doc.getLong("experience_points") ?: 0L
                    else -> doc.getLong(field) ?: 0L
                }
                val games = if (category == "XP") {
                    // Para XP, não temos games no users collection
                    0
                } else {
                    doc.getLong("totalGames")?.toInt() ?: doc.getLong("total_games")?.toInt() ?: 0
                }
                Triple(userId, value, games)
            }

            Result.success(results)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao buscar ranking $category", e)
            Result.failure(e)
        }
    }

    actual suspend fun getRankingDeltas(
        periodName: String,
        periodKey: String,
        deltaField: String,
        minGames: Int,
        limit: Int
    ): Result<List<Triple<String, Long, Int>>> {
        return try {
            val snapshot = firestore.collection("ranking_deltas")
                .whereEqualTo("period", periodName)
                .whereEqualTo("period_key", periodKey)
                .orderBy(deltaField, Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val deltas = snapshot.documents.mapNotNull { doc ->
                val userId = doc.getString("user_id") ?: return@mapNotNull null
                val value = doc.getLong(deltaField) ?: 0L
                val games = doc.getLong("games_added")?.toInt() ?: 0
                Triple(userId, value, games)
            }.filter { (_, _, games) -> games >= minGames } // Filtrar por mínimo de jogos

            Result.success(deltas)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao buscar ranking deltas", e)
            Result.failure(e)
        }
    }

    actual suspend fun getUsersStatistics(userIds: List<String>): Result<Map<String, Statistics>> {
        return try {
            if (userIds.isEmpty()) {
                return Result.success(emptyMap())
            }

            // Buscar em chunks de 10 (limite do whereIn)
            val statisticsMap = mutableMapOf<String, Statistics>()
            val chunks = userIds.chunked(10)

            chunks.forEach { chunk ->
                val snapshot = firestore.collection(COLLECTION_STATISTICS)
                    .whereIn(FieldPath.documentId(), chunk)
                    .get()
                    .await()

                snapshot.documents.forEach { doc ->
                    val stats = doc.toRankingStatisticsOrNull()
                    if (stats != null) {
                        statisticsMap[doc.id] = stats
                    }
                }
            }

            Result.success(statisticsMap)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao buscar estatísticas em batch", e)
            Result.failure(e)
        }
    }

    actual suspend fun getStatisticsRanking(orderByField: String, limit: Int): Result<List<Statistics>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_STATISTICS)
                .orderBy(orderByField, Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val statistics = snapshot.documents.mapNotNull { it.toRankingStatisticsOrNull() }
            Result.success(statistics)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao buscar ranking de estatísticas", e)
            Result.failure(e)
        }
    }

    // ========== NOTIFICATIONS ==========

    actual suspend fun getMyNotifications(limit: Int): Result<List<AppNotification>> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val snapshot = firestore.collection("notifications")
                .whereEqualTo("user_id", userId)
                .orderBy("created_at", Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val notifications = snapshot.documents.mapNotNull { it.toAppNotificationOrNull() }
            Result.success(notifications)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao buscar notificações", e)
            Result.failure(e)
        }
    }

    actual fun getMyNotificationsFlow(limit: Int): Flow<List<AppNotification>> = callbackFlow {
        val userId = auth.currentUser?.uid ?: run {
            trySend(emptyList())
            close()
            return@callbackFlow
        }

        val listener = firestore.collection("notifications")
            .whereEqualTo("user_id", userId)
            .orderBy("created_at", Query.Direction.DESCENDING)
            .limit(limit.toLong())
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(emptyList())
                    return@addSnapshotListener
                }
                val notifications = snapshot?.documents?.mapNotNull { it.toAppNotificationOrNull() }
                    ?: emptyList()
                trySend(notifications)
            }

        awaitClose { listener.remove() }
    }

    actual suspend fun getUnreadNotifications(): Result<List<AppNotification>> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val snapshot = firestore.collection("notifications")
                .whereEqualTo("user_id", userId)
                .whereEqualTo("read", false)
                .get()
                .await()

            val notifications = snapshot.documents.mapNotNull { it.toAppNotificationOrNull() }
            Result.success(notifications)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao buscar notificações não lidas", e)
            Result.failure(e)
        }
    }

    actual fun getUnreadCountFlow(): Flow<Int> = callbackFlow {
        val userId = auth.currentUser?.uid ?: run {
            trySend(0)
            close()
            return@callbackFlow
        }

        val listener = firestore.collection("notifications")
            .whereEqualTo("user_id", userId)
            .whereEqualTo("read", false)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    trySend(0)
                    return@addSnapshotListener
                }
                trySend(snapshot?.size() ?: 0)
            }

        awaitClose { listener.remove() }
    }

    actual suspend fun getUnreadCount(): Result<Int> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val snapshot = firestore.collection("notifications")
                .whereEqualTo("user_id", userId)
                .whereEqualTo("read", false)
                .get()
                .await()

            Result.success(snapshot.size())
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao contar notificações não lidas", e)
            Result.failure(e)
        }
    }

    actual suspend fun markNotificationAsRead(notificationId: String): Result<Unit> {
        return try {
            firestore.collection("notifications")
                .document(notificationId)
                .update(mapOf(
                    "read" to true,
                    "read_at" to com.google.firebase.firestore.FieldValue.serverTimestamp()
                ))
                .await()

            Result.success(Unit)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao marcar notificação como lida", e)
            Result.failure(e)
        }
    }

    actual suspend fun markNotificationAsUnread(notificationId: String): Result<Unit> {
        return try {
            firestore.collection("notifications")
                .document(notificationId)
                .update(mapOf(
                    "read" to false,
                    "read_at" to com.google.firebase.firestore.FieldValue.delete()
                ))
                .await()

            Result.success(Unit)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao marcar notificação como não lida", e)
            Result.failure(e)
        }
    }

    actual suspend fun markAllNotificationsAsRead(): Result<Unit> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val snapshot = firestore.collection("notifications")
                .whereEqualTo("user_id", userId)
                .whereEqualTo("read", false)
                .get()
                .await()

            if (snapshot.isEmpty) {
                return Result.success(Unit)
            }

            val batch = firestore.batch()
            snapshot.documents.forEach { doc ->
                batch.update(doc.reference, mapOf(
                    "read" to true,
                    "read_at" to com.google.firebase.firestore.FieldValue.serverTimestamp()
                ))
            }
            batch.commit().await()

            Result.success(Unit)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao marcar todas como lidas", e)
            Result.failure(e)
        }
    }

    actual suspend fun getNotificationById(notificationId: String): Result<AppNotification> {
        return try {
            val doc = firestore.collection("notifications")
                .document(notificationId)
                .get()
                .await()

            val notification = doc.toAppNotificationOrNull()
                ?: return Result.failure(Exception("Notificação não encontrada"))

            Result.success(notification)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao buscar notificação por ID", e)
            Result.failure(e)
        }
    }

    actual suspend fun createNotification(notification: AppNotification): Result<String> {
        return try {
            val docRef = if (notification.id.isNotEmpty()) {
                firestore.collection("notifications").document(notification.id)
            } else {
                firestore.collection("notifications").document()
            }

            val notificationWithId = notification.copy(id = docRef.id)
            docRef.set(notificationWithId).await()

            Result.success(docRef.id)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao criar notificação", e)
            Result.failure(e)
        }
    }

    actual suspend fun batchCreateNotifications(notifications: List<AppNotification>): Result<Unit> {
        return try {
            if (notifications.isEmpty()) return Result.success(Unit)

            val batch = firestore.batch()
            notifications.forEach { notification ->
                val docRef = if (notification.id.isNotEmpty()) {
                    firestore.collection("notifications").document(notification.id)
                } else {
                    firestore.collection("notifications").document()
                }
                val notificationWithId = notification.copy(id = docRef.id)
                batch.set(docRef, notificationWithId)
            }
            batch.commit().await()

            Result.success(Unit)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao criar notificações em lote", e)
            Result.failure(e)
        }
    }

    actual suspend fun deleteNotification(notificationId: String): Result<Unit> {
        return try {
            firestore.collection("notifications")
                .document(notificationId)
                .delete()
                .await()

            Result.success(Unit)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao deletar notificação", e)
            Result.failure(e)
        }
    }

    actual suspend fun deleteOldNotifications(): Result<Int> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val thirtyDaysAgo = Date(System.currentTimeMillis() - 30 * 24 * 60 * 60 * 1000L)

            // Buscar notificações antigas por data
            val oldSnapshot = firestore.collection("notifications")
                .whereEqualTo("user_id", userId)
                .whereLessThan("created_at", thirtyDaysAgo)
                .get()
                .await()

            // Buscar TODAS as notificações do usuário para verificar as com data nula
            val allSnapshot = firestore.collection("notifications")
                .whereEqualTo("user_id", userId)
                .get()
                .await()

            val docsToDelete = mutableListOf<com.google.firebase.firestore.DocumentSnapshot>()

            // Adicionar notificações antigas
            docsToDelete.addAll(oldSnapshot.documents)

            // Adicionar notificações com created_at nulo ou ausente
            allSnapshot.documents.forEach { doc ->
                val createdAt = doc.get("created_at")
                if (createdAt == null && !docsToDelete.any { it.id == doc.id }) {
                    docsToDelete.add(doc)
                }
            }

            if (docsToDelete.isEmpty()) {
                return Result.success(0)
            }

            // Dividir em batches de 400 (limite do Firestore é 500)
            val batches = docsToDelete.chunked(400)
            batches.forEach { chunk ->
                val batch = firestore.batch()
                chunk.forEach { doc ->
                    batch.delete(doc.reference)
                }
                batch.commit().await()
            }

            Result.success(docsToDelete.size)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao deletar notificações antigas", e)
            Result.failure(e)
        }
    }

    actual suspend fun getNotificationsByType(type: NotificationType, limit: Int): Result<List<AppNotification>> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val snapshot = firestore.collection("notifications")
                .whereEqualTo("user_id", userId)
                .whereEqualTo("type", type.name)
                .orderBy("created_at", Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val notifications = snapshot.documents.mapNotNull { it.toAppNotificationOrNull() }
            Result.success(notifications)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao buscar notificações por tipo", e)
            Result.failure(e)
        }
    }

    actual suspend fun getPendingActionNotifications(): Result<List<AppNotification>> {
        return try {
            val userId = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val snapshot = firestore.collection("notifications")
                .whereEqualTo("user_id", userId)
                .whereEqualTo("read", false)
                .get()
                .await()

            val now = System.currentTimeMillis()
            val notifications = snapshot.documents
                .mapNotNull { it.toAppNotificationOrNull() }
                .filter { it.requiresResponse() && (it.expiresAt == null || it.expiresAt > now) }

            Result.success(notifications)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao buscar notificações pendentes", e)
            Result.failure(e)
        }
    }

    // ========== GAMIFICATION - STREAKS ==========

    actual suspend fun getUserStreak(userId: String): Result<UserStreak?> {
        return try {
            val snapshot = firestore.collection("user_streaks")
                .whereEqualTo("user_id", userId)
                .get()
                .await()

            val streak = snapshot.documents.firstOrNull()?.toUserStreakOrNull()
            Result.success(streak)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun saveUserStreak(streak: UserStreak): Result<Unit> {
        return try {
            // Buscar documento existente
            val existingSnapshot = firestore.collection("user_streaks")
                .whereEqualTo("user_id", streak.userId)
                .get()
                .await()

            val docId = existingSnapshot.documents.firstOrNull()?.id
                ?: firestore.collection("user_streaks").document().id

            firestore.collection("user_streaks")
                .document(docId)
                .set(streak)
                .await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ========== GAMIFICATION - BADGES ==========

    actual suspend fun getAvailableBadges(): Result<List<BadgeDefinition>> {
        return try {
            val snapshot = firestore.collection("badges")
                .get()
                .await()

            val badges = snapshot.documents.mapNotNull { it.toBadgeDefinitionOrNull() }
            Result.success(badges)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun getUserBadges(userId: String): Result<List<UserBadge>> {
        return try {
            val snapshot = firestore.collection("user_badges")
                .whereEqualTo("user_id", userId)
                .get()
                .await()

            val badges = snapshot.documents.mapNotNull { it.toUserBadgeOrNull() }
            Result.success(badges)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun getRecentBadges(userId: String, limit: Int): Result<List<UserBadge>> {
        return try {
            val snapshot = firestore.collection("user_badges")
                .whereEqualTo("user_id", userId)
                .orderBy("unlocked_at", Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val badges = snapshot.documents.mapNotNull { it.toUserBadgeOrNull() }
            Result.success(badges)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun createUserBadge(userBadge: UserBadge): Result<UserBadge> {
        return try {
            val docRef = firestore.collection("user_badges").document()
            val badgeWithId = userBadge.copy(id = docRef.id)
            docRef.set(badgeWithId).await()
            Result.success(badgeWithId)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun updateUserBadge(userBadge: UserBadge): Result<Unit> {
        return try {
            firestore.collection("user_badges")
                .document(userBadge.id)
                .set(userBadge)
                .await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ========== GAMIFICATION - SEASONS ==========

    actual suspend fun getActiveSeason(): Result<Season?> {
        return try {
            // SEMPRE usar a season do mês atual (formato: monthly_YYYY_MM)
            val calendar = Calendar.getInstance()
            val year = calendar.get(Calendar.YEAR)
            val month = calendar.get(Calendar.MONTH) + 1 // Calendar.MONTH é 0-indexed
            val seasonId = "monthly_${year}_${String.format("%02d", month)}"

            // Buscar a season do mês atual
            val doc = firestore.collection("seasons").document(seasonId).get().await()

            val season = if (doc.exists()) {
                doc.toSeasonOrNull()
            } else {
                // Se não existe, criar automaticamente
                // Início do mês (dia 1, 00:00:00)
                val startCalendar = Calendar.getInstance().apply {
                    set(Calendar.YEAR, year)
                    set(Calendar.MONTH, month - 1)
                    set(Calendar.DAY_OF_MONTH, 1)
                    set(Calendar.HOUR_OF_DAY, 0)
                    set(Calendar.MINUTE, 0)
                    set(Calendar.SECOND, 0)
                    set(Calendar.MILLISECOND, 0)
                }

                // Fim do mês (último dia, 23:59:59)
                val endCalendar = Calendar.getInstance().apply {
                    set(Calendar.YEAR, year)
                    set(Calendar.MONTH, month - 1)
                    set(Calendar.DAY_OF_MONTH, getActualMaximum(Calendar.DAY_OF_MONTH))
                    set(Calendar.HOUR_OF_DAY, 23)
                    set(Calendar.MINUTE, 59)
                    set(Calendar.SECOND, 59)
                    set(Calendar.MILLISECOND, 999)
                }

                // Nome da season (ex: "Janeiro 2025")
                val dateFormat = SimpleDateFormat("MMMM yyyy", Locale.getDefault())
                val seasonName = dateFormat.format(startCalendar.time)
                    .replaceFirstChar { it.uppercase() }

                val newSeason = Season(
                    id = seasonId,
                    name = seasonName,
                    startDate = startCalendar.timeInMillis,
                    endDate = endCalendar.timeInMillis,
                    isActive = true
                )

                // Salvar no Firestore
                firestore.collection("seasons").document(seasonId).set(
                    mapOf(
                        "id" to newSeason.id,
                        "name" to newSeason.name,
                        "start_date" to com.google.firebase.Timestamp(Date(newSeason.startDate)),
                        "end_date" to com.google.firebase.Timestamp(Date(newSeason.endDate)),
                        "is_active" to true,
                        "created_at" to com.google.firebase.firestore.FieldValue.serverTimestamp()
                    )
                ).await()

                newSeason
            }

            Result.success(season)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun getAllSeasons(): Result<List<Season>> {
        return try {
            val snapshot = firestore.collection("seasons")
                .get()
                .await()

            val seasons = snapshot.documents.mapNotNull { it.toSeasonOrNull() }
                .sortedWith(
                    compareByDescending<Season> { it.endDate }
                        .thenByDescending { it.startDate }
                        .thenByDescending { it.id }
                )

            Result.success(seasons)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun getSeasonRanking(seasonId: String, limit: Int): Result<List<SeasonParticipation>> {
        return try {
            val snapshot = firestore.collection("season_participation")
                .whereEqualTo("season_id", seasonId)
                .orderBy("points", Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val ranking = snapshot.documents.mapNotNull { it.toSeasonParticipationOrNull() }
            Result.success(ranking)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual fun observeSeasonRanking(seasonId: String, limit: Int): Flow<List<SeasonParticipation>> {
        return callbackFlow {
            val listener = firestore.collection("season_participation")
                .whereEqualTo("season_id", seasonId)
                .orderBy("points", Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .addSnapshotListener { snapshot, error ->
                    if (error != null) {
                        close(error)
                        return@addSnapshotListener
                    }

                    val ranking = snapshot?.documents?.mapNotNull { it.toSeasonParticipationOrNull() } ?: emptyList()
                    trySend(ranking)
                }

            awaitClose { listener.remove() }
        }
    }

    actual suspend fun getSeasonParticipation(seasonId: String, userId: String): Result<SeasonParticipation?> {
        return try {
            val snapshot = firestore.collection("season_participation")
                .whereEqualTo("season_id", seasonId)
                .whereEqualTo("user_id", userId)
                .get()
                .await()

            val participation = snapshot.documents.firstOrNull()?.toSeasonParticipationOrNull()
            Result.success(participation)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun saveSeasonParticipation(participation: SeasonParticipation): Result<Unit> {
        return try {
            // Buscar documento existente
            val existingSnapshot = firestore.collection("season_participation")
                .whereEqualTo("season_id", participation.seasonId)
                .whereEqualTo("user_id", participation.userId)
                .get()
                .await()

            val docId = existingSnapshot.documents.firstOrNull()?.id
                ?: firestore.collection("season_participation").document().id

            firestore.collection("season_participation")
                .document(docId)
                .set(participation)
                .await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ========== GAMIFICATION - CHALLENGES ==========

    actual suspend fun getActiveChallenges(): Result<List<WeeklyChallenge>> {
        return try {
            val now = Date()
            val snapshot = firestore.collection("challenges")
                .whereLessThanOrEqualTo("start_date", now)
                .orderBy("start_date", Query.Direction.DESCENDING)
                .limit(20)
                .get()
                .await()

            val challenges = snapshot.documents.mapNotNull { doc ->
                doc.toWeeklyChallengeOrNull()
            }.filter { challenge ->
                // Filtrar apenas desafios ativos (endDate vazio ou no futuro)
                try {
                    if (challenge.endDate.isEmpty()) return@filter true
                    val end = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault()).parse(challenge.endDate)
                    end?.after(now) ?: true
                } catch (e: Exception) {
                    true // Se falhar ao parse, assume ativo
                }
            }

            Result.success(challenges)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun getChallengesProgress(userId: String, challengeIds: List<String>): Result<List<UserChallengeProgress>> {
        return try {
            if (challengeIds.isEmpty()) {
                return Result.success(emptyList())
            }

            // Firestore limit para 'IN' query é 10
            val chunks = challengeIds.chunked(10)
            val allProgress = mutableListOf<UserChallengeProgress>()

            chunks.forEach { chunk ->
                val snapshot = firestore.collection("challenge_progress")
                    .whereEqualTo("user_id", userId)
                    .whereIn("challenge_id", chunk)
                    .get()
                    .await()

                allProgress.addAll(snapshot.documents.mapNotNull { it.toUserChallengeProgressOrNull() })
            }

            Result.success(allProgress)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ========== LOCATIONS ==========

    actual suspend fun getAllLocations(): Result<List<Location>> {
        return try {
            // OTIMIZAÇÃO: Limitado a 100 locais para evitar carregar toda a coleção
            // Para listas maiores, use getLocationsWithPagination() com cursor
            val snapshot = firestore.collection("locations")
                .orderBy("name")
                .limit(100)
                .get()
                .await()

            Result.success(snapshot.documents.mapNotNull { it.toLocationOrNull() })
        } catch (e: Exception) {
            logLocationQueryError("getAllLocations", e)
            Result.failure(e)
        }
    }

    actual suspend fun getLocationsWithPagination(limit: Int, lastLocationName: String?): Result<List<Location>> {
        return try {
            var query = firestore.collection("locations")
                .orderBy("name")
                .limit(limit.toLong())

            if (lastLocationName != null) {
                query = query.startAfter(lastLocationName)
            }

            val snapshot = query.get().await()
            Result.success(snapshot.documents.mapNotNull { it.toLocationOrNull() })
        } catch (e: Exception) {
            logLocationQueryError(
                "getLocationsWithPagination",
                e,
                mapOf("limit" to limit.toString(), "lastLocationName" to (lastLocationName ?: "null"))
            )
            Result.failure(e)
        }
    }

    actual suspend fun getLocationsPaginated(
        pageSize: Int,
        cursor: String?,
        sortBy: LocationSortField
    ): Result<PaginatedResult<Location>> {
        return try {
            // Limita tamanho da página (máximo 50)
            val effectivePageSize = pageSize.coerceIn(1, 50)

            var query = firestore.collection("locations")
                .orderBy(sortBy.firestoreField, Query.Direction.ASCENDING)
                .limit((effectivePageSize + 1).toLong()) // +1 para verificar se há mais

            // Se há cursor, buscar o documento e usar como âncora
            if (!cursor.isNullOrBlank()) {
                val cursorData = decodeCursor(cursor)
                    ?: return Result.failure(CursorDecodingException("Cursor inválido ou expirado"))

                // Verificar se o campo de ordenação do cursor corresponde ao atual
                if (cursorData.sortField != sortBy) {
                    return Result.failure(CursorMismatchException(
                        "Campo de ordenação do cursor (${cursorData.sortField}) " +
                        "não corresponde ao solicitado ($sortBy)"
                    ))
                }

                // Buscar documento de referência para usar como âncora
                val anchorDoc = firestore.collection("locations")
                    .document(cursorData.documentId)
                    .get()
                    .await()

                if (!anchorDoc.exists()) {
                    return Result.failure(CursorDocumentNotFoundException(
                        "Documento do cursor não existe mais: ${cursorData.documentId}"
                    ))
                }

                query = query.startAfter(anchorDoc)
            }

            val snapshot = query.get().await()
            val allDocs = snapshot.documents

            // Verifica se há mais páginas
            val hasMore = allDocs.size > effectivePageSize
            val docsToReturn = if (hasMore) allDocs.take(effectivePageSize) else allDocs

            // Converte para Location
            val locations = docsToReturn.mapNotNull { it.toLocationOrNull() }

            // Gera cursor para próxima página (baseado no último documento retornado)
            val nextCursor = if (hasMore && docsToReturn.isNotEmpty()) {
                val lastDoc = docsToReturn.last()
                val lastValue = when (sortBy) {
                    LocationSortField.NAME -> lastDoc.getString("name")
                    LocationSortField.CITY -> lastDoc.getString("city")
                    LocationSortField.RATING -> lastDoc.getDouble("rating")?.toString()
                    LocationSortField.CREATED_AT -> lastDoc.getLong("createdAt")?.toString()
                }
                encodeCursor(lastDoc.reference.path, sortBy, lastValue)
            } else {
                null
            }

            Result.success(
                PaginatedResult(
                    items = locations,
                    cursor = nextCursor,
                    hasMore = hasMore
                )
            )
        } catch (e: CursorDecodingException) {
            Result.failure(e)
        } catch (e: CursorMismatchException) {
            Result.failure(e)
        } catch (e: CursorDocumentNotFoundException) {
            Result.failure(e)
        } catch (e: Exception) {
            logLocationQueryError(
                "getLocationsPaginated",
                e,
                mapOf(
                    "pageSize" to pageSize.toString(),
                    "cursor" to (cursor ?: "null"),
                    "sortBy" to sortBy.name
                )
            )
            Result.failure(e)
        }
    }

    /**
     * Codifica dados do cursor para string Base64.
     */
    private fun encodeCursor(documentPath: String, sortField: LocationSortField, lastValue: Any?): String {
        val json = org.json.JSONObject().apply {
            put("documentPath", documentPath)
            put("sortField", sortField.name)
            put("lastValue", lastValue?.toString() ?: "")
            put("timestamp", System.currentTimeMillis())
        }
        return android.util.Base64.encodeToString(
            json.toString().toByteArray(Charsets.UTF_8),
            android.util.Base64.URL_SAFE or android.util.Base64.NO_WRAP
        )
    }

    /**
     * Decodifica cursor de string Base64.
     * Retorna null se cursor inválido ou expirado (>15 minutos).
     */
    private fun decodeCursor(cursor: String): CursorInfo? {
        return try {
            val jsonString = String(
                android.util.Base64.decode(cursor, android.util.Base64.URL_SAFE),
                Charsets.UTF_8
            )
            val json = org.json.JSONObject(jsonString)

            // Verificar expiração (15 minutos)
            val timestamp = json.optLong("timestamp", 0)
            if (timestamp > 0 && System.currentTimeMillis() - timestamp > 15 * 60 * 1000) {
                android.util.Log.w("FirebaseDataSource", "Cursor expirado")
                return null
            }

            CursorInfo(
                documentPath = json.getString("documentPath"),
                sortField = LocationSortField.fromString(json.optString("sortField", "NAME")),
                lastValue = json.optString("lastValue").takeIf { it.isNotEmpty() },
                timestamp = timestamp
            )
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao decodificar cursor", e)
            null
        }
    }

    actual suspend fun deleteLocation(locationId: String): Result<Unit> {
        return try {
            firestore.collection("locations")
                .document(locationId)
                .delete()
                .await()
            Result.success(Unit)
        } catch (e: Exception) {
            logLocationUpdateError(locationId, "delete", e)
            Result.failure(e)
        }
    }

    actual suspend fun deleteLocationWithFields(locationId: String): Result<Int> {
        return try {
            // 1. Verificar se o local existe
            val locationDoc = firestore.collection("locations")
                .document(locationId)
                .get()
                .await()

            if (!locationDoc.exists()) {
                return Result.failure(Exception("Local não encontrado: $locationId"))
            }

            // 2. Buscar todas as quadras (fields) associadas ao local
            val fieldsSnapshot = firestore.collection("fields")
                .whereEqualTo("location_id", locationId)
                .get()
                .await()

            val fieldIds = fieldsSnapshot.documents.map { it.id }
            val totalDocsToDelete = 1 + fieldIds.size // 1 location + N fields

            android.util.Log.d(
                "FirebaseDataSource",
                "deleteLocationWithFields: location=$locationId, fields=${fieldIds.size}, total=$totalDocsToDelete"
            )

            // 3. Criar batch de delete (limite: 500 operações)
            val maxFieldsPerBatch = 499

            if (fieldIds.size <= maxFieldsPerBatch) {
                // Tudo cabe em um único batch
                val batch = firestore.batch()
                batch.delete(firestore.collection("locations").document(locationId))
                fieldIds.forEach { fieldId ->
                    batch.delete(firestore.collection("fields").document(fieldId))
                }
                batch.commit().await()
            } else {
                // Múltiplos batches necessários
                val fieldChunks = fieldIds.chunked(maxFieldsPerBatch)

                for ((index, chunk) in fieldChunks.withIndex()) {
                    val batch = firestore.batch()

                    // Deletar location apenas no primeiro batch
                    if (index == 0) {
                        batch.delete(firestore.collection("locations").document(locationId))
                    }

                    chunk.forEach { fieldId ->
                        batch.delete(firestore.collection("fields").document(fieldId))
                    }

                    batch.commit().await()
                }
            }

            Result.success(totalDocsToDelete)
        } catch (e: Exception) {
            logLocationUpdateError(locationId, "deleteWithFields", e)
            Result.failure(e)
        }
    }

    actual suspend fun getLocationsByOwner(ownerId: String): Result<List<Location>> {
        return try {
            val snapshot = firestore.collection("locations")
                .whereEqualTo("owner_id", ownerId)
                .orderBy("name")
                .get()
                .await()

            Result.success(snapshot.documents.mapNotNull { it.toLocationOrNull() })
        } catch (e: Exception) {
            logLocationQueryError("getLocationsByOwner", e, mapOf("owner_id" to ownerId))
            Result.failure(e)
        }
    }

    actual suspend fun getLocationById(locationId: String): Result<Location> {
        return try {
            val doc = firestore.collection("locations")
                .document(locationId)
                .get()
                .await()

            val location = doc.toLocationOrNull()
                ?: return Result.failure(Exception("Local não encontrado"))
            Result.success(location)
        } catch (e: Exception) {
            logLocationQueryError("getLocationById", e, mapOf("location_id" to locationId))
            Result.failure(e)
        }
    }

    actual suspend fun getLocationWithFields(locationId: String): Result<LocationWithFields> {
        return try {
            coroutineScope {
                val locationDeferred = async {
                    firestore.collection("locations")
                        .document(locationId)
                        .get()
                        .await()
                        .toLocationOrNull()
                }

                val fieldsDeferred = async {
                    firestore.collection("fields")
                        .whereEqualTo("location_id", locationId)
                        .whereEqualTo("is_active", true)
                        .orderBy("type")
                        .orderBy("name")
                        .get()
                        .await()
                        .documents
                        .mapNotNull { it.toFieldOrNull() }
                }

                val location = locationDeferred.await()
                    ?: return@coroutineScope Result.failure<LocationWithFields>(Exception("Local não encontrado"))

                val fields = fieldsDeferred.await()
                Result.success(LocationWithFields(location, fields))
            }
        } catch (e: Exception) {
            logLocationQueryError("getLocationWithFields", e, mapOf("location_id" to locationId))
            Result.failure(e)
        }
    }

    actual suspend fun createLocation(location: Location): Result<Location> {
        return try {
            val uid = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val docRef = firestore.collection("locations").document()
            val locationWithId = location.copy(
                id = docRef.id,
                ownerId = uid,
                createdAt = System.currentTimeMillis()
            )

            docRef.set(locationWithId).await()
            Result.success(locationWithId)
        } catch (e: Exception) {
            logLocationUpdateError(location.name, "create", e)
            Result.failure(e)
        }
    }

    actual suspend fun updateLocation(location: Location): Result<Unit> {
        return try {
            firestore.collection("locations")
                .document(location.id)
                .set(location)
                .await()
            Result.success(Unit)
        } catch (e: Exception) {
            logLocationUpdateError(location.id, "update", e)
            Result.failure(e)
        }
    }

    actual suspend fun searchLocations(query: String): Result<List<Location>> {
        return try {
            if (query.length < 2) {
                return Result.success(emptyList())
            }

            // OTIMIZAÇÃO: Usa cursor-based query em vez de carregar todos os registros
            // Usa startAt/endAt para busca prefixada otimizada no Firestore
            val snapshot = firestore.collection("locations")
                .orderBy("name")
                .startAt(query)
                .endAt(query + "\uf8ff")
                .limit(20)
                .get()
                .await()

            val locations = snapshot.documents
                .mapNotNull { it.toLocationOrNull() }

            // Se retornou menos de 20 resultados, tenta buscar por address também
            val additionalLocations = if (locations.size < 20) {
                firestore.collection("locations")
                    .orderBy("address")
                    .startAt(query)
                    .endAt(query + "\uf8ff")
                    .limit(20)
                    .get()
                    .await()
                    .documents
                    .mapNotNull { it.toLocationOrNull() }
                    .filter { addr -> locations.none { it.id == addr.id } }
            } else emptyList()

            Result.success((locations + additionalLocations).take(20))
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao buscar locais", e)
            Result.failure(e)
        }
    }

    actual suspend fun getOrCreateLocationFromPlace(
        placeId: String,
        name: String,
        address: String,
        city: String,
        state: String,
        latitude: Double?,
        longitude: Double?
    ): Result<Location> {
        return try {
            val existingSnapshot = firestore.collection("locations")
                .whereEqualTo("place_id", placeId)
                .limit(1)
                .get()
                .await()

            if (!existingSnapshot.isEmpty) {
                val existing = existingSnapshot.documents.first()
                    .toLocationOrNull()
                    ?: return Result.failure(Exception("Erro ao converter local existente"))
                return Result.success(existing)
            }

            val newLocation = Location(
                name = name,
                address = address,
                city = city,
                state = state,
                latitude = latitude,
                longitude = longitude,
                placeId = placeId
            )

            createLocation(newLocation)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun addLocationReview(review: LocationReview): Result<Unit> {
        return try {
            val reviewsRef = firestore.collection("locations")
                .document(review.locationId)
                .collection("reviews")

            reviewsRef.add(review).await()

            val snapshot = reviewsRef.get().await()
            val reviews = snapshot.documents.mapNotNull { it.toLocationReviewOrNull() }
            val count = reviews.size
            val avg = if (count > 0) reviews.map { it.rating }.average() else 0.0

            firestore.collection("locations")
                .document(review.locationId)
                .update(
                    mapOf(
                        "rating" to avg,
                        "ratingCount" to count
                    )
                )
                .await()

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun getLocationReviews(locationId: String): Result<List<LocationReview>> {
        return try {
            val snapshot = firestore.collection("locations")
                .document(locationId)
                .collection("reviews")
                .orderBy("created_at", Query.Direction.DESCENDING)
                .get()
                .await()

            val reviews = snapshot.documents.mapNotNull { it.toLocationReviewOrNull() }
            Result.success(reviews)
        } catch (e: Exception) {
            try {
                val snapshot = firestore.collection("locations")
                    .document(locationId)
                    .collection("reviews")
                    .get()
                    .await()
                val reviews = snapshot.documents.mapNotNull { it.toLocationReviewOrNull() }
                Result.success(reviews)
            } catch (e2: Exception) {
                Result.failure(e2)
            }
        }
    }

    actual suspend fun seedGinasioApollo(): Result<Location> {
        return try {
            val existing = firestore.collection("locations")
                .whereEqualTo("name", "Ginásio de Esportes Apollo")
                .limit(1)
                .get()
                .await()

            if (!existing.isEmpty) {
                val location = existing.documents.first().toLocationOrNull()
                    ?: return Result.failure(Exception("Erro ao converter local Ginásio Apollo"))
                return Result.success(location)
            }

            val uid = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado"))

            val docRef = firestore.collection("locations").document()
            val location = Location(
                id = docRef.id,
                name = "Ginásio de Esportes Apollo",
                address = "R. Canal Belém - Marginal Leste, 8027",
                city = "Curitiba",
                state = "PR",
                latitude = -25.4747,
                longitude = -49.2256,
                ownerId = uid,
                isVerified = true,
                phone = "(41) 99999-9999",
                website = "https://ginasioapollo.com.br",
                instagram = "@ginasioapollo",
                openingTime = "18:00",
                closingTime = "23:59",
                minGameDurationMinutes = 60,
                operatingDays = listOf(1, 2, 3, 4, 5, 6, 7),
                createdAt = System.currentTimeMillis()
            )

            docRef.set(location).await()

            for (i in 1..4) {
                val fieldRef = firestore.collection("fields").document()
                val field = Field(
                    id = fieldRef.id,
                    locationId = location.id,
                    name = "Quadra Futsal $i",
                    type = "FUTSAL",
                    description = "Quadra de futsal profissional, piso taco",
                    hourlyPrice = 120.0,
                    isActive = true
                )
                fieldRef.set(field).await()
            }

            for (i in 1..2) {
                val fieldRef = firestore.collection("fields").document()
                val field = Field(
                    id = fieldRef.id,
                    locationId = location.id,
                    name = "Campo Society $i",
                    type = "SOCIETY",
                    description = "Campo de society grama sintética",
                    hourlyPrice = 180.0,
                    isActive = true
                )
                fieldRef.set(field).await()
            }

            Result.success(location)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun migrateLocations(migrationData: List<LocationMigrationData>): Result<Int> {
        return try {
            val validData = migrationData.filter { it.nameKey.isNotBlank() }
            if (validData.isEmpty()) return Result.success(0)

            val uid = auth.currentUser?.uid
                ?: return Result.failure(Exception("Usuário não autenticado para migração"))

            val allLocationsResult = getAllLocations()
            if (allLocationsResult.isFailure) return Result.failure(allLocationsResult.exceptionOrNull() ?: Exception("Erro ao buscar locais para migração"))

            val allLocations = allLocationsResult.getOrNull() ?: emptyList()
            var processedCount = 0

            for (data in validData) {
                val existingLoc = allLocations.find {
                    it.name.trim().equals(data.nameKey.trim(), ignoreCase = true)
                }

                val finalPhone = if (!data.whatsapp.isNullOrBlank()) data.whatsapp else data.phone
                val finalInsta = data.instagram?.substringAfter(".com/")
                    ?.replace("/", "")?.replace("@", "")

                if (existingLoc != null) {
                    val updated = existingLoc.copy(
                        cep = data.cep,
                        street = data.street,
                        number = data.number,
                        neighborhood = data.neighborhood,
                        city = data.city,
                        state = data.state,
                        country = data.country,
                        complement = data.complement,
                        region = if (data.region.isNotBlank()) data.region else existingLoc.region,
                        address = "${data.street}, ${data.number}${if (data.complement.isNotBlank()) " - " + data.complement else ""} - ${data.neighborhood}, ${data.city} - ${data.state}",
                        phone = finalPhone ?: existingLoc.phone,
                        instagram = finalInsta ?: existingLoc.instagram,
                        amenities = if (data.amenities.isNotEmpty()) data.amenities else existingLoc.amenities,
                        description = data.description ?: existingLoc.description,
                        openingTime = data.openingTime ?: existingLoc.openingTime,
                        closingTime = data.closingTime ?: existingLoc.closingTime
                    )
                    updateLocation(updated)
                } else {
                    val docRef = firestore.collection("locations").document()
                    val newLoc = Location(
                        id = docRef.id,
                        ownerId = uid,
                        name = data.nameKey,
                        cep = data.cep,
                        street = data.street,
                        number = data.number,
                        neighborhood = data.neighborhood,
                        city = data.city,
                        state = data.state,
                        country = data.country,
                        complement = data.complement,
                        region = data.region,
                        address = "${data.street}, ${data.number}${if (data.complement.isNotBlank()) " - " + data.complement else ""} - ${data.neighborhood}, ${data.city} - ${data.state}",
                        phone = finalPhone,
                        instagram = finalInsta,
                        amenities = data.amenities,
                        description = data.description ?: "",
                        openingTime = data.openingTime ?: "08:00",
                        closingTime = data.closingTime ?: "23:00",
                        minGameDurationMinutes = 60,
                        isActive = true,
                        isVerified = true,
                        createdAt = System.currentTimeMillis()
                    )
                    docRef.set(newLoc).await()

                    val mainType = if (data.modalities.any { it.contains("Futsal", true) }) "FUTSAL" else "SOCIETY"
                    val count = if (data.numFieldsEstimation > 0) data.numFieldsEstimation else 1

                    for (i in 1..count) {
                        val fieldRef = firestore.collection("fields").document()
                        val field = Field(
                            id = fieldRef.id,
                            locationId = newLoc.id,
                            name = if (count > 1) "Quadra $i" else "Quadra Principal",
                            type = mainType,
                            hourlyPrice = 100.0,
                            isActive = true,
                            isCovered = true
                        )
                        fieldRef.set(field).await()
                    }
                }
                processedCount++
            }
            Result.success(processedCount)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun deduplicateLocations(): Result<Int> {
        return try {
            val allLocationsResult = getAllLocations()
            if (allLocationsResult.isFailure) return Result.failure(allLocationsResult.exceptionOrNull() ?: Exception("Erro ao buscar locais para deduplicação"))
            val allLocations = allLocationsResult.getOrNull() ?: emptyList()

            fun String.normalize(): String {
                return java.text.Normalizer.normalize(this, java.text.Normalizer.Form.NFD)
                    .replace(Regex("\\p{InCombiningDiacriticalMarks}+"), "")
                    .lowercase()
                    .replace(Regex("[^a-z0-9]"), "")
            }

            var deletedCount = 0
            val grouped = allLocations.groupBy { it.name.normalize() }

            for ((_, duplicates) in grouped) {
                if (duplicates.size > 1) {
                    val best = duplicates.sortedWith(
                        compareByDescending<Location> { !it.cep.isNullOrBlank() }
                            .thenByDescending { !it.phone.isNullOrBlank() }
                            .thenByDescending { it.id }
                    ).first()

                    val toDelete = duplicates.filter { it.id != best.id }

                    for (loc in toDelete) {
                        try {
                            firestore.collection("locations")
                                .document(loc.id)
                                .delete()
                                .await()

                            val fieldsSnapshot = firestore.collection("fields")
                                .whereEqualTo("location_id", loc.id)
                                .get()
                                .await()
                            for (fieldDoc in fieldsSnapshot.documents) {
                                fieldDoc.reference.delete().await()
                            }

                            deletedCount++
                        } catch (e: Exception) {
                            android.util.Log.e("FirebaseDataSource", "Error deleting duplicate ${loc.name}", e)
                        }
                    }
                }
            }
            Result.success(deletedCount)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ========== FIELDS ==========

    actual suspend fun getFieldsByLocation(locationId: String): Result<List<Field>> {
        return try {
            if (locationId.isBlank()) {
                return Result.failure(Exception("ID do local inválido"))
            }

            val snapshot = firestore.collection("fields")
                .whereEqualTo("location_id", locationId)
                .orderBy("type")
                .orderBy("name")
                .get()
                .await()

            Result.success(snapshot.documents.mapNotNull { it.toFieldOrNull() })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun getFieldById(fieldId: String): Result<Field> {
        return try {
            val doc = firestore.collection("fields")
                .document(fieldId)
                .get()
                .await()

            val field = doc.toFieldOrNull()
                ?: return Result.failure(Exception("Quadra não encontrada"))
            Result.success(field)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun createField(field: Field): Result<Field> {
        return try {
            val docRef = firestore.collection("fields").document()
            val fieldWithId = field.copy(id = docRef.id)

            docRef.set(fieldWithId).await()
            Result.success(fieldWithId)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun updateField(field: Field): Result<Unit> {
        return try {
            firestore.collection("fields")
                .document(field.id)
                .set(field)
                .await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun deleteField(fieldId: String): Result<Unit> {
        return try {
            firestore.collection("fields")
                .document(fieldId)
                .update("is_active", false)
                .await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun uploadFieldPhoto(filePath: String): Result<String> {
        return try {
            Result.failure(Exception("Upload de fotos requer Firebase Storage - não implementado ainda"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ========== LOCATION AUDIT LOGS ==========

    actual suspend fun logLocationAudit(log: LocationAuditLog): Result<Unit> {
        return try {
            val docRef = firestore.collection("locations")
                .document(log.locationId)
                .collection("audit_logs")
                .document()

            val logWithId = log.copy(
                id = docRef.id,
                timestamp = if (log.timestamp == 0L) System.currentTimeMillis() else log.timestamp
            )

            val data = mutableMapOf<String, Any?>(
                "id" to logWithId.id,
                "location_id" to logWithId.locationId,
                "user_id" to logWithId.userId,
                "user_name" to logWithId.userName,
                "action" to logWithId.action.name,
                "timestamp" to logWithId.timestamp
            )

            // Adiciona changes se houver (para UPDATE)
            if (logWithId.changes != null) {
                val changesMap = logWithId.changes.mapValues { (_, fieldChange) ->
                    mapOf(
                        "before" to fieldChange.before,
                        "after" to fieldChange.after
                    )
                }
                data["changes"] = changesMap
            }

            docRef.set(data).await()
            Result.success(Unit)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao registrar log de auditoria", e)
            Result.failure(e)
        }
    }

    actual suspend fun getLocationAuditLogs(locationId: String, limit: Int): Result<List<LocationAuditLog>> {
        return try {
            val snapshot = firestore.collection("locations")
                .document(locationId)
                .collection("audit_logs")
                .orderBy("timestamp", Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val logs = snapshot.documents.mapNotNull { doc ->
                doc.toLocationAuditLogOrNull()
            }

            Result.success(logs)
        } catch (e: Exception) {
            android.util.Log.e("FirebaseDataSource", "Erro ao buscar logs de auditoria", e)
            Result.failure(e)
        }
    }
}

/**
 * Helper para converter Timestamp do Firestore para kotlinx.datetime.Instant.
 */
private fun instantFromTimestamp(timestamp: com.google.firebase.Timestamp): kotlinx.datetime.Instant {
    val seconds = timestamp.seconds
    val nanos = timestamp.nanoseconds
    return kotlinx.datetime.Instant.fromEpochSeconds(seconds, nanos)
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

    // Se for um documento de subcoleção "members", o ID é o user_id
    val userId = getString("user_id") ?: getString("userId") ?: id
    val groupIdFromPath = reference.parent.parent?.id ?: ""

    return GroupMember(
        id = id,
        groupId = getString("group_id") ?: getString("groupId") ?: groupIdFromPath,
        userId = userId,
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

/**
 * Extensão para converter DocumentSnapshot para Payment com mapeamento manual.
 */
private fun DocumentSnapshot.toPaymentOrNull(): Payment? {
    if (!exists()) return null

    val typeStr = getString("type") ?: PaymentType.DAILY.name
    val statusStr = getString("status") ?: PaymentStatus.PENDING.name
    val methodStr = getString("payment_method")

    return Payment(
        id = id,
        userId = getString("user_id") ?: "",
        gameId = getString("game_id"),
        scheduleId = getString("schedule_id"),
        type = try { PaymentType.valueOf(typeStr) } catch (e: Exception) { PaymentType.DAILY },
        amount = getDouble("amount") ?: 0.0,
        status = try { PaymentStatus.valueOf(statusStr) } catch (e: Exception) { PaymentStatus.PENDING },
        paymentMethod = methodStr?.let {
            try { PaymentMethod.valueOf(it) } catch (e: Exception) { null }
        },
        dueDate = getString("due_date") ?: "",
        paidAt = safeLong("paid_at"),
        pixKey = getString("pix_key"),
        pixQrcode = getString("pix_qrcode"),
        pixTxid = getString("pix_txid"),
        receiptUrl = getString("receipt_url"),
        notes = getString("notes"),
        createdAt = safeLong("created_at")
    )
}

/**
 * Extensão para converter DocumentSnapshot para Statistics (usado em rankings).
 */
private fun DocumentSnapshot.toRankingStatisticsOrNull(): Statistics? {
    if (!exists()) return null

    return Statistics(
        id = id,
        userId = getString("user_id") ?: getString("userId") ?: "",
        totalGames = getLong("totalGames")?.toInt() ?: getLong("total_games")?.toInt() ?: 0,
        totalGoals = getLong("totalGoals")?.toInt() ?: getLong("total_goals")?.toInt() ?: 0,
        totalAssists = getLong("totalAssists")?.toInt() ?: getLong("total_assists")?.toInt() ?: 0,
        totalSaves = getLong("totalSaves")?.toInt() ?: getLong("total_saves")?.toInt() ?: 0,
        totalWins = getLong("totalWins")?.toInt() ?: getLong("total_wins")?.toInt() ?: 0,
        totalDraws = getLong("totalDraws")?.toInt() ?: getLong("total_draws")?.toInt() ?: 0,
        totalLosses = getLong("totalLosses")?.toInt() ?: getLong("total_losses")?.toInt() ?: 0,
        mvpCount = getLong("mvpCount")?.toInt() ?: getLong("mvp_count")?.toInt() ?: 0,
        bestGkCount = getLong("bestGkCount")?.toInt() ?: getLong("best_gk_count")?.toInt() ?: 0,
        worstPlayerCount = getLong("worstPlayerCount")?.toInt() ?: getLong("worst_player_count")?.toInt() ?: 0,
        currentStreak = getLong("currentStreak")?.toInt() ?: getLong("current_streak")?.toInt() ?: 0,
        bestStreak = getLong("bestStreak")?.toInt() ?: getLong("best_streak")?.toInt() ?: 0,
        yellowCards = getLong("yellowCards")?.toInt() ?: getLong("yellow_cards")?.toInt() ?: 0,
        redCards = getLong("redCards")?.toInt() ?: getLong("red_cards")?.toInt() ?: 0,
        lastGameDate = safeLong("last_game_date") ?: safeLong("lastGameDate"),
        updatedAt = safeLong("updated_at") ?: safeLong("updatedAt")
    )
}

/**
 * Extensão para converter DocumentSnapshot para UserStreak.
 */
private fun DocumentSnapshot.toUserStreakOrNull(): UserStreak? {
    if (!exists()) return null

    return UserStreak(
        id = id,
        userId = getString("user_id") ?: "",
        scheduleId = getString("schedule_id"),
        currentStreak = getLong("current_streak")?.toInt() ?: 0,
        longestStreak = getLong("longest_streak")?.toInt() ?: 0,
        lastGameDate = getString("last_game_date"),
        streakStartedAt = getString("streak_started_at")
    )
}

/**
 * Extensão para converter DocumentSnapshot para BadgeDefinition.
 */
private fun DocumentSnapshot.toBadgeDefinitionOrNull(): BadgeDefinition? {
    if (!exists()) return null

    val categoryStr = getString("category") ?: "PERFORMANCE"
    val rarityStr = getString("rarity") ?: "COMMON"

    return BadgeDefinition(
        id = id,
        name = getString("name") ?: "",
        description = getString("description") ?: "",
        emoji = getString("emoji") ?: "",
        category = try {
            BadgeCategory.valueOf(categoryStr)
        } catch (e: Exception) {
            BadgeCategory.PERFORMANCE
        },
        rarity = try {
            BadgeRarity.valueOf(rarityStr)
        } catch (e: Exception) {
            BadgeRarity.COMMON
        },
        requiredValue = getLong("required_value")?.toInt() ?: 1,
        isHidden = getBoolean("is_hidden") ?: false
    )
}

/**
 * Extensão para converter DocumentSnapshot para UserBadge.
 */
private fun DocumentSnapshot.toUserBadgeOrNull(): UserBadge? {
    if (!exists()) return null

    return UserBadge(
        id = id,
        userId = getString("user_id") ?: "",
        badgeId = getString("badge_id") ?: "",
        unlockedAt = safeLong("unlocked_at") ?: 0,
        unlockCount = getLong("unlock_count")?.toInt() ?: getLong("count")?.toInt() ?: 1
    )
}

/**
 * Extensão para converter DocumentSnapshot para Season.
 */
private fun DocumentSnapshot.toSeasonOrNull(): Season? {
    if (!exists()) return null

    return Season(
        id = id,
        name = getString("name") ?: "",
        description = getString("description") ?: "",
        startDate = safeLong("start_date") ?: 0,
        endDate = safeLong("end_date") ?: 0,
        isActive = getBoolean("is_active") ?: getBoolean("isActive") ?: false,
        createdAt = safeLong("created_at"),
        closedAt = safeLong("closed_at"),
        totalParticipants = getLong("total_participants")?.toInt() ?: 0,
        totalGames = getLong("total_games")?.toInt() ?: 0
    )
}

/**
 * Extensão para converter DocumentSnapshot para SeasonParticipation.
 */
private fun DocumentSnapshot.toSeasonParticipationOrNull(): SeasonParticipation? {
    if (!exists()) return null

    return SeasonParticipation(
        id = id,
        seasonId = getString("season_id") ?: "",
        userId = getString("user_id") ?: "",
        division = getString("division") ?: LeagueDivision.BRONZE.name,
        leagueRating = getLong("league_rating")?.toInt() ?: 1000,
        points = getLong("points")?.toInt() ?: 0,
        gamesPlayed = getLong("games_played")?.toInt() ?: 0,
        wins = getLong("wins")?.toInt() ?: 0,
        draws = getLong("draws")?.toInt() ?: 0,
        losses = getLong("losses")?.toInt() ?: 0,
        goals = getLong("goals")?.toInt() ?: getLong("goals_scored")?.toInt() ?: 0,
        assists = getLong("assists")?.toInt() ?: 0,
        saves = getLong("saves")?.toInt() ?: 0,
        mvpCount = getLong("mvp_count")?.toInt() ?: 0,
        bestGkCount = getLong("best_gk_count")?.toInt() ?: 0,
        worstPlayerCount = getLong("worst_player_count")?.toInt() ?: 0,
        currentStreak = getLong("current_streak")?.toInt() ?: 0,
        bestStreak = getLong("best_streak")?.toInt() ?: 0,
        xpEarned = getLong("xp_earned")?.toLong() ?: 0L,
        createdAt = safeLong("created_at"),
        updatedAt = safeLong("updated_at")
    )
}

/**
 * Extensão para converter DocumentSnapshot para WeeklyChallenge.
 */
private fun DocumentSnapshot.toWeeklyChallengeOrNull(): WeeklyChallenge? {
    if (!exists()) return null

    val typeStr = getString("type") ?: "score_goals"

    return WeeklyChallenge(
        id = id,
        name = getString("name") ?: "",
        description = getString("description") ?: "",
        type = try {
            ChallengeType.valueOf(typeStr)
        } catch (e: Exception) {
            ChallengeType.SCORE_GOALS
        },
        targetValue = getLong("target_value")?.toInt() ?: 0,
        xpReward = getLong("xp_reward")?.toLong() ?: 100L,
        startDate = getString("start_date") ?: "",
        endDate = getString("end_date") ?: "",
        isActive = getBoolean("is_active") ?: true,
        scheduleId = getString("schedule_id")
    )
}

/**
 * Extensão para converter DocumentSnapshot para UserChallengeProgress.
 */
private fun DocumentSnapshot.toUserChallengeProgressOrNull(): UserChallengeProgress? {
    if (!exists()) return null

    return UserChallengeProgress(
        id = id,
        userId = getString("user_id") ?: "",
        challengeId = getString("challenge_id") ?: "",
        currentProgress = getLong("current_progress")?.toInt() ?: 0,
        isCompleted = getBoolean("is_completed") ?: false,
        completedAt = safeLong("completed_at")
    )
}

/**
 * Extensão para converter DocumentSnapshot para AppNotification.
 */
private fun DocumentSnapshot.toAppNotificationOrNull(): AppNotification? {
    if (!exists()) return null

    val typeStr = getString("type") ?: NotificationType.GENERAL.name
    val actionTypeStr = getString("action_type")

    return AppNotification(
        id = id,
        userId = getString("user_id") ?: "",
        type = NotificationType.fromString(typeStr),
        title = getString("title") ?: "",
        message = getString("message") ?: "",
        senderId = getString("sender_id"),
        senderName = getString("sender_name"),
        senderPhoto = getString("sender_photo"),
        referenceId = getString("reference_id"),
        referenceType = getString("reference_type"),
        actionType = NotificationAction.fromString(actionTypeStr),
        read = getBoolean("read") ?: false,
        readAt = safeLong("read_at"),
        createdAt = safeLong("created_at"),
        expiresAt = safeLong("expires_at")
    )
}

/**
 * Extensão para converter DocumentSnapshot para Location.
 * Inclui logging de erros no Crashlytics para monitoramento de deserializacao.
 */
private fun DocumentSnapshot.toLocationOrNull(): Location? {
    if (!exists()) return null

    return try {
        Location(
            id = id,
            name = getString("name") ?: "",
            address = getString("address") ?: "",
            cep = getString("cep") ?: "",
            street = getString("street") ?: "",
            number = getString("number") ?: "",
            complement = getString("complement") ?: "",
            district = getString("district") ?: "",
            city = getString("city") ?: "",
            state = getString("state") ?: "",
            country = getString("country") ?: "Brasil",
            neighborhood = getString("neighborhood") ?: "",
            region = getString("region") ?: "",
            latitude = getDouble("latitude"),
            longitude = getDouble("longitude"),
            placeId = getString("place_id"),
            ownerId = getString("owner_id") ?: "",
            managers = (get("managers") as? List<*>)?.mapNotNull { it as? String } ?: emptyList(),
            isVerified = getBoolean("is_verified") ?: false,
            isActive = getBoolean("is_active") ?: true,
            rating = getDouble("rating") ?: 0.0,
            ratingCount = getLong("rating_count")?.toInt() ?: 0,
            description = getString("description") ?: "",
            photoUrl = getString("photo_url"),
            amenities = (get("amenities") as? List<*>)?.mapNotNull { it as? String } ?: emptyList(),
            phone = getString("phone"),
            website = getString("website"),
            instagram = getString("instagram"),
            openingTime = getString("opening_time") ?: "08:00",
            closingTime = getString("closing_time") ?: "23:00",
            operatingDays = (get("operating_days") as? List<*>)?.mapNotNull { (it as? Number)?.toInt() } ?: listOf(1, 2, 3, 4, 5, 6, 7),
            minGameDurationMinutes = getLong("min_game_duration_minutes")?.toInt() ?: 60,
            // Dados denormalizados de Fields
            fieldCount = getLong("field_count")?.toInt() ?: 0,
            primaryFieldType = getString("primary_field_type"),
            hasActiveFields = getBoolean("has_active_fields") ?: false,
            createdAt = safeLong("created_at"),
            updatedAt = safeLong("updated_at")
        )
    } catch (e: Exception) {
        logLocationDeserializationError(id, getString("owner_id"), e)
        null
    }
}

/**
 * Extensão para converter DocumentSnapshot para Field.
 * Inclui logging de erros no Crashlytics para monitoramento de deserializacao.
 */
private fun DocumentSnapshot.toFieldOrNull(): Field? {
    if (!exists()) return null

    return try {
        Field(
            id = id,
            locationId = getString("location_id") ?: "",
            name = getString("name") ?: "",
            type = getString("type") ?: "SOCIETY",
            description = getString("description"),
            photoUrl = getString("photo_url"),
            isActive = getBoolean("is_active") ?: true,
            hourlyPrice = getDouble("hourly_price") ?: 0.0,
            photos = (get("photos") as? List<*>)?.mapNotNull { it as? String } ?: emptyList(),
            managers = (get("managers") as? List<*>)?.mapNotNull { it as? String } ?: emptyList(),
            surface = getString("surface"),
            isCovered = getBoolean("is_covered") ?: false,
            dimensions = getString("dimensions")
        )
    } catch (e: Exception) {
        logFieldDeserializationError(id, getString("location_id"), e)
        null
    }
}

/**
 * Extensão para converter DocumentSnapshot para LocationReview.
 * Inclui logging de erros no Crashlytics para monitoramento de deserializacao.
 */
private fun DocumentSnapshot.toLocationReviewOrNull(): LocationReview? {
    if (!exists()) return null

    return try {
        LocationReview(
            id = id,
            locationId = getString("location_id") ?: "",
            userId = getString("user_id") ?: "",
            userName = getString("user_name") ?: "",
            userPhotoUrl = getString("user_photo_url"),
            rating = getLong("rating")?.toFloat() ?: 0f,
            comment = getString("comment") ?: "",
            createdAt = safeLong("created_at")
        )
    } catch (e: Exception) {
        logLocationReviewDeserializationError(id, getString("location_id"), e)
        null
    }
}

/**
 * Extensão para converter DocumentSnapshot para Activity.
 */
private fun DocumentSnapshot.toActivityOrNull(): Activity? {
    if (!exists()) return null

    return Activity(
        id = id,
        userId = getString("user_id") ?: "",
        userName = getString("user_name") ?: "",
        userPhoto = getString("user_photo"),
        type = ActivityType.fromString(getString("type")),
        title = getString("title") ?: "",
        description = getString("description") ?: "",
        referenceId = getString("reference_id"),
        referenceType = getString("reference_type"),
        metadata = (get("metadata") as? Map<String, String>) ?: emptyMap(),
        createdAt = safeLong("created_at"),
        visibility = ActivityVisibility.fromString(getString("visibility"))
    )
}

/**
 * Converte Activity para Map para salvar no Firestore.
 */
private fun activityToMap(activity: Activity): Map<String, Any?> {
    return mapOf(
        "user_id" to activity.userId,
        "user_name" to activity.userName,
        "user_photo" to activity.userPhoto,
        "type" to activity.type,
        "title" to activity.title,
        "description" to activity.description,
        "reference_id" to activity.referenceId,
        "reference_type" to activity.referenceType,
        "metadata" to activity.metadata,
        "created_at" to com.google.firebase.firestore.FieldValue.serverTimestamp(),
        "visibility" to activity.visibility
    )
}

// ========== CURSOR PAGINATION CLASSES ==========

/**
 * Informações decodificadas de um cursor de paginação.
 */
private data class CursorInfo(
    val documentPath: String,
    val sortField: LocationSortField,
    val lastValue: String?,
    val timestamp: Long
) {
    /**
     * Extrai o ID do documento do path.
     * Path tem formato: "locations/documentId"
     */
    val documentId: String
        get() = documentPath.substringAfterLast("/")
}

/**
 * Exceção lançada quando um cursor não pode ser decodificado.
 */
class CursorDecodingException(message: String) : Exception(message)

/**
 * Exceção lançada quando o campo de ordenação do cursor não corresponde ao solicitado.
 */
class CursorMismatchException(message: String) : Exception(message)

/**
 * Exceção lançada quando o documento referenciado pelo cursor não existe mais.
 */
class CursorDocumentNotFoundException(message: String) : Exception(message)

// ========== AUDIT LOG EXTENSION ==========

/**
 * Extensão para converter DocumentSnapshot para LocationAuditLog.
 */
private fun DocumentSnapshot.toLocationAuditLogOrNull(): LocationAuditLog? {
    if (!exists()) return null

    return try {
        val changesMap = (get("changes") as? Map<*, *>)?.mapNotNull { (key, value) ->
            val fieldKey = key as? String ?: return@mapNotNull null
            val fieldValue = value as? Map<*, *> ?: return@mapNotNull null
            val before = fieldValue["before"] as? String
            val after = fieldValue["after"] as? String
            fieldKey to FieldChange(before = before, after = after)
        }?.toMap()

        LocationAuditLog(
            id = id,
            locationId = getString("location_id") ?: "",
            userId = getString("user_id") ?: "",
            userName = getString("user_name") ?: "",
            action = LocationAuditAction.valueOf(
                getString("action")?.uppercase() ?: "UPDATE"
            ),
            changes = changesMap,
            timestamp = safeLong("timestamp") ?: 0L
        )
    } catch (e: Exception) {
        android.util.Log.e("FirebaseDataSource", "Erro ao deserializar LocationAuditLog: $id", e)
        null
    }
}

// ========== CRASHLYTICS LOGGING HELPERS ==========

/**
 * Registra erro de deserializacao de Location no Crashlytics.
 */
private fun logLocationDeserializationError(
    documentId: String,
    ownerId: String?,
    error: Throwable
) {
    android.util.Log.e(
        "FirebaseDataSource",
        "Location deserialization error [id=$documentId, owner=$ownerId]: ${error.message}",
        error
    )
}

/**
 * Registra erro de deserializacao de Field no Crashlytics.
 */
private fun logFieldDeserializationError(
    documentId: String,
    locationId: String?,
    error: Throwable
) {
    android.util.Log.e(
        "FirebaseDataSource",
        "Field deserialization error [id=$documentId, locationId=$locationId]: ${error.message}",
        error
    )
}

/**
 * Registra erro de deserializacao de LocationReview no Crashlytics.
 */
private fun logLocationReviewDeserializationError(
    documentId: String,
    locationId: String?,
    error: Throwable
) {
    android.util.Log.e(
        "FirebaseDataSource",
        "LocationReview deserialization error [id=$documentId, locationId=$locationId]: ${error.message}",
        error
    )
}

/**
 * Registra erro de query de Location no Crashlytics.
 */
private fun logLocationQueryError(
    queryName: String,
    error: Throwable,
    context: Map<String, String> = emptyMap()
) {
    val contextStr = if (context.isNotEmpty()) {
        context.entries.joinToString(", ") { "${it.key}=${it.value}" }
    } else ""
    android.util.Log.e(
        "FirebaseDataSource",
        "Location query error [query=$queryName, $contextStr]: ${error.message}",
        error
    )
}

/**
 * Registra erro de atualizacao de Location no Crashlytics.
 */
private fun logLocationUpdateError(
    locationId: String,
    operation: String,
    error: Throwable
) {
    android.util.Log.e(
        "FirebaseDataSource",
        "Location $operation error [id=$locationId]: ${error.message}",
        error
    )
}

