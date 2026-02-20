package com.futebadosparcas.platform.firebase

import com.futebadosparcas.domain.model.*
import dev.gitlive.firebase.Firebase
import dev.gitlive.firebase.auth.auth
import dev.gitlive.firebase.firestore.Direction
import dev.gitlive.firebase.firestore.FieldPath
import dev.gitlive.firebase.firestore.FieldValue
import dev.gitlive.firebase.firestore.Query
import dev.gitlive.firebase.firestore.Timestamp
import dev.gitlive.firebase.firestore.firestore
import dev.gitlive.firebase.storage.storage
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import kotlinx.datetime.LocalDateTime
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toInstant
import kotlinx.datetime.toLocalDateTime
import kotlin.io.encoding.Base64
import kotlin.io.encoding.ExperimentalEncodingApi

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

    // ========== GAMES ==========

    actual suspend fun getUpcomingGames(limit: Int): Result<List<Game>> {
        return try {
            val nowMillis = Clock.System.now().toEpochMilliseconds()
            val nowTs = Timestamp(nowMillis / 1000, ((nowMillis % 1000) * 1_000_000).toInt())
            val snapshot = firestore.collection(COLLECTION_GAMES)
                .where { "dateTime" greaterThanOrEqualTo nowTs }
                .orderBy("dateTime", Direction.ASCENDING)
                .limit(limit)
                .get()

            Result.success(snapshot.documents.mapNotNull { it.toGameOrNull() })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual fun getUpcomingGamesFlow(limit: Int): Flow<Result<List<Game>>> {
        val nowMillis = Clock.System.now().toEpochMilliseconds()
        val nowTs = Timestamp(nowMillis / 1000, ((nowMillis % 1000) * 1_000_000).toInt())
        return firestore.collection(COLLECTION_GAMES)
            .where { "dateTime" greaterThanOrEqualTo nowTs }
            .orderBy("dateTime", Direction.ASCENDING)
            .limit(limit)
            .snapshots()
            .map { snapshot -> Result.success(snapshot.documents.mapNotNull { it.toGameOrNull() }) }
            .catch { e -> emit(Result.failure(e)) }
    }

    actual suspend fun getGameById(gameId: String): Result<Game> {
        return try {
            val doc = firestore.collection(COLLECTION_GAMES)
                .document(gameId)
                .get()

            val game = doc.toGameOrNull()
                ?: return Result.failure(Exception("Jogo não encontrado"))
            Result.success(game)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual fun getGameByIdFlow(gameId: String): Flow<Result<Game>> {
        return firestore.collection(COLLECTION_GAMES)
            .document(gameId)
            .snapshots()
            .map { snapshot ->
                val game = snapshot.toGameOrNull()
                if (game != null) Result.success(game)
                else Result.failure(Exception("Jogo não encontrado"))
            }
            .catch { e -> emit(Result.failure(e)) }
    }

    actual suspend fun getConfirmedGamesForUser(userId: String): Result<List<Game>> {
        return try {
            // 1. Buscar confirmações do usuário
            val confirmations = firestore.collection(COLLECTION_CONFIRMATIONS)
                .where { "user_id" equalTo userId }
                .where { "status" equalTo "CONFIRMED" }
                .get()
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
                    .where { FieldPath.documentId inArray chunk }
                    .get()
                games.addAll(snapshot.documents.mapNotNull { it.toGameOrNull() })
            }

            // 4. Ordenar por data do jogo
            Result.success(games.sortedBy { "${it.date} ${it.time}" })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun getGamesByGroup(groupId: String, limit: Int): Result<List<Game>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_GAMES)
                .where { "group_id" equalTo groupId }
                .orderBy("dateTime", Direction.DESCENDING)
                .limit(limit)
                .get()

            Result.success(snapshot.documents.mapNotNull { it.toGameOrNull() })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun getPublicGames(limit: Int): Result<List<Game>> {
        return try {
            val nowMillis = Clock.System.now().toEpochMilliseconds()
            val nowTs = Timestamp(nowMillis / 1000, ((nowMillis % 1000) * 1_000_000).toInt())
            val snapshot = firestore.collection(COLLECTION_GAMES)
                .where { "visibility" inArray listOf("PUBLIC_OPEN", "PUBLIC_CLOSED") }
                .where { "dateTime" greaterThanOrEqualTo nowTs }
                .orderBy("dateTime", Direction.ASCENDING)
                .limit(limit)
                .get()

            Result.success(snapshot.documents.mapNotNull { it.toGameOrNull() })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun createGame(game: Game): Result<Game> {
        return try {
            val docRef = firestore.collection(COLLECTION_GAMES).document
            val gameWithId = game.copy(id = docRef.id)
            docRef.set(gameWithId)
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
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ========== CONFIRMATIONS ==========

    actual suspend fun getGameConfirmations(gameId: String): Result<List<GameConfirmation>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_CONFIRMATIONS)
                .where { "game_id" equalTo gameId }
                .get()

            Result.success(snapshot.documents.mapNotNull { it.toGameConfirmationOrNull() })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual fun getGameConfirmationsFlow(gameId: String): Flow<Result<List<GameConfirmation>>> {
        return firestore.collection(COLLECTION_CONFIRMATIONS)
            .where { "game_id" equalTo gameId }
            .snapshots()
            .map { snapshot -> Result.success(snapshot.documents.mapNotNull { it.toGameConfirmationOrNull() }) }
            .catch { e -> emit(Result.failure(e)) }
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
            // Usar ID determinístico {gameId}_{userId} para consistência com security rules
            val docId = "${gameId}_${userId}"
            val docRef = firestore.collection(COLLECTION_CONFIRMATIONS).document(docId)

            val confirmationData = mapOf(
                "id" to docId,
                "game_id" to gameId,
                "user_id" to userId,
                "user_name" to userName,
                "user_photo" to (userPhoto ?: ""),
                "position" to position,
                "status" to "CONFIRMED",
                "is_casual_player" to isCasualPlayer,
                "created_at" to FieldValue.serverTimestamp
            )
            docRef.set(confirmationData)

            val confirmation = GameConfirmation(
                id = docId,
                gameId = gameId,
                userId = userId,
                userName = userName,
                userPhoto = userPhoto,
                position = position,
                status = "CONFIRMED",
                isCasualPlayer = isCasualPlayer
            )
            Result.success(confirmation)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun cancelConfirmation(gameId: String, userId: String): Result<Unit> {
        return try {
            // Tentar deletar pelo ID determinístico primeiro
            val docRef = firestore.collection(COLLECTION_CONFIRMATIONS).document("${gameId}_${userId}")
            val doc = docRef.get()
            if (doc.exists) {
                docRef.delete()
            } else {
                // Fallback: buscar por query
                val query = firestore.collection(COLLECTION_CONFIRMATIONS)
                    .where { "game_id" equalTo gameId }
                    .where { "user_id" equalTo userId }
                    .get()
                query.documents.forEach { it.reference.delete() }
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun updatePaymentStatus(gameId: String, userId: String, isPaid: Boolean): Result<Unit> {
        return try {
            val snapshot = firestore.collection(COLLECTION_CONFIRMATIONS)
                .where { "game_id" equalTo gameId }
                .where { "user_id" equalTo userId }
                .get()

            if (snapshot.documents.isEmpty()) {
                return Result.failure(NoSuchElementException("Confirmação não encontrada"))
            }

            val status = if (isPaid) "PAID" else "PENDING"
            val batch = firestore.batch()
            snapshot.documents.forEach { doc ->
                batch.update(doc.reference, mapOf("payment_status" to status))
            }
            batch.commit()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun removePlayerFromGame(gameId: String, userId: String): Result<Unit> {
        return try {
            // Tentar deletar pelo ID determinístico primeiro
            val docRef = firestore.collection(COLLECTION_CONFIRMATIONS).document("${gameId}_${userId}")
            val doc = docRef.get()
            if (doc.exists) {
                docRef.delete()
            } else {
                // Fallback: buscar por query
                val snapshot = firestore.collection(COLLECTION_CONFIRMATIONS)
                    .where { "game_id" equalTo gameId }
                    .where { "user_id" equalTo userId }
                    .get()
                val batch = firestore.batch()
                snapshot.documents.forEach { d -> batch.delete(d.reference) }
                batch.commit()
            }
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
            batch.commit()
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
            // Buscar confirmacao existente com status PENDING pelo ID determinístico
            val docRef = firestore.collection(COLLECTION_CONFIRMATIONS).document("${gameId}_${userId}")
            val doc = docRef.get()

            if (!doc.exists) {
                // Fallback: buscar por query
                val snapshot = firestore.collection(COLLECTION_CONFIRMATIONS)
                    .where { "game_id" equalTo gameId }
                    .where { "user_id" equalTo userId }
                    .get()

                if (snapshot.documents.isEmpty()) {
                    return Result.failure(Exception("Convite não encontrado"))
                }

                val fallbackDoc = snapshot.documents[0]
                val updates = mapOf("status" to "CONFIRMED", "position" to position)
                fallbackDoc.reference.update(updates)

                val confirmation = GameConfirmation(
                    id = fallbackDoc.id,
                    gameId = gameId,
                    userId = userId,
                    userName = fallbackDoc.get<String?>("user_name") ?: fallbackDoc.get<String?>("userName") ?: "",
                    userPhoto = fallbackDoc.get<String?>("user_photo") ?: fallbackDoc.get<String?>("userPhoto"),
                    position = position,
                    status = "CONFIRMED",
                    isCasualPlayer = fallbackDoc.get<Boolean?>("is_casual_player") ?: fallbackDoc.get<Boolean?>("isCasualPlayer") ?: false
                )
                return Result.success(confirmation)
            }

            val updates = mapOf(
                "status" to "CONFIRMED",
                "position" to position
            )
            docRef.update(updates)

            // Construir confirmacao atualizada
            val confirmation = GameConfirmation(
                id = doc.id,
                gameId = gameId,
                userId = userId,
                userName = doc.get<String?>("user_name") ?: doc.get<String?>("userName") ?: "",
                userPhoto = doc.get<String?>("user_photo") ?: doc.get<String?>("userPhoto"),
                position = position,
                status = "CONFIRMED",
                isCasualPlayer = doc.get<Boolean?>("is_casual_player") ?: doc.get<Boolean?>("isCasualPlayer") ?: false
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
            // Tentar pelo ID determinístico primeiro
            val docRef = firestore.collection(COLLECTION_CONFIRMATIONS).document("${gameId}_${userId}")
            val doc = docRef.get()
            if (doc.exists) {
                docRef.update(mapOf("status" to status))
            } else {
                // Fallback: buscar por query
                val snapshot = firestore.collection(COLLECTION_CONFIRMATIONS)
                    .where { "game_id" equalTo gameId }
                    .where { "user_id" equalTo userId }
                    .get()

                if (snapshot.documents.isEmpty()) {
                    return Result.failure(Exception("Confirmação não encontrada"))
                }

                val batch = firestore.batch()
                snapshot.documents.forEach { d ->
                    batch.update(d.reference, mapOf("status" to status))
                }
                batch.commit()
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ========== TEAMS ==========

    actual suspend fun getGameTeams(gameId: String): Result<List<Team>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_TEAMS)
                .where { "game_id" equalTo gameId }
                .get()

            Result.success(snapshot.documents.mapNotNull { it.toTeamOrNull() })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual fun getGameTeamsFlow(gameId: String): Flow<Result<List<Team>>> {
        return firestore.collection(COLLECTION_TEAMS)
            .where { "game_id" equalTo gameId }
            .snapshots()
            .map { snapshot -> Result.success(snapshot.documents.mapNotNull { it.toTeamOrNull() }) }
            .catch { e -> emit(Result.failure(e)) }
    }

    actual suspend fun saveTeams(gameId: String, teams: List<Team>): Result<Unit> {
        return try {
            val batch = firestore.batch()

            teams.forEach { team ->
                val docRef = firestore.collection(COLLECTION_TEAMS).document
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

            batch.commit()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun clearGameTeams(gameId: String): Result<Unit> {
        return try {
            val snapshot = firestore.collection(COLLECTION_TEAMS)
                .where { "game_id" equalTo gameId }
                .get()

            val batch = firestore.batch()
            snapshot.documents.forEach { doc -> batch.delete(doc.reference) }
            batch.commit()

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
                .where { "visibility" equalTo "PUBLIC" }
                .orderBy("created_at", Direction.DESCENDING)
                .limit(limit)
                .get()

            Result.success(snapshot.documents.mapNotNull { it.toActivityOrNull() })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Flow de atividades recentes em tempo real.
     */
    fun getRecentActivitiesFlow(limit: Int): Flow<Result<List<Activity>>> {
        return firestore.collection("activities")
            .where { "visibility" equalTo "PUBLIC" }
            .orderBy("created_at", Direction.DESCENDING)
            .limit(limit)
            .snapshots()
            .map { snapshot -> Result.success(snapshot.documents.mapNotNull { it.toActivityOrNull() }) }
            .catch { e -> emit(Result.failure(e)) }
    }

    /**
     * Cria uma nova atividade.
     */
    suspend fun createActivity(activity: Activity): Result<Unit> {
        return try {
            firestore.collection("activities").add(activityToMap(activity))
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
                .where { "user_id" equalTo userId }
                .orderBy("created_at", Direction.DESCENDING)
                .limit(limit)
                .get()

            Result.success(snapshot.documents.mapNotNull { it.toActivityOrNull() })
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

            val stats = doc.toStatisticsOrNull() ?: Statistics(userId = userId)
            Result.success(stats)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual fun getUserStatisticsFlow(userId: String): Flow<Result<Statistics>> {
        return firestore.collection(COLLECTION_STATISTICS)
            .document(userId)
            .snapshots()
            .map { snapshot ->
                val stats = snapshot.toStatisticsOrNull() ?: Statistics(userId = userId)
                Result.success(stats)
            }
            .catch { e -> emit(Result.failure(e)) }
    }

    actual suspend fun updateUserStatistics(userId: String, updates: Map<String, Any>): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_STATISTICS)
                .document(userId)
                .update(updates)
            Result.success(Unit)
        } catch (e: Exception) {
            // Se o documento não existir, criar com as atualizações
            try {
                firestore.collection(COLLECTION_STATISTICS)
                    .document(userId)
                    .set(updates, merge = true)
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
                    .where { FieldPath.documentId inArray chunk }
                    .get()
                allUsers.addAll(snapshot.documents.mapNotNull { doc -> doc.toUserOrNull() })
            }

            Result.success(allUsers)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun getCurrentUser(): Result<User> {
        val uid = auth.currentUser?.uid
            ?: return Result.failure(Exception("Usuário não autenticado"))

        println("FirebaseDataSource: getCurrentUser: buscando para uid=$uid")

        return getUserById(uid).onSuccess { user ->
            println("FirebaseDataSource: getCurrentUser: carregado ${user.name}, Level=${user.level}")
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
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun searchUsers(query: String, limit: Int): Result<List<User>> {
        println("FirebaseDataSource: searchUsers called with query='$query', limit=$limit")
        return try {
            val collection = firestore.collection(COLLECTION_USERS)

            val snapshot = if (query.isBlank()) {
                collection
                    .limit(limit)
                    .get()
            } else {
                collection
                    .orderBy("name")
                    .startAt(query)
                    .endAt(query + "\uf8ff")
                    .limit(limit)
                    .get()
            }

            println("FirebaseDataSource: searchUsers query success. Documents found: ${snapshot.documents.size}")

            val users = snapshot.documents.mapNotNull {
                val user = it.toUserOrNull()
                if (user == null) {
                    println("FirebaseDataSource: Falha ao mapear documento ${it.id} para User")
                }
                user
            }

            println("FirebaseDataSource: searchUsers mapeou ${users.size} usuários com sucesso")

            Result.success(users)
        } catch (e: Exception) {
            println("FirebaseDataSource: searchUsers falhou: ${e.message}")
            Result.failure(e)
        }
    }

    actual suspend fun getAllUsers(): Result<List<User>> {
        return try {
            // OTIMIZAÇÃO: Limitado a 100 usuários para evitar carregar toda a coleção
            val snapshot = firestore.collection(COLLECTION_USERS)
                .orderBy("name")
                .limit(100)
                .get()

            val users = snapshot.documents.mapNotNull { it.toUserOrNull() }
            Result.success(users)
        } catch (e: Exception) {
            println("FirebaseDataSource: getAllUsers falhou: ${e.message}")
            Result.failure(e)
        }
    }

    actual suspend fun updateUserRole(userId: String, newRole: String): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_USERS)
                .document(userId)
                .update(mapOf("role" to newRole))
            Result.success(Unit)
        } catch (e: Exception) {
            println("FirebaseDataSource: updateUserRole falhou: ${e.message}")
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
                "auto_rating_updated_at" to FieldValue.serverTimestamp
            )
            firestore.collection(COLLECTION_USERS)
                .document(userId)
                .update(updates)
            Result.success(Unit)
        } catch (e: Exception) {
            println("FirebaseDataSource: updateAutoRatings falhou: ${e.message}")
            Result.failure(e)
        }
    }

    // ========== PROFILE VISIBILITY ==========

    actual suspend fun updateProfileVisibility(userId: String, isSearchable: Boolean): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_USERS)
                .document(userId)
                .update(mapOf("is_searchable" to isSearchable))
            Result.success(Unit)
        } catch (e: Exception) {
            println("FirebaseDataSource: updateProfileVisibility falhou: ${e.message}")
            Result.failure(e)
        }
    }

    // ========== FIELD OWNERS ==========

    actual suspend fun getFieldOwners(): Result<List<User>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_USERS)
                .where { "role" equalTo "FIELD_OWNER" }
                .orderBy("name")
                .get()
            val fieldOwners = snapshot.documents.mapNotNull { it.toUserOrNull() }
            Result.success(fieldOwners)
        } catch (e: Exception) {
            println("FirebaseDataSource: getFieldOwners falhou: ${e.message}")
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
                .update(mapOf("fcm_token" to token))
            Result.success(Unit)
        } catch (e: Exception) {
            println("FirebaseDataSource: updateFcmToken falhou: ${e.message}")
            Result.failure(e)
        }
    }

    // ========== AUTH ==========

    actual fun getAuthStateFlow(): Flow<String?> {
        return auth.authStateChanged
            .map { user -> user?.uid }
            .catch { emit(null) }
    }

    actual fun isLoggedIn(): Boolean {
        return auth.currentUser != null
    }

    actual fun getCurrentAuthUserId(): String? {
        return auth.currentUser?.uid
    }

    actual suspend fun getCurrentAuthUser(): Result<User> {
        println("FirebaseDataSource: === getCurrentAuthUser() START ===")
        return try {
            // Lógica de retry para confiabilidade do Google Sign-In
            var uid: String? = null
            var retries = 0
            val maxRetries = 10
            val baseDelay = 300L

            println("FirebaseDataSource: Iniciando loop de retry (máx $maxRetries tentativas)")
            while (uid == null && retries < maxRetries) {
                uid = auth.currentUser?.uid
                println("FirebaseDataSource: Retry $retries: uid = $uid")
                if (uid == null) {
                    val delay = baseDelay * (retries + 1)
                    println("FirebaseDataSource: Aguardando ${delay}ms antes do próximo retry")
                    kotlinx.coroutines.delay(delay)
                    retries++
                }
            }

            if (uid == null) {
                println("FirebaseDataSource: FALHOU: Sem UID após $retries retries")
                return Result.failure(Exception("Usuario nao autenticado"))
            }

            println("FirebaseDataSource: SUCESSO: UID = $uid")
            kotlinx.coroutines.delay(100)

            println("FirebaseDataSource: Consultando Firestore para user doc: $uid")
            val doc = firestore.collection(COLLECTION_USERS).document(uid).get()

            if (doc.exists) {
                println("FirebaseDataSource: Documento do usuário EXISTE no Firestore")
                var user = doc.toUserOrNull()
                    ?: return Result.failure(Exception("Erro ao converter usuario"))

                println("FirebaseDataSource: Usuário carregado: ${user.name} (${user.email})")

                // Verifica se a foto do Google mudou e atualiza
                val firebaseUser = auth.currentUser
                val googlePhotoUrl = firebaseUser?.photoURL

                if (googlePhotoUrl != null && googlePhotoUrl != user.photoUrl) {
                    println("FirebaseDataSource: Atualizando URL da foto")
                    firestore.collection(COLLECTION_USERS)
                        .document(uid)
                        .update(mapOf("photo_url" to googlePhotoUrl))
                    user = user.copy(photoUrl = googlePhotoUrl)
                }

                println("FirebaseDataSource: === getCurrentAuthUser() SUCESSO ===")
                Result.success(user)
            } else {
                println("FirebaseDataSource: Documento do usuário NÃO EXISTE - criando novo usuário")
                // Criar usuario automaticamente se nao existir
                val firebaseUser = auth.currentUser
                    ?: return Result.failure(Exception("Usuário não autenticado"))
                val newUser = User(
                    id = uid,
                    email = firebaseUser.email ?: "",
                    name = firebaseUser.displayName ?: "",
                    photoUrl = firebaseUser.photoURL
                )
                println("FirebaseDataSource: Criando usuário: ${newUser.name} (${newUser.email})")

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
                    "created_at" to FieldValue.serverTimestamp,
                    "updated_at" to FieldValue.serverTimestamp,
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
                println("FirebaseDataSource: === getCurrentAuthUser() SUCESSO (novo usuário criado) ===")
                Result.success(newUser)
            }
        } catch (e: Exception) {
            println("FirebaseDataSource: === getCurrentAuthUser() EXCEÇÃO: ${e.message} ===")
            Result.failure(e)
        }
    }

    actual fun logout() {
        runBlocking { auth.signOut() }
    }

    // ========== GROUPS ==========

    actual suspend fun getUserGroups(userId: String): Result<List<UserGroup>> {
        return try {
            val snapshot = firestore.collection("users")
                .document(userId)
                .collection("groups")
                .orderBy("joined_at", Direction.DESCENDING)
                .get()

            val userGroups = snapshot.documents.mapNotNull { it.toUserGroupOrNull() }
            Result.success(userGroups)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual fun getUserGroupsFlow(userId: String): Flow<Result<List<UserGroup>>> {
        return firestore.collection("users")
            .document(userId)
            .collection("groups")
            .orderBy("joined_at", Direction.DESCENDING)
            .snapshots()
            .map { snapshot -> Result.success(snapshot.documents.mapNotNull { it.toUserGroupOrNull() }) }
            .catch { e -> emit(Result.failure(e)) }
    }

    actual suspend fun getGroupById(groupId: String): Result<UserGroup> {
        return try {
            val doc = firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .get()

            if (!doc.exists) {
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
                .where { "user_id" equalTo userId }
                .orderBy("created_at", Direction.DESCENDING)
                .limit(limit)
                .get()

            val logs = snapshot.documents.mapNotNull { it.toXpLogOrNull() }
            Result.success(logs)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ========== XP/GAMIFICATION ==========

    actual suspend fun createXpLog(xpLog: XpLog): Result<XpLog> {
        return try {
            val docRef = firestore.collection(COLLECTION_XP_LOGS).document
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
                "created_at" to FieldValue.serverTimestamp
            )
            docRef.set(xpLogData)
            Result.success(xpLog.copy(id = docRef.id))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun updateUserLevel(userId: String, level: Int, xp: Long): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_USERS)
                .document(userId)
                .update(mapOf(
                    "level" to level,
                    "experience_points" to xp
                ))
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun awardBadge(userId: String, badgeId: String): Result<Unit> {
        return try {
            val docRef = firestore.collection("user_badges").document
            val badgeData = mapOf(
                "id" to docRef.id,
                "user_id" to userId,
                "badge_id" to badgeId,
                "unlocked_at" to FieldValue.serverTimestamp
            )
            docRef.set(badgeData)
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
                        "updated_at" to FieldValue.serverTimestamp
                    ),
                    merge = true
                )
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun unlockMilestone(userId: String, milestoneId: String): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_USERS)
                .document(userId)
                .update(mapOf(
                    "milestones_achieved" to FieldValue.arrayUnion(milestoneId)
                ))
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
                "owner_id" to (auth.currentUser?.uid ?: ""),
                "started_at" to FieldValue.serverTimestamp
            )
            firestore.collection("live_scores")
                .document(gameId)
                .set(liveScoreData)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun updateLiveScore(gameId: String, team1Score: Int, team2Score: Int): Result<Unit> {
        return try {
            firestore.collection("live_scores")
                .document(gameId)
                .update(mapOf(
                    "team1_score" to team1Score,
                    "team2_score" to team2Score
                ))
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun addGameEvent(gameId: String, event: GameEvent): Result<GameEvent> {
        return try {
            val docRef = firestore.collection("game_events").document
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
                "created_at" to FieldValue.serverTimestamp
            )
            docRef.set(eventData)
            Result.success(event.copy(id = docRef.id))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun getGameEvents(gameId: String): Result<List<GameEvent>> {
        return try {
            val snapshot = firestore.collection("game_events")
                .where { "game_id" equalTo gameId }
                .orderBy("minute", Direction.ASCENDING)
                .get()
            Result.success(snapshot.documents.mapNotNull { it.toGameEventOrNull() })
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual fun getGameEventsFlow(gameId: String): Flow<Result<List<GameEvent>>> {
        return firestore.collection("game_events")
            .where { "game_id" equalTo gameId }
            .orderBy("minute", Direction.ASCENDING)
            .snapshots()
            .map { snapshot -> Result.success(snapshot.documents.mapNotNull { it.toGameEventOrNull() }) }
            .catch { e -> emit(Result.failure(e)) }
    }

    actual fun getLiveScoreFlow(gameId: String): Flow<Result<LiveScore>> = flow {
        // Emitir valor padrão inicialmente para jogos que não estão live
        emit(Result.success(LiveScore()))
        firestore.collection("live_scores")
            .document(gameId)
            .snapshots()
            .collect { snapshot ->
                if (snapshot.exists) {
                    val score = snapshot.toLiveScoreOrNull()
                    if (score != null) {
                        emit(Result.success(score))
                    }
                }
            }
    }.catch { e -> emit(Result.failure(e)) }

    // ========== LIVE GAME (NOVOS MÉTODOS) ==========

    actual suspend fun startLiveGame(gameId: String, team1Id: String, team2Id: String): Result<LiveScore> {
        return try {
            val docRef = firestore.collection("live_scores").document(gameId)

            val scoreData = mapOf(
                "game_id" to gameId,
                "team1_id" to team1Id,
                "team1_score" to 0,
                "team2_id" to team2Id,
                "team2_score" to 0,
                "started_at" to FieldValue.serverTimestamp
            )

            docRef.set(scoreData)

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
            println("FirebaseDataSource: canManageGameEvents: Usuário não autenticado")
            return false
        }

        return try {
            // Verificar se é owner do jogo
            val gameDoc = firestore.collection("games").document(gameId).get()
            val ownerId = gameDoc.get<String?>("owner_id")
            if (ownerId == currentUserId) {
                println("FirebaseDataSource: canManageGameEvents: Usuário é owner")
                return true
            }

            // Verificar se está confirmado no jogo
            val confirmationId = "${gameId}_$currentUserId"
            val confDoc = firestore.collection("confirmations").document(confirmationId).get()
            if (confDoc.exists) {
                val status = confDoc.get<String?>("status")
                if (status == "CONFIRMED") {
                    println("FirebaseDataSource: canManageGameEvents: Usuário confirmado")
                    return true
                }
            }

            println("FirebaseDataSource: canManageGameEvents: Permissão negada")
            false
        } catch (e: Exception) {
            println("FirebaseDataSource: canManageGameEvents: Erro: ${e.message}")
            false
        }
    }

    actual suspend fun updateScoreForGoal(gameId: String, teamId: String): Result<Unit> {
        return try {
            val scoreDocRef = firestore.collection("live_scores").document(gameId)
            val gameDocRef = firestore.collection("games").document(gameId)

            // Garantir que o documento de placar existe
            try {
                val snapshot = scoreDocRef.get()
                if (!snapshot.exists) {
                    val teamsSnapshot = firestore.collection("teams")
                        .where { "game_id" equalTo gameId }
                        .get()

                    val teams = teamsSnapshot.documents.mapNotNull { it.toTeamOrNull() }
                    if (teams.size >= 2) {
                        startLiveGame(gameId, teams[0].id, teams[1].id)
                        println("FirebaseDataSource: Placar inicializado sob demanda")
                    }
                }
            } catch (e: Exception) {
                println("FirebaseDataSource: Erro ao inicializar placar: ${e.message}")
            }

            firestore.runTransaction<Unit> {
                val snapshot = get(scoreDocRef)
                val score = snapshot.toLiveScoreOrNull() ?: return@runTransaction

                var newTeam1Score = score.team1Score
                var newTeam2Score = score.team2Score

                when {
                    score.team1Id == teamId -> {
                        newTeam1Score += 1
                        update(scoreDocRef, mapOf("team1_score" to newTeam1Score))
                    }
                    score.team2Id == teamId -> {
                        newTeam2Score += 1
                        update(scoreDocRef, mapOf("team2_score" to newTeam2Score))
                    }
                    else -> {
                        println("FirebaseDataSource: GOL para time desconhecido: $teamId")
                    }
                }

                // Sincronizar com documento principal do jogo
                update(gameDocRef, mapOf(
                    "team1_score" to newTeam1Score,
                    "team2_score" to newTeam2Score
                ))
            }

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
            val statsDocRef = firestore.collection("live_player_stats").document(statsId)
            val confirmationId = "${gameId}_$playerId"
            val confDocRef = firestore.collection("confirmations").document(confirmationId)

            firestore.runTransaction<Unit> {
                // 1. Atualizar Live Player Stats
                val snapshot = get(statsDocRef)

                if (!snapshot.exists) {
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
                    set(statsDocRef, newStats)
                } else {
                    // Atualizar estatística existente
                    when (eventType) {
                        GameEventType.GOAL -> update(statsDocRef, mapOf("goals" to snapshot.getGoals() + 1))
                        GameEventType.SAVE -> update(statsDocRef, mapOf("saves" to snapshot.getSaves() + 1))
                        GameEventType.YELLOW_CARD -> update(statsDocRef, mapOf("yellow_cards" to snapshot.getYellowCards() + 1))
                        GameEventType.RED_CARD -> update(statsDocRef, mapOf("red_cards" to snapshot.getRedCards() + 1))
                        else -> {}
                    }
                }

                // 2. Sync com GameConfirmation
                val confSnapshot = get(confDocRef)
                if (confSnapshot.exists) {
                    val currentGoals = confSnapshot.get<Long?>("goals") ?: 0
                    val currentYellow = confSnapshot.get<Long?>("yellow_cards") ?: 0
                    val currentRed = confSnapshot.get<Long?>("red_cards") ?: 0
                    val currentSaves = confSnapshot.get<Long?>("saves") ?: 0

                    when (eventType) {
                        GameEventType.GOAL -> update(confDocRef, mapOf("goals" to currentGoals + 1))
                        GameEventType.YELLOW_CARD -> update(confDocRef, mapOf("yellow_cards" to currentYellow + 1))
                        GameEventType.RED_CARD -> update(confDocRef, mapOf("red_cards" to currentRed + 1))
                        GameEventType.SAVE -> update(confDocRef, mapOf("saves" to currentSaves + 1))
                        else -> {}
                    }
                }

                // 3. Atualizar assistência se houver
                if (eventType == GameEventType.GOAL && assistedById != null) {
                    val assistStatsId = "${gameId}_$assistedById"
                    val assistStatsDocRef = firestore.collection("live_player_stats").document(assistStatsId)
                    val assistConfDocRef = firestore.collection("confirmations").document(assistStatsId)

                    // Update Live Stats
                    val assistSnapshot = get(assistStatsDocRef)
                    if (assistSnapshot.exists) {
                        update(assistStatsDocRef, mapOf("assists" to assistSnapshot.getAssists() + 1))
                    } else {
                        val newAssistStats = mapOf(
                            "id" to assistStatsId,
                            "game_id" to gameId,
                            "player_id" to assistedById,
                            "team_id" to teamId,
                            "assists" to 1
                        )
                        set(assistStatsDocRef, newAssistStats)
                    }

                    // Update Confirmation
                    val assistConfSnapshot = get(assistConfDocRef)
                    if (assistConfSnapshot.exists) {
                        val currentAssistCount = assistConfSnapshot.get<Long?>("assists") ?: 0
                        update(assistConfDocRef, mapOf("assists" to currentAssistCount + 1))
                    }
                }
            }

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
            val eventDoc = firestore.collection("game_events").document(eventId).get()
            val event = eventDoc.toGameEventOrNull()
                ?: return Result.failure(Exception("Evento não encontrado"))

            val eventType = event.getEventTypeEnum()

            // Reverter estatísticas em transação
            firestore.runTransaction<Unit> {
                val scoreDocRef = firestore.collection("live_scores").document(gameId)
                val gameDocRef = firestore.collection("games").document(gameId)

                // Reverter placar se for gol
                if (eventType == GameEventType.GOAL) {
                    val scoreSnapshot = get(scoreDocRef)
                    val score = scoreSnapshot.toLiveScoreOrNull()

                    if (score != null) {
                        when {
                            score.team1Id == event.teamId -> {
                                val newScore = maxOf(0, score.team1Score - 1)
                                update(scoreDocRef, mapOf("team1_score" to newScore))
                                update(gameDocRef, mapOf("team1_score" to newScore))
                            }
                            score.team2Id == event.teamId -> {
                                val newScore = maxOf(0, score.team2Score - 1)
                                update(scoreDocRef, mapOf("team2_score" to newScore))
                                update(gameDocRef, mapOf("team2_score" to newScore))
                            }
                        }
                    }
                }

                // Reverter estatísticas do jogador
                if (event.playerId.isNotEmpty()) {
                    val statsId = "${gameId}_${event.playerId}"
                    val statsDocRef = firestore.collection("live_player_stats").document(statsId)
                    val confirmationId = "${gameId}_${event.playerId}"
                    val confDocRef = firestore.collection("confirmations").document(confirmationId)

                    val statsSnapshot = get(statsDocRef)

                    if (statsSnapshot.exists) {
                        when (eventType) {
                            GameEventType.GOAL -> update(statsDocRef, mapOf("goals" to maxOf(0, statsSnapshot.getGoals() - 1)))
                            GameEventType.SAVE -> update(statsDocRef, mapOf("saves" to maxOf(0, statsSnapshot.getSaves() - 1)))
                            GameEventType.YELLOW_CARD -> update(statsDocRef, mapOf("yellow_cards" to maxOf(0, statsSnapshot.getYellowCards() - 1)))
                            GameEventType.RED_CARD -> update(statsDocRef, mapOf("red_cards" to maxOf(0, statsSnapshot.getRedCards() - 1)))
                            else -> {}
                        }
                    }

                    // Reverter em confirmations
                    val confSnapshot = get(confDocRef)
                    if (confSnapshot.exists) {
                        when (eventType) {
                            GameEventType.GOAL -> {
                                val currentGoals = confSnapshot.get<Long?>("goals") ?: 0
                                update(confDocRef, mapOf("goals" to maxOf(0, currentGoals - 1)))
                            }
                            GameEventType.YELLOW_CARD -> {
                                val currentYellow = confSnapshot.get<Long?>("yellow_cards") ?: 0
                                update(confDocRef, mapOf("yellow_cards" to maxOf(0, currentYellow - 1)))
                            }
                            GameEventType.RED_CARD -> {
                                val currentRed = confSnapshot.get<Long?>("red_cards") ?: 0
                                update(confDocRef, mapOf("red_cards" to maxOf(0, currentRed - 1)))
                            }
                            GameEventType.SAVE -> {
                                val currentSaves = confSnapshot.get<Long?>("saves") ?: 0
                                update(confDocRef, mapOf("saves" to maxOf(0, currentSaves - 1)))
                            }
                            else -> {}
                        }
                    }
                }

                // Reverter assistência se for gol com assistência
                if (eventType == GameEventType.GOAL && !event.assistedById.isNullOrEmpty()) {
                    val assistStatsId = "${gameId}_${event.assistedById}"
                    val assistStatsDocRef = firestore.collection("live_player_stats").document(assistStatsId)
                    val assistConfDocRef = firestore.collection("confirmations").document(assistStatsId)

                    val assistSnapshot = get(assistStatsDocRef)
                    if (assistSnapshot.exists) {
                        update(assistStatsDocRef, mapOf("assists" to maxOf(0, assistSnapshot.getAssists() - 1)))
                    }

                    val assistConfSnapshot = get(assistConfDocRef)
                    if (assistConfSnapshot.exists) {
                        val currentAssists = assistConfSnapshot.get<Long?>("assists") ?: 0
                        update(assistConfDocRef, mapOf("assists" to maxOf(0, currentAssists - 1)))
                    }
                }

                // Deletar o evento
                delete(firestore.collection("game_events").document(eventId))
            }

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ========== GROUPS MANAGEMENT ==========

    actual suspend fun createGroup(group: Group): Result<Group> {
        return try {
            val docRef = firestore.collection(COLLECTION_GROUPS).document
            val groupData = mapOf(
                "id" to docRef.id,
                "name" to group.name,
                "description" to group.description,
                "photo_url" to group.photoUrl,
                "owner_id" to group.ownerId,
                "is_active" to true,
                "created_at" to FieldValue.serverTimestamp
            )
            docRef.set(groupData)
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
                "joined_at" to FieldValue.serverTimestamp
            )
            firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection("members")
                .document(userId)
                .set(memberData)
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

            if (!doc.exists) {
                return Result.failure(NoSuchElementException("Grupo não encontrado: $groupId"))
            }

            val group = doc.toGroupOrNull()
                ?: return Result.failure(IllegalStateException("Erro ao converter grupo"))

            Result.success(group)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual fun getGroupMembersFlow(groupId: String): Flow<Result<List<GroupMember>>> {
        return firestore.collection(COLLECTION_GROUPS)
            .document(groupId)
            .collection("members")
            .where { "status" equalTo "ACTIVE" }
            .orderBy("joined_at", Direction.ASCENDING)
            .snapshots()
            .map { snapshot -> Result.success(snapshot.documents.mapNotNull { it.toGroupMemberOrNull() }) }
            .catch { e -> emit(Result.failure(e)) }
    }

    actual fun getGroupDetailsFlow(groupId: String): Flow<Result<Group>> {
        return firestore.collection(COLLECTION_GROUPS)
            .document(groupId)
            .snapshots()
            .map { snapshot ->
                if (snapshot.exists) {
                    val group = snapshot.toGroupOrNull()
                    if (group != null) Result.success(group)
                    else Result.failure(Exception("Erro ao converter grupo"))
                } else {
                    Result.failure(Exception("Grupo não encontrado"))
                }
            }
            .catch { e -> emit(Result.failure(e)) }
    }

    // ========== GROUPS ADVANCED ==========

    actual suspend fun promoteGroupMemberToAdmin(groupId: String, memberId: String): Result<Unit> {
        return try {
            firestore.runTransaction<Unit> {
                val memberRef = firestore.collection(COLLECTION_GROUPS)
                    .document(groupId)
                    .collection("members").document(memberId)
                update(memberRef, mapOf("role" to "ADMIN"))

                val userGroupRef = firestore.collection("users")
                    .document(memberId)
                    .collection("groups").document(groupId)
                update(userGroupRef, mapOf("role" to "ADMIN"))
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun demoteGroupAdminToMember(groupId: String, memberId: String): Result<Unit> {
        return try {
            firestore.runTransaction<Unit> {
                val memberRef = firestore.collection(COLLECTION_GROUPS)
                    .document(groupId)
                    .collection("members").document(memberId)
                update(memberRef, mapOf("role" to "MEMBER"))

                val userGroupRef = firestore.collection("users")
                    .document(memberId)
                    .collection("groups").document(groupId)
                update(userGroupRef, mapOf("role" to "MEMBER"))
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun updateGroupMemberRole(groupId: String, userId: String, role: String): Result<Unit> {
        return try {
            firestore.runTransaction<Unit> {
                val memberRef = firestore.collection(COLLECTION_GROUPS)
                    .document(groupId)
                    .collection("members").document(userId)
                update(memberRef, mapOf("role" to role))

                val userGroupRef = firestore.collection("users")
                    .document(userId)
                    .collection("groups").document(groupId)
                update(userGroupRef, mapOf("role" to role))
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun leaveGroup(groupId: String, userId: String): Result<Unit> {
        return try {
            firestore.runTransaction<Unit> {
                val memberRef = firestore.collection(COLLECTION_GROUPS)
                    .document(groupId)
                    .collection("members").document(userId)
                update(memberRef, mapOf("status" to "INACTIVE"))

                val groupRef = firestore.collection(COLLECTION_GROUPS).document(groupId)
                update(groupRef, mapOf("member_count" to FieldValue.increment(-1)))

                val userGroupRef = firestore.collection("users")
                    .document(userId)
                    .collection("groups").document(groupId)
                delete(userGroupRef)
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun archiveGroup(groupId: String): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .update(mapOf(
                    "status" to "ARCHIVED",
                    "updated_at" to FieldValue.serverTimestamp
                ))
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun restoreGroup(groupId: String): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .update(mapOf(
                    "status" to "ACTIVE",
                    "updated_at" to FieldValue.serverTimestamp
                ))
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun deleteGroup(groupId: String): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .update(mapOf(
                    "status" to "DELETED",
                    "updated_at" to FieldValue.serverTimestamp
                ))
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
            firestore.runTransaction<Unit> {
                val groupRef = firestore.collection(COLLECTION_GROUPS).document(groupId)
                update(groupRef, mapOf(
                    "owner_id" to newOwnerId,
                    "owner_name" to newOwnerName,
                    "updated_at" to FieldValue.serverTimestamp
                ))

                val oldOwnerMemberRef = firestore.collection(COLLECTION_GROUPS)
                    .document(groupId)
                    .collection("members").document(oldOwnerId)
                update(oldOwnerMemberRef, mapOf("role" to "ADMIN"))

                val newOwnerMemberRef = firestore.collection(COLLECTION_GROUPS)
                    .document(groupId)
                    .collection("members").document(newOwnerId)
                update(newOwnerMemberRef, mapOf("role" to "OWNER"))

                val oldOwnerGroupRef = firestore.collection("users")
                    .document(oldOwnerId)
                    .collection("groups").document(groupId)
                update(oldOwnerGroupRef, mapOf("role" to "ADMIN"))

                val newOwnerGroupRef = firestore.collection("users")
                    .document(newOwnerId)
                    .collection("groups").document(groupId)
                update(newOwnerGroupRef, mapOf("role" to "OWNER"))
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun syncGroupMemberCount(groupId: String, userIds: List<String>): Result<Unit> {
        return try {
            val correctMemberCount = userIds.size
            val batch = firestore.batch()

            val groupRef = firestore.collection(COLLECTION_GROUPS).document(groupId)
            batch.update(groupRef, mapOf("member_count" to correctMemberCount))

            userIds.forEach { memberId ->
                val userGroupRef = firestore.collection("users")
                    .document(memberId)
                    .collection("groups").document(groupId)
                batch.update(userGroupRef, mapOf("member_count" to correctMemberCount))
            }

            batch.commit()
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
            val snapshot = firestore.collection(COLLECTION_GROUPS)
                .where { "invite_code" equalTo inviteCode }
                .where { "status" equalTo "ACTIVE" }
                .get()

            if (snapshot.documents.isEmpty()) {
                return Result.failure(Exception("Código de convite inválido"))
            }

            val groupDoc = snapshot.documents[0]
            val groupId = groupDoc.id
            val groupName = groupDoc.get<String?>("name") ?: ""
            val groupPhoto = groupDoc.get<String?>("photo_url")

            firestore.runTransaction<Unit> {
                val memberRef = firestore.collection(COLLECTION_GROUPS)
                    .document(groupId)
                    .collection("members").document(userId)

                val memberData = mapOf(
                    "user_id" to userId,
                    "user_name" to userName,
                    "user_photo" to userPhoto,
                    "role" to "MEMBER",
                    "status" to "ACTIVE",
                    "joined_at" to FieldValue.serverTimestamp
                )
                set(memberRef, memberData)

                val groupRef = firestore.collection(COLLECTION_GROUPS).document(groupId)
                update(groupRef, mapOf("member_count" to FieldValue.increment(1)))

                val userGroupRef = firestore.collection("users")
                    .document(userId)
                    .collection("groups").document(groupId)

                val userGroupData = mapOf(
                    "group_id" to groupId,
                    "group_name" to groupName,
                    "group_photo" to groupPhoto,
                    "role" to "MEMBER",
                    "joined_at" to FieldValue.serverTimestamp
                )
                set(userGroupRef, userGroupData)
            }

            Result.success(groupId)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun generateGroupInviteCode(groupId: String): Result<String> {
        return try {
            val chars = ('A'..'Z') + ('0'..'9')
            var code: String
            var attempts = 0

            do {
                code = (1..8).map { chars.random() }.joinToString("")
                val existing = firestore.collection(COLLECTION_GROUPS)
                    .where { "invite_code" equalTo code }
                    .limit(1)
                    .get()
                attempts++
            } while (!existing.documents.isEmpty() && attempts < 5)

            firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .update(mapOf(
                    "invite_code" to code,
                    "updated_at" to FieldValue.serverTimestamp
                ))

            Result.success(code)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ========== MÉTODOS AUXILIARES DE GRUPO ==========

    suspend fun getMyRoleInGroup(groupId: String, userId: String): Result<String?> {
        return try {
            val snapshot = firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection("members")
                .document(userId)
                .get()

            val role = snapshot.get<String?>("role")
            Result.success(role)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun isMemberOfGroup(groupId: String, userId: String): Result<Boolean> {
        return try {
            val snapshot = firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection("members")
                .document(userId)
                .get()

            val isMember = snapshot.exists && snapshot.get<String?>("status") == "ACTIVE"
            Result.success(isMember)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getMyAdminGroups(userId: String): Result<List<String>> {
        return try {
            val snapshot = firestore.collection("users")
                .document(userId)
                .collection("groups")
                .where { "role" inArray listOf("OWNER", "ADMIN") }
                .get()

            val groupIds = snapshot.documents.map { it.id }
            Result.success(groupIds)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getValidGroupsForGame(userId: String): Result<List<String>> {
        return try {
            val snapshot = firestore.collection("users")
                .document(userId)
                .collection("groups")
                .where { "status" equalTo "ACTIVE" }
                .where { "role" inArray listOf("OWNER", "ADMIN") }
                .get()

            val groupIds = snapshot.documents.map { it.id }
            Result.success(groupIds)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun canCreateGames(userId: String): Result<Boolean> {
        return try {
            val snapshot = firestore.collection("users")
                .document(userId)
                .collection("groups")
                .where { "status" equalTo "ACTIVE" }
                .where { "role" inArray listOf("OWNER", "ADMIN") }
                .limit(1)
                .get()

            Result.success(!snapshot.documents.isEmpty())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun countMyAdminGroups(userId: String): Result<Int> {
        return try {
            val snapshot = firestore.collection("users")
                .document(userId)
                .collection("groups")
                .where { "role" inArray listOf("OWNER", "ADMIN") }
                .get()

            Result.success(snapshot.documents.size)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun syncAllMyGroupsMemberCount(userId: String): Result<Unit> {
        return try {
            val groupsSnapshot = firestore.collection("users")
                .document(userId)
                .collection("groups")
                .get()

            groupsSnapshot.documents.forEach { userGroupDoc ->
                val groupId = userGroupDoc.id

                val membersSnapshot = firestore.collection(COLLECTION_GROUPS)
                    .document(groupId)
                    .collection("members")
                    .where { "status" equalTo "ACTIVE" }
                    .get()

                val memberCount = membersSnapshot.documents.size

                firestore.runTransaction<Unit> {
                    val groupRef = firestore.collection(COLLECTION_GROUPS).document(groupId)
                    update(groupRef, mapOf("member_count" to memberCount))

                    val userGroupRef = firestore.collection("users")
                        .document(userId)
                        .collection("groups").document(groupId)
                    update(userGroupRef, mapOf("member_count" to memberCount))
                }
            }

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getGroupActiveMemberIds(groupId: String): Result<List<String>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .collection("members")
                .where { "status" equalTo "ACTIVE" }
                .get()

            val userIds = snapshot.documents.map { it.id }
            Result.success(userIds)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun uploadGroupPhoto(groupId: String, photoPath: String): Result<String> {
        return Result.failure(Exception("Upload de fotos requer URI Android — não disponível nesta plataforma"))
    }

    // ========== BATCH OPERATIONS ==========

    actual suspend fun executeBatch(operations: List<BatchOperation>): Result<Unit> {
        return try {
            val chunks = operations.chunked(450)

            chunks.forEach { chunk ->
                val batch = firestore.batch()

                chunk.forEach { operation ->
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

                batch.commit()
            }

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun getLivePlayerStats(gameId: String): Result<List<LivePlayerStats>> {
        return try {
            val snapshot = firestore.collection("live_player_stats")
                .where { "game_id" equalTo gameId }
                .get()

            val stats = snapshot.documents.mapNotNull { doc ->
                LivePlayerStats(
                    id = doc.id,
                    gameId = doc.get<String?>("game_id") ?: "",
                    playerId = doc.get<String?>("player_id") ?: "",
                    playerName = doc.get<String?>("player_name") ?: "",
                    teamId = doc.get<String?>("team_id") ?: "",
                    position = doc.get<String?>("position") ?: "LINE",
                    goals = doc.get<Long?>("goals")?.toInt() ?: 0,
                    assists = doc.get<Long?>("assists")?.toInt() ?: 0,
                    saves = doc.get<Long?>("saves")?.toInt() ?: 0,
                    yellowCards = doc.get<Long?>("yellow_cards")?.toInt() ?: 0,
                    redCards = doc.get<Long?>("red_cards")?.toInt() ?: 0,
                    isPlaying = doc.get<Boolean?>("is_playing") ?: true
                )
            }

            Result.success(stats)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual fun getLivePlayerStatsFlow(gameId: String): Flow<Result<List<LivePlayerStats>>> {
        return firestore.collection("live_player_stats")
            .where { "game_id" equalTo gameId }
            .snapshots()
            .map { snapshot ->
                val stats = snapshot.documents.mapNotNull { doc ->
                    LivePlayerStats(
                        id = doc.id,
                        gameId = doc.get<String?>("game_id") ?: "",
                        playerId = doc.get<String?>("player_id") ?: "",
                        playerName = doc.get<String?>("player_name") ?: "",
                        teamId = doc.get<String?>("team_id") ?: "",
                        position = doc.get<String?>("position") ?: "LINE",
                        goals = doc.get<Long?>("goals")?.toInt() ?: 0,
                        assists = doc.get<Long?>("assists")?.toInt() ?: 0,
                        saves = doc.get<Long?>("saves")?.toInt() ?: 0,
                        yellowCards = doc.get<Long?>("yellow_cards")?.toInt() ?: 0,
                        redCards = doc.get<Long?>("red_cards")?.toInt() ?: 0,
                        isPlaying = doc.get<Boolean?>("is_playing") ?: true
                    )
                }
                Result.success(stats)
            }
            .catch { e -> emit(Result.failure(e)) }
    }

    actual suspend fun finishGame(gameId: String): Result<Unit> {
        return try {
            firestore.collection("live_scores")
                .document(gameId)
                .update(mapOf("finished_at" to FieldValue.serverTimestamp))
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    actual suspend fun clearAllLiveGameData(): Result<Unit> {
        return try {
            // Buscar documentos de cada coleção
            val scoresSnapshot = firestore.collection("live_scores").limit(500).get()
            val eventsSnapshot = firestore.collection("game_events").limit(500).get()
            val liveStatsSnapshot = firestore.collection("live_player_stats").limit(500).get()

            // Juntar todos os docs e processar em chunks de 450 (limite do batch é 500)
            val allDocs = scoresSnapshot.documents + eventsSnapshot.documents + liveStatsSnapshot.documents
            allDocs.chunked(450).forEach { chunk ->
                val batch = firestore.batch()
                chunk.forEach { doc -> batch.delete(doc.reference) }
                batch.commit()
            }

            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ========== PAYMENTS ==========

    actual suspend fun createPayment(payment: Payment): Result<Payment> {
        return try {
            val paymentRef = if (payment.id.isEmpty()) firestore.collection(COLLECTION_PAYMENTS).document
            else firestore.collection(COLLECTION_PAYMENTS).document(payment.id)
            val paymentData = mapOf(
                "id" to paymentRef.id, "user_id" to payment.userId, "game_id" to (payment.gameId ?: ""),
                "schedule_id" to (payment.scheduleId ?: ""), "type" to payment.type.name,
                "amount" to payment.amount, "status" to payment.status.name,
                "payment_method" to (payment.paymentMethod?.name ?: ""), "due_date" to payment.dueDate,
                "paid_at" to (payment.paidAt ?: 0L), "pix_key" to (payment.pixKey ?: ""),
                "pix_qrcode" to (payment.pixQrcode ?: ""), "pix_txid" to (payment.pixTxid ?: ""),
                "receipt_url" to (payment.receiptUrl ?: ""), "notes" to (payment.notes ?: ""),
                "created_at" to (payment.createdAt ?: Clock.System.now().toEpochMilliseconds())
            )
            paymentRef.set(paymentData)
            Result.success(payment.copy(id = paymentRef.id))
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao criar pagamento: ${e.message}")
            Result.failure(e)
        }
    }

    actual suspend fun confirmPayment(paymentId: String): Result<Unit> {
        return try {
            firestore.collection(COLLECTION_PAYMENTS).document(paymentId)
                .update(mapOf("status" to PaymentStatus.PAID.name, "paid_at" to Clock.System.now().toEpochMilliseconds()))
            Result.success(Unit)
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao confirmar pagamento: ${e.message}")
            Result.failure(e)
        }
    }

    actual suspend fun getPaymentsByUser(userId: String): Result<List<Payment>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_PAYMENTS)
                .where { "user_id" equalTo userId }.orderBy("created_at", Direction.DESCENDING).get()
            Result.success(snapshot.documents.mapNotNull { it.toPaymentOrNull() })
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao buscar pagamentos do usuário: ${e.message}")
            Result.failure(e)
        }
    }

    // ========== CASHBOX ==========

    actual suspend fun uploadCashboxReceipt(groupId: String, filePath: String): Result<String> {
        return Result.failure(Exception("Upload de recibo requer URI Android — não disponível nesta plataforma"))
    }

    actual suspend fun addCashboxEntry(groupId: String, entry: CashboxEntry, receiptFilePath: String?): Result<String> {
        return try {
            val userId = auth.currentUser?.uid ?: return Result.failure(Exception("Usuário não autenticado"))
            val memberDoc = firestore.collection(COLLECTION_GROUPS).document(groupId)
                .collection("members").document(userId).get()
            if (!memberDoc.exists) return Result.failure(Exception("Usuário não é membro do grupo"))
            val role = memberDoc.get<String?>("role")
            if (role != "ADMIN" && role != "OWNER") return Result.failure(Exception("Apenas administradores podem lançar no caixa"))
            val finalEntry = if (receiptFilePath != null) {
                val up = uploadCashboxReceipt(groupId, receiptFilePath)
                if (up.isSuccess) entry.copy(receiptUrl = up.getOrNull()) else entry
            } else entry
            val userName = memberDoc.get<String?>("user_name") ?: ""
            val entryRef = firestore.collection(COLLECTION_GROUPS).document(groupId).collection(SUBCOLLECTION_CASHBOX).document
            val summaryRef = firestore.collection(COLLECTION_GROUPS).document(groupId).collection(SUBCOLLECTION_CASHBOX_SUMMARY).document("current")
            if (finalEntry.amount <= 0) return Result.failure(Exception("O valor deve ser maior que zero"))
            val entryData = mapOf(
                "id" to entryRef.id, "type" to finalEntry.type, "category" to finalEntry.category,
                "custom_category" to (finalEntry.customCategory ?: ""), "amount" to finalEntry.amount,
                "description" to finalEntry.description, "created_by_id" to userId, "created_by_name" to userName,
                "reference_date" to finalEntry.referenceDate.toString(),
                "created_at" to (finalEntry.createdAt?.toString() ?: FieldValue.serverTimestamp),
                "player_id" to (finalEntry.playerId ?: ""), "player_name" to (finalEntry.playerName ?: ""),
                "game_id" to (finalEntry.gameId ?: ""), "receipt_url" to (finalEntry.receiptUrl ?: ""),
                "status" to finalEntry.status
            )
            firestore.runTransaction<Unit> {
                val summaryDoc = get(summaryRef)
                val balance = summaryDoc.get<Double?>("balance") ?: 0.0
                val totalIncome = summaryDoc.get<Double?>("total_income") ?: 0.0
                val totalExpense = summaryDoc.get<Double?>("total_expense") ?: 0.0
                val entryCount = summaryDoc.get<Long?>("entry_count")?.toInt() ?: 0
                val amount = finalEntry.amount
                val newSummary = if (finalEntry.isIncome()) mapOf(
                    "balance" to (balance + amount), "total_income" to (totalIncome + amount),
                    "total_expense" to totalExpense, "last_entry_at" to FieldValue.serverTimestamp,
                    "entry_count" to (entryCount + 1)
                ) else mapOf(
                    "balance" to (balance - amount), "total_income" to totalIncome,
                    "total_expense" to (totalExpense + amount), "last_entry_at" to FieldValue.serverTimestamp,
                    "entry_count" to (entryCount + 1)
                )
                set(summaryRef, newSummary)
                set(entryRef, entryData)
            }
            Result.success(entryRef.id)
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao adicionar entrada no caixa: ${e.message}")
            Result.failure(e)
        }
    }

    actual suspend fun getCashboxSummary(groupId: String): Result<CashboxSummary> {
        return try {
            val doc = firestore.collection(COLLECTION_GROUPS).document(groupId)
                .collection(SUBCOLLECTION_CASHBOX_SUMMARY).document("current").get()
            Result.success(if (doc.exists) doc.toCashboxSummaryOrNull() ?: CashboxSummary() else CashboxSummary())
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao buscar resumo do caixa: ${e.message}")
            Result.failure(e)
        }
    }

    actual fun getCashboxSummaryFlow(groupId: String): Flow<Result<CashboxSummary>> {
        return firestore.collection(COLLECTION_GROUPS).document(groupId)
            .collection(SUBCOLLECTION_CASHBOX_SUMMARY).document("current").snapshots()
            .map { s -> Result.success(if (s.exists) s.toCashboxSummaryOrNull() ?: CashboxSummary() else CashboxSummary()) }
            .catch { e -> emit(Result.failure(e)) }
    }

    actual suspend fun getCashboxHistory(groupId: String, limit: Int): Result<List<CashboxEntry>> {
        return try {
            val snapshot = firestore.collection(COLLECTION_GROUPS).document(groupId)
                .collection(SUBCOLLECTION_CASHBOX).where { "status" equalTo CashboxAppStatus.ACTIVE.name }
                .orderBy("created_at", Direction.DESCENDING).limit(limit).get()
            Result.success(snapshot.documents.mapNotNull { it.toCashboxEntryOrNull() })
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao buscar histórico do caixa: ${e.message}")
            Result.failure(e)
        }
    }

    actual fun getCashboxHistoryFlow(groupId: String, limit: Int): Flow<Result<List<CashboxEntry>>> {
        return firestore.collection(COLLECTION_GROUPS).document(groupId)
            .collection(SUBCOLLECTION_CASHBOX).where { "status" equalTo CashboxAppStatus.ACTIVE.name }
            .orderBy("created_at", Direction.DESCENDING).limit(limit).snapshots()
            .map { s -> Result.success(s.documents.mapNotNull { it.toCashboxEntryOrNull() }) }
            .catch { e -> emit(Result.failure(e)) }
    }

    actual suspend fun getCashboxHistoryFiltered(groupId: String, filter: CashboxFilter, limit: Int): Result<List<CashboxEntry>> {
        return try {
            var query: Query = firestore.collection(COLLECTION_GROUPS).document(groupId)
                .collection(SUBCOLLECTION_CASHBOX).where { "status" equalTo CashboxAppStatus.ACTIVE.name }
            filter.type?.let { query = query.where { "type" equalTo it.name } }
            filter.category?.let { query = query.where { "category" equalTo it.name } }
            filter.playerId?.let { query = query.where { "player_id" equalTo it } }
            filter.startDate?.let { query = query.where { "reference_date" greaterThanOrEqualTo it.toString() } }
            filter.endDate?.let { query = query.where { "reference_date" lessThanOrEqualTo it.toString() } }
            val orderField = if (filter.startDate != null || filter.endDate != null) "reference_date" else "created_at"
            Result.success(query.orderBy(orderField, Direction.DESCENDING).limit(limit).get().documents.mapNotNull { it.toCashboxEntryOrNull() })
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao buscar histórico filtrado do caixa: ${e.message}")
            Result.failure(e)
        }
    }

    actual suspend fun getCashboxEntriesByMonth(groupId: String, year: Int, month: Int): Result<List<CashboxEntry>> {
        return try {
            val startMillis = kotlinx.datetime.LocalDateTime(year, month, 1, 0, 0, 0).toInstant(TimeZone.currentSystemDefault()).toEpochMilliseconds()
            val ny = if (month == 12) year + 1 else year; val nm = if (month == 12) 1 else month + 1
            val endMillis = kotlinx.datetime.LocalDateTime(ny, nm, 1, 0, 0, 0).toInstant(TimeZone.currentSystemDefault()).toEpochMilliseconds()
            val snapshot = firestore.collection(COLLECTION_GROUPS).document(groupId)
                .collection(SUBCOLLECTION_CASHBOX).where { "status" equalTo CashboxAppStatus.ACTIVE.name }
                .where { "reference_date" greaterThanOrEqualTo Timestamp(startMillis / 1000, 0) }
                .where { "reference_date" lessThan Timestamp(endMillis / 1000, 0) }
                .orderBy("reference_date", Direction.DESCENDING).get()
            Result.success(snapshot.documents.mapNotNull { it.toCashboxEntryOrNull() })
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao buscar entradas por mês: ${e.message}")
            Result.failure(e)
        }
    }

    actual suspend fun getCashboxEntryById(groupId: String, entryId: String): Result<CashboxEntry> {
        return try {
            val doc = firestore.collection(COLLECTION_GROUPS).document(groupId).collection(SUBCOLLECTION_CASHBOX).document(entryId).get()
            if (doc.exists) Result.success(doc.toCashboxEntryOrNull() ?: return Result.failure(Exception("Erro ao converter entrada")))
            else Result.failure(Exception("Entrada não encontrada"))
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao buscar entrada por ID: ${e.message}")
            Result.failure(e)
        }
    }

    actual suspend fun deleteCashboxEntry(groupId: String, entryId: String): Result<Unit> {
        return try {
            val userId = auth.currentUser?.uid ?: return Result.failure(Exception("Usuário não autenticado"))
            val memberDoc = firestore.collection(COLLECTION_GROUPS).document(groupId).collection("members").document(userId).get()
            if (!memberDoc.exists) return Result.failure(Exception("Você não é membro deste grupo"))
            if (memberDoc.get<String?>("role") != "OWNER") return Result.failure(Exception("Apenas o dono do grupo pode estornar entradas"))
            val entryDoc = firestore.collection(COLLECTION_GROUPS).document(groupId).collection(SUBCOLLECTION_CASHBOX).document(entryId).get()
            if (!entryDoc.exists) return Result.failure(Exception("Entrada não encontrada"))
            val entry = entryDoc.toCashboxEntryOrNull() ?: return Result.failure(Exception("Erro ao converter entrada"))
            if (entry.status == CashboxAppStatus.VOIDED.name) return Result.failure(Exception("Esta entrada já foi estornada"))
            firestore.runTransaction<Unit> {
                val summaryRef = firestore.collection(COLLECTION_GROUPS).document(groupId).collection(SUBCOLLECTION_CASHBOX_SUMMARY).document("current")
                val summaryDoc = get(summaryRef)
                val balance = summaryDoc.get<Double?>("balance") ?: 0.0
                val totalIncome = summaryDoc.get<Double?>("total_income") ?: 0.0
                val totalExpense = summaryDoc.get<Double?>("total_expense") ?: 0.0
                val entryCount = summaryDoc.get<Long?>("entry_count")?.toInt() ?: 0
                update(summaryRef, mapOf(
                    "balance" to (balance + (if (entry.isIncome()) -entry.amount else entry.amount)),
                    "total_income" to (if (entry.isIncome()) totalIncome - entry.amount else totalIncome),
                    "total_expense" to (if (entry.isExpense()) totalExpense - entry.amount else totalExpense),
                    "last_entry_at" to FieldValue.serverTimestamp,
                    "entry_count" to (entryCount - 1).coerceAtLeast(0)
                ))
                val entryRef = firestore.collection(COLLECTION_GROUPS).document(groupId).collection(SUBCOLLECTION_CASHBOX).document(entryId)
                update(entryRef, mapOf("status" to CashboxAppStatus.VOIDED.name, "voided_at" to FieldValue.serverTimestamp, "voided_by" to userId))
            }
            Result.success(Unit)
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao deletar entrada do caixa: ${e.message}")
            Result.failure(e)
        }
    }

    actual suspend fun recalculateCashboxBalance(groupId: String): Result<CashboxSummary> {
        return try {
            val userId = auth.currentUser?.uid ?: return Result.failure(Exception("Usuário não autenticado"))
            val memberDoc = firestore.collection(COLLECTION_GROUPS).document(groupId).collection("members").document(userId).get()
            val role = memberDoc.get<String?>("role")
            if (role != "ADMIN" && role != "OWNER") return Result.failure(Exception("Apenas administradores podem recalcular o saldo"))
            val entriesSnapshot = firestore.collection(COLLECTION_GROUPS).document(groupId)
                .collection(SUBCOLLECTION_CASHBOX).where { "status" equalTo CashboxAppStatus.ACTIVE.name }.get()
            var totalIncome = 0.0; var totalExpense = 0.0
            val entries = entriesSnapshot.documents.mapNotNull { it.toCashboxEntryOrNull() }
            val sortedEntries = entries.sortedByDescending { it.createdAt ?: Clock.System.now() }
            sortedEntries.forEach { if (it.isIncome()) totalIncome += it.amount else totalExpense += it.amount }
            val lastEntryDate: Timestamp? = sortedEntries.firstOrNull()?.createdAt?.let { inst ->
                val millis = inst.toEpochMilliseconds(); Timestamp(millis / 1000, ((millis % 1000) * 1_000_000).toInt())
            }
            val balance = totalIncome - totalExpense
            val summary = CashboxSummary(balance = balance, totalIncome = totalIncome, totalExpense = totalExpense,
                lastEntryAt = lastEntryDate?.let { instantFromTimestamp(it) }, entryCount = entries.size)
            firestore.collection(COLLECTION_GROUPS).document(groupId).collection(SUBCOLLECTION_CASHBOX_SUMMARY).document("current")
                .set(mapOf("balance" to balance, "total_income" to totalIncome, "total_expense" to totalExpense,
                    "last_entry_at" to (lastEntryDate ?: FieldValue.serverTimestamp), "entry_count" to entries.size))
            Result.success(summary)
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao recalcular saldo do caixa: ${e.message}")
            Result.failure(e)
        }
    }

    // ========== RANKINGS ==========

    actual suspend fun getRankingByCategory(category: String, field: String, limit: Int): Result<List<Triple<String, Long, Int>>> {
        return try {
            val collection = if (category == "XP") COLLECTION_USERS else COLLECTION_STATISTICS
            val snapshot = firestore.collection(collection).orderBy(field, Direction.DESCENDING).limit(limit).get()
            Result.success(snapshot.documents.mapNotNull { doc ->
                val value = if (category == "XP") doc.get<Long?>("experience_points") ?: 0L else doc.get<Long?>(field) ?: 0L
                val games = if (category == "XP") 0 else doc.get<Long?>("totalGames")?.toInt() ?: doc.get<Long?>("total_games")?.toInt() ?: 0
                Triple(doc.id, value, games)
            })
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao buscar ranking $category: ${e.message}")
            Result.failure(e)
        }
    }

    actual suspend fun getRankingDeltas(periodName: String, periodKey: String, deltaField: String, minGames: Int, limit: Int): Result<List<Triple<String, Long, Int>>> {
        return try {
            val snapshot = firestore.collection("ranking_deltas")
                .where { "period" equalTo periodName }.where { "period_key" equalTo periodKey }
                .orderBy(deltaField, Direction.DESCENDING).limit(limit).get()
            Result.success(snapshot.documents.mapNotNull { doc ->
                val userId = doc.get<String?>("user_id") ?: return@mapNotNull null
                Triple(userId, doc.get<Long?>(deltaField) ?: 0L, doc.get<Long?>("games_added")?.toInt() ?: 0)
            }.filter { (_, _, g) -> g >= minGames })
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao buscar ranking deltas: ${e.message}")
            Result.failure(e)
        }
    }

    actual suspend fun getUsersStatistics(userIds: List<String>): Result<Map<String, Statistics>> {
        return try {
            if (userIds.isEmpty()) return Result.success(emptyMap())
            val map = mutableMapOf<String, Statistics>()
            userIds.chunked(10).forEach { chunk ->
                firestore.collection(COLLECTION_STATISTICS).where { FieldPath.documentId inArray chunk }.get()
                    .documents.forEach { doc -> doc.toRankingStatisticsOrNull()?.let { map[doc.id] = it } }
            }
            Result.success(map)
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao buscar estatísticas em batch: ${e.message}")
            Result.failure(e)
        }
    }

    actual suspend fun getStatisticsRanking(orderByField: String, limit: Int): Result<List<Statistics>> {
        return try {
            Result.success(firestore.collection(COLLECTION_STATISTICS).orderBy(orderByField, Direction.DESCENDING).limit(limit).get()
                .documents.mapNotNull { it.toRankingStatisticsOrNull() })
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao buscar ranking de estatísticas: ${e.message}")
            Result.failure(e)
        }
    }

    // ========== NOTIFICATIONS ==========

    actual suspend fun getMyNotifications(limit: Int): Result<List<AppNotification>> {
        return try {
            val userId = auth.currentUser?.uid ?: return Result.failure(Exception("Usuário não autenticado"))
            Result.success(firestore.collection("notifications").where { "user_id" equalTo userId }
                .orderBy("created_at", Direction.DESCENDING).limit(limit).get().documents.mapNotNull { it.toAppNotificationOrNull() })
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao buscar notificações: ${e.message}")
            Result.failure(e)
        }
    }

    actual fun getMyNotificationsFlow(limit: Int): Flow<List<AppNotification>> = flow {
        val userId = auth.currentUser?.uid ?: run { emit(emptyList()); return@flow }
        firestore.collection("notifications").where { "user_id" equalTo userId }
            .orderBy("created_at", Direction.DESCENDING).limit(limit).snapshots()
            .collect { emit(it.documents.mapNotNull { d -> d.toAppNotificationOrNull() }) }
    }.catch { emit(emptyList()) }

    actual suspend fun getUnreadNotifications(): Result<List<AppNotification>> {
        return try {
            val userId = auth.currentUser?.uid ?: return Result.failure(Exception("Usuário não autenticado"))
            Result.success(firestore.collection("notifications").where { "user_id" equalTo userId }
                .where { "read" equalTo false }.get().documents.mapNotNull { it.toAppNotificationOrNull() })
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao buscar notificações não lidas: ${e.message}")
            Result.failure(e)
        }
    }

    actual fun getUnreadCountFlow(): Flow<Int> = flow {
        val userId = auth.currentUser?.uid ?: run { emit(0); return@flow }
        firestore.collection("notifications").where { "user_id" equalTo userId }.where { "read" equalTo false }
            .snapshots().collect { emit(it.documents.size) }
    }.catch { emit(0) }

    actual suspend fun getUnreadCount(): Result<Int> {
        return try {
            val userId = auth.currentUser?.uid ?: return Result.failure(Exception("Usuário não autenticado"))
            Result.success(firestore.collection("notifications").where { "user_id" equalTo userId }.where { "read" equalTo false }.get().documents.size)
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao contar notificações não lidas: ${e.message}")
            Result.failure(e)
        }
    }

    actual suspend fun markNotificationAsRead(notificationId: String): Result<Unit> {
        return try {
            firestore.collection("notifications").document(notificationId)
                .update(mapOf("read" to true, "read_at" to FieldValue.serverTimestamp))
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    actual suspend fun markNotificationAsUnread(notificationId: String): Result<Unit> {
        return try {
            firestore.collection("notifications").document(notificationId)
                .update(mapOf("read" to false, "read_at" to FieldValue.delete))
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    actual suspend fun markAllNotificationsAsRead(): Result<Unit> {
        return try {
            val userId = auth.currentUser?.uid ?: return Result.failure(Exception("Usuário não autenticado"))
            val snapshot = firestore.collection("notifications").where { "user_id" equalTo userId }.where { "read" equalTo false }.get()
            if (snapshot.documents.isEmpty()) return Result.success(Unit)
            snapshot.documents.chunked(450).forEach { chunk ->
                val batch = firestore.batch()
                chunk.forEach { doc -> batch.update(doc.reference, mapOf("read" to true, "read_at" to FieldValue.serverTimestamp)) }
                batch.commit()
            }
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    actual suspend fun getNotificationById(notificationId: String): Result<AppNotification> {
        return try {
            val doc = firestore.collection("notifications").document(notificationId).get()
            Result.success(doc.toAppNotificationOrNull() ?: return Result.failure(Exception("Notificação não encontrada")))
        } catch (e: Exception) { Result.failure(e) }
    }

    actual suspend fun createNotification(notification: AppNotification): Result<String> {
        return try {
            val docRef = if (notification.id.isNotEmpty()) firestore.collection("notifications").document(notification.id)
            else firestore.collection("notifications").document
            docRef.set(notification.copy(id = docRef.id))
            Result.success(docRef.id)
        } catch (e: Exception) { Result.failure(e) }
    }

    actual suspend fun batchCreateNotifications(notifications: List<AppNotification>): Result<Unit> {
        return try {
            if (notifications.isEmpty()) return Result.success(Unit)
            val batch = firestore.batch()
            notifications.forEach { notification ->
                val docRef = if (notification.id.isNotEmpty()) firestore.collection("notifications").document(notification.id)
                else firestore.collection("notifications").document
                batch.set(docRef, notification.copy(id = docRef.id))
            }
            batch.commit()
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    actual suspend fun deleteNotification(notificationId: String): Result<Unit> {
        return try {
            firestore.collection("notifications").document(notificationId).delete()
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    actual suspend fun deleteOldNotifications(): Result<Int> {
        return try {
            val userId = auth.currentUser?.uid ?: return Result.failure(Exception("Usuário não autenticado"))
            val thirtyDaysAgoTs = Timestamp((Clock.System.now().toEpochMilliseconds() - 30L * 24 * 60 * 60 * 1000) / 1000, 0)
            val oldSnapshot = firestore.collection("notifications").where { "user_id" equalTo userId }.where { "created_at" lessThan thirtyDaysAgoTs }.get()
            val allSnapshot = firestore.collection("notifications").where { "user_id" equalTo userId }.get()
            val docsToDelete = mutableListOf<dev.gitlive.firebase.firestore.DocumentSnapshot>()
            docsToDelete.addAll(oldSnapshot.documents)
            allSnapshot.documents.forEach { doc ->
                if (doc.get<Any?>("created_at") == null && !docsToDelete.any { it.id == doc.id }) docsToDelete.add(doc)
            }
            if (docsToDelete.isEmpty()) return Result.success(0)
            docsToDelete.chunked(400).forEach { chunk ->
                val batch = firestore.batch(); chunk.forEach { doc -> batch.delete(doc.reference) }; batch.commit()
            }
            Result.success(docsToDelete.size)
        } catch (e: Exception) { Result.failure(e) }
    }

    actual suspend fun getNotificationsByType(type: NotificationType, limit: Int): Result<List<AppNotification>> {
        return try {
            val userId = auth.currentUser?.uid ?: return Result.failure(Exception("Usuário não autenticado"))
            Result.success(firestore.collection("notifications").where { "user_id" equalTo userId }
                .where { "type" equalTo type.name }.orderBy("created_at", Direction.DESCENDING).limit(limit).get()
                .documents.mapNotNull { it.toAppNotificationOrNull() })
        } catch (e: Exception) { Result.failure(e) }
    }

    actual suspend fun getPendingActionNotifications(): Result<List<AppNotification>> {
        return try {
            val userId = auth.currentUser?.uid ?: return Result.failure(Exception("Usuário não autenticado"))
            val snapshot = firestore.collection("notifications").where { "user_id" equalTo userId }.where { "read" equalTo false }.get()
            val now = Clock.System.now().toEpochMilliseconds()
            Result.success(snapshot.documents.mapNotNull { it.toAppNotificationOrNull() }
                .filter { it.requiresResponse() && (it.expiresAt == null || it.expiresAt > now) })
        } catch (e: Exception) { Result.failure(e) }
    }

    // ========== GAMIFICATION - STREAKS ==========

    actual suspend fun getUserStreak(userId: String): Result<UserStreak?> {
        return try {
            val snapshot = firestore.collection("user_streaks").where { "user_id" equalTo userId }.get()
            Result.success(snapshot.documents.firstOrNull()?.toUserStreakOrNull())
        } catch (e: Exception) { Result.failure(e) }
    }

    actual suspend fun saveUserStreak(streak: UserStreak): Result<Unit> {
        return try {
            val existing = firestore.collection("user_streaks").where { "user_id" equalTo streak.userId }.get()
            val docId = existing.documents.firstOrNull()?.id ?: firestore.collection("user_streaks").document.id
            firestore.collection("user_streaks").document(docId).set(streak)
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    // ========== GAMIFICATION - BADGES ==========

    actual suspend fun getAvailableBadges(): Result<List<BadgeDefinition>> {
        return try {
            Result.success(firestore.collection("badges").get().documents.mapNotNull { it.toBadgeDefinitionOrNull() })
        } catch (e: Exception) { Result.failure(e) }
    }

    actual suspend fun getUserBadges(userId: String): Result<List<UserBadge>> {
        return try {
            Result.success(firestore.collection("user_badges").where { "user_id" equalTo userId }.get().documents.mapNotNull { it.toUserBadgeOrNull() })
        } catch (e: Exception) { Result.failure(e) }
    }

    actual suspend fun getRecentBadges(userId: String, limit: Int): Result<List<UserBadge>> {
        return try {
            Result.success(firestore.collection("user_badges").where { "user_id" equalTo userId }
                .orderBy("unlocked_at", Direction.DESCENDING).limit(limit).get().documents.mapNotNull { it.toUserBadgeOrNull() })
        } catch (e: Exception) { Result.failure(e) }
    }

    actual suspend fun createUserBadge(userBadge: UserBadge): Result<UserBadge> {
        return try {
            val docRef = firestore.collection("user_badges").document
            val badgeWithId = userBadge.copy(id = docRef.id)
            docRef.set(badgeWithId)
            Result.success(badgeWithId)
        } catch (e: Exception) { Result.failure(e) }
    }

    actual suspend fun updateUserBadge(userBadge: UserBadge): Result<Unit> {
        return try {
            firestore.collection("user_badges").document(userBadge.id).set(userBadge)
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    // ========== GAMIFICATION - SEASONS ==========

    actual suspend fun getActiveSeason(): Result<Season?> {
        return try {
            val now = Clock.System.now().toLocalDateTime(TimeZone.currentSystemDefault())
            val year = now.year; val month = now.monthNumber
            val seasonId = "monthly_${year}_${month.toString().padStart(2, '0')}"
            val doc = firestore.collection("seasons").document(seasonId).get()
            val season = if (doc.exists) {
                doc.toSeasonOrNull()
            } else {
                val startMillis = kotlinx.datetime.LocalDateTime(year, month, 1, 0, 0, 0).toInstant(TimeZone.currentSystemDefault()).toEpochMilliseconds()
                val ny = if (month == 12) year + 1 else year; val nm = if (month == 12) 1 else month + 1
                val endMillis = kotlinx.datetime.LocalDateTime(ny, nm, 1, 0, 0, 0).toInstant(TimeZone.currentSystemDefault()).toEpochMilliseconds() - 1
                val portugueseMonths = listOf("Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
                    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro")
                val seasonName = "${portugueseMonths[month - 1]} $year"
                val newSeason = Season(id = seasonId, name = seasonName, startDate = startMillis, endDate = endMillis, isActive = true)
                firestore.collection("seasons").document(seasonId).set(mapOf(
                    "id" to newSeason.id, "name" to newSeason.name,
                    "start_date" to Timestamp(startMillis / 1000, 0),
                    "end_date" to Timestamp(endMillis / 1000, 0),
                    "is_active" to true, "created_at" to FieldValue.serverTimestamp
                ))
                newSeason
            }
            Result.success(season)
        } catch (e: Exception) { Result.failure(e) }
    }

    actual suspend fun getAllSeasons(): Result<List<Season>> {
        return try {
            val seasons = firestore.collection("seasons").get().documents.mapNotNull { it.toSeasonOrNull() }
                .sortedWith(compareByDescending<Season> { it.endDate }.thenByDescending { it.startDate }.thenByDescending { it.id })
            Result.success(seasons)
        } catch (e: Exception) { Result.failure(e) }
    }

    actual suspend fun getSeasonRanking(seasonId: String, limit: Int): Result<List<SeasonParticipation>> {
        return try {
            Result.success(firestore.collection("season_participation").where { "season_id" equalTo seasonId }
                .orderBy("points", Direction.DESCENDING).limit(limit).get().documents.mapNotNull { it.toSeasonParticipationOrNull() })
        } catch (e: Exception) { Result.failure(e) }
    }

    actual fun observeSeasonRanking(seasonId: String, limit: Int): Flow<List<SeasonParticipation>> {
        return firestore.collection("season_participation").where { "season_id" equalTo seasonId }
            .orderBy("points", Direction.DESCENDING).limit(limit).snapshots()
            .map { it.documents.mapNotNull { d -> d.toSeasonParticipationOrNull() } }
            .catch { emit(emptyList()) }
    }

    actual suspend fun getSeasonParticipation(seasonId: String, userId: String): Result<SeasonParticipation?> {
        return try {
            val snapshot = firestore.collection("season_participation")
                .where { "season_id" equalTo seasonId }.where { "user_id" equalTo userId }.get()
            Result.success(snapshot.documents.firstOrNull()?.toSeasonParticipationOrNull())
        } catch (e: Exception) { Result.failure(e) }
    }

    actual suspend fun saveSeasonParticipation(participation: SeasonParticipation): Result<Unit> {
        return try {
            val existing = firestore.collection("season_participation")
                .where { "season_id" equalTo participation.seasonId }.where { "user_id" equalTo participation.userId }.get()
            val docId = existing.documents.firstOrNull()?.id ?: firestore.collection("season_participation").document.id
            firestore.collection("season_participation").document(docId).set(participation)
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    // ========== GAMIFICATION - CHALLENGES ==========

    actual suspend fun getActiveChallenges(): Result<List<WeeklyChallenge>> {
        return try {
            val nowMillis = Clock.System.now().toEpochMilliseconds()
            val nowTs = Timestamp(nowMillis / 1000, 0)
            val snapshot = firestore.collection("challenges")
                .where { "start_date" lessThanOrEqualTo nowTs }
                .orderBy("start_date", Direction.DESCENDING).limit(20).get()
            val nowDateStr = Clock.System.now().toLocalDateTime(TimeZone.currentSystemDefault()).let {
                "${it.year}-${it.monthNumber.toString().padStart(2,'0')}-${it.dayOfMonth.toString().padStart(2,'0')}"
            }
            val challenges = snapshot.documents.mapNotNull { it.toWeeklyChallengeOrNull() }.filter { challenge ->
                if (challenge.endDate.isEmpty()) true
                else try { challenge.endDate >= nowDateStr } catch (e: Exception) { true }
            }
            Result.success(challenges)
        } catch (e: Exception) { Result.failure(e) }
    }

    actual suspend fun getChallengesProgress(userId: String, challengeIds: List<String>): Result<List<UserChallengeProgress>> {
        return try {
            if (challengeIds.isEmpty()) return Result.success(emptyList())
            val allProgress = mutableListOf<UserChallengeProgress>()
            challengeIds.chunked(10).forEach { chunk ->
                allProgress.addAll(firestore.collection("challenge_progress")
                    .where { "user_id" equalTo userId }.where { "challenge_id" inArray chunk }.get()
                    .documents.mapNotNull { it.toUserChallengeProgressOrNull() })
            }
            Result.success(allProgress)
        } catch (e: Exception) { Result.failure(e) }
    }

    // ========== LOCATIONS ==========

    actual suspend fun getAllLocations(): Result<List<Location>> {
        return try {
            Result.success(firestore.collection("locations").orderBy("name").limit(100).get().documents.mapNotNull { it.toLocationOrNull() })
        } catch (e: Exception) {
            logLocationQueryError("getAllLocations", e)
            Result.failure(e)
        }
    }

    actual suspend fun getLocationsWithPagination(limit: Int, lastLocationName: String?): Result<List<Location>> {
        return try {
            var query = firestore.collection("locations").orderBy("name").limit(limit)
            if (lastLocationName != null) query = query.startAfter(lastLocationName)
            Result.success(query.get().documents.mapNotNull { it.toLocationOrNull() })
        } catch (e: Exception) {
            logLocationQueryError("getLocationsWithPagination", e, mapOf("limit" to limit.toString()))
            Result.failure(e)
        }
    }

    actual suspend fun getLocationsPaginated(pageSize: Int, cursor: String?, sortBy: LocationSortField): Result<PaginatedResult<Location>> {
        return try {
            val effectivePageSize = pageSize.coerceIn(1, 50)
            var query = firestore.collection("locations").orderBy(sortBy.firestoreField, Direction.ASCENDING).limit(effectivePageSize + 1)
            if (!cursor.isNullOrBlank()) {
                val cursorData = decodeCursor(cursor) ?: return Result.failure(CursorDecodingException("Cursor inválido ou expirado"))
                if (cursorData.sortField != sortBy) return Result.failure(CursorMismatchException("Campo de ordenação do cursor não corresponde ao solicitado"))
                val anchorDoc = firestore.collection("locations").document(cursorData.documentId).get()
                if (!anchorDoc.exists) return Result.failure(CursorDocumentNotFoundException("Documento do cursor não existe mais: ${cursorData.documentId}"))
                query = query.startAfter(anchorDoc)
            }
            val allDocs = query.get().documents
            val hasMore = allDocs.size > effectivePageSize
            val docsToReturn = if (hasMore) allDocs.take(effectivePageSize) else allDocs
            val locations = docsToReturn.mapNotNull { it.toLocationOrNull() }
            val nextCursor = if (hasMore && docsToReturn.isNotEmpty()) {
                val lastDoc = docsToReturn.last()
                val lastValue = when (sortBy) {
                    LocationSortField.NAME -> lastDoc.get<String?>("name")
                    LocationSortField.CITY -> lastDoc.get<String?>("city")
                    LocationSortField.RATING -> lastDoc.get<Double?>("rating")?.toString()
                    LocationSortField.CREATED_AT -> lastDoc.get<Long?>("createdAt")?.toString()
                }
                encodeCursor(lastDoc.reference.path, sortBy, lastValue)
            } else null
            Result.success(PaginatedResult(items = locations, cursor = nextCursor, hasMore = hasMore))
        } catch (e: CursorDecodingException) { Result.failure(e)
        } catch (e: CursorMismatchException) { Result.failure(e)
        } catch (e: CursorDocumentNotFoundException) { Result.failure(e)
        } catch (e: Exception) {
            logLocationQueryError("getLocationsPaginated", e, mapOf("pageSize" to pageSize.toString(), "sortBy" to sortBy.name))
            Result.failure(e)
        }
    }

    @OptIn(ExperimentalEncodingApi::class)
    private fun encodeCursor(documentPath: String, sortField: LocationSortField, lastValue: Any?): String {
        val cursorStr = "$documentPath|${sortField.name}|${lastValue?.toString() ?: ""}|${Clock.System.now().toEpochMilliseconds()}"
        return Base64.encode(cursorStr.toByteArray(Charsets.UTF_8))
    }

    @OptIn(ExperimentalEncodingApi::class)
    private fun decodeCursor(cursor: String): CursorInfo? {
        return try {
            val decoded = String(Base64.decode(cursor), Charsets.UTF_8)
            val parts = decoded.split("|")
            if (parts.size < 4) return null
            val timestamp = parts[3].toLongOrNull() ?: 0L
            if (timestamp > 0 && Clock.System.now().toEpochMilliseconds() - timestamp > 15 * 60 * 1000) {
                println("FirebaseDataSource: Cursor expirado")
                return null
            }
            CursorInfo(documentPath = parts[0], sortField = LocationSortField.fromString(parts[1]),
                lastValue = parts[2].takeIf { it.isNotEmpty() }, timestamp = timestamp)
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao decodificar cursor: ${e.message}")
            null
        }
    }

    actual suspend fun deleteLocation(locationId: String): Result<Unit> {
        return try {
            firestore.collection("locations").document(locationId).delete()
            Result.success(Unit)
        } catch (e: Exception) { logLocationUpdateError(locationId, "delete", e); Result.failure(e) }
    }

    actual suspend fun deleteLocationWithFields(locationId: String): Result<Int> {
        return try {
            val locationDoc = firestore.collection("locations").document(locationId).get()
            if (!locationDoc.exists) return Result.failure(Exception("Local não encontrado: $locationId"))
            val fieldsSnapshot = firestore.collection("fields").where { "location_id" equalTo locationId }.get()
            val fieldIds = fieldsSnapshot.documents.map { it.id }
            val totalDocsToDelete = 1 + fieldIds.size
            if (fieldIds.size <= 499) {
                val batch = firestore.batch()
                batch.delete(firestore.collection("locations").document(locationId))
                fieldIds.forEach { batch.delete(firestore.collection("fields").document(it)) }
                batch.commit()
            } else {
                fieldIds.chunked(499).forEachIndexed { index, chunk ->
                    val batch = firestore.batch()
                    if (index == 0) batch.delete(firestore.collection("locations").document(locationId))
                    chunk.forEach { batch.delete(firestore.collection("fields").document(it)) }
                    batch.commit()
                }
            }
            Result.success(totalDocsToDelete)
        } catch (e: Exception) { logLocationUpdateError(locationId, "deleteWithFields", e); Result.failure(e) }
    }

    actual suspend fun getLocationsByOwner(ownerId: String): Result<List<Location>> {
        return try {
            Result.success(firestore.collection("locations").where { "owner_id" equalTo ownerId }.orderBy("name").get().documents.mapNotNull { it.toLocationOrNull() })
        } catch (e: Exception) { logLocationQueryError("getLocationsByOwner", e, mapOf("owner_id" to ownerId)); Result.failure(e) }
    }

    actual suspend fun getLocationById(locationId: String): Result<Location> {
        return try {
            val doc = firestore.collection("locations").document(locationId).get()
            Result.success(doc.toLocationOrNull() ?: return Result.failure(Exception("Local não encontrado")))
        } catch (e: Exception) { logLocationQueryError("getLocationById", e, mapOf("location_id" to locationId)); Result.failure(e) }
    }

    actual suspend fun getLocationWithFields(locationId: String): Result<LocationWithFields> {
        return try {
            coroutineScope {
                val locationDeferred = async { firestore.collection("locations").document(locationId).get().toLocationOrNull() }
                val fieldsDeferred = async {
                    firestore.collection("fields").where { "location_id" equalTo locationId }.where { "is_active" equalTo true }
                        .orderBy("type").orderBy("name").get().documents.mapNotNull { it.toFieldOrNull() }
                }
                val location = locationDeferred.await() ?: return@coroutineScope Result.failure<LocationWithFields>(Exception("Local não encontrado"))
                Result.success(LocationWithFields(location, fieldsDeferred.await()))
            }
        } catch (e: Exception) { logLocationQueryError("getLocationWithFields", e, mapOf("location_id" to locationId)); Result.failure(e) }
    }

    actual suspend fun createLocation(location: Location): Result<Location> {
        return try {
            val uid = auth.currentUser?.uid ?: return Result.failure(Exception("Usuário não autenticado"))
            val docRef = firestore.collection("locations").document
            val locationWithId = location.copy(id = docRef.id, ownerId = uid, createdAt = Clock.System.now().toEpochMilliseconds())
            docRef.set(locationWithId)
            Result.success(locationWithId)
        } catch (e: Exception) { logLocationUpdateError(location.name, "create", e); Result.failure(e) }
    }

    actual suspend fun updateLocation(location: Location): Result<Unit> {
        return try {
            firestore.collection("locations").document(location.id).set(location)
            Result.success(Unit)
        } catch (e: Exception) { logLocationUpdateError(location.id, "update", e); Result.failure(e) }
    }

    actual suspend fun searchLocations(query: String): Result<List<Location>> {
        return try {
            if (query.length < 2) return Result.success(emptyList())
            val snapshot = firestore.collection("locations").orderBy("name")
                .startAt(query).endAt(query + "\uf8ff").limit(20).get()
            val locations = snapshot.documents.mapNotNull { it.toLocationOrNull() }
            val additional = if (locations.size < 20) {
                firestore.collection("locations").orderBy("address")
                    .startAt(query).endAt(query + "\uf8ff").limit(20).get()
                    .documents.mapNotNull { it.toLocationOrNull() }.filter { addr -> locations.none { it.id == addr.id } }
            } else emptyList()
            Result.success((locations + additional).take(20))
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao buscar locais: ${e.message}")
            Result.failure(e)
        }
    }

    actual suspend fun getOrCreateLocationFromPlace(placeId: String, name: String, address: String, city: String, state: String, latitude: Double?, longitude: Double?): Result<Location> {
        return try {
            val existingSnapshot = firestore.collection("locations").where { "place_id" equalTo placeId }.limit(1).get()
            if (!existingSnapshot.documents.isEmpty()) {
                val existing = existingSnapshot.documents.first().toLocationOrNull() ?: return Result.failure(Exception("Erro ao converter local existente"))
                return Result.success(existing)
            }
            createLocation(Location(name = name, address = address, city = city, state = state, latitude = latitude, longitude = longitude, placeId = placeId))
        } catch (e: Exception) { Result.failure(e) }
    }

    actual suspend fun addLocationReview(review: LocationReview): Result<Unit> {
        return try {
            val reviewsRef = firestore.collection("locations").document(review.locationId).collection("reviews")
            reviewsRef.add(review)
            val snapshot = reviewsRef.get()
            val reviews = snapshot.documents.mapNotNull { it.toLocationReviewOrNull() }
            val count = reviews.size
            val avg = if (count > 0) reviews.map { it.rating }.average() else 0.0
            firestore.collection("locations").document(review.locationId).update(mapOf("rating" to avg, "ratingCount" to count))
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    actual suspend fun getLocationReviews(locationId: String): Result<List<LocationReview>> {
        return try {
            val snapshot = try {
                firestore.collection("locations").document(locationId).collection("reviews").orderBy("created_at", Direction.DESCENDING).get()
            } catch (e: Exception) {
                firestore.collection("locations").document(locationId).collection("reviews").get()
            }
            Result.success(snapshot.documents.mapNotNull { it.toLocationReviewOrNull() })
        } catch (e: Exception) { Result.failure(e) }
    }

    actual suspend fun seedGinasioApollo(): Result<Location> {
        return try {
            val existing = firestore.collection("locations").where { "name" equalTo "Ginásio de Esportes Apollo" }.limit(1).get()
            if (!existing.documents.isEmpty()) {
                return Result.success(existing.documents.first().toLocationOrNull() ?: return Result.failure(Exception("Erro ao converter local")))
            }
            val uid = auth.currentUser?.uid ?: return Result.failure(Exception("Usuário não autenticado"))
            val docRef = firestore.collection("locations").document
            val location = Location(id = docRef.id, name = "Ginásio de Esportes Apollo", address = "R. Canal Belém - Marginal Leste, 8027",
                city = "Curitiba", state = "PR", latitude = -25.4747, longitude = -49.2256, ownerId = uid, isVerified = true,
                phone = "(41) 99999-9999", website = "https://ginasioapollo.com.br", instagram = "@ginasioapollo",
                openingTime = "18:00", closingTime = "23:59", minGameDurationMinutes = 60,
                operatingDays = listOf(1, 2, 3, 4, 5, 6, 7), createdAt = Clock.System.now().toEpochMilliseconds())
            docRef.set(location)
            for (i in 1..4) {
                val fieldRef = firestore.collection("fields").document
                fieldRef.set(Field(id = fieldRef.id, locationId = location.id, name = "Quadra Futsal $i", type = "FUTSAL",
                    description = "Quadra de futsal profissional, piso taco", hourlyPrice = 120.0, isActive = true))
            }
            for (i in 1..2) {
                val fieldRef = firestore.collection("fields").document
                fieldRef.set(Field(id = fieldRef.id, locationId = location.id, name = "Campo Society $i", type = "SOCIETY",
                    description = "Campo de society grama sintética", hourlyPrice = 180.0, isActive = true))
            }
            Result.success(location)
        } catch (e: Exception) { Result.failure(e) }
    }

    actual suspend fun migrateLocations(migrationData: List<LocationMigrationData>): Result<Int> {
        return try {
            val validData = migrationData.filter { it.nameKey.isNotBlank() }
            if (validData.isEmpty()) return Result.success(0)
            val uid = auth.currentUser?.uid ?: return Result.failure(Exception("Usuário não autenticado para migração"))
            val allLocationsResult = getAllLocations()
            if (allLocationsResult.isFailure) return Result.failure(allLocationsResult.exceptionOrNull() ?: Exception("Erro ao buscar locais"))
            val allLocations = allLocationsResult.getOrNull() ?: emptyList()
            var processedCount = 0
            for (data in validData) {
                val existingLoc = allLocations.find { it.name.trim().equals(data.nameKey.trim(), ignoreCase = true) }
                val finalPhone = if (!data.whatsapp.isNullOrBlank()) data.whatsapp else data.phone
                val finalInsta = data.instagram?.substringAfter(".com/")?.replace("/", "")?.replace("@", "")
                val addr = "${data.street}, ${data.number}${if (data.complement.isNotBlank()) " - " + data.complement else ""} - ${data.neighborhood}, ${data.city} - ${data.state}"
                if (existingLoc != null) {
                    updateLocation(existingLoc.copy(cep = data.cep, street = data.street, number = data.number,
                        neighborhood = data.neighborhood, city = data.city, state = data.state, country = data.country,
                        complement = data.complement, region = if (data.region.isNotBlank()) data.region else existingLoc.region,
                        address = addr, phone = finalPhone ?: existingLoc.phone, instagram = finalInsta ?: existingLoc.instagram,
                        amenities = if (data.amenities.isNotEmpty()) data.amenities else existingLoc.amenities,
                        description = data.description ?: existingLoc.description, openingTime = data.openingTime ?: existingLoc.openingTime,
                        closingTime = data.closingTime ?: existingLoc.closingTime))
                } else {
                    val docRef = firestore.collection("locations").document
                    val newLoc = Location(id = docRef.id, ownerId = uid, name = data.nameKey, cep = data.cep, street = data.street,
                        number = data.number, neighborhood = data.neighborhood, city = data.city, state = data.state, country = data.country,
                        complement = data.complement, region = data.region, address = addr, phone = finalPhone, instagram = finalInsta,
                        amenities = data.amenities, description = data.description ?: "", openingTime = data.openingTime ?: "08:00",
                        closingTime = data.closingTime ?: "23:00", minGameDurationMinutes = 60, isActive = true, isVerified = true,
                        createdAt = Clock.System.now().toEpochMilliseconds())
                    docRef.set(newLoc)
                    val mainType = if (data.modalities.any { it.contains("Futsal", true) }) "FUTSAL" else "SOCIETY"
                    val count = if (data.numFieldsEstimation > 0) data.numFieldsEstimation else 1
                    for (i in 1..count) {
                        val fieldRef = firestore.collection("fields").document
                        fieldRef.set(Field(id = fieldRef.id, locationId = newLoc.id,
                            name = if (count > 1) "Quadra $i" else "Quadra Principal",
                            type = mainType, hourlyPrice = 100.0, isActive = true, isCovered = true))
                    }
                }
                processedCount++
            }
            Result.success(processedCount)
        } catch (e: Exception) { Result.failure(e) }
    }

    actual suspend fun deduplicateLocations(): Result<Int> {
        return try {
            val allLocationsResult = getAllLocations()
            if (allLocationsResult.isFailure) return Result.failure(allLocationsResult.exceptionOrNull() ?: Exception("Erro ao buscar locais"))
            val allLocations = allLocationsResult.getOrNull() ?: emptyList()
            fun String.normalizeStr(): String = this.lowercase().replace(Regex("[^a-z0-9]"), "")
            var deletedCount = 0
            val grouped = allLocations.groupBy { it.name.normalizeStr() }
            for ((_, duplicates) in grouped) {
                if (duplicates.size > 1) {
                    val best = duplicates.sortedWith(compareByDescending<Location> { !it.cep.isNullOrBlank() }
                        .thenByDescending { !it.phone.isNullOrBlank() }.thenByDescending { it.id }).first()
                    duplicates.filter { it.id != best.id }.forEach { loc ->
                        try {
                            firestore.collection("locations").document(loc.id).delete()
                            firestore.collection("fields").where { "location_id" equalTo loc.id }.get().documents.forEach { it.reference.delete() }
                            deletedCount++
                        } catch (e: Exception) { println("FirebaseDataSource: Erro ao deletar duplicata ${loc.name}: ${e.message}") }
                    }
                }
            }
            Result.success(deletedCount)
        } catch (e: Exception) { Result.failure(e) }
    }

    // ========== FIELDS ==========

    actual suspend fun getFieldsByLocation(locationId: String): Result<List<Field>> {
        return try {
            if (locationId.isBlank()) return Result.failure(Exception("ID do local inválido"))
            Result.success(firestore.collection("fields").where { "location_id" equalTo locationId }
                .orderBy("type").orderBy("name").get().documents.mapNotNull { it.toFieldOrNull() })
        } catch (e: Exception) { Result.failure(e) }
    }

    actual suspend fun getFieldById(fieldId: String): Result<Field> {
        return try {
            val doc = firestore.collection("fields").document(fieldId).get()
            Result.success(doc.toFieldOrNull() ?: return Result.failure(Exception("Quadra não encontrada")))
        } catch (e: Exception) { Result.failure(e) }
    }

    actual suspend fun createField(field: Field): Result<Field> {
        return try {
            val docRef = firestore.collection("fields").document
            val fieldWithId = field.copy(id = docRef.id)
            docRef.set(fieldWithId)
            Result.success(fieldWithId)
        } catch (e: Exception) { Result.failure(e) }
    }

    actual suspend fun updateField(field: Field): Result<Unit> {
        return try {
            firestore.collection("fields").document(field.id).set(field)
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    actual suspend fun deleteField(fieldId: String): Result<Unit> {
        return try {
            firestore.collection("fields").document(fieldId).update(mapOf("is_active" to false))
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    actual suspend fun uploadFieldPhoto(filePath: String): Result<String> {
        return Result.failure(Exception("Upload de fotos requer Firebase Storage — não implementado ainda"))
    }

    // ========== LOCATION AUDIT LOGS ==========

    actual suspend fun logLocationAudit(log: LocationAuditLog): Result<Unit> {
        return try {
            val docRef = firestore.collection("locations").document(log.locationId).collection("audit_logs").document
            val logWithId = log.copy(id = docRef.id, timestamp = if (log.timestamp == 0L) Clock.System.now().toEpochMilliseconds() else log.timestamp)
            val data = mutableMapOf<String, Any?>(
                "id" to logWithId.id, "location_id" to logWithId.locationId, "user_id" to logWithId.userId,
                "user_name" to logWithId.userName, "action" to logWithId.action.name, "timestamp" to logWithId.timestamp
            )
            if (logWithId.changes != null) {
                data["changes"] = logWithId.changes.mapValues { (_, fc) -> mapOf("before" to fc.before, "after" to fc.after) }
            }
            docRef.set(data)
            Result.success(Unit)
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao registrar log de auditoria: ${e.message}")
            Result.failure(e)
        }
    }

    actual suspend fun getLocationAuditLogs(locationId: String, limit: Int): Result<List<LocationAuditLog>> {
        return try {
            val snapshot = firestore.collection("locations").document(locationId).collection("audit_logs")
                .orderBy("timestamp", Direction.DESCENDING).limit(limit).get()
            Result.success(snapshot.documents.mapNotNull { it.toLocationAuditLogOrNull() })
        } catch (e: Exception) {
            println("FirebaseDataSource: Erro ao buscar logs de auditoria: ${e.message}")
            Result.failure(e)
        }
    }
}

// ========== PRIVATE HELPERS ==========

private fun instantFromTimestamp(timestamp: Timestamp): Instant {
    return Instant.fromEpochSeconds(timestamp.seconds, timestamp.nanoseconds.toLong())
}

private fun dev.gitlive.firebase.firestore.DocumentSnapshot.safeLong(field: String): Long? {
    val value = get<Any?>(field)
    return when (value) {
        is Number -> value.toLong()
        is Timestamp -> value.seconds * 1000L + value.nanoseconds / 1_000_000
        is String -> value.toLongOrNull()
        else -> null
    }
}

private fun dev.gitlive.firebase.firestore.DocumentSnapshot.safeInt(field: String): Int? = safeLong(field)?.toInt()

private fun dev.gitlive.firebase.firestore.DocumentSnapshot.toUserOrNull(): User? {
    if (!exists) return null
    return User(
        id = id, email = get<String?>("email") ?: "", name = get<String?>("name") ?: "",
        phone = get<String?>("phone"), nickname = get<String?>("nickname"),
        photoUrl = get<String?>("photo_url") ?: get<String?>("photoUrl"),
        fcmToken = get<String?>("fcm_token") ?: get<String?>("fcmToken"),
        isSearchable = get<Boolean?>("is_searchable") ?: get<Boolean?>("isSearchable") ?: true,
        isProfilePublic = get<Boolean?>("is_profile_public") ?: get<Boolean?>("isProfilePublic") ?: true,
        role = get<String?>("role") ?: UserRole.PLAYER.name,
        createdAt = safeLong("created_at") ?: safeLong("createdAt"),
        updatedAt = safeLong("updated_at") ?: safeLong("updatedAt"),
        strikerRating = get<Double?>("striker_rating") ?: get<Double?>("strikerRating") ?: 0.0,
        midRating = get<Double?>("mid_rating") ?: get<Double?>("midRating") ?: 0.0,
        defenderRating = get<Double?>("defender_rating") ?: get<Double?>("defenderRating") ?: 0.0,
        gkRating = get<Double?>("gk_rating") ?: get<Double?>("gkRating") ?: 0.0,
        preferredPosition = get<String?>("preferred_position") ?: get<String?>("preferredPosition"),
        preferredFieldTypes = ((get<List<*>?>("preferred_field_types") ?: get<List<*>?>("preferredFieldTypes")))?.mapNotNull { item ->
            (item as? String)?.let { name -> try { FieldType.valueOf(name) } catch (e: Exception) { null } }
        } ?: emptyList(),
        birthDate = safeLong("birth_date") ?: safeLong("birthDate"),
        gender = get<String?>("gender"), heightCm = safeInt("height_cm") ?: safeInt("heightCm"),
        weightKg = safeInt("weight_kg") ?: safeInt("weightKg"),
        dominantFoot = get<String?>("dominant_foot") ?: get<String?>("dominantFoot"),
        primaryPosition = get<String?>("primary_position") ?: get<String?>("primaryPosition"),
        secondaryPosition = get<String?>("secondary_position") ?: get<String?>("secondaryPosition"),
        playStyle = get<String?>("play_style") ?: get<String?>("playStyle"),
        experienceYears = safeInt("experience_years") ?: safeInt("experienceYears"),
        level = safeInt("level") ?: 1,
        experiencePoints = safeLong("experience_points") ?: safeLong("experiencePoints") ?: 0L,
        milestonesAchieved = ((get<List<*>?>("milestones_achieved") ?: get<List<*>?>("milestonesAchieved")))?.mapNotNull { it as? String } ?: emptyList(),
        autoStrikerRating = get<Double?>("auto_striker_rating") ?: 0.0, autoMidRating = get<Double?>("auto_mid_rating") ?: 0.0,
        autoDefenderRating = get<Double?>("auto_defender_rating") ?: 0.0, autoGkRating = get<Double?>("auto_gk_rating") ?: 0.0,
        autoRatingSamples = safeInt("auto_rating_samples") ?: 0
    )
}

private fun dev.gitlive.firebase.firestore.DocumentSnapshot.toGameOrNull(): Game? {
    if (!exists) return null
    return Game(
        id = id, scheduleId = get<String?>("schedule_id") ?: get<String?>("scheduleId") ?: "",
        date = get<String?>("date") ?: "", time = get<String?>("time") ?: "",
        endTime = get<String?>("end_time") ?: get<String?>("endTime") ?: "",
        status = get<String?>("status") ?: GameStatus.SCHEDULED.name,
        maxPlayers = safeInt("max_players") ?: safeInt("maxPlayers") ?: 14,
        maxGoalkeepers = safeInt("max_goalkeepers") ?: safeInt("maxGoalkeepers") ?: 3,
        playersCount = safeInt("players_count") ?: safeInt("playersCount") ?: 0,
        goalkeepersCount = safeInt("goalkeepers_count") ?: safeInt("goalkeepersCount") ?: 0,
        dailyPrice = get<Double?>("daily_price") ?: get<Double?>("dailyPrice") ?: 0.0,
        totalCost = get<Double?>("total_cost") ?: get<Double?>("totalCost") ?: 0.0,
        pixKey = get<String?>("pix_key") ?: get<String?>("pixKey") ?: "",
        numberOfTeams = safeInt("number_of_teams") ?: safeInt("numberOfTeams") ?: 2,
        ownerId = get<String?>("owner_id") ?: get<String?>("ownerId") ?: "",
        ownerName = get<String?>("owner_name") ?: get<String?>("ownerName") ?: "",
        locationId = get<String?>("location_id") ?: get<String?>("locationId") ?: "",
        fieldId = get<String?>("field_id") ?: get<String?>("fieldId") ?: "",
        locationName = get<String?>("location_name") ?: get<String?>("locationName") ?: "",
        locationAddress = get<String?>("location_address") ?: get<String?>("locationAddress") ?: "",
        locationLat = get<Double?>("location_lat") ?: get<Double?>("locationLat"),
        locationLng = get<Double?>("location_lng") ?: get<Double?>("locationLng"),
        fieldName = get<String?>("field_name") ?: get<String?>("fieldName") ?: "",
        gameType = get<String?>("game_type") ?: get<String?>("gameType") ?: "Society",
        recurrence = get<String?>("recurrence") ?: "none",
        visibility = get<String?>("visibility") ?: GameVisibility.GROUP_ONLY.name,
        createdAt = safeLong("created_at") ?: safeLong("createdAt"),
        xpProcessed = get<Boolean?>("xp_processed") ?: get<Boolean?>("xpProcessed") ?: false,
        mvpId = get<String?>("mvp_id") ?: get<String?>("mvpId"),
        team1Score = safeInt("team1_score") ?: safeInt("team1Score") ?: 0,
        team2Score = safeInt("team2_score") ?: safeInt("team2Score") ?: 0,
        team1Name = get<String?>("team1_name") ?: get<String?>("team1Name") ?: "Time 1",
        team2Name = get<String?>("team2_name") ?: get<String?>("team2Name") ?: "Time 2",
        groupId = get<String?>("group_id") ?: get<String?>("groupId"),
        groupName = get<String?>("group_name") ?: get<String?>("groupName")
    )
}

private fun dev.gitlive.firebase.firestore.DocumentSnapshot.toGameConfirmationOrNull(): GameConfirmation? {
    if (!exists) return null
    return GameConfirmation(
        id = id, gameId = get<String?>("game_id") ?: get<String?>("gameId") ?: "",
        userId = get<String?>("user_id") ?: get<String?>("userId") ?: "",
        userName = get<String?>("user_name") ?: get<String?>("userName") ?: "",
        userPhoto = get<String?>("user_photo") ?: get<String?>("userPhoto"),
        position = get<String?>("position") ?: "FIELD",
        teamId = get<String?>("team_id") ?: get<String?>("teamId"),
        status = get<String?>("status") ?: ConfirmationStatus.CONFIRMED.name,
        paymentStatus = get<String?>("payment_status") ?: get<String?>("paymentStatus") ?: PaymentStatus.PENDING.name,
        isCasualPlayer = get<Boolean?>("is_casual_player") ?: get<Boolean?>("isCasualPlayer") ?: false,
        goals = safeInt("goals") ?: 0, assists = safeInt("assists") ?: 0, saves = safeInt("saves") ?: 0,
        yellowCards = safeInt("yellow_cards") ?: safeInt("yellowCards") ?: 0,
        redCards = safeInt("red_cards") ?: safeInt("redCards") ?: 0,
        nickname = get<String?>("nickname"), xpEarned = safeInt("xp_earned") ?: safeInt("xpEarned") ?: 0,
        isMvp = get<Boolean?>("is_mvp") ?: get<Boolean?>("isMvp") ?: false,
        isBestGk = get<Boolean?>("is_best_gk") ?: get<Boolean?>("isBestGk") ?: false,
        isWorstPlayer = get<Boolean?>("is_worst_player") ?: get<Boolean?>("isWorstPlayer") ?: false,
        confirmedAt = safeLong("confirmed_at") ?: safeLong("confirmedAt")
    )
}

private fun dev.gitlive.firebase.firestore.DocumentSnapshot.toStatisticsOrNull(): Statistics? {
    if (!exists) return null
    return Statistics(
        id = id, userId = get<String?>("user_id") ?: get<String?>("userId") ?: "",
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

private fun dev.gitlive.firebase.firestore.DocumentSnapshot.toUserGroupOrNull(): UserGroup? {
    if (!exists) return null
    return UserGroup(
        id = id, userId = get<String?>("user_id") ?: get<String?>("userId") ?: "",
        groupId = get<String?>("group_id") ?: get<String?>("groupId") ?: "",
        groupName = get<String?>("group_name") ?: get<String?>("groupName") ?: "",
        groupPhoto = get<String?>("group_photo") ?: get<String?>("groupPhoto"),
        role = get<String?>("role") ?: GroupMemberRole.MEMBER.name,
        joinedAt = safeLong("joined_at") ?: safeLong("joinedAt")
    )
}

private fun dev.gitlive.firebase.firestore.DocumentSnapshot.toTeamOrNull(): Team? {
    if (!exists) return null
    return Team(
        id = id, gameId = get<String?>("game_id") ?: get<String?>("gameId") ?: "",
        name = get<String?>("name") ?: "", color = get<String?>("color") ?: "",
        playerIds = (get<List<*>?>("player_ids") ?: get<List<*>?>("playerIds"))?.filterIsInstance<String>() ?: emptyList(),
        score = safeInt("score") ?: 0
    )
}

private fun dev.gitlive.firebase.firestore.DocumentSnapshot.toXpLogOrNull(): XpLog? {
    if (!exists) return null
    return XpLog(
        id = id, userId = get<String?>("user_id") ?: get<String?>("userId") ?: "",
        gameId = get<String?>("game_id") ?: get<String?>("gameId") ?: "",
        xpEarned = safeLong("xp_earned") ?: safeLong("xpEarned") ?: 0L,
        xpBefore = safeLong("xp_before") ?: safeLong("xpBefore") ?: 0L,
        xpAfter = safeLong("xp_after") ?: safeLong("xpAfter") ?: 0L,
        levelBefore = safeInt("level_before") ?: safeInt("levelBefore") ?: 1,
        levelAfter = safeInt("level_after") ?: safeInt("levelAfter") ?: 1,
        xpParticipation = safeInt("xp_participation") ?: 0, xpGoals = safeInt("xp_goals") ?: 0,
        xpAssists = safeInt("xp_assists") ?: 0, xpSaves = safeInt("xp_saves") ?: 0,
        xpResult = safeInt("xp_result") ?: 0, xpMvp = safeInt("xp_mvp") ?: 0,
        xpMilestones = safeInt("xp_milestones") ?: 0, xpStreak = safeInt("xp_streak") ?: 0,
        goals = safeInt("goals") ?: 0, assists = safeInt("assists") ?: 0, saves = safeInt("saves") ?: 0,
        wasMvp = get<Boolean?>("was_mvp") ?: get<Boolean?>("wasMvp") ?: false,
        gameResult = get<String?>("game_result") ?: get<String?>("gameResult") ?: "",
        milestonesUnlocked = (get<List<*>?>("milestones_unlocked") ?: get<List<*>?>("milestonesUnlocked"))?.filterIsInstance<String>() ?: emptyList(),
        createdAt = safeLong("created_at") ?: safeLong("createdAt")
    )
}

private fun dev.gitlive.firebase.firestore.DocumentSnapshot.toGameEventOrNull(): GameEvent? {
    if (!exists) return null
    return GameEvent(
        id = id, gameId = get<String?>("game_id") ?: get<String?>("gameId") ?: "",
        eventType = get<String?>("event_type") ?: get<String?>("eventType") ?: GameEventType.GOAL.name,
        playerId = get<String?>("player_id") ?: get<String?>("playerId") ?: "",
        playerName = get<String?>("player_name") ?: get<String?>("playerName") ?: "",
        teamId = get<String?>("team_id") ?: get<String?>("teamId") ?: "",
        assistedById = get<String?>("assisted_by_id") ?: get<String?>("assistedById"),
        assistedByName = get<String?>("assisted_by_name") ?: get<String?>("assistedByName"),
        minute = safeInt("minute") ?: 0, createdBy = get<String?>("created_by") ?: get<String?>("createdBy") ?: "",
        createdAt = safeLong("created_at") ?: safeLong("createdAt")
    )
}

private fun dev.gitlive.firebase.firestore.DocumentSnapshot.toLiveScoreOrNull(): LiveScore? {
    if (!exists) return null
    return LiveScore(
        id = id, gameId = get<String?>("game_id") ?: get<String?>("gameId") ?: "",
        team1Id = get<String?>("team1_id") ?: get<String?>("team1Id") ?: "",
        team1Score = safeInt("team1_score") ?: safeInt("team1Score") ?: 0,
        team2Id = get<String?>("team2_id") ?: get<String?>("team2Id") ?: "",
        team2Score = safeInt("team2_score") ?: safeInt("team2Score") ?: 0,
        startedAt = safeLong("started_at") ?: safeLong("startedAt"),
        finishedAt = safeLong("finished_at") ?: safeLong("finishedAt")
    )
}

private fun dev.gitlive.firebase.firestore.DocumentSnapshot.toGroupOrNull(): Group? {
    if (!exists) return null
    return Group(
        id = id, name = get<String?>("name") ?: "", description = get<String?>("description") ?: "",
        photoUrl = get<String?>("photo_url") ?: get<String?>("photoUrl"),
        ownerId = get<String?>("owner_id") ?: get<String?>("ownerId") ?: "",
        ownerName = get<String?>("owner_name") ?: get<String?>("ownerName") ?: "",
        membersCount = safeInt("members_count") ?: safeInt("membersCount") ?: 0,
        gamesCount = safeInt("games_count") ?: safeInt("gamesCount") ?: 0,
        isPublic = get<Boolean?>("is_public") ?: get<Boolean?>("isPublic") ?: false,
        inviteCode = get<String?>("invite_code") ?: get<String?>("inviteCode"),
        pixKey = get<String?>("pix_key") ?: get<String?>("pixKey"),
        defaultLocationId = get<String?>("default_location_id") ?: get<String?>("defaultLocationId"),
        defaultLocationName = get<String?>("default_location_name") ?: get<String?>("defaultLocationName"),
        defaultDayOfWeek = safeInt("default_day_of_week") ?: safeInt("defaultDayOfWeek"),
        defaultTime = get<String?>("default_time") ?: get<String?>("defaultTime"),
        defaultMaxPlayers = safeInt("default_max_players") ?: safeInt("defaultMaxPlayers") ?: 14,
        defaultPrice = get<Double?>("default_price") ?: get<Double?>("defaultPrice") ?: 0.0,
        createdAt = safeLong("created_at") ?: safeLong("createdAt"),
        updatedAt = safeLong("updated_at") ?: safeLong("updatedAt")
    )
}

private fun dev.gitlive.firebase.firestore.DocumentSnapshot.toGroupMemberOrNull(): GroupMember? {
    if (!exists) return null
    val userId = get<String?>("user_id") ?: get<String?>("userId") ?: id
    val groupIdFromPath = reference.parent.parent?.id ?: ""
    return GroupMember(
        id = id, groupId = get<String?>("group_id") ?: get<String?>("groupId") ?: groupIdFromPath,
        userId = userId, userName = get<String?>("user_name") ?: get<String?>("userName") ?: "",
        userPhoto = get<String?>("user_photo") ?: get<String?>("userPhoto"),
        role = get<String?>("role") ?: GroupMemberRole.MEMBER.name,
        nickname = get<String?>("nickname"),
        joinedAt = safeLong("joined_at") ?: safeLong("joinedAt"),
        gamesPlayed = safeInt("games_played") ?: safeInt("gamesPlayed") ?: 0,
        goals = safeInt("goals") ?: 0, assists = safeInt("assists") ?: 0
    )
}

private fun dev.gitlive.firebase.firestore.DocumentSnapshot.toPaymentOrNull(): Payment? {
    if (!exists) return null
    val typeStr = get<String?>("type") ?: PaymentType.DAILY.name
    val statusStr = get<String?>("status") ?: PaymentStatus.PENDING.name
    val methodStr = get<String?>("payment_method")
    return Payment(
        id = id, userId = get<String?>("user_id") ?: "", gameId = get<String?>("game_id"),
        scheduleId = get<String?>("schedule_id"),
        type = try { PaymentType.valueOf(typeStr) } catch (e: Exception) { PaymentType.DAILY },
        amount = get<Double?>("amount") ?: 0.0,
        status = try { PaymentStatus.valueOf(statusStr) } catch (e: Exception) { PaymentStatus.PENDING },
        paymentMethod = methodStr?.let { try { PaymentMethod.valueOf(it) } catch (e: Exception) { null } },
        dueDate = get<String?>("due_date") ?: "", paidAt = safeLong("paid_at"),
        pixKey = get<String?>("pix_key"), pixQrcode = get<String?>("pix_qrcode"),
        pixTxid = get<String?>("pix_txid"), receiptUrl = get<String?>("receipt_url"),
        notes = get<String?>("notes"), createdAt = safeLong("created_at")
    )
}

private fun dev.gitlive.firebase.firestore.DocumentSnapshot.toRankingStatisticsOrNull(): Statistics? {
    if (!exists) return null
    return Statistics(
        id = id, userId = get<String?>("user_id") ?: get<String?>("userId") ?: "",
        totalGames = get<Long?>("totalGames")?.toInt() ?: get<Long?>("total_games")?.toInt() ?: 0,
        totalGoals = get<Long?>("totalGoals")?.toInt() ?: get<Long?>("total_goals")?.toInt() ?: 0,
        totalAssists = get<Long?>("totalAssists")?.toInt() ?: get<Long?>("total_assists")?.toInt() ?: 0,
        totalSaves = get<Long?>("totalSaves")?.toInt() ?: get<Long?>("total_saves")?.toInt() ?: 0,
        totalWins = get<Long?>("totalWins")?.toInt() ?: get<Long?>("total_wins")?.toInt() ?: 0,
        totalDraws = get<Long?>("totalDraws")?.toInt() ?: get<Long?>("total_draws")?.toInt() ?: 0,
        totalLosses = get<Long?>("totalLosses")?.toInt() ?: get<Long?>("total_losses")?.toInt() ?: 0,
        mvpCount = get<Long?>("mvpCount")?.toInt() ?: get<Long?>("mvp_count")?.toInt() ?: 0,
        bestGkCount = get<Long?>("bestGkCount")?.toInt() ?: get<Long?>("best_gk_count")?.toInt() ?: 0,
        worstPlayerCount = get<Long?>("worstPlayerCount")?.toInt() ?: get<Long?>("worst_player_count")?.toInt() ?: 0,
        currentStreak = get<Long?>("currentStreak")?.toInt() ?: get<Long?>("current_streak")?.toInt() ?: 0,
        bestStreak = get<Long?>("bestStreak")?.toInt() ?: get<Long?>("best_streak")?.toInt() ?: 0,
        yellowCards = get<Long?>("yellowCards")?.toInt() ?: get<Long?>("yellow_cards")?.toInt() ?: 0,
        redCards = get<Long?>("redCards")?.toInt() ?: get<Long?>("red_cards")?.toInt() ?: 0,
        lastGameDate = safeLong("last_game_date") ?: safeLong("lastGameDate"),
        updatedAt = safeLong("updated_at") ?: safeLong("updatedAt")
    )
}

private fun dev.gitlive.firebase.firestore.DocumentSnapshot.toUserStreakOrNull(): UserStreak? {
    if (!exists) return null
    return UserStreak(
        id = id, userId = get<String?>("user_id") ?: "", scheduleId = get<String?>("schedule_id"),
        currentStreak = get<Long?>("current_streak")?.toInt() ?: 0,
        longestStreak = get<Long?>("longest_streak")?.toInt() ?: 0,
        lastGameDate = get<String?>("last_game_date"), streakStartedAt = get<String?>("streak_started_at")
    )
}

private fun dev.gitlive.firebase.firestore.DocumentSnapshot.toBadgeDefinitionOrNull(): BadgeDefinition? {
    if (!exists) return null
    val categoryStr = get<String?>("category") ?: "PERFORMANCE"
    val rarityStr = get<String?>("rarity") ?: "COMMON"
    return BadgeDefinition(
        id = id, name = get<String?>("name") ?: "", description = get<String?>("description") ?: "",
        emoji = get<String?>("emoji") ?: "",
        category = try { BadgeCategory.valueOf(categoryStr) } catch (e: Exception) { BadgeCategory.PERFORMANCE },
        rarity = try { BadgeRarity.valueOf(rarityStr) } catch (e: Exception) { BadgeRarity.COMMON },
        requiredValue = get<Long?>("required_value")?.toInt() ?: 1,
        isHidden = get<Boolean?>("is_hidden") ?: false
    )
}

private fun dev.gitlive.firebase.firestore.DocumentSnapshot.toUserBadgeOrNull(): UserBadge? {
    if (!exists) return null
    return UserBadge(
        id = id, userId = get<String?>("user_id") ?: "", badgeId = get<String?>("badge_id") ?: "",
        unlockedAt = safeLong("unlocked_at") ?: 0,
        unlockCount = get<Long?>("unlock_count")?.toInt() ?: get<Long?>("count")?.toInt() ?: 1
    )
}

private fun dev.gitlive.firebase.firestore.DocumentSnapshot.toSeasonOrNull(): Season? {
    if (!exists) return null
    return Season(
        id = id, name = get<String?>("name") ?: "", description = get<String?>("description") ?: "",
        startDate = safeLong("start_date") ?: 0, endDate = safeLong("end_date") ?: 0,
        isActive = get<Boolean?>("is_active") ?: get<Boolean?>("isActive") ?: false,
        createdAt = safeLong("created_at"), closedAt = safeLong("closed_at"),
        totalParticipants = get<Long?>("total_participants")?.toInt() ?: 0,
        totalGames = get<Long?>("total_games")?.toInt() ?: 0
    )
}

private fun dev.gitlive.firebase.firestore.DocumentSnapshot.toSeasonParticipationOrNull(): SeasonParticipation? {
    if (!exists) return null
    return SeasonParticipation(
        id = id, seasonId = get<String?>("season_id") ?: "", userId = get<String?>("user_id") ?: "",
        division = get<String?>("division") ?: LeagueDivision.BRONZE.name,
        leagueRating = get<Long?>("league_rating")?.toInt() ?: 1000,
        points = get<Long?>("points")?.toInt() ?: 0,
        gamesPlayed = get<Long?>("games_played")?.toInt() ?: 0,
        wins = get<Long?>("wins")?.toInt() ?: 0, draws = get<Long?>("draws")?.toInt() ?: 0,
        losses = get<Long?>("losses")?.toInt() ?: 0,
        goals = get<Long?>("goals")?.toInt() ?: get<Long?>("goals_scored")?.toInt() ?: 0,
        assists = get<Long?>("assists")?.toInt() ?: 0, saves = get<Long?>("saves")?.toInt() ?: 0,
        mvpCount = get<Long?>("mvp_count")?.toInt() ?: 0,
        bestGkCount = get<Long?>("best_gk_count")?.toInt() ?: 0,
        worstPlayerCount = get<Long?>("worst_player_count")?.toInt() ?: 0,
        currentStreak = get<Long?>("current_streak")?.toInt() ?: 0,
        bestStreak = get<Long?>("best_streak")?.toInt() ?: 0,
        xpEarned = get<Long?>("xp_earned") ?: 0L,
        createdAt = safeLong("created_at"), updatedAt = safeLong("updated_at")
    )
}

private fun dev.gitlive.firebase.firestore.DocumentSnapshot.toWeeklyChallengeOrNull(): WeeklyChallenge? {
    if (!exists) return null
    val typeStr = get<String?>("type") ?: "score_goals"
    return WeeklyChallenge(
        id = id, name = get<String?>("name") ?: "", description = get<String?>("description") ?: "",
        type = try { ChallengeType.valueOf(typeStr) } catch (e: Exception) { ChallengeType.SCORE_GOALS },
        targetValue = get<Long?>("target_value")?.toInt() ?: 0,
        xpReward = get<Long?>("xp_reward") ?: 100L,
        startDate = get<String?>("start_date") ?: "", endDate = get<String?>("end_date") ?: "",
        isActive = get<Boolean?>("is_active") ?: true, scheduleId = get<String?>("schedule_id")
    )
}

private fun dev.gitlive.firebase.firestore.DocumentSnapshot.toUserChallengeProgressOrNull(): UserChallengeProgress? {
    if (!exists) return null
    return UserChallengeProgress(
        id = id, userId = get<String?>("user_id") ?: "", challengeId = get<String?>("challenge_id") ?: "",
        currentProgress = get<Long?>("current_progress")?.toInt() ?: 0,
        isCompleted = get<Boolean?>("is_completed") ?: false, completedAt = safeLong("completed_at")
    )
}

private fun dev.gitlive.firebase.firestore.DocumentSnapshot.toAppNotificationOrNull(): AppNotification? {
    if (!exists) return null
    val typeStr = get<String?>("type") ?: NotificationType.GENERAL.name
    val actionTypeStr = get<String?>("action_type")
    return AppNotification(
        id = id, userId = get<String?>("user_id") ?: "",
        type = NotificationType.fromString(typeStr), title = get<String?>("title") ?: "",
        message = get<String?>("message") ?: "", senderId = get<String?>("sender_id"),
        senderName = get<String?>("sender_name"), senderPhoto = get<String?>("sender_photo"),
        referenceId = get<String?>("reference_id"), referenceType = get<String?>("reference_type"),
        actionType = NotificationAction.fromString(actionTypeStr),
        read = get<Boolean?>("read") ?: false, readAt = safeLong("read_at"),
        createdAt = safeLong("created_at"), expiresAt = safeLong("expires_at")
    )
}

private fun dev.gitlive.firebase.firestore.DocumentSnapshot.toActivityOrNull(): Activity? {
    if (!exists) return null
    return Activity(
        id = id, userId = get<String?>("user_id") ?: "", userName = get<String?>("user_name") ?: "",
        userPhoto = get<String?>("user_photo"), type = ActivityType.fromString(get<String?>("type")),
        title = get<String?>("title") ?: "", description = get<String?>("description") ?: "",
        referenceId = get<String?>("reference_id"), referenceType = get<String?>("reference_type"),
        metadata = (get<Map<*, *>?>("metadata") as? Map<String, String>) ?: emptyMap(),
        createdAt = safeLong("created_at"), visibility = ActivityVisibility.fromString(get<String?>("visibility"))
    )
}

private fun activityToMap(activity: Activity): Map<String, Any?> {
    return mapOf(
        "user_id" to activity.userId, "user_name" to activity.userName, "user_photo" to activity.userPhoto,
        "type" to activity.type, "title" to activity.title, "description" to activity.description,
        "reference_id" to activity.referenceId, "reference_type" to activity.referenceType,
        "metadata" to activity.metadata, "created_at" to FieldValue.serverTimestamp,
        "visibility" to activity.visibility
    )
}

// ========== CURSOR PAGINATION CLASSES ==========

private data class CursorInfo(
    val documentPath: String, val sortField: LocationSortField,
    val lastValue: String?, val timestamp: Long
) {
    val documentId: String get() = documentPath.substringAfterLast("/")
}

class CursorDecodingException(message: String) : Exception(message)
class CursorMismatchException(message: String) : Exception(message)
class CursorDocumentNotFoundException(message: String) : Exception(message)
