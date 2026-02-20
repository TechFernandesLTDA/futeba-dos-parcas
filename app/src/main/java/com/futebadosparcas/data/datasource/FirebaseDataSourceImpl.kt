package com.futebadosparcas.data.datasource

import com.futebadosparcas.domain.model.*
import com.futebadosparcas.data.util.BatchOperationHelper
import com.futebadosparcas.domain.util.RetryPolicy
import com.futebadosparcas.domain.util.suspendWithRetryResult
import com.futebadosparcas.util.AppLogger
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await
import java.util.*
import com.google.firebase.firestore.FieldPath as FirestoreFieldPath

/**
 * Implementação concreta do FirebaseDataSource.
 *
 * Características:
 * - Retry automático com exponential backoff
 * - Logging estruturado de operações
 * - Conversão de exceções Firebase para Result
 * - Flows reativos com callback
 */
class FirebaseDataSourceImpl constructor(
    private val firestore: FirebaseFirestore,
    private val auth: FirebaseAuth
) : FirebaseDataSource {

    companion object {
        private const val TAG = "FirebaseDataSource"
        private const val COLLECTION_GAMES = "games"
        private const val COLLECTION_CONFIRMATIONS = "confirmations"
        private const val COLLECTION_TEAMS = "teams"
        private const val COLLECTION_STATISTICS = "statistics"
        private const val COLLECTION_USERS = "users"
        private const val COLLECTION_GROUPS = "groups"
        private const val COLLECTION_USER_GROUPS = "user_groups"
        private const val COLLECTION_XP_LOGS = "xp_logs"
        private const val COLLECTION_RANKING_DELTAS = "ranking_deltas"

        // Limites de seguranca para buscas
        private const val MAX_SEARCH_QUERY_LENGTH = 100
        private const val MAX_SEARCH_RESULTS = 50
    }

    // ========== GAMES ==========

    override suspend fun getUpcomingGames(limit: Int): Result<List<Game>> {
        return suspendWithRetryResult(RetryPolicy.DEFAULT) {
            AppLogger.d(TAG) { "Buscando $limit jogos futuros" }

            val now = Date()
            val snapshot = firestore.collection(COLLECTION_GAMES)
                .whereGreaterThanOrEqualTo("dateTime", now)
                .orderBy("dateTime", Query.Direction.ASCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            val games = snapshot.toObjects(Game::class.java)
            AppLogger.d(TAG) { "Encontrados ${games.size} jogos futuros" }
            games
        }
    }

    override fun getUpcomingGamesFlow(limit: Int): Flow<Result<List<Game>>> = callbackFlow {
        AppLogger.d(TAG) { "Iniciando flow de jogos futuros (limit=$limit)" }

        val now = Date()
        val listener = firestore.collection(COLLECTION_GAMES)
            .whereGreaterThanOrEqualTo("dateTime", now)
            .orderBy("dateTime", Query.Direction.ASCENDING)
            .limit(limit.toLong())
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    AppLogger.e(TAG, "Erro no flow de jogos", error)
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }

                if (snapshot != null) {
                    val games = snapshot.toObjects(Game::class.java)
                    AppLogger.d(TAG) { "Flow: ${games.size} jogos futuros" }
                    trySend(Result.success(games))
                }
            }

        awaitClose { listener.remove() }
    }

    override suspend fun getGameById(gameId: String): Result<Game> {
        return suspendWithRetryResult(RetryPolicy.DEFAULT) {
            AppLogger.d(TAG) { "Buscando jogo: $gameId" }

            val doc = firestore.collection(COLLECTION_GAMES)
                .document(gameId)
                .get()
                .await()

            if (!doc.exists()) {
                throw NoSuchElementException("Jogo não encontrado: $gameId")
            }

            doc.toObject(Game::class.java)
                ?: throw IllegalStateException("Erro ao converter jogo: $gameId")
        }
    }

    override fun getGameByIdFlow(gameId: String): Flow<Result<Game>> = callbackFlow {
        AppLogger.d(TAG) { "Iniciando flow do jogo: $gameId" }

        val listener = firestore.collection(COLLECTION_GAMES)
            .document(gameId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    AppLogger.e(TAG, "Erro no flow do jogo", error)
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }

                if (snapshot != null && snapshot.exists()) {
                    val game = snapshot.toObject(Game::class.java)
                    if (game != null) {
                        trySend(Result.success(game))
                    } else {
                        trySend(Result.failure(IllegalStateException("Erro ao converter jogo")))
                    }
                }
            }

        awaitClose { listener.remove() }
    }

    override suspend fun getConfirmedGamesForUser(userId: String): Result<List<Game>> {
        return suspendWithRetryResult(RetryPolicy.DEFAULT) {
            AppLogger.d(TAG) { "Buscando jogos confirmados do usuário: $userId" }

            // 1. Buscar confirmações do usuário
            val confirmations = firestore.collection(COLLECTION_CONFIRMATIONS)
                .whereEqualTo("user_id", userId)
                .whereEqualTo("status", ConfirmationStatus.CONFIRMED.name)
                .get()
                .await()
                .toObjects(GameConfirmation::class.java)

            // 2. Buscar jogos confirmados
            val gameIds = confirmations.map { it.gameId }.distinct()
            if (gameIds.isEmpty()) {
                return@suspendWithRetryResult emptyList()
            }

            // 3. Buscar jogos em paralelo (chunks de 10, limite do whereIn)
            val games = BatchOperationHelper.parallelWhereIn(
                collection = firestore.collection(COLLECTION_GAMES),
                ids = gameIds,
                mapper = { doc -> doc.toObject(Game::class.java) }
            )

            AppLogger.d(TAG) { "Encontrados ${games.size} jogos confirmados" }
            games.sortedBy { it.createdAt }
        }
    }

    override suspend fun getGamesByGroup(groupId: String, limit: Int): Result<List<Game>> {
        return suspendWithRetryResult(RetryPolicy.DEFAULT) {
            AppLogger.d(TAG) { "Buscando jogos do grupo: $groupId" }

            val snapshot = firestore.collection(COLLECTION_GAMES)
                .whereEqualTo("group_id", groupId)
                .orderBy("dateTime", Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            snapshot.toObjects(Game::class.java)
        }
    }

    override suspend fun getPublicGames(limit: Int): Result<List<Game>> {
        return suspendWithRetryResult(RetryPolicy.DEFAULT) {
            AppLogger.d(TAG) { "Buscando jogos públicos (limit=$limit)" }

            val now = Date()
            val snapshot = firestore.collection(COLLECTION_GAMES)
                .whereGreaterThanOrEqualTo("dateTime", now)
                .whereIn("visibility", listOf(
                    GameVisibility.PUBLIC_OPEN.name,
                    GameVisibility.PUBLIC_CLOSED.name
                ))
                .orderBy("dateTime", Query.Direction.ASCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            snapshot.toObjects(Game::class.java)
        }
    }

    override suspend fun createGame(game: Game): Result<Game> {
        return suspendWithRetryResult(RetryPolicy.DEFAULT) {
            AppLogger.d(TAG) { "Criando novo jogo" }

            val docRef = firestore.collection(COLLECTION_GAMES).document()
            val gameWithId = game.copy(id = docRef.id)

            docRef.set(gameWithId).await()
            AppLogger.d(TAG) { "Jogo criado: ${docRef.id}" }

            gameWithId
        }
    }

    override suspend fun updateGame(gameId: String, updates: Map<String, Any>): Result<Unit> {
        return suspendWithRetryResult(RetryPolicy.DEFAULT) {
            AppLogger.d(TAG) { "Atualizando jogo: $gameId (${updates.keys})" }

            firestore.collection(COLLECTION_GAMES)
                .document(gameId)
                .update(updates)
                .await()
        }
    }

    override suspend fun deleteGame(gameId: String): Result<Unit> {
        return suspendWithRetryResult(RetryPolicy.DEFAULT) {
            AppLogger.d(TAG) { "Deletando jogo: $gameId" }

            firestore.collection(COLLECTION_GAMES)
                .document(gameId)
                .delete()
                .await()
        }
    }

    // ========== GAME CONFIRMATIONS ==========

    override suspend fun getGameConfirmations(gameId: String): Result<List<GameConfirmation>> {
        return suspendWithRetryResult(RetryPolicy.DEFAULT) {
            AppLogger.d(TAG) { "Buscando confirmações do jogo: $gameId" }

            val snapshot = firestore.collection(COLLECTION_CONFIRMATIONS)
                .whereEqualTo("game_id", gameId)
                .get()
                .await()

            snapshot.toObjects(GameConfirmation::class.java)
        }
    }

    override fun getGameConfirmationsFlow(gameId: String): Flow<Result<List<GameConfirmation>>> = callbackFlow {
        AppLogger.d(TAG) { "Iniciando flow de confirmações: $gameId" }

        val listener = firestore.collection(COLLECTION_CONFIRMATIONS)
            .whereEqualTo("game_id", gameId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    AppLogger.e(TAG, "Erro no flow de confirmações", error)
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }

                if (snapshot != null) {
                    val confirmations = snapshot.toObjects(GameConfirmation::class.java)
                    trySend(Result.success(confirmations))
                }
            }

        awaitClose { listener.remove() }
    }

    override suspend fun confirmPresence(
        gameId: String,
        userId: String,
        userName: String,
        userPhoto: String?,
        position: String,
        isCasualPlayer: Boolean
    ): Result<GameConfirmation> {
        return suspendWithRetryResult(RetryPolicy.DEFAULT) {
            AppLogger.d(TAG) { "Confirmando presença: userId=$userId, gameId=$gameId" }

            val confirmation = GameConfirmation(
                gameId = gameId,
                userId = userId,
                userName = userName,
                userPhoto = userPhoto,
                position = position,
                status = ConfirmationStatus.CONFIRMED.name,
                isCasualPlayer = isCasualPlayer,
                confirmedAt = Date().time
            )

            val docRef = firestore.collection(COLLECTION_CONFIRMATIONS).document()
            val finalConfirmation = confirmation.copy(id = docRef.id)

            docRef.set(finalConfirmation).await()
            AppLogger.d(TAG) { "Presença confirmada: ${docRef.id}" }

            finalConfirmation
        }
    }

    override suspend fun cancelConfirmation(gameId: String, userId: String): Result<Unit> {
        return suspendWithRetryResult(RetryPolicy.DEFAULT) {
            AppLogger.d(TAG) { "Cancelando confirmação: userId=$userId, gameId=$gameId" }

            val snapshot = firestore.collection(COLLECTION_CONFIRMATIONS)
                .whereEqualTo("game_id", gameId)
                .whereEqualTo("user_id", userId)
                .get()
                .await()

            val batch = firestore.batch()
            snapshot.documents.forEach { doc ->
                batch.delete(doc.reference)
            }
            batch.commit().await()

            AppLogger.d(TAG) { "Confirmação cancelada: ${snapshot.size()} documentos removidos" }
        }
    }

    override suspend fun updatePaymentStatus(
        gameId: String,
        userId: String,
        isPaid: Boolean
    ): Result<Unit> {
        return suspendWithRetryResult(RetryPolicy.DEFAULT) {
            AppLogger.d(TAG) { "Atualizando pagamento: userId=$userId, gameId=$gameId, paid=$isPaid" }

            val snapshot = firestore.collection(COLLECTION_CONFIRMATIONS)
                .whereEqualTo("game_id", gameId)
                .whereEqualTo("user_id", userId)
                .get()
                .await()

            if (snapshot.isEmpty) {
                throw NoSuchElementException("Confirmação não encontrada")
            }

            val status = if (isPaid) PaymentStatus.PAID.name else PaymentStatus.PENDING.name
            val batch = firestore.batch()
            snapshot.documents.forEach { doc ->
                batch.update(doc.reference, "payment_status", status)
            }
            batch.commit().await()
        }
    }

    // ========== TEAMS ==========

    override suspend fun getGameTeams(gameId: String): Result<List<Team>> {
        return suspendWithRetryResult(RetryPolicy.DEFAULT) {
            AppLogger.d(TAG) { "Buscando times do jogo: $gameId" }

            val snapshot = firestore.collection(COLLECTION_TEAMS)
                .whereEqualTo("game_id", gameId)
                .get()
                .await()

            snapshot.toObjects(Team::class.java)
        }
    }

    override fun getGameTeamsFlow(gameId: String): Flow<Result<List<Team>>> = callbackFlow {
        AppLogger.d(TAG) { "Iniciando flow de times: $gameId" }

        val listener = firestore.collection(COLLECTION_TEAMS)
            .whereEqualTo("game_id", gameId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    AppLogger.e(TAG, "Erro no flow de times", error)
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }

                if (snapshot != null) {
                    val teams = snapshot.toObjects(Team::class.java)
                    trySend(Result.success(teams))
                }
            }

        awaitClose { listener.remove() }
    }

    override suspend fun saveTeams(gameId: String, teams: List<Team>): Result<Unit> {
        return suspendWithRetryResult(RetryPolicy.DEFAULT) {
            AppLogger.d(TAG) { "Salvando ${teams.size} times para o jogo: $gameId" }

            val batch = firestore.batch()

            teams.forEach { team ->
                val docRef = firestore.collection(COLLECTION_TEAMS).document()
                val teamWithId = team.copy(id = docRef.id, gameId = gameId)
                batch.set(docRef, teamWithId)
            }

            batch.commit().await()
            AppLogger.d(TAG) { "Times salvos com sucesso" }
        }
    }

    override suspend fun clearGameTeams(gameId: String): Result<Unit> {
        return suspendWithRetryResult(RetryPolicy.DEFAULT) {
            AppLogger.d(TAG) { "Removendo times do jogo: $gameId" }

            val snapshot = firestore.collection(COLLECTION_TEAMS)
                .whereEqualTo("game_id", gameId)
                .get()
                .await()

            val batch = firestore.batch()
            snapshot.documents.forEach { doc ->
                batch.delete(doc.reference)
            }
            batch.commit().await()

            AppLogger.d(TAG) { "Times removidos: ${snapshot.size()} documentos" }
        }
    }

    // ========== STATISTICS ==========

    override suspend fun getUserStatistics(userId: String): Result<UserStatistics> {
        return suspendWithRetryResult(RetryPolicy.DEFAULT) {
            AppLogger.d(TAG) { "Buscando estatísticas do usuário: $userId" }

            val doc = firestore.collection(COLLECTION_STATISTICS)
                .document(userId)
                .get()
                .await()

            if (!doc.exists()) {
                // Retornar estatísticas vazias se não existir
                return@suspendWithRetryResult UserStatistics(id = userId)
            }

            doc.toObject(UserStatistics::class.java)
                ?: UserStatistics(id = userId)
        }
    }

    override fun getUserStatisticsFlow(userId: String): Flow<Result<UserStatistics>> = callbackFlow {
        AppLogger.d(TAG) { "Iniciando flow de estatísticas: $userId" }

        val listener = firestore.collection(COLLECTION_STATISTICS)
            .document(userId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    AppLogger.e(TAG, "Erro no flow de estatísticas", error)
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }

                if (snapshot != null && snapshot.exists()) {
                    val stats = snapshot.toObject(UserStatistics::class.java)
                        ?: UserStatistics(id = userId)
                    trySend(Result.success(stats))
                } else {
                    // Estatísticas vazias se não existir
                    trySend(Result.success(UserStatistics(id = userId)))
                }
            }

        awaitClose { listener.remove() }
    }

    override suspend fun updateUserStatistics(userId: String, updates: Map<String, Any>): Result<Unit> {
        return suspendWithRetryResult(RetryPolicy.DEFAULT) {
            AppLogger.d(TAG) { "Atualizando estatísticas: $userId (${updates.keys})" }

            firestore.collection(COLLECTION_STATISTICS)
                .document(userId)
                .set(updates, SetOptions.merge())
                .await()
        }
    }

    // ========== RANKING ==========

    override suspend fun getRanking(
        category: String,
        orderByField: String,
        limit: Int
    ): Result<List<DocumentSnapshot>> {
        return suspendWithRetryResult(RetryPolicy.DEFAULT) {
            AppLogger.d(TAG) { "Buscando ranking: category=$category, field=$orderByField" }

            val collection = if (category == "XP") COLLECTION_USERS else COLLECTION_STATISTICS

            val snapshot = firestore.collection(collection)
                .orderBy(orderByField, Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            snapshot.documents
        }
    }

    override suspend fun getRankingDeltas(
        period: String,
        periodKey: String,
        orderByField: String,
        limit: Int
    ): Result<List<DocumentSnapshot>> {
        return suspendWithRetryResult(RetryPolicy.DEFAULT) {
            AppLogger.d(TAG) { "Buscando deltas: period=$period, key=$periodKey" }

            val snapshot = firestore.collection(COLLECTION_RANKING_DELTAS)
                .whereEqualTo("period", period)
                .whereEqualTo("period_key", periodKey)
                .orderBy(orderByField, Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            snapshot.documents
        }
    }

    override suspend fun getUserXpLogs(userId: String, limit: Int): Result<List<XpLog>> {
        return suspendWithRetryResult(RetryPolicy.DEFAULT) {
            AppLogger.d(TAG) { "Buscando logs de XP: $userId" }

            val snapshot = firestore.collection(COLLECTION_XP_LOGS)
                .whereEqualTo("user_id", userId)
                .orderBy("created_at", Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()

            snapshot.toObjects(XpLog::class.java)
        }
    }

    // ========== USERS ==========

    override suspend fun getUserById(userId: String): Result<User> {
        return suspendWithRetryResult(RetryPolicy.DEFAULT) {
            AppLogger.d(TAG) { "Buscando usuário: $userId" }

            val doc = firestore.collection(COLLECTION_USERS)
                .document(userId)
                .get()
                .await()

            if (!doc.exists()) {
                throw NoSuchElementException("Usuário não encontrado: $userId")
            }

            doc.toObject(User::class.java)
                ?: throw IllegalStateException("Erro ao converter usuário")
        }
    }

    override suspend fun getUsersByIds(userIds: List<String>): Result<List<User>> {
        return suspendWithRetryResult(RetryPolicy.DEFAULT) {
            AppLogger.d(TAG) { "Buscando ${userIds.size} usuários em batch" }

            if (userIds.isEmpty()) {
                return@suspendWithRetryResult emptyList()
            }

            // Busca paralela em chunks de 10 (limite do whereIn)
            BatchOperationHelper.parallelWhereIn(
                collection = firestore.collection(COLLECTION_USERS),
                ids = userIds,
                mapper = { doc -> doc.toObject(User::class.java) }
            )
        }
    }

    override suspend fun getCurrentUser(): Result<User> {
        val userId = auth.currentUser?.uid
            ?: return Result.failure(IllegalStateException("Usuário não autenticado"))

        return getUserById(userId)
    }

    override suspend fun updateUser(userId: String, updates: Map<String, Any>): Result<Unit> {
        return suspendWithRetryResult(RetryPolicy.DEFAULT) {
            AppLogger.d(TAG) { "Atualizando usuário: $userId (${updates.keys})" }

            firestore.collection(COLLECTION_USERS)
                .document(userId)
                .update(updates)
                .await()
        }
    }

    override suspend fun searchUsers(query: String, limit: Int): Result<List<User>> {
        return suspendWithRetryResult(RetryPolicy.DEFAULT) {
            // Validacao de input para prevenir queries malformadas
            val sanitizedQuery = query
                .trim()
                .take(MAX_SEARCH_QUERY_LENGTH) // Limita comprimento
                .replace(Regex("[\\p{Cc}\\p{Cf}]"), "") // Remove caracteres de controle

            AppLogger.d(TAG) { "Pesquisando usuários: query='$sanitizedQuery'" }

            val snapshot = if (sanitizedQuery.isBlank()) {
                firestore.collection(COLLECTION_USERS)
                    .orderBy("name")
                    .limit(limit.toLong().coerceIn(1, MAX_SEARCH_RESULTS.toLong()))
                    .get()
                    .await()
            } else {
                firestore.collection(COLLECTION_USERS)
                    .orderBy("name")
                    .startAt(sanitizedQuery)
                    .endAt(sanitizedQuery + "\uf8ff")
                    .limit(limit.toLong().coerceIn(1, MAX_SEARCH_RESULTS.toLong()))
                    .get()
                    .await()
            }

            snapshot.toObjects(User::class.java)
        }
    }

    // ========== GROUPS ==========

    override suspend fun getUserGroups(userId: String): Result<List<UserGroup>> {
        return suspendWithRetryResult(RetryPolicy.DEFAULT) {
            AppLogger.d(TAG) { "Buscando grupos do usuário: $userId" }

            val snapshot = firestore.collection(COLLECTION_USER_GROUPS)
                .whereEqualTo("user_id", userId)
                .whereEqualTo("is_active", true)
                .get()
                .await()

            snapshot.toObjects(UserGroup::class.java)
        }
    }

    override fun getUserGroupsFlow(userId: String): Flow<Result<List<UserGroup>>> = callbackFlow {
        AppLogger.d(TAG) { "Iniciando flow de grupos: $userId" }

        val listener = firestore.collection(COLLECTION_USER_GROUPS)
            .whereEqualTo("user_id", userId)
            .whereEqualTo("is_active", true)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    AppLogger.e(TAG, "Erro no flow de grupos", error)
                    trySend(Result.failure(error))
                    return@addSnapshotListener
                }

                if (snapshot != null) {
                    val groups = snapshot.toObjects(UserGroup::class.java)
                    trySend(Result.success(groups))
                }
            }

        awaitClose { listener.remove() }
    }

    override suspend fun getGroupById(groupId: String): Result<UserGroup> {
        return suspendWithRetryResult(RetryPolicy.DEFAULT) {
            AppLogger.d(TAG) { "Buscando grupo: $groupId" }

            val doc = firestore.collection(COLLECTION_GROUPS)
                .document(groupId)
                .get()
                .await()

            if (!doc.exists()) {
                throw NoSuchElementException("Grupo não encontrado: $groupId")
            }

            doc.toObject(UserGroup::class.java)
                ?: throw IllegalStateException("Erro ao converter grupo")
        }
    }

    // ========== UTILITY ==========

    override suspend fun <T> runTransaction(block: suspend () -> T): Result<T> {
        return suspendWithRetryResult(RetryPolicy.CONSERVATIVE) {
            block()
        }
    }

    override suspend fun executeBatch(operations: List<BatchOperation>): Result<Unit> {
        return suspendWithRetryResult(RetryPolicy.DEFAULT) {
            AppLogger.d(TAG) { "Executando batch com ${operations.size} operações" }

            val batch = firestore.batch()

            operations.forEach { operation ->
                when (operation) {
                    is BatchOperation.Set -> {
                        val ref = firestore.collection(operation.collection)
                            .document(operation.documentId)
                        batch.set(ref, operation.data)
                    }
                    is BatchOperation.Update -> {
                        val ref = firestore.collection(operation.collection)
                            .document(operation.documentId)
                        batch.update(ref, operation.updates)
                    }
                    is BatchOperation.Delete -> {
                        val ref = firestore.collection(operation.collection)
                            .document(operation.documentId)
                        batch.delete(ref)
                    }
                }
            }

            batch.commit().await()
            AppLogger.d(TAG) { "Batch executado com sucesso" }
        }
    }
}
